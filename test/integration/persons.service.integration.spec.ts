import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpStatus } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { PersonsService } from 'src/services/persons/persons.service';
import { PersonsRepository } from 'src/services/persons/persons.repository';
import { GendersService } from 'src/services/genders/genders.service';
import { GenderRepository } from 'src/services/genders/genders.repository';
import { GeorefService } from 'src/clients/georef/georef.service';
import { RequestContextService } from 'src/common/context/request-context.service';
import { RedisService } from 'src/common/redis/redis.service';
import { PersonEntity } from 'src/entities/person.entity';
import { GenderEntity } from 'src/entities/gender.entity';
import { OutboxEntity } from 'src/entities/outbox.entity';
import { PersonErrorCodes, PersonException } from 'src/services/persons/persons.exception';
import { PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';
import { IGeoref } from 'src/clients/georef/georef.interface';
import {
  AssignPersonRoleDto,
  CreatePersonDto,
  PatchPersonDto,
  PatchPersonGenderDto,
  PatchPersonIdDto,
} from 'src/interfaces/dto/person.dto';
import { AddressDto } from 'src/interfaces/dto/address.dto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  lat: -34.6037,
  lon: -58.3816,
};

function buildContextService(user = mockUser): RequestContextService {
  const svc = new RequestContextService();
  jest.spyOn(svc, 'getCurrentUser').mockReturnValue(user);
  return svc;
}

