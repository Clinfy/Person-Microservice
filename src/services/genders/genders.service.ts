import { HttpStatus, Injectable } from '@nestjs/common';
import { GenderRepository } from 'src/services/genders/genders.repository';
import { CreateGenderDto, PatchGenderDto } from 'src/interfaces/dto/gender.dto';
import { GenderEntity } from 'src/entities/gender.entity';
import { GenderErrorCodes, GenderException } from 'src/services/genders/genders.exception';
import { RequestContextService } from 'src/common/context/request-context.service';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';
import { IGender } from 'src/interfaces/gender.interface';

@Injectable()
export class GendersService {
  constructor(
    private readonly genderRepository: GenderRepository,
    private readonly contextService: RequestContextService,
  ) {}

  async create(dto: CreateGenderDto): Promise<GenderEntity> {
    try {
      return await this.genderRepository.save(
        this.genderRepository.create({
          ...dto,
          created_by: this.contextService.getCurrentUser(),
        }),
      );
    } catch (error) {
      throw new GenderException(
        'Gender creation failed',
        GenderErrorCodes.GENDER_NOT_CREATED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async edit(id: string, dto: PatchGenderDto): Promise<GenderEntity> {
    try {
      const gender = await this.findOneById(id);
      return await this.genderRepository.save(await this.genderRepository.merge(gender, dto));
    } catch (error) {
      throw new GenderException(
        'Gender update failed',
        GenderErrorCodes.GENDER_NOT_UPDATED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    try {
      const gender = await this.findOneById(id);
      await this.genderRepository.remove(gender);
      return { message: `Gender ${gender.display_name} (${gender.code}) deleted successfully` };
    } catch (error) {
      throw new GenderException(
        'Gender deletion failed',
        GenderErrorCodes.GENDER_NOT_DELETED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async getGendersDetails(): Promise<IGender[]> {
    const genders = await this.genderRepository.findAllForDetails();
    return genders.map((gender) => this.generateGenderInterface(gender));
  }

  async findOneById(id: string): Promise<GenderEntity> {
    const gender = await this.genderRepository.findOneById(id);

    if (gender) return gender;

    throw new GenderException('Gender not found', GenderErrorCodes.GENDER_NOT_FOUND, HttpStatus.NOT_FOUND);
  }

  async findAll(query: PaginationQueryDto = new PaginationQueryDto()): Promise<PaginatedResponseDto<GenderEntity>> {
    try {
      const [data, total] = await this.genderRepository.findAll(query);
      return new PaginatedResponseDto(data, total, query.page, query.limit);
    } catch (error) {
      throw new GenderException(
        'Genders not found',
        GenderErrorCodes.GENDER_NOT_FOUND,
        error.status ?? HttpStatus.NOT_FOUND,
        error,
      );
    }
  }

  private generateGenderInterface(gender: GenderEntity): IGender {
    return {
      id: gender.id,
      name: gender.display_name,
    };
  }
}
