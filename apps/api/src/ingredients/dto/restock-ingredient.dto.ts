import { IsInt, Max, Min } from 'class-validator';

export class RestockIngredientDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity: number;
}
