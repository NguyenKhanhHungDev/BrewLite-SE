import 'dotenv/config';
import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class ProductsService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured');
    }

    const adapter = new PrismaPg({
      connectionString: databaseUrl,
    });

    this.prisma = new PrismaClient({ adapter });
  }

  async findAll() {
    return this.prisma.product.findMany({
      orderBy: {
        id: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}