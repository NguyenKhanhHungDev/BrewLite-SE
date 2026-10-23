import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is missing');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  // Mẫu đồ uống để kiểm tra API; không phải dữ liệu khách hàng thật.
  const products = [
    { name: 'Cà phê sữa', price: 35000, imageUrl: '/images/ca-phe-sua.jpg', stock: 30 },
    { name: 'Trà đào', price: 39000, imageUrl: '/images/tra-dao.jpg', stock: 25 },
    { name: 'Bạc xỉu', price: 38000, imageUrl: '/images/bac-xiu.jpg', stock: 20 },
  ];

  for (const product of products) {
    const exists = await prisma.product.findFirst({ where: { name: product.name } });
    if (!exists) await prisma.product.create({ data: product });
  }
  console.log('Seed Product completed');
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });