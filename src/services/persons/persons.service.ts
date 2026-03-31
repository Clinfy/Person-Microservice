import { Injectable } from '@nestjs/common';
import { PersonsRepository } from 'src/services/persons/persons.repository';
import { GeorefService } from 'src/clients/georef/georef.service';

@Injectable()
export class PersonsService {
  constructor(
    private readonly personsRepository: PersonsRepository,
    private readonly georefService: GeorefService,
  ) {}
}
