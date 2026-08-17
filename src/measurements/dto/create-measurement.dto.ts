import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateMeasurementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  type!: string;

  @IsNumber()
  @Type(() => Number)
  value!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(16)
  unit!: string;

  @IsString()
  timestamp!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  externalId?: string;
}