function buildRedisMock() {
  const multi: any = {
    set: jest.fn().mockReturnThis(),
    sAdd: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    sRem: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  return {
    get: jest.fn().mockResolvedValue(null),
    multi: jest.fn().mockReturnValue(multi),
    _multi: multi,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('PersonsService — integration (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let module: TestingModule;
  let service: PersonsService;
  let georefMock: jest.Mocked<GeorefService>;
  let redisMock: ReturnType<typeof buildRedisMock>;

  // Seed: one gender entity shared across the suite
  let seedGenderId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('person_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    redisMock = buildRedisMock();

    georefMock = {
      normalizeAddress: jest.fn().mockResolvedValue(mockAddress),
    } as unknown as jest.Mocked<GeorefService>;

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          database: container.getDatabase(),
          username: container.getUsername(),
          password: container.getPassword(),
          entities: [PersonEntity, GenderEntity, OutboxEntity],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([PersonEntity, GenderEntity]),
      ],
      providers: [
        PersonsService,
        PersonsRepository,
        GendersService,
        GenderRepository,
        {
          provide: GeorefService,
          useValue: georefMock,
        },
        {
          provide: RequestContextService,
          useValue: buildContextService(),
        },
        {
          provide: RedisService,
          useValue: { raw: redisMock },
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

    // Prevent onModuleInit from running during tests
    jest.spyOn(module.get<PersonsService>(PersonsService), 'onModuleInit').mockResolvedValue();

    service = module.get<PersonsService>(PersonsService);
    dataSource = module.get<DataSource>(DataSource);

    // Seed one gender to be used in person creation tests
    const genderRepository = dataSource.getRepository(GenderEntity);
    const gender = await genderRepository.save(genderRepository.create({ code: 'male', display_name: 'Male' }));
    seedGenderId = gender.id;
  }, 120_000);

  afterAll(async () => {
    await module?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    // Clean persons table between tests; keep the seed gender
    await dataSource.query('DELETE FROM person');
    jest.clearAllMocks();
    // Restore defaults after clearAllMocks
    redisMock.get.mockResolvedValue(null);
    redisMock._multi.exec.mockResolvedValue([]);
    redisMock._multi.set.mockReturnThis();
    redisMock._multi.sAdd.mockReturnThis();
    redisMock._multi.del.mockReturnThis();
    redisMock._multi.sRem.mockReturnThis();
    redisMock.multi.mockReturnValue(redisMock._multi);
    georefMock.normalizeAddress.mockResolvedValue(mockAddress);
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async function createTestPerson(overrides: Partial<CreatePersonDto> = {}): Promise<PersonEntity> {
    const dto: CreatePersonDto = {
      first_name: 'John',
      last_name: 'Doe',
      birth_date: '1990-01-01',
      contact_email: `john-${Date.now()}@example.com`,
      contact_phone: '+5491112345678',
      personal_id: String(Math.floor(10_000_000 + Math.random() * 89_999_999)),
      address: {} as any,
      gender: seedGenderId,
      ...overrides,
    };
    return service.create(dto);
  }

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should persist a new person and return it with an auto-generated id', async () => {
      const result = await createTestPerson({ first_name: 'Alice', last_name: 'Smith' });

      expect(result.id).toBeDefined();
      expect(result.first_name).toBe('Alice');
      expect(result.last_name).toBe('Smith');
      expect(result.address).toEqual(mockAddress);
      expect(result.gender.id).toBe(seedGenderId);
      expect(result.created_by).toMatchObject({ id: mockUser.id });

      const stored = await dataSource.getRepository(PersonEntity).findOneBy({ id: result.id });
      expect(stored).not.toBeNull();
    });

    it('should call normalizeAddress with the provided address DTO', async () => {
      const addressDto = {
        street_one: 'Corrientes',
        street_number: '1234',
        province: 'Buenos Aires',
        locality: 'CABA',
      } as any;
      await createTestPerson({ address: addressDto });

      expect(georefMock.normalizeAddress).toHaveBeenCalledWith(addressDto);
    });

    it('should persist two persons independently', async () => {
      await createTestPerson();
      await createTestPerson();

      const count = await dataSource.getRepository(PersonEntity).count();
      expect(count).toBe(2);
    });

    it('should throw PersonException when georef fails', async () => {
      georefMock.normalizeAddress.mockRejectedValueOnce(
        Object.assign(new Error('Georef unavailable'), { status: HttpStatus.BAD_GATEWAY }),
      );

      const error = await createTestPerson().catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_CREATION_FAILED);
      expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    });
  });

  // ─── findOneById ──────────────────────────────────────────────────────────

  describe('findOneById', () => {
    it('should return the person when it exists in the DB', async () => {
      const created = await createTestPerson();

      const found = await service.findOneById(created.id);

      expect(found.id).toBe(created.id);
      expect(found.first_name).toBe('John');
    });

    it('should throw PersonException with NOT_FOUND for an unknown id', async () => {
      const error = await service.findOneById('00000000-0000-0000-0000-000000000000').catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_NOT_FOUND);
    });
  });

  // ─── findOneByPersonalId ──────────────────────────────────────────────────

  describe('findOneByPersonalId', () => {
    it('should return the person when personal_id exists', async () => {
      const created = await createTestPerson({ personal_id: '11111111' });

      const found = await service.findOneByPersonalId('11111111');

      expect(found.id).toBe(created.id);
      expect(found.personal_id).toBe('11111111');
    });

    it('should throw PersonException when personal_id does not exist', async () => {
      const error = await service.findOneByPersonalId('99999999').catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_NOT_FOUND);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all persons paginated', async () => {
      await createTestPerson({ contact_email: 'aaa@example.com', personal_id: '11111111' });
      await createTestPerson({ contact_email: 'bbb@example.com', personal_id: '22222222' });
      await createTestPerson({ contact_email: 'ccc@example.com', personal_id: '33333333' });

      const query: PaginationQueryDto = { page: 1, limit: 20 };
      const result = await service.findAll(query);

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(3);
      expect(result.totalPages).toBe(1);
    });

    it('should respect page and limit', async () => {
      await createTestPerson({ contact_email: 'aaa@example.com', personal_id: '11111111' });
      await createTestPerson({ contact_email: 'bbb@example.com', personal_id: '22222222' });
      await createTestPerson({ contact_email: 'ccc@example.com', personal_id: '33333333' });

      const query: PaginationQueryDto = { page: 1, limit: 2 };
      const result = await service.findAll(query);

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(2);
      expect(result.totalPages).toBe(2);
    });

    it('should return second page correctly', async () => {
      await createTestPerson({ contact_email: 'aaa@example.com', personal_id: '11111111' });
      await createTestPerson({ contact_email: 'bbb@example.com', personal_id: '22222222' });
      await createTestPerson({ contact_email: 'ccc@example.com', personal_id: '33333333' });

      const query: PaginationQueryDto = { page: 2, limit: 2 };
      const result = await service.findAll(query);

      expect(result.data).toHaveLength(1);
    });

    it('should return empty result when no persons exist', async () => {
      const query: PaginationQueryDto = { page: 1, limit: 20 };
      const result = await service.findAll(query);

      expect(result.total).toBe(0);
      expect(result.data).toEqual([]);
      expect(result.totalPages).toBe(0);
    });
  });

  // ─── updatePersonalData ───────────────────────────────────────────────────

  describe('updatePersonalData', () => {
    it('should persist updated personal data fields', async () => {
      const created = await createTestPerson();
      const dto: PatchPersonDto = { first_name: 'Jane', last_name: 'Smith' };

      const updated = await service.updatePersonalData(created.id, dto);

      expect(updated.id).toBe(created.id);
      expect(updated.first_name).toBe('Jane');
      expect(updated.last_name).toBe('Smith');

      const stored = await dataSource.getRepository(PersonEntity).findOneBy({ id: created.id });
      expect(stored!.first_name).toBe('Jane');
    });

    it('should throw PersonException when person does not exist', async () => {
      const error = await service
        .updatePersonalData('00000000-0000-0000-0000-000000000000', { first_name: 'X' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_NOT_FOUND);
    });
  });

  // ─── updatePersonGender ───────────────────────────────────────────────────

  describe('updatePersonGender', () => {
    it('should update the gender and persist the change', async () => {
      // Create a second gender for the update
      const genderRepo = dataSource.getRepository(GenderEntity);
      const femaleGender = await genderRepo.save(genderRepo.create({ code: 'female', display_name: 'Female' }));

      const created = await createTestPerson();
      expect(created.gender.id).toBe(seedGenderId);

      const dto: PatchPersonGenderDto = { gender: femaleGender.id };
      const updated = await service.updatePersonGender(created.id, dto);

      expect(updated.gender.id).toBe(femaleGender.id);

      const stored = await dataSource
        .getRepository(PersonEntity)
        .findOne({ where: { id: created.id }, relations: { gender: true } });
      expect(stored!.gender.id).toBe(femaleGender.id);

      // Delete person first (FK), then the extra gender
      await dataSource.getRepository(PersonEntity).delete({ id: created.id });
      await genderRepo.delete({ id: femaleGender.id });
    });

    it('should throw PersonException when person does not exist', async () => {
      const error = await service
        .updatePersonGender('00000000-0000-0000-0000-000000000000', { gender: seedGenderId })
        .catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
    });
  });

  // ─── updatePersonalId ─────────────────────────────────────────────────────

  describe('updatePersonalId', () => {
    it('should persist the new personal_id', async () => {
      const created = await createTestPerson({ personal_id: '11111111' });

      const dto: PatchPersonIdDto = { personal_id: '99999999' };
      const updated = await service.updatePersonalId(created.id, dto);

      expect(updated.personal_id).toBe('99999999');

      const stored = await dataSource.getRepository(PersonEntity).findOneBy({ id: created.id });
      expect(stored!.personal_id).toBe('99999999');
    });

    it('should throw PersonException when person does not exist', async () => {
      const error = await service
        .updatePersonalId('00000000-0000-0000-0000-000000000000', { personal_id: '99999999' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
    });
  });

  // ─── updatePersonAddress ──────────────────────────────────────────────────

  describe('updatePersonAddress', () => {
    it('should normalize and persist the new address', async () => {
      const newAddress: IGeoref = {
        address_line: 'Av. Santa Fe 100',
        city: 'Buenos Aires',
        province: 'Buenos Aires',
        lat: -34.59,
        lon: -58.39,
      };

      // Create person first (consumes the default mockAddress mock)
      const created = await createTestPerson();

      // Override for the address update call
      georefMock.normalizeAddress.mockResolvedValueOnce(newAddress);

      const dto: AddressDto = {
        street_one: 'Av. Santa Fe',
        street_number: '100',
        province: 'Buenos Aires',
        locality: 'CABA',
      } as any;
      const updated = await service.updatePersonAddress(created.id, dto);

      expect(updated.address).toEqual(newAddress);

      const stored = await dataSource.getRepository(PersonEntity).findOneBy({ id: created.id });
      expect(stored!.address).toEqual(newAddress);
    });

    it('should throw PersonException when person does not exist', async () => {
      const error = await service.updatePersonAddress('00000000-0000-0000-0000-000000000000', {} as any).catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
    });
  });

  // ─── updateRoles ──────────────────────────────────────────────────────────

  describe('updateRoles', () => {
    it('should set is_employee = true and persist', async () => {
      const created = await createTestPerson();
      const dto: AssignPersonRoleDto = { person_id: created.id, role: 'employee' };

      await service.updateRoles(dto);

      const stored = await dataSource.getRepository(PersonEntity).findOneBy({ id: created.id });
      expect(stored!.is_employee).toBe(true);
      expect(stored!.is_patient).toBe(false);
    });

    it('should set is_patient = true and persist', async () => {
      const created = await createTestPerson();
      const dto: AssignPersonRoleDto = { person_id: created.id, role: 'patient' };

      await service.updateRoles(dto);

      const stored = await dataSource.getRepository(PersonEntity).findOneBy({ id: created.id });
      expect(stored!.is_patient).toBe(true);
      expect(stored!.is_employee).toBe(false);
    });

    it('should silently discard when person does not exist', async () => {
      const dto: AssignPersonRoleDto = { person_id: '00000000-0000-0000-0000-000000000000', role: 'employee' };

      await expect(service.updateRoles(dto)).resolves.toBeUndefined();
    });
  });

  // ─── getPersonDetails ─────────────────────────────────────────────────────

  describe('getPersonDetails', () => {
    it('should return IPerson from DB on cache miss', async () => {
      const created = await createTestPerson({ first_name: 'Bob', last_name: 'Martin' });
      redisMock.get.mockResolvedValue(null);

      const result = await service.getPersonDetails(created.id);

      expect(result.first_name).toBe('Bob');
      expect(result.last_name).toBe('Martin');
      expect(result.gender).toBe('Male');
      expect(typeof result.age).toBe('number');
      expect(result.address).toEqual(mockAddress);
    });

    it('should return cached IPerson without hitting DB when cache is warm', async () => {
      const created = await createTestPerson();
      const iperson = service.generatePersonInterface(created);
      redisMock.get.mockResolvedValue(JSON.stringify(iperson));

      const result = await service.getPersonDetails(created.id);

      // birth_date becomes a string after JSON round-trip from cache
      expect(result).toMatchObject({
        first_name: iperson.first_name,
        last_name: iperson.last_name,
        gender: iperson.gender,
        personal_id: iperson.personal_id,
        age: iperson.age,
      });
    });

    it('should throw PersonException for unknown id on cache miss', async () => {
      redisMock.get.mockResolvedValue(null);

      const error = await service.getPersonDetails('00000000-0000-0000-0000-000000000000').catch((e) => e);

      expect(error).toBeInstanceOf(PersonException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.getErrorCode()).toBe(PersonErrorCodes.PERSON_NOT_FOUND);
    });
  });

  // ─── getBatchPersonDetails ────────────────────────────────────────────────

  describe('getBatchPersonDetails', () => {
    it('should return details for multiple persons on cache miss', async () => {
      const p1 = await createTestPerson({ personal_id: '11111111', contact_email: 'p1@example.com' });
      const p2 = await createTestPerson({ personal_id: '22222222', contact_email: 'p2@example.com' });
      redisMock.get.mockResolvedValue(null);

      const result = await service.getBatchPersonDetails([p1.id, p2.id]);

      expect(result[p1.id]).toBeDefined();
      expect(result[p2.id]).toBeDefined();
      expect(result[p1.id].personal_id).toBe('11111111');
      expect(result[p2.id].personal_id).toBe('22222222');
    });

    it('should use cache for cached ids and DB for misses', async () => {
      const p1 = await createTestPerson({ personal_id: '11111111', contact_email: 'p1@example.com' });
      const p2 = await createTestPerson({ personal_id: '22222222', contact_email: 'p2@example.com' });
      const iperson1 = service.generatePersonInterface(p1);

      redisMock.get
        .mockResolvedValueOnce(JSON.stringify(iperson1)) // p1 — cache hit
        .mockResolvedValueOnce(null); // p2 — cache miss

      const result = await service.getBatchPersonDetails([p1.id, p2.id]);

      // birth_date becomes a string after JSON round-trip from cache
      expect(result[p1.id]).toMatchObject({
        first_name: iperson1.first_name,
        gender: iperson1.gender,
        personal_id: iperson1.personal_id,
      });
      expect(result[p2.id]).toBeDefined();
      expect(result[p2.id].personal_id).toBe('22222222');
    });

    it('should return an empty object for an empty id list', async () => {
      const result = await service.getBatchPersonDetails([]);

      expect(result).toEqual({});
    });

    it('should return empty object for ids not found in DB and not in cache', async () => {
      redisMock.get.mockResolvedValue(null);

      const result = await service.getBatchPersonDetails(['00000000-0000-0000-0000-000000000000']);

      // Not found in DB → not in result
      expect(result['00000000-0000-0000-0000-000000000000']).toBeUndefined();
    });
  });
});
