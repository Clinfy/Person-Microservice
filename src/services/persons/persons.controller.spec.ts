import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { PersonEntity } from 'src/entities/person.entity';
import { GenderEntity } from 'src/entities/gender.entity';
import { PersonErrorCodes, PersonException } from './persons.exception';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/dto/pagination.dto';
import {
  BatchPersonDetailsDto,
  CreatePersonDto,
  PatchPersonDto,
  PatchPersonGenderDto,
  PatchPersonIdDto,
} from 'src/interfaces/dto/person.dto';
import { AddressDto } from 'src/interfaces/dto/address.dto';
import { IPerson } from 'src/interfaces/person.interface';

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

const buildAddress = (): AddressDto => ({
  street_one: 'Calle Falsa',
  street_number: 123,
  province: 'Buenos Aires',
  locality: 'CABA',
});

const buildPerson = (overrides: Partial<PersonEntity> = {}): PersonEntity =>
  ({
    id: 'person-uuid-1',
    first_name: 'John',
    last_name: 'Doe',
    birth_date: new Date('1990-01-01'),
    contact_email: 'john.doe@example.com',
    contact_phone: '+541112345678',
    personal_id: '12345678',
    address: buildAddress() as any,
    gender: buildGender(),
    is_employee: false,
    is_patient: false,
    created_at: new Date('2024-01-01'),
    created_by: null,
    updated_at: new Date('2024-01-01'),
    ...overrides,
  }) as PersonEntity;

const buildIPerson = (overrides: Partial<IPerson> = {}): IPerson => ({
  first_name: 'John',
  last_name: 'Doe',
  personal_id: '12345678',
  gender: 'Male',
  birth_date: new Date('1990-01-01'),
  age: 35,
  contact_email: 'john.doe@example.com',
  contact_phone: '+541112345678',
  address: buildAddress() as any,
  ...overrides,
});

