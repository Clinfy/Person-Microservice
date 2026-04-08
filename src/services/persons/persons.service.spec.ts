import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PersonsService } from './persons.service';
import { PersonsRepository } from './persons.repository';
import { GendersService } from 'src/services/genders/genders.service';
import { RequestContextService } from 'src/common/context/request-context.service';
import { RedisService } from 'src/common/redis/redis.service';
import { GeorefService } from 'src/clients/georef/georef.service';
import { PersonEntity } from 'src/entities/person.entity';
import { GenderEntity } from 'src/entities/gender.entity';
import { PersonErrorCodes, PersonException } from './persons.exception';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';
import {
  AssignPersonRoleDto,
  CreatePersonDto,
  PatchPersonDto,
  PatchPersonGenderDto,
  PatchPersonIdDto,
} from 'src/interfaces/dto/person.dto';
import { AddressDto } from 'src/interfaces/dto/address.dto';
import { IGeoref } from 'src/clients/georef/georef.interface';
import { IPerson } from 'src/interfaces/person.interface';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  person_id: 'person-1',
  email: 'admin@example.com',
  session_id: 'session-1',
};

const mockAddress: IGeoref = {
  address_line: 'Av. Corrientes 1234',
  city: 'Buenos Aires',
  province: 'Buenos Aires',
  lat: -34.6,
  lon: -58.4,
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

const buildPerson = (overrides: Partial<PersonEntity> = {}): PersonEntity =>
  ({
    id: 'person-uuid-1',
    first_name: 'John',
    last_name: 'Doe',
    birth_date: new Date('1990-01-01'),
    contact_email: 'john@example.com',
    contact_phone: '+5491112345678',
    personal_id: '12345678',
    address: mockAddress,
    gender: buildGender(),
    has_employee_profile: false,
    has_patient_profile: false,
    created_at: new Date('2024-01-01'),
    created_by: null,
    updated_at: new Date('2024-01-01'),
    ...overrides,
  }) as PersonEntity;

// ─── Mock Redis multi() chain ─────────────────────────────────────────────────

function buildMultiMock() {
  const multi: any = {
    set: jest.fn().mockReturnThis(),
    sAdd: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    sRem: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  return multi;
}

function buildRedisMock() {
  const multi = buildMultiMock();
  return {
    get: jest.fn(),
    mGet: jest.fn(),
    multi: jest.fn().mockReturnValue(multi),
    _multi: multi,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('PersonsService', () => {
  let service: PersonsService;
  let personsRepository: jest.Mocked<PersonsRepository>;
  let gendersService: jest.Mocked<GendersService>;
  let georefService: jest.Mocked<GeorefService>;
  let contextService: jest.Mocked<RequestContextService>;
  let redisMock: ReturnType<typeof buildRedisMock>;
  let redisService: { raw: ReturnType<typeof buildRedisMock> };

  beforeEach(async () => {
    redisMock = buildRedisMock();
    redisService = { raw: redisMock };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonsService,
        {
          provide: PersonsRepository,
          useValue: {
            save: jest.fn(),
            create: jest.fn(),
            merge: jest.fn(),
            findOneById: jest.fn(),
            findOneByPersonalId: jest.fn(),
            findAll: jest.fn(),
            findByIds: jest.fn(),
            findAllForCache: jest.fn(),
          },
        },
        {
          provide: GendersService,
          useValue: {
            findOneById: jest.fn(),
          },
        },
        {
          provide: GeorefService,
          useValue: {
            normalizeAddress: jest.fn(),
          },
        },
        {
          provide: RequestContextService,
          useValue: {
            getCurrentUser: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    // Disable onModuleInit to prevent warmUpCache from running during tests
    service = module.get<PersonsService>(PersonsService);
    personsRepository = module.get(PersonsRepository);
    gendersService = module.get(GendersService);
    georefService = module.get(GeorefService);
    contextService = module.get(RequestContextService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── onModuleInit / warmUpCache ───────────────────────────────────────────

  describe('onModuleInit', () => {
    it('should call warmUpCache on init', async () => {
      const person = buildPerson();
      personsRepository.findAllForCache.mockResolvedValueOnce({ data: [person], total: 1 });
      personsRepository.findAllForCache.mockResolvedValueOnce({ data: [], total: 1 });

      await service.onModuleInit();

      expect(personsRepository.findAllForCache).toHaveBeenCalledWith(1, 100);
    });

    it('should not throw when warmUpCache fails', async () => {
      personsRepository.findAllForCache.mockRejectedValue(new Error('DB down'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it('should paginate all records across multiple pages', async () => {
      // Page 1: 100 records, total = 101 → fetched(100) < total(101) → page 2
      // Page 2: 1 record, total = 101 → fetched(101) >= total(101) → loop ends
      const persons = Array.from({ length: 100 }, (_, i) => buildPerson({ id: `person-${i}` }));
      personsRepository.findAllForCache
        .mockResolvedValueOnce({ data: persons, total: 101 })
        .mockResolvedValueOnce({ data: [buildPerson({ id: 'person-extra' })], total: 101 });

      await service.onModuleInit();

      expect(personsRepository.findAllForCache).toHaveBeenCalledTimes(2);
      expect(personsRepository.findAllForCache).toHaveBeenNthCalledWith(1, 1, 100);
      expect(personsRepository.findAllForCache).toHaveBeenNthCalledWith(2, 2, 100);
    });

    it('should stop paginating when data is empty before reaching total', async () => {
      personsRepository.findAllForCache.mockResolvedValueOnce({ data: [], total: 50 });

      await service.onModuleInit();

      expect(personsRepository.findAllForCache).toHaveBeenCalledTimes(1);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should normalize address, find gender, save person and return the entity', async () => {
      const dto: CreatePersonDto = {
        first_name: 'John',
        last_name: 'Doe',
        birth_date: '1990-01-01',
        contact_email: 'john@example.com',
        contact_phone: '+5491112345678',
        personal_id: '12345678',
        address: { street: 'Av. Corrientes 1234', city: 'Buenos Aires', province: 'Buenos Aires' } as any,
        gender: 'gender-uuid-1',
      };
      const gender = buildGender();
      const person = buildPerson({ created_by: mockUser });

      contextService.getCurrentUser.mockReturnValue(mockUser);
      georefService.normalizeAddress.mockResolvedValue(mockAddress);
      gendersService.findOneById.mockResolvedValue(gender);
      personsRepository.create.mockReturnValue(person);
      personsRepository.save.mockResolvedValue(person);

      const result = await service.create(dto);

      expect(georefService.normalizeAddress).toHaveBeenCalledWith(dto.address);
      expect(gendersService.findOneById).toHaveBeenCalledWith('gender-uuid-1');
      expect(personsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          gender,
          address: mockAddress,
          created_by: mockUser,
        }),
      );
      expect(personsRepository.save).toHaveBeenCalledWith(person);
      expect(result).toEqual(person);
    });

    it('should load the created person to Redis', async () => {
      const dto: CreatePersonDto = {
        first_name: 'John',
        last_name: 'Doe',
        birth_date: '1990-01-01',
        contact_email: 'john@example.com',
        contact_phone: '+5491112345678',
        personal_id: '12345678',
        address: {} as any,
        gender: 'gender-uuid-1',
      };
      const person = buildPerson();

      contextService.getCurrentUser.mockReturnValue(null);
      georefService.normalizeAddress.mockResolvedValue(mockAddress);
      gendersService.findOneById.mockResolvedValue(buildGender());
      personsRepository.create.mockReturnValue(person);
      personsRepository.save.mockResolvedValue(person);

      await service.create(dto);

      expect(redisMock.multi).toHaveBeenCalled();
      expect(redisMock._multi.set).toHaveBeenCalledWith(service.redisKey(person.id), expect.any(String));
      expect(redisMock._multi.sAdd).toHaveBeenCalledWith('persons', person.id);
    });

    it('should throw PersonException when normalizeAddress fails', async () => {
      const dto: CreatePersonDto = {
        first_name: 'John',
        last_name: 'Doe',
        birth_date: '1990-01-01',
        contact_email: 'john@example.com',
        contact_phone: '+5491112345678',
        personal_id: '12345678',
        address: {} as any,
        gender: 'gender-uuid-1',
      };
      georefService.normalizeAddress.mockRejectedValue(
        Object.assign(new Error('Georef error'), { status: HttpStatus.BAD_GATEWAY }),
      );

      const error = await service.create(dto).catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_CREATION_FAILED);
      expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    });

    it('should use INTERNAL_SERVER_ERROR when cause has no status', async () => {
      const dto: CreatePersonDto = {
        first_name: 'John',
        last_name: 'Doe',
        birth_date: '1990-01-01',
        contact_email: 'john@example.com',
        contact_phone: '+5491112345678',
        personal_id: '12345678',
        address: {} as any,
        gender: 'gender-uuid-1',
      };
      georefService.normalizeAddress.mockRejectedValue(new Error('Unknown error'));

      const error = await service.create(dto).catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  // ─── findOneById ──────────────────────────────────────────────────────────

  describe('findOneById', () => {
    it('should return the person entity when found', async () => {
      const person = buildPerson();
      personsRepository.findOneById.mockResolvedValue(person);

      const result = await service.findOneById('person-uuid-1');

      expect(personsRepository.findOneById).toHaveBeenCalledWith('person-uuid-1');
      expect(result).toEqual(person);
    });

    it('should throw PersonException with NOT_FOUND when person does not exist', async () => {
      personsRepository.findOneById.mockResolvedValue(null);

      const error = await service.findOneById('non-existent').catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_NOT_FOUND);
    });
  });

  // ─── findOneByPersonalId ──────────────────────────────────────────────────

  describe('findOneByPersonalId', () => {
    it('should return the person entity when found by personal_id', async () => {
      const person = buildPerson();
      personsRepository.findOneByPersonalId.mockResolvedValue(person);

      const result = await service.findOneByPersonalId('12345678');

      expect(personsRepository.findOneByPersonalId).toHaveBeenCalledWith('12345678');
      expect(result).toEqual(person);
    });

    it('should throw PersonException with NOT_FOUND when personal_id does not exist', async () => {
      personsRepository.findOneByPersonalId.mockResolvedValue(null);

      const error = await service.findOneByPersonalId('00000000').catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_NOT_FOUND);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return a paginated response', async () => {
      const persons = [buildPerson(), buildPerson({ id: 'person-uuid-2', personal_id: '87654321' })];
      const query: PaginationQueryDto = { page: 1, limit: 20 };
      personsRepository.findAll.mockResolvedValue([persons, 2]);

      const result = await service.findAll(query);

      expect(personsRepository.findAll).toHaveBeenCalledWith(query);
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.data).toEqual(persons);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should use default pagination when no query is provided', async () => {
      personsRepository.findAll.mockResolvedValue([[], 0]);

      const result = await service.findAll();

      expect(personsRepository.findAll).toHaveBeenCalled();
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should throw PersonException when repository fails', async () => {
      const query: PaginationQueryDto = { page: 1, limit: 20 };
      personsRepository.findAll.mockRejectedValue(new Error('DB failure'));

      const error = await service.findAll(query).catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
    });
  });

  // ─── updatePersonalData ───────────────────────────────────────────────────

  describe('updatePersonalData', () => {
    it('should find person, merge changes, save and reload cache', async () => {
      const person = buildPerson();
      const dto: PatchPersonDto = { first_name: 'Jane' };
      const updated = buildPerson({ first_name: 'Jane' });

      personsRepository.findOneById.mockResolvedValue(person);
      personsRepository.merge.mockResolvedValue(updated);
      personsRepository.save.mockResolvedValue(updated);

      const result = await service.updatePersonalData('person-uuid-1', dto);

      expect(personsRepository.findOneById).toHaveBeenCalledWith('person-uuid-1');
      expect(personsRepository.merge).toHaveBeenCalledWith(person, dto);
      expect(personsRepository.save).toHaveBeenCalledWith(updated);
      expect(result).toEqual(updated);
      // invalidation + reload: multi should be called twice
      expect(redisMock.multi).toHaveBeenCalledTimes(2);
    });

    it('should propagate PersonException when person is not found', async () => {
      personsRepository.findOneById.mockResolvedValue(null);

      const error = await service.updatePersonalData('non-existent', {}).catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_NOT_FOUND);
    });
  });

  // ─── updatePersonGender ───────────────────────────────────────────────────

  describe('updatePersonGender', () => {
    it('should update gender, save and reload cache', async () => {
      const person = buildPerson();
      const newGender = buildGender({ id: 'gender-uuid-2', code: 'female', display_name: 'Female' });
      const dto: PatchPersonGenderDto = { gender: 'gender-uuid-2' };
      const updated = buildPerson({ gender: newGender });

      personsRepository.findOneById.mockResolvedValue(person);
      gendersService.findOneById.mockResolvedValue(newGender);
      personsRepository.merge.mockResolvedValue(updated);
      personsRepository.save.mockResolvedValue(updated);

      const result = await service.updatePersonGender('person-uuid-1', dto);

      expect(gendersService.findOneById).toHaveBeenCalledWith('gender-uuid-2');
      expect(personsRepository.merge).toHaveBeenCalledWith(person, { gender: newGender });
      expect(result).toEqual(updated);
      expect(redisMock.multi).toHaveBeenCalledTimes(2);
    });

    it('should propagate PersonException when person is not found', async () => {
      personsRepository.findOneById.mockResolvedValue(null);

      const error = await service.updatePersonGender('non-existent', { gender: 'gender-uuid-1' }).catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_NOT_FOUND);
    });
  });

  // ─── updatePersonalId ─────────────────────────────────────────────────────

  describe('updatePersonalId', () => {
    it('should update personal_id, save and reload cache', async () => {
      const person = buildPerson();
      const dto: PatchPersonIdDto = { personal_id: '87654321' };
      const updated = buildPerson({ personal_id: '87654321' });

      personsRepository.findOneById.mockResolvedValue(person);
      personsRepository.merge.mockResolvedValue(updated);
      personsRepository.save.mockResolvedValue(updated);

      const result = await service.updatePersonalId('person-uuid-1', dto);

      expect(personsRepository.merge).toHaveBeenCalledWith(person, { personal_id: '87654321' });
      expect(result).toEqual(updated);
      expect(redisMock.multi).toHaveBeenCalledTimes(2);
    });

    it('should propagate PersonException when person is not found', async () => {
      personsRepository.findOneById.mockResolvedValue(null);

      const error = await service.updatePersonalId('non-existent', { personal_id: '87654321' }).catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
    });
  });

  // ─── updatePersonAddress ──────────────────────────────────────────────────

  describe('updatePersonAddress', () => {
    it('should normalize address, update person and reload cache', async () => {
      const person = buildPerson();
      const dto: AddressDto = { street: 'Av. Rivadavia 100', city: 'Buenos Aires', province: 'Buenos Aires' } as any;
      const newAddress: IGeoref = { ...mockAddress, address_line: 'Av. Rivadavia 100' };
      const updated = buildPerson({ address: newAddress });

      personsRepository.findOneById.mockResolvedValue(person);
      georefService.normalizeAddress.mockResolvedValue(newAddress);
      personsRepository.merge.mockResolvedValue(updated);
      personsRepository.save.mockResolvedValue(updated);

      const result = await service.updatePersonAddress('person-uuid-1', dto);

      expect(georefService.normalizeAddress).toHaveBeenCalledWith(dto);
      expect(personsRepository.merge).toHaveBeenCalledWith(person, { address: newAddress });
      expect(result).toEqual(updated);
      expect(redisMock.multi).toHaveBeenCalledTimes(2);
    });

    it('should propagate PersonException when person is not found', async () => {
      personsRepository.findOneById.mockResolvedValue(null);

      const error = await service.updatePersonAddress('non-existent', {} as any).catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
    });
  });

  // ─── updateRoles ──────────────────────────────────────────────────────────

  describe('updateRoles', () => {
    it('should set has_employee_profile = true when role is employee', async () => {
      const person = buildPerson({ has_employee_profile: false });
      const dto: AssignPersonRoleDto = { person_id: 'person-uuid-1', role: 'employee' };

      personsRepository.findOneById.mockResolvedValue(person);
      personsRepository.save.mockResolvedValue({ ...person, has_employee_profile: true } as PersonEntity);

      await service.updateRoles(dto);

      expect(person.has_employee_profile).toBe(true);
      expect(person.has_patient_profile).toBe(false);
      expect(personsRepository.save).toHaveBeenCalledWith(person);
    });

    it('should set has_patient_profile = true when role is patient', async () => {
      const person = buildPerson({ has_patient_profile: false });
      const dto: AssignPersonRoleDto = { person_id: 'person-uuid-1', role: 'patient' };

      personsRepository.findOneById.mockResolvedValue(person);
      personsRepository.save.mockResolvedValue({ ...person, has_patient_profile: true } as PersonEntity);

      await service.updateRoles(dto);

      expect(person.has_patient_profile).toBe(true);
      expect(person.has_employee_profile).toBe(false);
    });

    it('should silently discard when person is not found (PERSON_NOT_FOUND)', async () => {
      const dto: AssignPersonRoleDto = { person_id: 'non-existent', role: 'employee' };
      personsRepository.findOneById.mockResolvedValue(null);

      await expect(service.updateRoles(dto)).resolves.toBeUndefined();
      expect(personsRepository.save).not.toHaveBeenCalled();
    });

    it('should throw PersonException with PERSON_UPDATE_ROLES_FAILED for unexpected errors', async () => {
      const person = buildPerson();
      const dto: AssignPersonRoleDto = { person_id: 'person-uuid-1', role: 'employee' };

      personsRepository.findOneById.mockResolvedValue(person);
      personsRepository.save.mockRejectedValue(new Error('DB failure'));

      const error = await service.updateRoles(dto).catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_UPDATE_ROLES_FAILED);
      expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  // ─── getPersonDetails ─────────────────────────────────────────────────────

  describe('getPersonDetails', () => {
    it('should return cached IPerson when Redis has the key', async () => {
      const person = buildPerson();
      const iperson: IPerson = service.generatePersonInterface(person);
      redisMock.get.mockResolvedValue(JSON.stringify(iperson));

      const result = await service.getPersonDetails('person-uuid-1');

      expect(redisMock.get).toHaveBeenCalledWith(service.redisKey('person-uuid-1'));
      expect(personsRepository.findOneById).not.toHaveBeenCalled();
      // birth_date is serialized to a string when round-tripped through JSON
      expect(result).toMatchObject({
        first_name: iperson.first_name,
        last_name: iperson.last_name,
        gender: iperson.gender,
        personal_id: iperson.personal_id,
        age: iperson.age,
      });
    });

    it('should hit DB on cache miss, cache the result and return IPerson', async () => {
      const person = buildPerson();
      redisMock.get.mockResolvedValue(null);
      personsRepository.findOneById.mockResolvedValue(person);

      const result = await service.getPersonDetails('person-uuid-1');

      expect(personsRepository.findOneById).toHaveBeenCalledWith('person-uuid-1');
      expect(redisMock.multi).toHaveBeenCalled();
      expect(result).toMatchObject({
        first_name: 'John',
        last_name: 'Doe',
        gender: 'Male',
      });
    });

    it('should throw PersonException when person is not found', async () => {
      redisMock.get.mockResolvedValue(null);
      personsRepository.findOneById.mockResolvedValue(null);

      const error = await service.getPersonDetails('non-existent').catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_NOT_FOUND);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('should throw PersonException when Redis.get throws', async () => {
      redisMock.get.mockRejectedValue(new Error('Redis down'));

      const error = await service.getPersonDetails('person-uuid-1').catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_NOT_FOUND);
    });
  });

  // ─── getBatchPersonDetails ────────────────────────────────────────────────

  describe('getBatchPersonDetails', () => {
    it('should return all persons from cache when all are cached', async () => {
      const person = buildPerson();
      const iperson = service.generatePersonInterface(person);
      redisMock.mGet.mockResolvedValue([JSON.stringify(iperson), JSON.stringify(iperson)]);

      const result = await service.getBatchPersonDetails(['person-uuid-1', 'person-uuid-2']);

      expect(personsRepository.findByIds).not.toHaveBeenCalled();
      // birth_date is serialized to a string after JSON round-trip
      expect(result['person-uuid-1']).toMatchObject({ first_name: iperson.first_name, gender: iperson.gender });
      expect(result['person-uuid-2']).toMatchObject({ first_name: iperson.first_name, gender: iperson.gender });
    });

    it('should fetch DB for cache misses and populate result', async () => {
      const person1 = buildPerson({ id: 'person-uuid-1' });
      const person2 = buildPerson({ id: 'person-uuid-2', personal_id: '87654321' });
      const iperson1 = service.generatePersonInterface(person1);

      // person-uuid-1 is cached, person-uuid-2 is a miss
      redisMock.mGet.mockResolvedValue([JSON.stringify(iperson1), null]);

      personsRepository.findByIds.mockResolvedValue([person2]);

      const result = await service.getBatchPersonDetails(['person-uuid-1', 'person-uuid-2']);

      expect(personsRepository.findByIds).toHaveBeenCalledWith(['person-uuid-2']);
      // birth_date is serialized to string after JSON round-trip from cache
      expect(result['person-uuid-1']).toMatchObject({ first_name: iperson1.first_name, gender: iperson1.gender });
      expect(result['person-uuid-2']).toMatchObject({ first_name: 'John' });
    });

    it('should return an empty object for an empty ids array', async () => {
      const result = await service.getBatchPersonDetails([]);

      expect(result).toEqual({});
      expect(redisMock.get).not.toHaveBeenCalled();
    });

    it('should return partial results and log a warning when DB fetch fails for misses', async () => {
      const person = buildPerson({ id: 'person-uuid-1' });
      const iperson = service.generatePersonInterface(person);

      redisMock.mGet.mockResolvedValue([JSON.stringify(iperson), null]);

      personsRepository.findByIds.mockRejectedValue(new Error('DB failure'));

      const result = await service.getBatchPersonDetails(['person-uuid-1', 'person-uuid-2']);

      // person-uuid-1 came from cache (birth_date is a string after JSON round-trip)
      expect(result['person-uuid-1']).toMatchObject({ first_name: iperson.first_name, gender: iperson.gender });
      // person-uuid-2 was a miss and DB failed — should NOT be in result
      expect(result['person-uuid-2']).toBeUndefined();
    });

    it('should load each miss back into Redis after fetching from DB', async () => {
      const person = buildPerson({ id: 'person-uuid-1' });
      redisMock.mGet.mockResolvedValue([null]);
      personsRepository.findByIds.mockResolvedValue([person]);

      await service.getBatchPersonDetails(['person-uuid-1']);

      expect(redisMock.multi).toHaveBeenCalled();
      expect(redisMock._multi.set).toHaveBeenCalledWith(service.redisKey('person-uuid-1'), expect.any(String));
    });
  });

  // ─── redisKey ─────────────────────────────────────────────────────────────

  describe('redisKey', () => {
    it('should return person:{id}', () => {
      expect(service.redisKey('abc-123')).toBe('person:abc-123');
    });
  });

  // ─── generatePersonInterface ──────────────────────────────────────────────

  describe('generatePersonInterface', () => {
    it('should map PersonEntity fields to IPerson', () => {
      const person = buildPerson({ birth_date: '1990-01-01' });

      const result = service.generatePersonInterface(person);

      expect(result.first_name).toBe('John');
      expect(result.last_name).toBe('Doe');
      expect(result.personal_id).toBe('12345678');
      expect(result.gender).toBe('Male');
      expect(result.contact_email).toBe('john@example.com');
      expect(result.contact_phone).toBe('+5491112345678');
      expect(result.address).toEqual(mockAddress);
      expect(typeof result.age).toBe('number');
      expect(result.age).toBeGreaterThanOrEqual(0);
    });

    it('should compute age from birth_date using differenceInYears', () => {
      const birthDate = '2000-01-01';
      const person = buildPerson({ birth_date: birthDate });

      const result = service.generatePersonInterface(person);

      // The age must be at least the difference from year 2000 to 2026
      expect(result.age).toBeGreaterThanOrEqual(26);
    });
  });
});
