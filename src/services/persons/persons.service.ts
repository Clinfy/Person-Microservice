import { HttpStatus, Injectable } from '@nestjs/common';
import { PersonsRepository } from 'src/services/persons/persons.repository';
import { GeorefService } from 'src/clients/georef/georef.service';
import { CreatePersonDto } from 'src/interfaces/dto/person.dto';
import { PersonEntity } from 'src/entities/person.entity';
import { GendersService } from 'src/services/genders/genders.service';
import { RequestContextService } from 'src/common/context/request-context.service';
import { PersonErrorCodes, PersonException } from 'src/services/persons/persons.exception';

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
}
