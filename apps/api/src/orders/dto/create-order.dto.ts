import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsInt()
  @Min(1)
  productId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsIn(['S', 'M', 'L'])
  size?: 'S' | 'M' | 'L';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsIn(['PEARL', 'CREAM'], { each: true })
  toppings?: ('PEARL' | 'CREAM')[];
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  recipientName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^\+?[0-9][0-9\s().-]{6,18}[0-9]$/)
  recipientPhone!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  promoCode?: string;
}
