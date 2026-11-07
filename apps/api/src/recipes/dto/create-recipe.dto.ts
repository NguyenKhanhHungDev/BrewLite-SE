import { Type } from 'class-transformer';
import {
  ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsString,
  Matches, Max, Min, ValidateIf, ValidateNested,
} from 'class-validator';
import type { RecipeRecord } from '../recipes.contract.js';

export class RecipeIngredientDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  ingredientId: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity: number;
}

export class CreateRecipeDto {
  @IsString()
  @Matches(/\S/u)
  name: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  price: number;

  @IsString()
  @Matches(/^\/images\/products\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/)
  imageUrl: string;

  @IsBoolean()
  isActive: boolean;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['COFFEE', 'TEA', 'OTHER'])
  category?: RecipeRecord['category'];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: RecipeIngredientDto) => item?.ingredientId)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];
}
