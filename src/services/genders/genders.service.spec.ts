import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { GendersService } from './genders.service';
import { GenderRepository } from './genders.repository';
import { RequestContextService } from 'src/common/context/request-context.service';
import { GenderEntity } from 'src/entities/gender.entity';
import { GenderErrorCodes, GenderException } from './genders.exception';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';
import { CreateGenderDto, PatchGenderDto } from 'src/interfaces/dto/gender.dto';

const mockAuthUser = {
  id: 'user-1',
  person_id: 'person-1',
  email: 'test@example.com',
  session_id: 'session-1',
};

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

describe('GendersService', () => {
  let service: GendersService;
  let repository: jest.Mocked<GenderRepository>;
  let contextService: jest.Mocked<RequestContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GendersService,
        {
          provide: GenderRepository,
          useValue: {
            save: jest.fn(),
            create: jest.fn(),
            merge: jest.fn(),
            findOneById: jest.fn(),
            findAll: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: RequestContextService,
          useValue: {
            getCurrentUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GendersService>(GendersService);
    repository = module.get(GenderRepository);
    contextService = module.get(RequestContextService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return a gender entity', async () => {
      const dto: CreateGenderDto = { code: 'male', display_name: 'Male' };
      const newGender = buildGender({ created_by: mockAuthUser });

      contextService.getCurrentUser.mockReturnValue(mockAuthUser);
      repository.create.mockReturnValue(newGender);
      repository.save.mockResolvedValue(newGender);

      const result = await service.create(dto);

      expect(contextService.getCurrentUser).toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith({ ...dto, created_by: mockAuthUser });
      expect(repository.save).toHaveBeenCalledWith(newGender);
      expect(result).toEqual(newGender);
    });

    it('should throw GenderException when save fails', async () => {
      const dto: CreateGenderDto = { code: 'male', display_name: 'Male' };
      const dbError = Object.assign(new Error('DB failure'), { status: HttpStatus.INTERNAL_SERVER_ERROR });

      contextService.getCurrentUser.mockReturnValue(null);
      repository.create.mockReturnValue(buildGender());
      repository.save.mockRejectedValue(dbError);

      const error = await service.create(dto).catch((e) => e);

      expect(error).toBeInstanceOf(GenderException);
      expect(error.getErrorCode()).toBe(GenderErrorCodes.GENDER_NOT_CREATED);
      expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should use INTERNAL_SERVER_ERROR when cause has no status', async () => {
      const dto: CreateGenderDto = { code: 'male', display_name: 'Male' };

      contextService.getCurrentUser.mockReturnValue(null);
      repository.create.mockReturnValue(buildGender());
      repository.save.mockRejectedValue(new Error('no status'));

      const error = await service.create(dto).catch((e) => e);

      expect(error).toBeInstanceOf(GenderException);
      expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(error.getErrorCode()).toBe(GenderErrorCodes.GENDER_NOT_CREATED);
    });
  });

  // ─── edit ────────────────────────────────────────────────────────────────────

  describe('edit', () => {
    it('should merge and return the updated gender', async () => {
      const dto: PatchGenderDto = { display_name: 'Updated Male' } as PatchGenderDto;
      const existing = buildGender();
      const updated = buildGender({ display_name: 'Updated Male' });

      repository.findOneById.mockResolvedValue(existing);
      repository.merge.mockResolvedValue(updated);
      repository.save.mockResolvedValue(updated);

      const result = await service.edit('gender-uuid-1', dto);

      expect(repository.findOneById).toHaveBeenCalledWith('gender-uuid-1');
      expect(repository.merge).toHaveBeenCalledWith(existing, dto);
      expect(repository.save).toHaveBeenCalledWith(updated);
      expect(result).toEqual(updated);
    });

    it('should propagate GenderException when gender is not found', async () => {
      repository.findOneById.mockResolvedValue(null);

      await expect(service.edit('non-existent', {} as PatchGenderDto)).rejects.toThrow(GenderException);
    });

    it('should throw GenderException with GENDER_NOT_UPDATED when save fails', async () => {
      const existing = buildGender();
      const dbError = Object.assign(new Error('DB failure'), { status: HttpStatus.INTERNAL_SERVER_ERROR });

      repository.findOneById.mockResolvedValue(existing);
      repository.merge.mockResolvedValue(existing);
      repository.save.mockRejectedValue(dbError);

      const error = await service.edit('gender-uuid-1', {} as PatchGenderDto).catch((e) => e);

      expect(error).toBeInstanceOf(GenderException);
      expect(error.getErrorCode()).toBe(GenderErrorCodes.GENDER_NOT_UPDATED);
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete the gender and return a success message', async () => {
      const gender = buildGender();

      repository.findOneById.mockResolvedValue(gender);
      repository.remove.mockResolvedValue(undefined);

      const result = await service.delete('gender-uuid-1');

      expect(repository.findOneById).toHaveBeenCalledWith('gender-uuid-1');
      expect(repository.remove).toHaveBeenCalledWith(gender);
      expect(result).toEqual({ message: `Gender ${gender.display_name} (${gender.code}) deleted successfully` });
    });

    it('should propagate GenderException when gender is not found', async () => {
      repository.findOneById.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(GenderException);
    });

    it('should throw GenderException with GENDER_NOT_DELETED when remove fails', async () => {
      const gender = buildGender();
      const dbError = Object.assign(new Error('DB failure'), { status: HttpStatus.INTERNAL_SERVER_ERROR });

      repository.findOneById.mockResolvedValue(gender);
      repository.remove.mockRejectedValue(dbError);

      const error = await service.delete('gender-uuid-1').catch((e) => e);

      expect(error).toBeInstanceOf(GenderException);
      expect(error.getErrorCode()).toBe(GenderErrorCodes.GENDER_NOT_DELETED);
    });
  });

  // ─── findOneById ─────────────────────────────────────────────────────────────

  describe('findOneById', () => {
    it('should return the gender when found', async () => {
      const gender = buildGender();

      repository.findOneById.mockResolvedValue(gender);

      const result = await service.findOneById('gender-uuid-1');

      expect(repository.findOneById).toHaveBeenCalledWith('gender-uuid-1');
      expect(result).toEqual(gender);
    });

    it('should throw GenderException with NOT_FOUND when gender does not exist', async () => {
      repository.findOneById.mockResolvedValue(null);

      const error = await service.findOneById('non-existent').catch((e) => e);

      expect(error).toBeInstanceOf(GenderException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.getErrorCode()).toBe(GenderErrorCodes.GENDER_NOT_FOUND);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return a paginated response', async () => {
      const genders = [buildGender(), buildGender({ id: 'gender-uuid-2', code: 'female', display_name: 'Female' })];
      const query: PaginationQueryDto = { page: 1, limit: 20 };

      repository.findAll.mockResolvedValue([genders, 2]);

      const result = await service.findAll(query);

      expect(repository.findAll).toHaveBeenCalledWith(query);
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.data).toEqual(genders);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should return totalPages = 0 when no records exist', async () => {
      const query: PaginationQueryDto = { page: 1, limit: 20 };

      repository.findAll.mockResolvedValue([[], 0]);

      const result = await service.findAll(query);

      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should throw GenderException when repository fails', async () => {
      const query: PaginationQueryDto = { page: 1, limit: 20 };

      repository.findAll.mockRejectedValue(new Error('DB failure'));

      const error = await service.findAll(query).catch((e) => e);

      expect(error).toBeInstanceOf(GenderException);
    });
  });
});
