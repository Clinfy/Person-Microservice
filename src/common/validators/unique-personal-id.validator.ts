import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DataSource, Not } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { PersonEntity } from 'src/entities/person.entity';
import { PersonErrorCodes } from 'src/services/persons/persons.exception';

@ValidatorConstraint({ name: 'IsUniquePersonalIdValidator', async: true })
@Injectable()
export class IsUniquePersonalIdValidatorConstraint implements ValidatorConstraintInterface {
  constructor(private readonly dataSource: DataSource) {}

  async validate(value: string, args: ValidationArguments) {
    if (!value) return true;
    const ignoreIdField = (args.constraints?.[0]?.ignoreIdField as string) || 'id';
    const ignoreId = (args.object as any)?.[ignoreIdField];

    const where: any = { personal_id: value };
    if (ignoreId) where.id = Not(ignoreId);

    const repo = this.dataSource.getRepository(PersonEntity);
    const exists = await repo.exists({ where });
    return !exists;
  }

  defaultMessage() {
    return 'The person is already registered.';
  }
}

export function IsUniquePersonalIdValidator(options?: { ignoreIdField?: string }, validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      constraints: [options || {}],
      options: {
        ...validationOptions,
        context: {
          errorCode: PersonErrorCodes.PERSON_ALREADY_EXISTS,
          ...validationOptions?.context,
        },
      },
      validator: IsUniquePersonalIdValidatorConstraint,
    });
  };
}
