import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { AddressDto } from 'src/interfaces/dto/address.dto';
import { IsUniquePersonalId } from 'src/common/validators/unique-personal-id.validator';

export class CreatePersonDto {
  @IsNotEmpty({ message: 'first name is obligatory' })
  @IsString({ message: 'first name must be a string' })
  first_name: string;

  @IsNotEmpty({ message: 'last name is obligatory' })
  @IsString({ message: 'last name must be a string' })
  last_name: string;

  @IsNotEmpty({ message: 'birth date is obligatory' })
  @IsDateString({},{ message: 'birth date must be a date' })
  birth_date: string;

  @IsNotEmpty({ message: 'personal id is obligatory' })
  @IsEmail({}, { message: 'personal id must be a valid email' })
  contact_email: string;

  @IsNotEmpty({ message: 'contact phone is obligatory' })
  @IsPhoneNumber('AR', { message: 'contact phone must be a valid phone number' })
  contact_phone: string;

  @IsNotEmpty({ message: 'personal id is obligatory' })
  @Matches(/^\d{7,8}$/, { message: 'DNI must contain 7 or 8 digits' })
  @IsUniquePersonalId()
  personal_id: string;

  @IsNotEmpty({ message: 'address is obligatory' })
  address: AddressDto;

  @IsNotEmpty({ message: 'gender is obligatory' })
  @IsUUID('4', { message: 'gender must be a valid UUID' })
  gender: string;
}

export class PatchPersonDto {
  @IsOptional()
  @IsString({ message: 'first name must be a string' })
  first_name?: string;

  @IsOptional()
  @IsString({ message: 'last name must be a string' })
  last_name?: string;

  @IsOptional()
  @IsDateString({},{ message: 'birth date must be a date' })
  birth_date?: string;

  @IsOptional()
  @IsEmail({}, { message: 'personal id must be a valid email' })
  contact_email?: string;

  @IsOptional()
  @IsPhoneNumber('AR', { message: 'contact phone must be a valid phone number' })
  contact_phone?: string;
}

export class PatchPersonGenderDto {
  @IsNotEmpty({ message: 'gender is obligatory' })
  @IsUUID('4', { message: 'gender must be a valid UUID' })
  gender: string;
}

export class PatchPersonIdDto {
  @IsNotEmpty({ message: 'personal id is obligatory' })
  @Matches(/^\d{7,8}$/, { message: 'DNI must contain 7 or 8 digits' })
  @IsUniquePersonalId()
  personal_id: string;
}

export class AssignPersonRoleDto {
  @IsUUID('4')
  @IsNotEmpty()
  person_id: string;

  @IsIn(['employee', 'patient'])
  @IsNotEmpty()
  role: 'employee' | 'patient';
}

export class BatchPersonDetailsDto {
  @IsArray({ message: 'ids must be an array' })
  @ArrayNotEmpty({ message: 'ids must not be empty' })
  @IsUUID('4', { each: true, message: 'Each id must be a valid UUID v4' })
  ids: string[];
}
