import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AddressDto {
  @IsNotEmpty({ message: 'Street one field is required' })
  @IsString({ message: 'Street one input must be an string' })
  street_one: string;

  @IsOptional()
  @IsNumber({}, { message: 'Street number input must be a number' })
  street_number?: number;

  @IsOptional()
  @IsString({ message: 'Street two input must be an string' })
  street_two?: string;

  @IsNotEmpty({ message: 'Province field is required' })
  @IsString({ message: 'Province input must be an string' })
  province: string;

  @IsNotEmpty({ message: 'Locality field is required' })
  @IsString({ message: 'Locality input must be an string' })
  locality: string;
}

export class AddressPatchDto {
  @IsOptional()
  @IsString({ message: 'This input must be an string' })
  street_one?: string;

  @IsOptional()
  @IsNumber({}, { message: 'This input must be a number' })
  street_number?: number;

  @IsOptional()
  @IsString({ message: 'This input must be an string' })
  street_two?: string;

  @IsNotEmpty({ message: 'This field is required' })
  @IsString({ message: 'This input must be an string' })
  province: string;

  @IsNotEmpty({ message: 'This field is required' })
  @IsString({ message: 'This input must be an string' })
  locality: string;
}
