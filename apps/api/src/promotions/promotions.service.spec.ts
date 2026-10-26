import { describe, expect, it } from 'vitest';
import {
  applyPromotion,
  calculateDiscount,
  validatePromotion,
} from './promotions.service.js';

describe('A1-10 Promotions', () => {
  it('applies the demo code BREW10 for 10 percent off', () => {
    expect(validatePromotion(' brew10 ')).toEqual({
      code: 'BREW10',
      percent: 10,
    });
    expect(applyPromotion(100000, 'BREW10')).toEqual({
      promoCode: 'BREW10',
      discount: 10000,
      payable: 90000,
    });
  });

  it('does not discount an order when no code is provided', () => {
    expect(applyPromotion(100000)).toEqual({
      promoCode: null,
      discount: 0,
      payable: 100000,
    });
  });

  it('rejects invalid promotion codes', () => {
    expect(() => applyPromotion(100000, 'XYZ')).toThrow();
    expect(() => applyPromotion(100000, '')).toThrow();
  });

  it('never generates a negative discount or payable total', () => {
    expect(calculateDiscount(1, 10)).toBe(0);
    expect(applyPromotion(1, 'BREW10').payable).toBe(1);
    expect(() => applyPromotion(-10, 'BREW10')).toThrow();
    expect(() => calculateDiscount(100, 101)).toThrow();
  });
});
