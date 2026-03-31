import { Controller } from '@nestjs/common';
import { PersonsService } from 'src/services/persons/persons.service';

@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}
}
