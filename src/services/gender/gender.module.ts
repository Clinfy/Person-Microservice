import { Module } from '@nestjs/common';
import { GendersController } from './gender.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenderEntity } from 'src/entities/gender.entity';
import { GendersService } from 'src/services/gender/gender.service';
import { GenderRepository } from 'src/services/gender/gender.repository';

@Module({
  imports: [TypeOrmModule.forFeature([GenderEntity])],
  controllers: [GendersController],
  providers: [GendersService, GenderRepository],
  exports: [GendersService],
})
export class GendersModule {}
