import { Module } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { PersonsController } from './persons.controller';
import { PersonsConsumer } from './persons.consumer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonEntity } from 'src/entities/person.entity';
import { GeorefModule } from 'src/clients/georef/georef.module';
import { PersonsRepository } from 'src/services/persons/persons.repository';
import { GendersModule } from 'src/services/genders/genders.module';

@Module({
  imports: [TypeOrmModule.forFeature([PersonEntity]), GeorefModule, GendersModule],
  controllers: [PersonsController, PersonsConsumer],
  providers: [PersonsService, PersonsRepository],
})
export class PersonsModule {}
