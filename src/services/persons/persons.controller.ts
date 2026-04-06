import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PersonsService } from 'src/services/persons/persons.service';
import { IPerson } from 'src/interfaces/person.interface';
import {
  BatchPersonDetailsDto,
  CreatePersonDto,
  PatchPersonDto,
  PatchPersonGenderDto,
  PatchPersonIdDto,
} from 'src/interfaces/dto/person.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';
import { PersonEntity } from 'src/entities/person.entity';
import { AddressDto } from 'src/interfaces/dto/address.dto';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';

@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @UseGuards(AuthGuard)
  @EndpointKey('persons.create')
  @Post('new')
  create(@Body() dto: CreatePersonDto): Promise<PersonEntity> {
    return this.personsService.create(dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('persons.edit')
  @Patch('edit/details/:id')
  updatePersonalDetails(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PatchPersonDto): Promise<PersonEntity> {
    return this.personsService.updatePersonalData(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('persons.edit')
  @Patch('edit/gender/:id')
  updatePersonGender(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PatchPersonGenderDto): Promise<PersonEntity> {
    return this.personsService.updatePersonGender(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('persons.edit')
  @Patch('edit/dni/:id')
  updatePersonalId(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PatchPersonIdDto): Promise<PersonEntity> {
    return this.personsService.updatePersonalId(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('persons.edit')
  @Patch('edit/address/:id')
  updatePersonAddress(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddressDto): Promise<PersonEntity> {
    return this.personsService.updatePersonAddress(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('persons.find')
  @Patch('find/id/:id')
  findOneById(@Param('id', ParseUUIDPipe) id: string): Promise<PersonEntity> {
    return this.personsService.findOneById(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('persons.find')
  @Patch('find/dni/:dni')
  findOneByPersonalId(@Param('dni') dni: string): Promise<PersonEntity> {
    return this.personsService.findOneByPersonalId(dni);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('persons.find')
  @Patch('all')
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedResponseDto<PersonEntity>> {
    return this.personsService.findAll(query);
  }
  @UseGuards(AuthGuard)
  @EndpointKey('persons.details')
  @Get('details/:id')
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
