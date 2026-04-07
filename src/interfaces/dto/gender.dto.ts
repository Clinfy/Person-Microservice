import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { IsUniqueGenderCode } from 'src/common/validators/unique-gender-code.validator';
import { IsUniqueGenderDisplayName } from 'src/common/validators/unique-gender-display_name.validator';

export class CreateGenderDto {
  @IsString({ message: 'Code must be a string' })
  @IsNotEmpty({ message: 'Code is required' })
  @Matches(/^[a-z_-]+$/, { message: 'Code must contain only lowercase letters separated by hyphens or underscores' })
  @IsUniqueGenderCode()
  code: string;

  @IsString({ message: 'Display name must be a string' })
  @IsNotEmpty({ message: 'Display name is required' })
  @IsUniqueGenderDisplayName()
  display_name: string;
}

export class PatchGenderDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  @Matches(/^[a-z_-]+$/, { message: 'Code must contain only lowercase letters separated by hyphens or underscores' })
  @IsUniqueGenderCode()
  code?: string;

  @IsString({ message: 'Display name must be a string' })
  @IsOptional()
  @IsUniqueGenderDisplayName()
  display_name?: string;
}
