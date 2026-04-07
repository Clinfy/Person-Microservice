import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PersonEntity } from 'src/entities/person.entity';
import { PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';

@Injectable()
export class PersonsRepository {
  constructor(
    @InjectRepository(PersonEntity)
    private readonly ormRepository: Repository<PersonEntity>,
  ) {}

  async save(person: PersonEntity): Promise<PersonEntity> {
    return await this.ormRepository.save(person);
  }

  create(person: Partial<PersonEntity>): PersonEntity {
    return this.ormRepository.create(person);
  }

  async merge(person: PersonEntity, changes: Partial<PersonEntity>): Promise<PersonEntity> {
    return this.ormRepository.merge(person, changes);
  }

  async personalIdExists(personalId: string): Promise<boolean> {
    return await this.ormRepository.existsBy({ personal_id: personalId });
  }

  async findOneById(id: string): Promise<PersonEntity | null> {
    return await this.ormRepository.findOneBy({ id });
  }

  async findOneByPersonalId(personalId: string): Promise<PersonEntity | null> {
    return await this.ormRepository.findOneBy({ personal_id: personalId });
  }

  async findAll(query: PaginationQueryDto): Promise<[PersonEntity[], number]> {
    const { page, limit } = query;
    return await this.ormRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { contact_email: 'ASC' },
    });
  }

  async findByIds(ids: string[]): Promise<PersonEntity[]> {
    return await this.ormRepository.findBy({ id: In(ids) });
  }

  async findAllForCache(page: number, limit: number): Promise<{ data: PersonEntity[]; total: number }> {
    const [data, total] = await this.ormRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      relations: { gender: true },
    });
    return { data, total };
  }
}
