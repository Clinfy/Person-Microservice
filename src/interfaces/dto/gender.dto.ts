import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateGenderDto {
  @IsString({ message: 'Code must be a string' })
  @IsNotEmpty({ message: 'Code is required' })
  @Matches(/^\S+$/, { message: 'Code cannot contain spaces' })
  code: string;

  @IsString({ message: 'Display name must be a string' })
  @IsNotEmpty({ message: 'Display name is required' })
  display_name: string;
}
