import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { PersonsService } from 'src/services/persons/persons.service';
import { IPerson } from 'src/interfaces/person.interface';
import { BatchPersonDetailsDto } from 'src/interfaces/dto/person.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';

@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}


  @UseGuards(AuthGuard)
  @EndpointKey('persons.details')
  @Get(':id/details')
  async getPersonDetails(@Param('id', ParseUUIDPipe) id: string): Promise<IPerson> {
    return this.personsService.getPersonDetails(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('persons.details')
  @Post('details/batch')
  async getBatchPersonDetails(@Body() dto: BatchPersonDetailsDto): Promise<Record<string, IPerson>> {
    return this.personsService.getBatchPersonDetails(dto.ids);
  }
}
