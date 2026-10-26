import { describe, expect, it, vi } from 'vitest';
import { LoyaltyService, pointsForPaidOrder } from './loyalty.service.js';
import type { LoyaltyStore } from './loyalty.contract.js';

describe('A1-10 Loyalty', () => {
  it('calculates one point per 10,000 VND paid', () => {
    expect(pointsForPaidOrder(90000)).toBe(9);
    expect(pointsForPaidOrder(9999)).toBe(0);
    expect(() => pointsForPaidOrder(-1)).toThrow();
  });

  it('does not award points unless storage confirms PAID and an unclaimed award', async () => {
    const awardPaidOrder = vi
      .fn()
      .mockResolvedValueOnce({ awarded: true, points: 9 })
      .mockResolvedValueOnce({ awarded: false, points: 0 });
    const store: LoyaltyStore = { awardPaidOrder };
    const service = new LoyaltyService(store);
    await expect(service.awardPaidOrder(42)).resolves.toEqual({
      awarded: true,
      points: 9,
    });
    await expect(service.awardPaidOrder(42)).resolves.toEqual({
      awarded: false,
      points: 0,
    });
    expect(awardPaidOrder).toHaveBeenCalledTimes(2);
  });
});
