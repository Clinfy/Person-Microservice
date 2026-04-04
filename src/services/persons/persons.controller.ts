import { Body, Controller, Get, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PersonsService } from 'src/services/persons/persons.service';
import { PersonErrorCodes, PersonException } from 'src/services/persons/persons.exception';
import { IPerson } from 'src/interfaces/person.interface';
import { BatchPersonDetailsDto } from 'src/interfaces/dto/person.dto';

@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get(':id/details')
  async getPersonDetails(@Param('id', ParseUUIDPipe) id: string): Promise<IPerson> {
    const person = await this.personsService.getPersonDetails(id);
    if (!person) throw new PersonException('Person not found', PersonErrorCodes.PERSON_NOT_FOUND, HttpStatus.NOT_FOUND);
    return person;
  }

  @Post('details/batch')
  async getBatchPersonDetails(@Body() dto: BatchPersonDetailsDto): Promise<Record<string, IPerson>> {
    return this.personsService.getBatchPersonDetails(dto.ids);
  }
}
