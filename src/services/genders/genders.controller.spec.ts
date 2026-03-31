import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { GendersController } from './genders.controller';
import { GendersService } from './genders.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { GenderEntity } from 'src/entities/gender.entity';
import { GenderErrorCodes, GenderException } from './genders.exception';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';
import { CreateGenderDto, PatchGenderDto } from 'src/interfaces/dto/gender.dto';

/** Always-allow guard stub used to bypass AuthGuard in unit tests. */
const mockAuthGuard = { canActivate: (_ctx: ExecutionContext) => true };

const buildGender = (overrides: Partial<GenderEntity> = {}): GenderEntity =>
  ({
    id: 'gender-uuid-1',
    code: 'male',
    display_name: 'Male',
    persons: [],
    created_at: new Date('2024-01-01'),
    created_by: null,
    updated_at: new Date('2024-01-01'),
    ...overrides,
  }) as GenderEntity;

describe('GendersController', () => {
  let controller: GendersController;
  let service: jest.Mocked<GendersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GendersController],
      providers: [
        {
          provide: GendersService,
          useValue: {
            create: jest.fn(),
            edit: jest.fn(),
            delete: jest.fn(),
            findOneById: jest.fn(),
            findAll: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<GendersController>(GendersController);
    service = module.get(GendersService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should delegate to service.create and return the result', async () => {
      const dto: CreateGenderDto = { code: 'male', display_name: 'Male' };
      const gender = buildGender();

      service.create.mockResolvedValue(gender);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(gender);
    });

    it('should propagate GenderException thrown by the service', async () => {
      const dto: CreateGenderDto = { code: 'male', display_name: 'Male' };

      service.create.mockRejectedValue(
        new GenderException('Gender creation failed', GenderErrorCodes.GENDER_NOT_CREATED, HttpStatus.INTERNAL_SERVER_ERROR),
      );

      await expect(controller.create(dto)).rejects.toThrow(GenderException);
    });
  });

  // ─── edit ────────────────────────────────────────────────────────────────────

  describe('edit', () => {
    it('should delegate to service.edit with id and dto, and return the result', async () => {
      const dto: PatchGenderDto = { display_name: 'Updated Male' } as PatchGenderDto;
      const updated = buildGender({ display_name: 'Updated Male' });

      service.edit.mockResolvedValue(updated);

      const result = await controller.edit('gender-uuid-1', dto);

      expect(service.edit).toHaveBeenCalledWith('gender-uuid-1', dto);
      expect(result).toEqual(updated);
    });

    it('should propagate GenderException when gender is not found', async () => {
      service.edit.mockRejectedValue(
        new GenderException('Gender not found', GenderErrorCodes.GENDER_NOT_FOUND, HttpStatus.NOT_FOUND),
      );

      await expect(controller.edit('non-existent', {} as PatchGenderDto)).rejects.toThrow(GenderException);
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delegate to service.delete and return the success message', async () => {
      const expected = { message: 'Gender Male (male) deleted successfully' };

      service.delete.mockResolvedValue(expected);

      const result = await controller.delete('gender-uuid-1');

      expect(service.delete).toHaveBeenCalledWith('gender-uuid-1');
      expect(result).toEqual(expected);
    });

    it('should propagate GenderException when gender is not found', async () => {
      service.delete.mockRejectedValue(
        new GenderException('Gender not found', GenderErrorCodes.GENDER_NOT_FOUND, HttpStatus.NOT_FOUND),
      );

      await expect(controller.delete('non-existent')).rejects.toThrow(GenderException);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should delegate to service.findOneById and return the gender', async () => {
      const gender = buildGender();

      service.findOneById.mockResolvedValue(gender);

      const result = await controller.findOne('gender-uuid-1');

      expect(service.findOneById).toHaveBeenCalledWith('gender-uuid-1');
      expect(result).toEqual(gender);
    });

    it('should propagate GenderException when gender is not found', async () => {
      service.findOneById.mockRejectedValue(
        new GenderException('Gender not found', GenderErrorCodes.GENDER_NOT_FOUND, HttpStatus.NOT_FOUND),
      );

      await expect(controller.findOne('non-existent')).rejects.toThrow(GenderException);
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should delegate to service.findAll and return a paginated response', async () => {
      const query: PaginationQueryDto = { page: 1, limit: 20 };
      const genders = [buildGender(), buildGender({ id: 'gender-uuid-2', code: 'female', display_name: 'Female' })];
      const paginated = new PaginatedResponseDto(genders, 2, 1, 20);

      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(paginated);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });

    it('should propagate GenderException when service fails', async () => {
      service.findAll.mockRejectedValue(
        new GenderException('Genders not found', GenderErrorCodes.GENDER_NOT_FOUND, HttpStatus.NOT_FOUND),
      );

      await expect(controller.findAll({ page: 1, limit: 20 })).rejects.toThrow(GenderException);
    });
  });
});
