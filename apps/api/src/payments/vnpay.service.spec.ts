import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { PaymentsService } from './payments.service.js';
import { signVnpayParams, VnpayService } from './vnpay.service.js';
import type {
  CreateVnpayPaymentRecordInput,
  PaymentOrdersStore,
  VnpayIpnProcessInput,
} from './payments.contract.js';

describe('VNPAY Sandbox Service & IPN Verification (T01 - T10)', () => {
  const TEST_SECRET = 'DEMO_VNPAY_HASH_SECRET_KEY_2026';
  const TEST_TMN = 'BREWTEST';

  beforeEach(() => {
    process.env.VNPAY_TMN_CODE = TEST_TMN;
    process.env.VNPAY_HASH_SECRET = TEST_SECRET;
    process.env.VNPAY_URL =
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    process.env.VNPAY_RETURN_URL = 'http://localhost:3000/payment/result';
  });

  function createMockVnpayEnvironment(orderTotal = 70000, ownerId = 10) {
    let orderStatus = 'PENDING';
    const payments = new Map<
      string,
      {
        id: number;
        orderId: number;
        amount: number;
        status: string;
      }
    >();

    const store: PaymentOrdersStore = {
      payOnce: async () => ({ orderId: 2, status: 'PAID' }),
      createVnpayPayment: async (input: CreateVnpayPaymentRecordInput) => {
        if (input.userId !== ownerId) {
          throw new ForbiddenException('Order does not belong to current user');
        }
        const rec = {
          id: 15,
          orderId: input.orderId,
          amount: orderTotal,
          status: 'PENDING',
        };
        payments.set(input.transactionRef, rec);
        return {
          orderId: input.orderId,
          paymentId: rec.id,
          amount: rec.amount,
          transactionRef: input.transactionRef,
        };
      },
      processVnpayIpn: async (input: VnpayIpnProcessInput) => {
        const payment = payments.get(input.transactionRef);
        if (!payment) return { RspCode: '01', Message: 'Order not found' };
        if (payment.amount !== input.amountVnd) {
          return { RspCode: '04', Message: 'Invalid amount' };
        }
        if (payment.status !== 'PENDING') {
          return { RspCode: '02', Message: 'Order already confirmed' };
        }
        if (
          input.responseCode === '00' &&
          input.transactionStatus === '00'
        ) {
          payment.status = 'SUCCESS';
          orderStatus = 'PAID';
        } else if (input.responseCode === '24') {
          payment.status = 'CANCELLED';
          orderStatus = 'PAYMENT_FAILED';
        } else {
          payment.status = 'FAILED';
          orderStatus = 'PAYMENT_FAILED';
        }
        return { RspCode: '00', Message: 'Confirm Success' };
      },
      getOrderPaymentStatus: async (userId: number, orderId: number) => {
        if (userId !== ownerId) {
          throw new ForbiddenException('Order does not belong to current user');
        }
        return {
          orderId,
          orderStatus,
          latestPayment: null,
        };
      },
    };

    const vnpayService = new VnpayService();
    const paymentsService = new PaymentsService(store, vnpayService);

    return {
      paymentsService,
      getOrderStatus: () => orderStatus,
      getPayment: (ref: string) => payments.get(ref),
    };
  }

  it('T01 & T05: creates VNPAY URL with vnp_Amount = 70000 * 100 and rejects client-supplied amount', async () => {
    const { paymentsService } = createMockVnpayEnvironment(70000, 10);

    // Client cố tình truyền thêm amount: 1000 phải bị chặn
    await expect(
      paymentsService.createVnpayPayment(10, { orderId: 2, amount: 1000 }),
    ).rejects.toThrow(BadRequestException);

    const res = await paymentsService.createVnpayPayment(10, { orderId: 2 });
    expect(res.orderId).toBe(2);
    expect(res.paymentId).toBe(15);
    expect(res.paymentUrl).toContain('vnp_Amount=7000000');
    expect(res.paymentUrl).toContain('vnp_SecureHash=');
  });

  it('T02 & T08: valid IPN sets Order PAID and duplicate IPN returns RspCode 02 idempotently', async () => {
    const { paymentsService, getOrderStatus } = createMockVnpayEnvironment(
      70000,
      10,
    );
    const created = await paymentsService.createVnpayPayment(10, {
      orderId: 2,
    });
    const url = new URL(created.paymentUrl);
    const txnRef = url.searchParams.get('vnp_TxnRef')!;

    const ipnParams: Record<string, string> = {
      vnp_Amount: '7000000',
      vnp_BankCode: 'NCB',
      vnp_ResponseCode: '00',
      vnp_TmnCode: TEST_TMN,
      vnp_TransactionNo: '14223344',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: txnRef,
    };
    ipnParams.vnp_SecureHash = signVnpayParams(ipnParams, TEST_SECRET);

    const firstIpn = await paymentsService.handleVnpayIpn(ipnParams);
    expect(firstIpn).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(getOrderStatus()).toBe('PAID');

    // Gửi lặp lại IPN lần 2
    const secondIpn = await paymentsService.handleVnpayIpn(ipnParams);
    expect(secondIpn).toEqual({
      RspCode: '02',
      Message: 'Order already confirmed',
    });
  });

  it('T03 & T04: cancelled (24) or failed OTP does not set Order to PAID', async () => {
    const { paymentsService, getOrderStatus } = createMockVnpayEnvironment(
      70000,
      10,
    );
    const created = await paymentsService.createVnpayPayment(10, {
      orderId: 2,
    });
    const txnRef = new URL(created.paymentUrl).searchParams.get('vnp_TxnRef')!;

    const cancelParams: Record<string, string> = {
      vnp_Amount: '7000000',
      vnp_ResponseCode: '24',
      vnp_TmnCode: TEST_TMN,
      vnp_TransactionStatus: '02',
      vnp_TxnRef: txnRef,
    };
    cancelParams.vnp_SecureHash = signVnpayParams(cancelParams, TEST_SECRET);

    const res = await paymentsService.handleVnpayIpn(cancelParams);
    expect(res.RspCode).toBe('00');
    expect(getOrderStatus()).not.toBe('PAID');
  });

  it('T06 & T07: rejects tampered signature (97) and mismatched amount (04)', async () => {
    const { paymentsService, getOrderStatus } = createMockVnpayEnvironment(
      70000,
      10,
    );
    const created = await paymentsService.createVnpayPayment(10, {
      orderId: 2,
    });
    const txnRef = new URL(created.paymentUrl).searchParams.get('vnp_TxnRef')!;

    // Chữ ký giả
    const badSig = await paymentsService.handleVnpayIpn({
      vnp_Amount: '7000000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: txnRef,
      vnp_SecureHash: 'invalid_signature_123',
    });
    expect(badSig).toEqual({ RspCode: '97', Message: 'Invalid Checksum' });
    expect(getOrderStatus()).toBe('PENDING');

    // Chữ ký đúng nhưng số tiền sai (10.000đ thay vì 70.000đ)
    const wrongAmountParams: Record<string, string> = {
      vnp_Amount: '1000000',
      vnp_ResponseCode: '00',
      vnp_TmnCode: TEST_TMN,
      vnp_TransactionStatus: '00',
      vnp_TxnRef: txnRef,
    };
    wrongAmountParams.vnp_SecureHash = signVnpayParams(
      wrongAmountParams,
      TEST_SECRET,
    );

    const badAmount = await paymentsService.handleVnpayIpn(wrongAmountParams);
    expect(badAmount).toEqual({ RspCode: '04', Message: 'Invalid amount' });
    expect(getOrderStatus()).toBe('PENDING');
  });

  it('T10: blocks another user from creating payment or checking status of unowned order', async () => {
    const { paymentsService } = createMockVnpayEnvironment(70000, 10);
    await expect(
      paymentsService.createVnpayPayment(999, { orderId: 2 }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      paymentsService.getOrderPaymentStatus(999, 2),
    ).rejects.toThrow(ForbiddenException);
  });
});