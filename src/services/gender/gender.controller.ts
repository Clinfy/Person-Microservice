import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GendersService } from 'src/services/gender/gender.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';
import { CreateGenderDto } from 'src/interfaces/dto/gender.dto';
import { GenderEntity } from 'src/entities/gender.entity';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';

@Controller('genders')
export class GendersController {
  constructor(private readonly genderService: GendersService) {}

  @UseGuards(AuthGuard)
  @EndpointKey('genders.create')
  @Post('create')
  create(@Body() dto: CreateGenderDto): Promise<GenderEntity> {
    return this.genderService.create(dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('genders.update')
  @Patch('edit/:id')
  edit (@Param('id') id: string, @Body() dto: CreateGenderDto): Promise<GenderEntity> {
    return this.genderService.edit(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('genders.delete')
  @Delete('delete/:id')
  delete (@Param('id') id: string): Promise<{message: string}> {
    return this.genderService.delete(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('genders.find')
  @Get('find/:id')
  findOne (@Param('id') id: string): Promise<GenderEntity> {
    return this.genderService.findOneById(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('genders.find')
  @Get('all')
  findAll (@Query() query: PaginationQueryDto): Promise<PaginatedResponseDto<GenderEntity>> {
    return this.genderService.findAll(query);
  }


}
