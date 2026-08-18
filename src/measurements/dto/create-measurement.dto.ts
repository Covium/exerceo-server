import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export const MEASUREMENT_TYPES = [
  'weight',
  'body_fat',
  'waist',
  'chest',
  'arm',
  'thigh',
] as const;

export const MEASUREMENT_UNITS = ['kg', 'lb', 'cm', 'in', '%'] as const;

export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

const UNITS_BY_TYPE: Record<MeasurementType, readonly MeasurementUnit[]> = {
  weight: ['kg', 'lb'],
  body_fat: ['%'],
  waist: ['cm', 'in'],
  chest: ['cm', 'in'],
  arm: ['cm', 'in'],
  thigh: ['cm', 'in'],
};

function IsUnitForType(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isUnitForType',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(unit: unknown, args: ValidationArguments) {
          const type = (args.object as CreateMeasurementDto).type;
          const allowed = UNITS_BY_TYPE[type];
          return (
            typeof unit === 'string' &&
            allowed !== undefined &&
            (allowed as readonly string[]).includes(unit)
          );
        },
        defaultMessage(args: ValidationArguments) {
          const type = (args.object as CreateMeasurementDto).type;
          const allowed = UNITS_BY_TYPE[type] ?? MEASUREMENT_UNITS;
          return `unit must be one of: ${allowed.join(', ')}`;
        },
      },
    });
  };
}

export class CreateMeasurementDto {
  @IsIn(MEASUREMENT_TYPES)
  type!: MeasurementType;

  @IsNumber()
  @Type(() => Number)
  value!: number;

  @IsIn(MEASUREMENT_UNITS)
  @IsUnitForType()
  unit!: MeasurementUnit;

  @IsString()
  timestamp!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  externalId?: string;
}
