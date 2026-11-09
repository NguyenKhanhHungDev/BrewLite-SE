import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/** One shared Prisma connection owner for customer/admin payment reads. */
@Injectable()
export class PaymentReadDatabase
  extends PrismaClient
  implements OnModuleDestroy
{
  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    super({ adapter: new PrismaPg({ connectionString: url }) });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
