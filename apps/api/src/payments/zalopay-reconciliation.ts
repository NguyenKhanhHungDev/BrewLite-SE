import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PaymentOrdersStore } from './payments.contract.js';
import { ZalopayService } from './zalopay.service.js';

export type ZalopayAttempt = {
  provider: string;
  transactionRef: string | null;
  amount: number;
  status: string;
  createdAt: Date;
};

/** Query/reconcile flows share one in-flight set across customer, admin and background calls. */
export class ZalopayReconciliation {
  private readonly inFlightQueries = new Set<string>();
  constructor(
    private readonly ordersStore: PaymentOrdersStore,
    private readonly zalopay: ZalopayService,
  ) {}
  async getOrderPaymentStatus(userId: unknown, rawOrderId: unknown) {
    if (!Number.isSafeInteger(userId) || Number(userId) <= 0) {
      throw new UnauthorizedException('JWT required');
    }
    const orderId = Number(rawOrderId);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      throw new BadRequestException('orderId must be a positive integer');
    }

    const normalizedUserId = Number(userId);
    const currentStatus = await this.ordersStore.getOrderPaymentStatus(
      normalizedUserId,
      orderId,
    );

    const latest = currentStatus.latestPayment;
    if (
      latest &&
      latest.provider === 'ZALOPAY' &&
      latest.status === 'PENDING' &&
      latest.creationStatus !== 'REJECTED' &&
      (latest.creationStatus !== 'CREATING' ||
        (latest.createdAt &&
          Date.now() - latest.createdAt.getTime() >= 60_000)) &&
      latest.transactionRef &&
      !this.inFlightQueries.has(latest.transactionRef)
    ) {
      const updated = await this.queryAndReconcileSingleAttempt(
        latest.transactionRef,
        latest.amount,
        latest.createdAt,
      );
      if (updated) {
        return this.ordersStore.getOrderPaymentStatus(
          normalizedUserId,
          orderId,
        );
      }
    }

    return currentStatus;
  }
  async reconcilePendingZalopayBatch(limit = 50): Promise<number> {
    const pendingList =
      await this.ordersStore.listPendingZalopayAttempts(limit);
    let resolvedCount = 0;

    for (const item of pendingList) {
      if (this.inFlightQueries.has(item.transactionRef)) continue;
      const resolved = await this.queryAndReconcileSingleAttempt(
        item.transactionRef,
        item.amount,
        item.createdAt,
      );
      if (resolved) resolvedCount += 1;
    }

    return resolvedCount;
  }
  async recheckAdminAttempt(attempt: ZalopayAttempt) {
    if (attempt.provider !== 'ZALOPAY' || !attempt.transactionRef)
      throw new BadRequestException('Giao dịch không hỗ trợ kiểm tra ZaloPay.');
    const ref = attempt.transactionRef;
    if (this.inFlightQueries.has(ref))
      throw new ConflictException(
        'Giao dịch đang được kiểm tra. Vui lòng thử lại sau.',
      );
    this.inFlightQueries.add(ref);
    try {
      const config = this.zalopay.getValidatedConfig();
      const result = await this.zalopay.querySandboxOrder(ref);
      if (![1, 2, 3].includes(result.return_code))
        throw new Error('Gateway response unavailable');
      if (attempt.status === 'RECONCILIATION_REQUIRED')
        return {
          result: 'MANUAL_RESOLUTION_REQUIRED',
          paymentStatus: attempt.status,
          message:
            'Đã truy vấn gateway. Giao dịch cần xử lý đối soát thủ công; trạng thái tài chính được giữ nguyên.',
        };
      let outcome: 'SUCCESS' | 'FAILED' | null = null;
      if (result.return_code === 1) outcome = 'SUCCESS';
      else if (
        result.is_processing === false &&
        (result.return_code === 2 ||
          (result.return_code === 3 &&
            Date.now() - attempt.createdAt.getTime() > 15 * 60000))
      )
        outcome = 'FAILED';
      if (!outcome)
        return {
          result: 'PENDING',
          paymentStatus: attempt.status,
          message:
            'Gateway chưa xác nhận kết quả cuối. Chưa thay đổi trạng thái.',
        };
      const settled = await this.ordersStore.applyZalopayResolution({
        transactionRef: ref,
        appId: config.appId,
        amountVnd:
          outcome === 'SUCCESS'
            ? (result.amount ?? attempt.amount)
            : attempt.amount,
        providerTransactionId: result.zp_trans_id
          ? String(result.zp_trans_id)
          : null,
        outcome,
      });
      const needsManualResolution =
        settled.paymentStatus === 'RECONCILIATION_REQUIRED' ||
        settled.paymentStatus !== outcome;
      return {
        result: needsManualResolution
          ? 'MANUAL_RESOLUTION_REQUIRED'
          : 'SETTLED',
        paymentStatus: settled.paymentStatus,
        message: needsManualResolution
          ? 'Kết quả gateway và dữ liệu hiện có cần đối soát thủ công; không ép thay đổi trạng thái tài chính.'
          : settled.applied
            ? 'Đã kiểm tra gateway và áp dụng kết quả qua quy trình thanh toán.'
            : 'Đã kiểm tra gateway. Giao dịch đã có kết quả cuối tương ứng; không thay đổi trạng thái.',
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException(
        'Không kiểm tra được ZaloPay: thiếu cấu hình, gateway không sẵn sàng hoặc kết quả không thể xác minh.',
      );
    } finally {
      this.inFlightQueries.delete(ref);
    }
  }
  private async queryAndReconcileSingleAttempt(
    transactionRef: string,
    expectedAmount: number,
    createdAt?: Date,
  ): Promise<boolean> {
    this.inFlightQueries.add(transactionRef);
    try {
      const config = this.zalopay.getValidatedConfig();
      const queryRes = await this.zalopay.querySandboxOrder(transactionRef);

      // return_code = 1: Giao dịch thành công
      if (queryRes.return_code === 1) {
        await this.ordersStore.applyZalopayResolution({
          transactionRef,
          appId: config.appId,
          amountVnd: queryRes.amount ?? expectedAmount,
          providerTransactionId: queryRes.zp_trans_id
            ? String(queryRes.zp_trans_id)
            : null,
          outcome: 'SUCCESS',
        });
        return true;
      }

      // return_code = 2 và không còn is_processing: Giao dịch thất bại cuối
      if (
        queryRes.is_processing === false &&
        (queryRes.return_code === 2 ||
          (queryRes.return_code === 3 &&
            createdAt &&
            Date.now() - createdAt.getTime() > 15 * 60_000))
      ) {
        await this.ordersStore.applyZalopayResolution({
          transactionRef,
          appId: config.appId,
          amountVnd: expectedAmount,
          providerTransactionId: null,
          outcome: 'FAILED',
        });
        return true;
      }

      // Unpaid within the gateway window, still processing, and ambiguous errors remain pending.
      return false;
    } catch {
      return false;
    } finally {
      this.inFlightQueries.delete(transactionRef);
    }
  }
}
