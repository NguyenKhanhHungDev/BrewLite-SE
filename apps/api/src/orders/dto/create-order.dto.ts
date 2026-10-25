import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

export class CreateOrderItemDto {
  @IsInt() @Min(1)
  productId!: number;

  @IsInt() @Min(1)
  quantity!: number;

  @IsOptional() @IsIn(['S', 'M', 'L'])
  size?: 'S' | 'M' | 'L';

  @IsOptional() @IsArray() @ArrayMaxSize(2) @ArrayUnique() @IsIn(['PEARL', 'CREAM'], { each: true })
  toppings?: ('PEARL' | 'CREAM')[];
}

export class CreateOrderDto {
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
