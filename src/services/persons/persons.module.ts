import { Module } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { PersonsController } from './persons.controller';
import { PersonsConsumer } from './persons.consumer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonEntity } from 'src/entities/person.entity';
import { PersonsRepository } from 'src/services/persons/persons.repository';
import { GendersModule } from 'src/services/genders/genders.module';
import { GeoapifyModule } from 'src/clients/geoapify/geoapify.module';

@Module({
  imports: [TypeOrmModule.forFeature([PersonEntity]), GeoapifyModule, GendersModule],
  controllers: [PersonsController, PersonsConsumer],
  providers: [PersonsService, PersonsRepository],
  exports: [PersonsRepository, PersonsService],
})
export class PersonsModule {}
