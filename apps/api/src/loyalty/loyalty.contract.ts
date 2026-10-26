export interface LoyaltyAwardResult {
  awarded: boolean;
  points: number;
}

export interface LoyaltyStore {
  awardPaidOrder(orderId: number): Promise<LoyaltyAwardResult>;
}

export const LOYALTY_STORE = Symbol('LOYALTY_STORE');
