import { Type } from 'class-transformer';
import {
  ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsString,
  Matches, Max, Min, ValidateNested,
} from 'class-validator';

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

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: RecipeIngredientDto) => item?.ingredientId)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];
}
