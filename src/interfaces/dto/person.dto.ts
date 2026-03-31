import { IsDate, IsEmail, IsNotEmpty, IsPhoneNumber, IsString, IsUUID, Matches } from 'class-validator';
import { AddressDto } from 'src/interfaces/dto/address.dto';

export class CreatePersonDto {
  @IsNotEmpty({ message: 'first name is obligatory' })
  @IsString({ message: 'first name must be a string' })
  first_name: string;

  @IsNotEmpty({ message: 'last name is obligatory' })
  @IsString({ message: 'last name must be a string' })
  last_name: string;

  @IsNotEmpty({ message: 'birth date is obligatory' })
  @IsDate({ message: 'birth date must be a date' })
  birth_date: Date;

  @IsNotEmpty({ message: 'personal id is obligatory' })
  @IsEmail({}, { message: 'personal id must be a valid email' })
  contact_email: string;

  @IsNotEmpty({ message: 'contact phone is obligatory' })
  @IsPhoneNumber('AR', { message: 'contact phone must be a valid phone number' })
  contact_phone: string;

  @IsNotEmpty({ message: 'personal id is obligatory' })
  @Matches(/^\d{7,8}$/, { message: 'DNI must contain 7 or 8 digits' })
  personal_id: string;

  @IsNotEmpty({ message: 'address is obligatory' })
  address: AddressDto;

  @IsNotEmpty({ message: 'gender is obligatory' })
  @IsUUID('4', { message: 'gender must be a valid UUID' })
  gender: string;

}