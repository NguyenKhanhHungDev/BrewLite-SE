import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load môi trường từ .env
dotenv.config({ path: resolve(__dirname, '../.env') });

async function grantAdmin() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Lỗi: Biến môi trường DATABASE_URL chưa được định nghĩa.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const rawEmail = process.env.ADMIN_EMAIL;

    if (!rawEmail || rawEmail.trim() === '') {
      console.error('❌ Lỗi: Biến môi trường ADMIN_EMAIL chưa được cung cấp hoặc bị trống.');
      console.error('Vui lòng chạy với lệnh: $env:ADMIN_EMAIL="email@example.com"; npx tsx scripts/grant-admin.ts');
      process.exit(1);
    }

    const email = rawEmail.trim().toLowerCase();

    // 1. Tìm user theo email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ Lỗi: Không tìm thấy người dùng với email "${email}". Hãy đăng ký tài khoản trước!`);
      process.exit(1);
    }

    // 2. Cập nhật role thành ADMIN
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    console.log(`✅ Cấp quyền Admin thành công cho User ID: ${updatedUser.id} (${updatedUser.email}). Role hiện tại: ${updatedUser.role}`);
  } catch (error) {
    console.error('❌ Đã xảy ra lỗi trong quá trình cấp quyền Admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

grantAdmin();