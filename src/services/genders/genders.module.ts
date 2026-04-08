import { Module } from '@nestjs/common';
import { GendersController } from './genders.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenderEntity } from 'src/entities/gender.entity';
import { GendersService } from 'src/services/genders/genders.service';
import { GenderRepository } from 'src/services/genders/genders.repository';

@Module({
  imports: [TypeOrmModule.forFeature([GenderEntity])],
  controllers: [GendersController],
  providers: [GendersService, GenderRepository],
  exports: [GendersService],
})
export class GendersModule {}
