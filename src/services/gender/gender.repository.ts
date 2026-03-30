import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GenderEntity } from 'src/entities/gender.entity';
import { Repository } from 'typeorm';

@Injectable()
export class GenderRepository {
  constructor(
    @InjectRepository(GenderEntity)
    private readonly ormRepository: Repository<GenderEntity>,
  ) {}

  async save(gender: GenderEntity): Promise<GenderEntity> {
    return await this.ormRepository.save(gender);
  }

  create (gender: Partial<GenderEntity>): GenderEntity {
    return this.ormRepository.create(gender);
  }

  async merge(gender: GenderEntity, changes: Partial<GenderEntity>): Promise<GenderEntity> {
    return this.ormRepository.merge(gender, changes);
  }

  async findOneById(id: string): Promise<GenderEntity | null> {
    return await this.ormRepository.findOneBy({ id });
  }

  async remove(gender: GenderEntity): Promise<void> {
    await this.ormRepository.remove(gender);
  }
}