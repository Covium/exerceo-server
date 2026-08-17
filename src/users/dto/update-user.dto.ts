import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName?: string;

  @IsOptional()
  @IsIn(['en', 'ru'])
  language?: 'en' | 'ru';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weeklyWorkoutGoal?: number;
}
