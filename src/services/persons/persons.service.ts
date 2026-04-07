import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PersonsRepository } from 'src/services/persons/persons.repository';
import { GeorefService } from 'src/clients/georef/georef.service';
import {
  AssignPersonRoleDto,
  CreatePersonDto,
  PatchPersonDto,
  PatchPersonGenderDto,
  PatchPersonIdDto,
} from 'src/interfaces/dto/person.dto';
import { PersonEntity } from 'src/entities/person.entity';
import { GendersService } from 'src/services/genders/genders.service';
import { RequestContextService } from 'src/common/context/request-context.service';
import { PersonErrorCodes, PersonException } from 'src/services/persons/persons.exception';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { serializeError } from 'src/common/utils/logger-format.util';
import { RedisService } from 'src/common/redis/redis.service';
import { IPerson } from 'src/interfaces/person.interface';
import { differenceInYears } from 'date-fns';
import { AddressDto } from 'src/interfaces/dto/address.dto';

@Injectable()
export class PersonsService implements OnModuleInit {
  constructor(
    private readonly personsRepository: PersonsRepository,
    private readonly georefService: GeorefService,
    private readonly gendersService: GendersService,
    private readonly contextService: RequestContextService,
    private readonly redisService: RedisService,

    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.warmUpCache();
    } catch (error) {
      this.logger.error('Failed to warm up cache', {
        context: 'PersonsService',
        operation: 'onModuleInit',
        error: serializeError(error),
      });
    }
  }

  async create(dto: CreatePersonDto): Promise<PersonEntity> {
    try {
      const address = await this.georefService.normalizeAddress(dto.address);
      const gender = await this.gendersService.findOneById(dto.gender);

      const person = await this.personsRepository.save(
        this.personsRepository.create({
          ...dto,
          gender,
          address,
          created_by: this.contextService.getCurrentUser(),
        }),
      );

      await this.loadPersonToRedis(person);
      return person;
    } catch (error) {
      throw new PersonException(
        'Person creation failed',
        PersonErrorCodes.PERSON_CREATION_FAILED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async findOneById(id: string): Promise<PersonEntity> {
    const person = await this.personsRepository.findOneById(id);
    if (person) return person;
    throw new PersonException('Person not found', PersonErrorCodes.PERSON_NOT_FOUND, HttpStatus.NOT_FOUND);
  }

  async findOneByPersonalId(personalId: string): Promise<PersonEntity> {
    const person = await this.personsRepository.findOneByPersonalId(personalId);
    if (person) return person;
    throw new PersonException('Person not found', PersonErrorCodes.PERSON_NOT_FOUND, HttpStatus.NOT_FOUND);
  }

  async findAll(query: PaginationQueryDto = new PaginationQueryDto()): Promise<PaginatedResponseDto<PersonEntity>> {
    try {
      const [data, total] = await this.personsRepository.findAll(query);
      return new PaginatedResponseDto(data, total, query.page, query.limit);
    } catch (error) {
      throw new PersonException(
        'Persons not found',
        error.status ?? PersonErrorCodes.PERSON_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        error,
      );
    }
  }

  async updatePersonalData(id: string, dto: PatchPersonDto): Promise<PersonEntity> {
    const person = await this.findOneById(id);
    const updated = await this.personsRepository.save(await this.personsRepository.merge(person, dto));
    await this.invalidatePersonCache(id);
    await this.loadPersonToRedis(updated);
    return updated;
  }

  async updatePersonGender(id: string, dto: PatchPersonGenderDto): Promise<PersonEntity> {
    const person = await this.findOneById(id);
    const newGender = await this.gendersService.findOneById(dto.gender);

    const updated = await this.personsRepository.save(await this.personsRepository.merge(person, { gender: newGender }));

    await this.invalidatePersonCache(id);
    await this.loadPersonToRedis(updated);
    return updated;
  }

  async updatePersonalId(id: string, dto: PatchPersonIdDto): Promise<PersonEntity> {
    const person = await this.findOneById(id);
    const updated = await this.personsRepository.save(
      await this.personsRepository.merge(person, { personal_id: dto.personal_id }),
    );

    await this.invalidatePersonCache(id);
    await this.loadPersonToRedis(updated);
    return updated;
  }

  async updatePersonAddress(id: string, dto: AddressDto): Promise<PersonEntity> {
    const person = await this.findOneById(id);
    const newAddress = await this.georefService.normalizeAddress(dto);

    const updated = await this.personsRepository.save(await this.personsRepository.merge(person, { address: newAddress }));

    await this.invalidatePersonCache(id);
    await this.loadPersonToRedis(updated);
    return updated;
  }

  async updateRoles(dto: AssignPersonRoleDto): Promise<void> {
    try {
      const person = await this.findOneById(dto.person_id);

      if (dto.role === 'employee') person.is_employee = true;
      if (dto.role === 'patient') person.is_patient = true;

      await this.personsRepository.save(person);
    } catch (error) {
      if (error instanceof PersonException && error.getErrorCode() === PersonErrorCodes.PERSON_NOT_FOUND) {
        this.logger.warn('Person not found during role assignment — discarding message', {
          context: 'PersonsService',
          operation: 'updateRoles',
          person_id: dto.person_id,
          role: dto.role,
          error: serializeError(error),
        });
        return;
      }
      throw new PersonException(
        'Failed to update person roles',
        PersonErrorCodes.PERSON_UPDATE_ROLES_FAILED,
        HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async getPersonDetails(id: string): Promise<IPerson> {
    try {
      const cached = await this.redisService.raw.get(this.redisKey(id));
      if (cached) return JSON.parse(cached) as IPerson;

      const entity = await this.findOneById(id);
      await this.loadPersonToRedis(entity);
      return this.generatePersonInterface(entity);
    } catch (error) {
      this.logger.error('Failed to get person details', {
        context: 'PersonsService',
        operation: 'getPersonDetails',
        person_id: id,
        error: serializeError(error),
      });
      throw new PersonException('Person not found', PersonErrorCodes.PERSON_NOT_FOUND, HttpStatus.NOT_FOUND, error);
    }
  }

  async getBatchPersonDetails(ids: string[]): Promise<Record<string, IPerson>> {
    const result: Record<string, IPerson> = {};

    const cached = await Promise.all(ids.map((id) => this.redisService.raw.get(this.redisKey(id))));

    const misses: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const hit = cached[i];
      if (hit === null) {
        misses.push(ids[i]);
      } else {
        result[ids[i]] = JSON.parse(hit) as IPerson;
      }
    }

    if (misses.length > 0) {
      try {
        const entities = await this.personsRepository.findByIds(misses);
        for (const entity of entities) {
          result[entity.id] = this.generatePersonInterface(entity);
        }
      } catch (error) {
        this.logger.warn('Failed to fetch persons during batch details fetch', {
          context: 'PersonsService',
          operation: 'getBatchPersonDetails',
          person_ids: misses,
          error: serializeError(error),
        });
      }
    }

    return result;
  }

  private async warmUpCache(): Promise<void> {
    const pageSize = 100;
    let page = 1;
    let fetched = 0;
    let total: number;

    try {
      do {
        const result = await this.personsRepository.findAllForCache(page, pageSize);
        total = result.total;

        if (result.data.length === 0) break;

        const multi = this.redisService.raw.multi();
        const ids: string[] = [];

        for (const person of result.data) {
          multi.set(this.redisKey(person.id), JSON.stringify(this.generatePersonInterface(person)), { EX: 86400 });
          ids.push(person.id);
        }

        if (ids.length > 0) {
          multi.sAdd('persons', ids);
        }

        await multi.exec();

        fetched += result.data.length;
        page++;
      } while (fetched < total);
    } catch (error) {
      this.logger.error('Failed to warm up cache', {
        context: 'PersonsService',
        operation: 'warmUpCache',
        error: serializeError(error),
      });
    }
  }

  private async loadPersonToRedis(person: PersonEntity): Promise<void> {
    try {
      const multi = this.redisService.raw.multi();
      multi.set(this.redisKey(person.id), JSON.stringify(this.generatePersonInterface(person)), { EX: 86400 });
      multi.sAdd('persons', person.id);
      await multi.exec();
    } catch (error) {
      this.logger.error('Failed to load person to Redis', {
        context: 'PersonsService',
        operation: 'loadPersonToRedis',
        person_id: person.id,
        error: serializeError(error),
      });
    }
  }

  private async invalidatePersonCache(id: string): Promise<void> {
    try {
      const multi = this.redisService.raw.multi();
      multi.del(this.redisKey(id));
      multi.sRem('persons', id);
      await multi.exec();
    } catch (error) {
      this.logger.error('Failed to invalidate person cache', {
        context: 'PersonsService',
        operation: 'invalidatePersonCache',
        person_id: id,
        error: serializeError(error),
      });
    }
  }

  private redisKey(id: string): string {
    return `person:${id}`;
  }

  private generatePersonInterface(person: PersonEntity): IPerson {
    return {
      first_name: person.first_name,
      last_name: person.last_name,
      personal_id: person.personal_id,
      gender: person.gender.display_name,
      birth_date: person.birth_date,
      age: differenceInYears(new Date(), person.birth_date),
      contact_email: person.contact_email,
      contact_phone: person.contact_phone,
      address: person.address,
    };
  }
}
