import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { GendersService } from 'src/services/gender/gender.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';
import { CreateGenderDto } from 'src/interfaces/dto/gender.dto';
import { GenderEntity } from 'src/entities/gender.entity';

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

}
