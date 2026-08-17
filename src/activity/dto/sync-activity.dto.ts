import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class SyncSessionDto {
  @IsString()
  externalId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  qualifies?: boolean;
}

export class SyncDayDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  workoutMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  steps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  activeCalories?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsNumber()
  bodyFat?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncSessionDto)
  sessions?: SyncSessionDto[];
}

export class SyncActivityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncDayDto)
  days!: SyncDayDto[];
}
