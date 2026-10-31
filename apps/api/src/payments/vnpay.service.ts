import { createHmac } from 'node:crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';

export interface BuildVnpayUrlInput {
  transactionRef: string;
  amountVnd: number;
  orderInfo: string;
  ipAddr: string;
  createDate?: Date;
}

function formatVnpDate(date: Date): string {
  // Chuyển sang múi giờ Việt Nam (GMT+7) định dạng YYYYMMDDHHmmss
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = vnTime.getUTCFullYear().toString();
  const MM = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(vnTime.getUTCDate()).padStart(2, '0');
  const HH = String(vnTime.getUTCHours()).padStart(2, '0');
  const mm = String(vnTime.getUTCMinutes()).padStart(2, '0');
  const ss = String(vnTime.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
}

function encodeVnpValue(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

export function buildSortedQueryString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .filter((key) => params[key] !== undefined && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeVnpValue(params[key]!)}`)
    .join('&');
}

export function signVnpayParams(
  params: Record<string, string>,
  hashSecret: string,
): string {
  const signData = buildSortedQueryString(params);
  return createHmac('sha512', hashSecret)
    .update(Buffer.from(signData, 'utf-8'))
    .digest('hex');
}

@Injectable()
export class VnpayService {
  private getConfig() {
    const tmnCode = process.env.VNPAY_TMN_CODE?.trim();
    const hashSecret = process.env.VNPAY_HASH_SECRET?.trim();
    const vnpUrl =
      process.env.VNPAY_URL?.trim() ||
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const returnUrl =
      process.env.VNPAY_RETURN_URL?.trim() ||
      'http://localhost:3000/payment/result';

    if (!tmnCode || !hashSecret) {
      throw new InternalServerErrorException(
        'VNPAY configuration (VNPAY_TMN_CODE / VNPAY_HASH_SECRET) is missing',
      );
    }

    return { tmnCode, hashSecret, vnpUrl, returnUrl };
  }

  createPaymentUrl(input: BuildVnpayUrlInput): string {
    const { tmnCode, hashSecret, vnpUrl, returnUrl } = this.getConfig();
    const now = input.createDate ?? new Date();

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: input.transactionRef,
      vnp_OrderInfo: input.orderInfo,
      vnp_OrderType: 'other',
      // Quy tắc bắt buộc của VNPAY: nhân 100 (ví dụ 70.000đ -> 7000000)
      vnp_Amount: String(Math.round(input.amountVnd * 100)),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: input.ipAddr || '127.0.0.1',
      vnp_CreateDate: formatVnpDate(now),
    };

    const queryString = buildSortedQueryString(vnpParams);
    const secureHash = signVnpayParams(vnpParams, hashSecret);

    return `${vnpUrl}?${queryString}&vnp_SecureHash=${secureHash}`;
  }

  verifyIpnSignature(rawQuery: Record<string, unknown>): boolean {
    const { hashSecret } = this.getConfig();
    const receivedHash =
      typeof rawQuery.vnp_SecureHash === 'string'
        ? rawQuery.vnp_SecureHash.trim()
        : '';

    if (!receivedHash) {
      return false;
    }

    const cleanParams: Record<string, string> = {};
    for (const [key, val] of Object.entries(rawQuery)) {
      if (
        key.startsWith('vnp_') &&
        key !== 'vnp_SecureHash' &&
        key !== 'vnp_SecureHashType' &&
        val !== undefined &&
        val !== null &&
        String(val) !== ''
      ) {
        cleanParams[key] = String(val);
      }
    }

    const expectedHash = signVnpayParams(cleanParams, hashSecret);
    return expectedHash.toLowerCase() === receivedHash.toLowerCase();
  }
}