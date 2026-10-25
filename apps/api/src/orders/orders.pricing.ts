import { BadRequestException } from '@nestjs/common';
import type { Size, Topping } from './orders.contract.js';

const sizeOffset: Record<Size, number> = { S: -5000, M: 0, L: 5000 };
const toppingPrice: Record<Topping, number> = { PEARL: 5000, CREAM: 7000 };

export function calculateUnitPrice(base: number, size: Size, toppings: Topping[]): number {
  const result = base + sizeOffset[size] + toppings.reduce((sum, topping) => sum + toppingPrice[topping], 0);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new BadRequestException('Invalid calculated price');
  }
  return result;
}
