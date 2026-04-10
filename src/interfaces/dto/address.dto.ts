import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AddressDto {
  @IsNotEmpty({ message: 'Street one field is required' })
  @IsString({ message: 'Street one input must be an string' })
  street_one: string;

  @IsOptional()
  @IsNumber({}, { message: 'Street number input must be a number' })
  street_number: number;

  @IsNotEmpty({ message: 'Province field is required' })
  @IsString({ message: 'Province input must be an string' })
  province: string;

  @IsNotEmpty({ message: 'Postal code field is required' })
  @IsNumber({}, { message: 'Postal code input must be an string' })
  postal_code: number;

  @IsNotEmpty({ message: 'Locality field is required' })
  @IsString({ message: 'Locality input must be an string' })
  locality: string;
}
