import { Type } from 'class-transformer';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';

export class InventoryHistoryQueryDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  page?: number;
}
