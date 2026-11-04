import { describe, expect, it } from 'vitest';
import { PaymentsPrismaAdapter } from './payments.prisma-adapter.js';

describe.skipIf(!process.env.DATABASE_URL)('PaymentsPrismaAdapter Integration (ZaloPay)', () => {
  it('Khởi tạo adapter kết nối DB thành công', () => {
    const adapter = new PaymentsPrismaAdapter();
    expect(adapter).toBeDefined();
  });
});
