import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GenderService } from 'src/services/gender/gender.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';
import { CreateGenderDto } from 'src/interfaces/dto/gender.dto';
import { GenderEntity } from 'src/entities/gender.entity';

@Controller('gender')
export class GenderController {
  constructor(private readonly genderService: GenderService) {}

  @UseGuards(AuthGuard)
  @EndpointKey('gender.create')
  @Post('create')
  create(@Body() dto: CreateGenderDto): Promise<GenderEntity> {
    return this.genderService.create(dto);
  }
}
