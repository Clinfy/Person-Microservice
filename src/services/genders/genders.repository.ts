import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GenderEntity } from 'src/entities/gender.entity';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';
import { IGender } from 'src/interfaces/gender.interface';

@Injectable()
export class GenderRepository {
  constructor(
    @InjectRepository(GenderEntity)
    private readonly ormRepository: Repository<GenderEntity>,
  ) {}

  async save(gender: GenderEntity): Promise<GenderEntity> {
    return await this.ormRepository.save(gender);
  }

  create(gender: Partial<GenderEntity>): GenderEntity {
    return this.ormRepository.create(gender);
  }

  async merge(gender: GenderEntity, changes: Partial<GenderEntity>): Promise<GenderEntity> {
    return this.ormRepository.merge(gender, changes);
  }

  async findOneById(id: string): Promise<GenderEntity | null> {
    return await this.ormRepository.findOneBy({ id });
  }

  async findAll(query: PaginationQueryDto): Promise<[GenderEntity[], number]> {
    const { page, limit } = query;
    return await this.ormRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { code: 'ASC' },
    });
  }

  async findAllForDetails(): Promise<IGender[]> {
    return await this.ormRepository.createQueryBuilder('gender')
      .select('gender.id', 'id')
      .addSelect('gender.display_name', 'name')
      .orderBy('gender.display_name', 'ASC')
      .getRawMany<IGender>();
  }

  async remove(gender: GenderEntity): Promise<void> {
    await this.ormRepository.remove(gender);
  }
}
