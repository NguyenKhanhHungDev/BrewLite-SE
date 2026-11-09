import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdjustIngredientDto {
  @IsInt()
  @Min(0)
  @Max(2147483647)
  stock: number;

  @IsInt()
  @Min(0)
  @Max(2147483647)
  expectedVersion: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}
