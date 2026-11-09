import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  parseAdminNote,
  parsePaymentAdminQuery,
} from './payment-admin-input.js';
import { PaymentReadDatabase } from './payment-read-database.js';
import { safePaymentSelect } from './payment-select.js';

/** Admin lookup and notes; financial state changes stay in the settlement adapter. */
@Injectable()
export class PaymentAdminService {
  constructor(private readonly db: PaymentReadDatabase) {}
  async reconciliation(page: number) {
    const where = { status: 'RECONCILIATION_REQUIRED' };
    const [total, payments] = await this.db.$transaction(
      [
        this.db.payment.count({ where }),
        this.db.payment.findMany({
          where,
          skip: (page - 1) * 20,
          take: 20,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            ...safePaymentSelect,
            order: { select: { id: true, status: true } },
          },
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { page, pageSize: 20, total, payments };
  }
  async adminTransactions(query: Record<string, unknown>) {
    const { page, limit, status, search, dateFrom, dateToExclusive } =
      parsePaymentAdminQuery(query);
    const id =
      /^[1-9]\d*$/.test(search) && Number(search) <= 2147483647
        ? Number(search)
        : undefined;
    const where: Prisma.PaymentWhereInput = {
      ...(status ? { status } : {}),
      ...(dateFrom || dateToExclusive
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateToExclusive ? { lt: dateToExclusive } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { transactionRef: { contains: search, mode: 'insensitive' } },
              {
                providerTransactionId: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              ...(id ? [{ orderId: id }, { id }] : []),
              {
                order: {
                  OR: [
                    {
                      recipientName: { contains: search, mode: 'insensitive' },
                    },
                    {
                      recipientPhone: { contains: search, mode: 'insensitive' },
                    },
                    {
                      user: {
                        OR: [
                          { email: { contains: search, mode: 'insensitive' } },
                          { name: { contains: search, mode: 'insensitive' } },
                          { phone: { contains: search, mode: 'insensitive' } },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };
    const [total, data] = await this.db.$transaction(
      [
        this.db.payment.count({ where }),
        this.db.payment.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            ...safePaymentSelect,
            adminNote: true,
            adminNoteUpdatedAt: true,
            order: {
              select: {
                id: true,
                status: true,
                total: true,
                recipientName: true,
                recipientPhone: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { data, page, limit, total, totalPages: Math.ceil(total / limit) };
  }
  async adminTransaction(id: number) {
    const payment = await this.db.payment.findUnique({
      where: { id },
      select: {
        ...safePaymentSelect,
        adminNote: true,
        adminNoteUpdatedAt: true,
        adminNoteUpdatedById: true,
        adminNoteUpdatedBy: { select: { id: true, name: true, email: true } },
        order: {
          select: {
            id: true,
            status: true,
            total: true,
            createdAt: true,
            recipientName: true,
            recipientPhone: true,
            user: { select: { id: true, name: true, email: true } },
            payments: {
              select: safePaymentSelect,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Không tìm thấy giao dịch.');
    return payment;
  }
  async saveAdminNote(id: number, actorId: number, body: unknown) {
    const note = parseAdminNote(body);
    await this.adminTransaction(id);
    await this.db.payment.update({
      where: { id },
      data: {
        adminNote: note,
        adminNoteUpdatedAt: new Date(),
        adminNoteUpdatedById: actorId,
      },
    });
    return this.adminTransaction(id);
  }
}
