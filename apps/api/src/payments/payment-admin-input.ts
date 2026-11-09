import { BadRequestException } from '@nestjs/common';
export const paymentStatuses = [
  'PENDING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'RECONCILIATION_REQUIRED',
];
export function parsePaymentAdminQuery(query: Record<string, unknown>) {
  const integer = (value: unknown, fallback: number, max: number) => {
    if (value === undefined) return fallback;
    if (
      typeof value !== 'string' ||
      !/^[1-9]\d*$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) > max
    )
      throw new BadRequestException('Phân trang không hợp lệ.');
    return Number(value);
  };
  const page = integer(query.page, 1, 1000000),
    limit = integer(query.limit, 20, 50);
  const status =
    query.status === undefined || query.status === 'ALL' ? null : query.status;
  if (
    status !== null &&
    (typeof status !== 'string' || !paymentStatuses.includes(status))
  )
    throw new BadRequestException('Trạng thái thanh toán không hợp lệ.');
  if (
    query.search !== undefined &&
    (typeof query.search !== 'string' || query.search.length > 200)
  )
    throw new BadRequestException('Từ khóa tối đa 200 ký tự.');
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const date = (raw: unknown) => {
    if (raw === undefined) return null;
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw))
      throw new BadRequestException('Ngày phải có định dạng YYYY-MM-DD.');
    const parsed = new Date(`${raw}T00:00:00Z`);
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== raw
    )
      throw new BadRequestException('Ngày không hợp lệ.');
    return new Date(parsed.getTime() - 7 * 3600000);
  };
  const dateFrom = date(query.dateFrom),
    end = date(query.dateTo);
  if (dateFrom && end && dateFrom > end)
    throw new BadRequestException('Ngày bắt đầu không được sau ngày kết thúc.');
  return {
    page,
    limit,
    status,
    search,
    dateFrom,
    dateToExclusive: end ? new Date(end.getTime() + 86400000) : null,
  };
}
export function parseAdminNote(body: unknown) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !('note' in body) ||
    typeof body.note !== 'string' ||
    body.note.length > 1000
  )
    throw new BadRequestException('Ghi chú phải là chuỗi tối đa 1000 ký tự.');
  return body.note.trim();
}
