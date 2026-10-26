import { BadRequestException } from '@nestjs/common';

export const DEMO_PROMOTION_CODE = 'BREW10';
export const DEMO_PROMOTION_PERCENT = 10;

export interface PromotionCalculation {
  promoCode: string | null;
  discount: number;
  payable: number;
}

function assertSafeTotal(total: number): void {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new BadRequestException(
      'Tổng tiền phải là số nguyên không âm an toàn',
    );
  }
}

export function validatePromotion(code: string): {
  code: string;
  percent: number;
} {
  if (
    typeof code !== 'string' ||
    code.trim().toUpperCase() !== DEMO_PROMOTION_CODE
  ) {
    throw new BadRequestException(
      'Mã giảm giá không hợp lệ hoặc không còn hiệu lực',
    );
  }
  return { code: DEMO_PROMOTION_CODE, percent: DEMO_PROMOTION_PERCENT };
}

export function calculateDiscount(total: number, percent: number): number {
  assertSafeTotal(total);
  if (!Number.isSafeInteger(percent) || percent < 0 || percent > 100) {
    throw new BadRequestException('Tỷ lệ giảm giá không hợp lệ');
  }
  // Tính theo phần nguyên và phần dư để tránh total * percent vượt safe integer.
  const discount =
    Math.floor(total / 100) * percent +
    Math.floor(((total % 100) * percent) / 100);
  if (!Number.isSafeInteger(discount) || discount < 0 || discount > total) {
    throw new BadRequestException('Tiền giảm giá không hợp lệ');
  }
  return discount;
}

export function applyPromotion(
  total: number,
  code?: string,
): PromotionCalculation {
  assertSafeTotal(total);
  if (code === undefined)
    return { promoCode: null, discount: 0, payable: total };

  const promotion = validatePromotion(code);
  const discount = calculateDiscount(total, promotion.percent);
  const payable = total - discount;
  if (!Number.isSafeInteger(payable) || payable < 0) {
    throw new BadRequestException('Tổng tiền sau giảm giá không hợp lệ');
  }
  return { promoCode: promotion.code, discount, payable };
}
