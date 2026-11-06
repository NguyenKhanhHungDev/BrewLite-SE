import { Type } from 'class-transformer';
import {
  ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsString,
  Matches, Max, Min, ValidateIf, ValidateNested,
} from 'class-validator';
import { RecipeIngredientDto } from './create-recipe.dto.js';
import type { RecipeRecord } from '../recipes.contract.js';

// Undefined means omitted; null must fail validation on PATCH.
export class UpdateRecipeDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/\S/u)
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  price?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^\/images\/products\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/)
  imageUrl?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['COFFEE', 'TEA', 'OTHER'])
  category?: RecipeRecord['category'];

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: RecipeIngredientDto) => item?.ingredientId)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients?: RecipeIngredientDto[];
}
