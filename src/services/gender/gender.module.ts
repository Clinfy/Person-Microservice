import { Module } from '@nestjs/common';
import { GenderController } from './gender.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenderEntity } from 'src/entities/gender.entity';
import { GenderService } from 'src/services/gender/gender.service';
import { GenderRepository } from 'src/services/gender/gender.repository';

@Module({
  imports: [TypeOrmModule.forFeature([GenderEntity])],
  controllers: [GenderController],
  providers: [GenderService, GenderRepository],
  exports: [GenderService],
})
export class GenderModule {}
