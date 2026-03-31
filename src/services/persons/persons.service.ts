import { HttpStatus, Injectable } from '@nestjs/common';
import { PersonsRepository } from 'src/services/persons/persons.repository';
import { GeorefService } from 'src/clients/georef/georef.service';
import { CreatePersonDto } from 'src/interfaces/dto/person.dto';
import { PersonEntity } from 'src/entities/person.entity';
import { GendersService } from 'src/services/genders/genders.service';
import { RequestContextService } from 'src/common/context/request-context.service';
import { PersonErrorCodes, PersonException } from 'src/services/persons/persons.exception';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';

@Injectable()
export class PersonsService {
  constructor(
    private readonly personsRepository: PersonsRepository,
    private readonly georefService: GeorefService,
    private readonly gendersService: GendersService,
    private readonly contextService: RequestContextService,
  ) {}

  async create(dto: CreatePersonDto): Promise<PersonEntity> {
    try {
      const address = await this.georefService.normalizeAddress(dto.address);
      const gender = await this.gendersService.findOneById(dto.gender);

      return await this.personsRepository.save(
        this.personsRepository.create({
          ...dto,
          gender,
          address,
          created_by: this.contextService.getCurrentUser(),
        }),
      );
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

async findAll(query: PaginationQueryDto): Promise<PaginatedResponseDto<PersonEntity>> {
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
}
