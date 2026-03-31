import { HttpStatus, Injectable } from '@nestjs/common';
import { GenderRepository } from 'src/services/gender/gender.repository';
import { CreateGenderDto } from 'src/interfaces/dto/gender.dto';
import { GenderEntity } from 'src/entities/gender.entity';
import { GenderErrorCodes, GenderException } from 'src/services/gender/gender.exception';
import { RequestContextService } from 'src/common/context/request-context.service';

@Injectable()
export class GenderService {
  constructor(
    private readonly genderRepository: GenderRepository,
    private readonly contextService: RequestContextService,
  ) {}

  async create(dto: CreateGenderDto): Promise<GenderEntity> {
    try {
      return this.genderRepository.save(
        this.genderRepository.create({
          ...dto,
          created_by: this.contextService.getCurrentUser()
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
}
