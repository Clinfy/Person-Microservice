import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { GendersService } from 'src/services/genders/genders.service';
import { GenderRepository } from 'src/services/genders/genders.repository';
import { GenderEntity } from 'src/entities/gender.entity';
import { GenderErrorCodes, GenderException } from 'src/services/genders/genders.exception';
import { RequestContextService } from 'src/common/context/request-context.service';
import { PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';
import { OutboxEntity } from 'src/entities/outbox.entity';
import { PersonEntity } from 'src/entities/person.entity';
import { HttpStatus } from '@nestjs/common';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  person_id: 'person-1',
  email: 'admin@example.com',
  session_id: 'session-1',
};

/**
 * Builds a RequestContextService mock that always returns mockUser.
 * Unit mocking is sufficient here — context storage is not relevant for
 * integration tests targeting the persistence layer.
 */
function buildContextService(user = mockUser): RequestContextService {
  const svc = new RequestContextService();
  jest.spyOn(svc, 'getCurrentUser').mockReturnValue(user);
  return svc;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('GendersService — integration (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let module: TestingModule;
  let service: GendersService;

  // Start a real PostgreSQL container once for the whole suite
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('person_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          database: container.getDatabase(),
          username: container.getUsername(),
          password: container.getPassword(),
          entities: [GenderEntity, PersonEntity, OutboxEntity],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([GenderEntity]),
      ],
      providers: [
        GendersService,
        GenderRepository,
        {
          provide: RequestContextService,
          useValue: buildContextService(),
        },
      ],
    }).compile();

    service = module.get<GendersService>(GendersService);
    dataSource = module.get<DataSource>(DataSource);
  }, 120_000);

  afterAll(async () => {
    // module.close() already destroys the DataSource — no need to call destroy() separately
    await module?.close();
    await container?.stop();
  });

  // Wipe the gender table before each test to keep tests independent.
  // DELETE ... CASCADE is used instead of TRUNCATE because `person` holds a FK to `gender`.
  beforeEach(async () => {
    await dataSource.query('DELETE FROM gender');
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should persist a new gender and return it with an auto-generated id', async () => {
      const result = await service.create({ code: 'male', display_name: 'Male' });

      expect(result.id).toBeDefined();
      expect(result.code).toBe('male');
      expect(result.display_name).toBe('Male');
      expect(result.created_by).toMatchObject({ id: mockUser.id });

      const stored = await dataSource.getRepository(GenderEntity).findOneBy({ id: result.id });
      expect(stored).toBeTruthy();
      expect(stored!.code).toBe('male');
    });

    it('should persist two different genders independently', async () => {
      await service.create({ code: 'male', display_name: 'Male' });
      await service.create({ code: 'female', display_name: 'Female' });

      const count = await dataSource.getRepository(GenderEntity).count();
      expect(count).toBe(2);
    });
  });

  // ─── findOneById ──────────────────────────────────────────────────────────

  describe('findOneById', () => {
    it('should return the gender when it exists in the DB', async () => {
      const created = await service.create({ code: 'male', display_name: 'Male' });

      const found = await service.findOneById(created.id);

      expect(found.id).toBe(created.id);
      expect(found.code).toBe('male');
    });

    it('should throw GenderException with NOT_FOUND for an unknown id', async () => {
      const error = await service.findOneById('00000000-0000-0000-0000-000000000000').catch((e) => e);

      expect(error).toBeInstanceOf(GenderException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.getErrorCode()).toBe(GenderErrorCodes.GENDER_NOT_FOUND);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all genders paginated', async () => {
      await service.create({ code: 'female', display_name: 'Female' });
      await service.create({ code: 'male', display_name: 'Male' });
      await service.create({ code: 'non_binary', display_name: 'Non-binary' });

      const query: PaginationQueryDto = { page: 1, limit: 20 };
      const result = await service.findAll(query);

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(3);
      expect(result.totalPages).toBe(1);
      // Repository orders by code ASC
      expect(result.data[0].code).toBe('female');
      expect(result.data[1].code).toBe('male');
      expect(result.data[2].code).toBe('non_binary');
    });

    it('should respect page and limit parameters', async () => {
      await service.create({ code: 'female', display_name: 'Female' });
      await service.create({ code: 'male', display_name: 'Male' });
      await service.create({ code: 'non_binary', display_name: 'Non-binary' });

      const query: PaginationQueryDto = { page: 1, limit: 2 };
      const result = await service.findAll(query);

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(2);
      expect(result.totalPages).toBe(2);
    });

    it('should return the second page correctly', async () => {
      await service.create({ code: 'female', display_name: 'Female' });
      await service.create({ code: 'male', display_name: 'Male' });
      await service.create({ code: 'non_binary', display_name: 'Non-binary' });

      const query: PaginationQueryDto = { page: 2, limit: 2 };
      const result = await service.findAll(query);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].code).toBe('non_binary');
    });

    it('should return totalPages = 0 and empty data when no genders exist', async () => {
      const query: PaginationQueryDto = { page: 1, limit: 20 };
      const result = await service.findAll(query);

      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.data).toEqual([]);
    });
  });

  // ─── edit ─────────────────────────────────────────────────────────────────

  describe('edit', () => {
    it('should update and persist the changed fields', async () => {
      const created = await service.create({ code: 'male', display_name: 'Male' });

      const updated = await service.edit(created.id, { display_name: 'Male (updated)' } as any);

      expect(updated.id).toBe(created.id);
      expect(updated.display_name).toBe('Male (updated)');
      expect(updated.code).toBe('male');

      const stored = await dataSource.getRepository(GenderEntity).findOneBy({ id: created.id });
      expect(stored!.display_name).toBe('Male (updated)');
    });

    it('should throw GenderException when the gender does not exist', async () => {
      const error = await service.edit('00000000-0000-0000-0000-000000000000', { code: 'x' } as any).catch((e) => e);

      expect(error).toBeInstanceOf(GenderException);
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should remove the gender from the DB and return a success message', async () => {
      const created = await service.create({ code: 'male', display_name: 'Male' });

      const result = await service.delete(created.id);

      expect(result.message).toContain('deleted successfully');

      const stored = await dataSource.getRepository(GenderEntity).findOneBy({ id: created.id });
      expect(stored).toBeNull();
    });

    it('should throw GenderException when the gender does not exist', async () => {
      const error = await service.delete('00000000-0000-0000-0000-000000000000').catch((e) => e);

      expect(error).toBeInstanceOf(GenderException);
    });
  });
});
