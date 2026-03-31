import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DataSource, Not } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { GenderErrorCodes } from 'src/services/gender/gender.exception';
import { GenderEntity } from 'src/entities/gender.entity';

@ValidatorConstraint({ name: 'IsUniqueGenderCode', async: true })
@Injectable()
export class IsUniqueGenderCodeConstraint implements ValidatorConstraintInterface {
  constructor(private readonly dataSource: DataSource) {}

  async validate(value: string, args: ValidationArguments) {
    if (!value) return true;
    const ignoreIdField = (args.constraints?.[0]?.ignoreIdField as string) || 'id';
    const ignoreId = (args.object as any)?.[ignoreIdField];

    const where: any = { code: value };
    if (ignoreId) where.id = Not(ignoreId);

    const repo = this.dataSource.getRepository(GenderEntity);
    const exists = await repo.exists({ where });
    return !exists;
  }

  defaultMessage() {
    return 'This gender code is already registered.';
  }
}

export function IsUniqueGenderCode(options?: { ignoreIdField?: string }, validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      constraints: [options || {}],
      options: {
        ...validationOptions,
        context: {
          errorCode: GenderErrorCodes.GENDER_CODE_ALREADY_EXISTS,
          ...validationOptions?.context,
        },
      },
      validator: IsUniqueGenderCodeConstraint,
    });
  };
}
