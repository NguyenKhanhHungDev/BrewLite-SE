/**
 * BrewLite-SE – 10 dữ liệu đồ uống mẫu cho Assignment 1.
 *
 * Cách dùng:
 * 1. Sao chép toàn bộ nội dung file này thay cho BrewLite-SE/apps/api/prisma/seed.ts.
 * 2. Mở terminal tại BrewLite-SE/apps/api.
 * 3. Bảo đảm PostgreSQL đang chạy, .env có DATABASE_URL và đã chạy migration.
 * 4. Nếu chưa cài thư viện: npm install
 * 5. Tạo Prisma Client: npx prisma generate --config ./prisma7.config.ts
 * 6. Thêm dữ liệu: npx prisma db seed --config ./prisma7.config.ts
 * 7. Kiểm tra: GET http://localhost:3001/products (sau khi chạy API).
 *
 * Không chạy prisma migrate reset: lệnh reset sẽ xóa dữ liệu trong database.
 * Có thể chạy lại seed: sản phẩm trùng tên sẽ không được tạo thêm.
 * ID do PostgreSQL tự cấp, không tự đặt ID để tránh đè dữ liệu khác.
 *
 * Không bổ sung size/topping: schema Product hiện tại mới có
 * id, name, price, imageUrl, stock. Size/topping thuộc công việc A1-04
 * và cần được nhóm thống nhất riêng.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing in apps/api/.env');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

// 10 ảnh nằm tại apps/web/public/images/products/ trong gói dữ liệu mẫu.
// URL được Next.js phục vụ từ thư mục public, không ghi chữ "public" vào URL.
const imageOf = (fileName: string) => `/images/products/${fileName}.svg`;

const products = [
  { name: 'Cà phê sữa', price: 35000, imageUrl: imageOf('ca-phe-sua'), stock: 30 },
  { name: 'Trà đào', price: 39000, imageUrl: imageOf('tra-dao'), stock: 25 },
  { name: 'Bạc xỉu', price: 38000, imageUrl: imageOf('bac-xiu'), stock: 20 },
  { name: 'Cà phê đen đá', price: 29000, imageUrl: imageOf('ca-phe-den-da'), stock: 35 },
  { name: 'Cà phê muối', price: 42000, imageUrl: imageOf('ca-phe-muoi'), stock: 25 },
  { name: 'Trà sữa trân châu', price: 45000, imageUrl: imageOf('tra-sua-tran-chau'), stock: 30 },
  { name: 'Trà vải', price: 40000, imageUrl: imageOf('tra-vai'), stock: 20 },
  { name: 'Matcha latte', price: 49000, imageUrl: imageOf('matcha-latte'), stock: 18 },
  { name: 'Cacao sữa', price: 42000, imageUrl: imageOf('cacao-sua'), stock: 22 },
  { name: 'Trà chanh', price: 29000, imageUrl: imageOf('tra-chanh'), stock: 40 },
];

// Ba mẫu cũ trỏ tới ảnh .jpg chưa tồn tại. Chỉ sửa đường dẫn ảnh mẫu
// cũ hoặc placeholder; không ghi đè ảnh thật do nhóm tự bổ sung.
const oldImageUrls: Record<string, string> = {
  'Cà phê sữa': '/images/ca-phe-sua.jpg',
  'Trà đào': '/images/tra-dao.jpg',
  'Bạc xỉu': '/images/bac-xiu.jpg',
};

async function main() {
  let created = 0;
  let reused = 0;
  let fixedImage = 0;

  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name },
    });

    if (!existing) {
      await prisma.product.create({ data: product });
      created++;
      continue;
    }

    reused++;
    if (
      existing.imageUrl === oldImageUrls[product.name] ||
      existing.imageUrl === '/images/drink-placeholder.svg'
    ) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { imageUrl: product.imageUrl },
      });
      fixedImage++;
    }
  }

  const totalInDatabase = await prisma.product.count();
  console.log(`BrewLite seed: đã kiểm tra ${products.length} mẫu.`);
  console.log(`Tạo mới: ${created}; đã có: ${reused}; sửa đường dẫn ảnh cũ: ${fixedImage}.`);
  console.log(`Tổng bản ghi Product trong database: ${totalInDatabase}.`);
  console.log('Nếu database đã có sản phẩm riêng trước đó, tổng có thể lớn hơn 10.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
