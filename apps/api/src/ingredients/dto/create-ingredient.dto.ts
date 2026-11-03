import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateIngredientDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['g', 'ml'])
  unit: 'g' | 'ml';

  @IsInt()
  @Min(0)
  @Max(2147483647)
  stock: number;

  @IsInt()
  @Min(0)
  @Max(2147483647)
  minStock: number;
}