describe('PersonsController', () => {
  let controller: PersonsController;
  let service: jest.Mocked<PersonsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonsController],
      providers: [
        {
          provide: PersonsService,
          useValue: {
            create: jest.fn(),
            updatePersonalData: jest.fn(),
            updatePersonGender: jest.fn(),
            updatePersonalId: jest.fn(),
            updatePersonAddress: jest.fn(),
            findOneById: jest.fn(),
            findOneByPersonalId: jest.fn(),
            findAll: jest.fn(),
            getPersonDetails: jest.fn(),
            getBatchPersonDetails: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<PersonsController>(PersonsController);
    service = module.get(PersonsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should delegate to service.create and return the created person', async () => {
      const dto: CreatePersonDto = {
        first_name: 'John',
        last_name: 'Doe',
        birth_date: new Date('1990-01-01'),
        contact_email: 'john.doe@example.com',
        contact_phone: '+541112345678',
        personal_id: '12345678',
        address: buildAddress(),
        gender: 'gender-uuid-1',
      };
      const person = buildPerson();

      service.create.mockResolvedValue(person);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(person);
    });

    it('should propagate PersonException thrown by the service', async () => {
      const dto: CreatePersonDto = {
        first_name: 'John',
        last_name: 'Doe',
        birth_date: new Date('1990-01-01'),
        contact_email: 'john.doe@example.com',
        contact_phone: '+541112345678',
        personal_id: '12345678',
        address: buildAddress(),
        gender: 'gender-uuid-1',
      };

      service.create.mockRejectedValue(
        new PersonException(
          'Person creation failed',
          PersonErrorCodes.PERSON_CREATION_FAILED,
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      await expect(controller.create(dto)).rejects.toThrow(PersonException);
    });
  });

  // ─── updatePersonalDetails ───────────────────────────────────────────────────

  describe('updatePersonalDetails', () => {
    it('should delegate to service.updatePersonalData with id and dto, and return the updated person', async () => {
      const dto: PatchPersonDto = { first_name: 'Jane' };
      const updated = buildPerson({ first_name: 'Jane' });

      service.updatePersonalData.mockResolvedValue(updated);

      const result = await controller.updatePersonalDetails('person-uuid-1', dto);

      expect(service.updatePersonalData).toHaveBeenCalledWith('person-uuid-1', dto);
      expect(result).toEqual(updated);
    });

    it('should propagate PersonException when person is not found', async () => {
      service.updatePersonalData.mockRejectedValue(
        new PersonException('Person not found', PersonErrorCodes.PERSON_NOT_FOUND, HttpStatus.NOT_FOUND),
      );

      await expect(controller.updatePersonalDetails('non-existent', {})).rejects.toThrow(PersonException);
    });
  });

  // ─── updatePersonGender ──────────────────────────────────────────────────────

  describe('updatePersonGender', () => {
    it('should delegate to service.updatePersonGender with id and dto, and return the updated person', async () => {
      const dto: PatchPersonGenderDto = { gender: 'gender-uuid-2' };
      const femaleGender = buildGender({ id: 'gender-uuid-2', code: 'female', display_name: 'Female' });
      const updated = buildPerson({ gender: femaleGender });

      service.updatePersonGender.mockResolvedValue(updated);

      const result = await controller.updatePersonGender('person-uuid-1', dto);

      expect(service.updatePersonGender).toHaveBeenCalledWith('person-uuid-1', dto);
      expect(result).toEqual(updated);
    });

    it('should propagate PersonException when person is not found', async () => {
      service.updatePersonGender.mockRejectedValue(
        new PersonException('Person not found', PersonErrorCodes.PERSON_NOT_FOUND, HttpStatus.NOT_FOUND),
      );

      await expect(controller.updatePersonGender('non-existent', { gender: 'gender-uuid-2' })).rejects.toThrow(
        PersonException,
      );
    });
  });

  // ─── updatePersonalId ────────────────────────────────────────────────────────

  describe('updatePersonalId', () => {
    it('should delegate to service.updatePersonalId with id and dto, and return the updated person', async () => {
      const dto: PatchPersonIdDto = { personal_id: '87654321' };
      const updated = buildPerson({ personal_id: '87654321' });

      service.updatePersonalId.mockResolvedValue(updated);

      const result = await controller.updatePersonalId('person-uuid-1', dto);

      expect(service.updatePersonalId).toHaveBeenCalledWith('person-uuid-1', dto);
      expect(result).toEqual(updated);
    });

    it('should propagate PersonException when person is not found', async () => {
      service.updatePersonalId.mockRejectedValue(
        new PersonException('Person not found', PersonErrorCodes.PERSON_NOT_FOUND, HttpStatus.NOT_FOUND),
      );

      await expect(controller.updatePersonalId('non-existent', { personal_id: '87654321' })).rejects.toThrow(
        PersonException,
      );
    });
  });

  // ─── updatePersonAddress ─────────────────────────────────────────────────────

  describe('updatePersonAddress', () => {
    it('should delegate to service.updatePersonAddress with id and dto, and return the updated person', async () => {
      const dto: AddressDto = buildAddress();
      const updated = buildPerson();

      service.updatePersonAddress.mockResolvedValue(updated);

      const result = await controller.updatePersonAddress('person-uuid-1', dto);

      expect(service.updatePersonAddress).toHaveBeenCalledWith('person-uuid-1', dto);
      expect(result).toEqual(updated);
    });

    it('should propagate PersonException when person is not found', async () => {
      service.updatePersonAddress.mockRejectedValue(
        new PersonException('Person not found', PersonErrorCodes.PERSON_NOT_FOUND, HttpStatus.NOT_FOUND),
      );

      await expect(controller.updatePersonAddress('non-existent', buildAddress())).rejects.toThrow(PersonException);
    });
  });

  // ─── findOneById ─────────────────────────────────────────────────────────────

  describe('findOneById', () => {
    it('should delegate to service.findOneById and return the person', async () => {
      const person = buildPerson();

      service.findOneById.mockResolvedValue(person);

      const result = await controller.findOneById('person-uuid-1');

      expect(service.findOneById).toHaveBeenCalledWith('person-uuid-1');
      expect(result).toEqual(person);
    });

    it('should propagate PersonException when person is not found', async () => {
      service.findOneById.mockRejectedValue(
        new PersonException('Person not found', PersonErrorCodes.PERSON_NOT_FOUND, HttpStatus.NOT_FOUND),
      );

      await expect(controller.findOneById('non-existent')).rejects.toThrow(PersonException);
    });
  });

  // ─── findOneByPersonalId ─────────────────────────────────────────────────────

  describe('findOneByPersonalId', () => {
    it('should delegate to service.findOneByPersonalId and return the person', async () => {
      const person = buildPerson();

      service.findOneByPersonalId.mockResolvedValue(person);

      const result = await controller.findOneByPersonalId('12345678');

      expect(service.findOneByPersonalId).toHaveBeenCalledWith('12345678');
      expect(result).toEqual(person);
    });

    it('should propagate PersonException when person is not found by personal id', async () => {
      service.findOneByPersonalId.mockRejectedValue(
        new PersonException('Person not found', PersonErrorCodes.PERSON_NOT_FOUND, HttpStatus.NOT_FOUND),
      );

      await expect(controller.findOneByPersonalId('non-existent')).rejects.toThrow(PersonException);
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should delegate to service.findAll and return a paginated response', async () => {
      const query: PaginationQueryDto = { page: 1, limit: 20 };
      const persons = [buildPerson(), buildPerson({ id: 'person-uuid-2', first_name: 'Jane' })];
      const paginated = new PaginatedResponseDto(persons, 2, 1, 20);

      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(paginated);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });

    it('should propagate PersonException when service fails', async () => {
      service.findAll.mockRejectedValue(
        new PersonException('Persons not found', PersonErrorCodes.PERSON_NOT_FOUND, HttpStatus.NOT_FOUND),
      );

      await expect(controller.findAll({ page: 1, limit: 20 })).rejects.toThrow(PersonException);
    });
  });

  // ─── getPersonDetails ────────────────────────────────────────────────────────

  describe('getPersonDetails', () => {
    it('should delegate to service.getPersonDetails and return the IPerson interface', async () => {
      const personDetails = buildIPerson();

      service.getPersonDetails.mockResolvedValue(personDetails);

      const result = await controller.getPersonDetails('person-uuid-1');

      expect(service.getPersonDetails).toHaveBeenCalledWith('person-uuid-1');
      expect(result).toEqual(personDetails);
    });

    it('should propagate PersonException when person details are not found', async () => {
      service.getPersonDetails.mockRejectedValue(
        new PersonException('Person not found', PersonErrorCodes.PERSON_NOT_FOUND, HttpStatus.NOT_FOUND),
      );

      await expect(controller.getPersonDetails('non-existent')).rejects.toThrow(PersonException);
    });
  });

  // ─── getBatchPersonDetails ───────────────────────────────────────────────────

  describe('getBatchPersonDetails', () => {
    it('should delegate to service.getBatchPersonDetails and return a record of IPerson', async () => {
      const dto: BatchPersonDetailsDto = { ids: ['person-uuid-1', 'person-uuid-2'] };
      const person1 = buildIPerson();
      const person2 = buildIPerson({ first_name: 'Jane', last_name: 'Smith' });
      const expected: Record<string, IPerson> = {
        'person-uuid-1': person1,
        'person-uuid-2': person2,
      };

      service.getBatchPersonDetails.mockResolvedValue(expected);

      const result = await controller.getBatchPersonDetails(dto);

      expect(service.getBatchPersonDetails).toHaveBeenCalledWith(dto.ids);
      expect(result).toEqual(expected);
    });

    it('should return an empty record when no ids are matched', async () => {
      const dto: BatchPersonDetailsDto = { ids: ['non-existent-uuid-1'] };

      service.getBatchPersonDetails.mockResolvedValue({});

      const result = await controller.getBatchPersonDetails(dto);

      expect(service.getBatchPersonDetails).toHaveBeenCalledWith(dto.ids);
      expect(result).toEqual({});
    });
  });
});
