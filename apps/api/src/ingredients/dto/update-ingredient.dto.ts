import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateIngredientDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  minStock?: number;
}
