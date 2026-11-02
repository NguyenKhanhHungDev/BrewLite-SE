import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is missing');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

async function main() {
  await prisma.$transaction(
    async (tx) => {
      console.log('🌱 Bắt đầu seed dữ liệu nguyên liệu và công thức...');

      // 1. Danh sách nguyên liệu chuẩn (15 loại)
      const ingredientsData = [
        { name: 'Cà phê bột', unit: 'g', stock: 2000, minStock: 400 },
        { name: 'Sữa đặc', unit: 'ml', stock: 2000, minStock: 400 },
        { name: 'Sữa tươi', unit: 'ml', stock: 5000, minStock: 1000 },
        { name: 'Trà khô', unit: 'g', stock: 1000, minStock: 200 },
        { name: 'Nước', unit: 'ml', stock: 20000, minStock: 4000 },
        { name: 'Đá', unit: 'g', stock: 10000, minStock: 2000 },
        { name: 'Đường', unit: 'g', stock: 1000, minStock: 200 },
        { name: 'Siro đào', unit: 'ml', stock: 1000, minStock: 200 },
        { name: 'Siro vải', unit: 'ml', stock: 1000, minStock: 200 },
        { name: 'Matcha', unit: 'g', stock: 1000, minStock: 200 },
        { name: 'Bột cacao', unit: 'g', stock: 1000, minStock: 200 },
        { name: 'Nước cốt chanh', unit: 'ml', stock: 1000, minStock: 200 },
        { name: 'Muối', unit: 'g', stock: 1000, minStock: 200 },
        { name: 'Kem sữa', unit: 'ml', stock: 1000, minStock: 200 },
        { name: 'Trân châu', unit: 'g', stock: 1000, minStock: 200 },
      ];

      const ingredientMap = new Map<string, number>();

      for (const ing of ingredientsData) {
        // Dùng upsert để không ghi đè stock nếu đã có giao dịch
        const existing = await tx.ingredient.findUnique({
          where: { name: ing.name },
        });

        let record;
        if (!existing) {
          record = await tx.ingredient.create({
            data: ing,
          });
        } else {
          if (existing.unit !== ing.unit) {
            throw new Error(`Ingredient unit mismatch: ${ing.name}`);
          }
          record = await tx.ingredient.update({
            where: { name: ing.name },
            data: { minStock: ing.minStock }, // Giữ nguyên stock cũ nếu đã tồn tại
          });
        }
        ingredientMap.set(record.name, record.id);
      }

      // 2. Danh sách 10 công thức demo kèm định lượng size M
      const recipesData = [
        {
          name: 'Cà phê sữa',
          price: 35000,
          imageUrl: '/images/products/ca-phe-sua.jpg',
          recipeIngredients: [
            { name: 'Cà phê bột', quantity: 20 },
            { name: 'Sữa đặc', quantity: 30 },
            { name: 'Nước', quantity: 100 },
            { name: 'Đá', quantity: 100 },
          ],
        },
        {
          name: 'Trà đào',
          price: 39000,
          imageUrl: '/images/products/tra-dao.jpg',
          recipeIngredients: [
            { name: 'Trà khô', quantity: 8 },
            { name: 'Siro đào', quantity: 35 },
            { name: 'Nước', quantity: 180 },
            { name: 'Đá', quantity: 100 },
          ],
        },
        {
          name: 'Bạc xỉu',
          price: 38000,
          imageUrl: '/images/products/bac-xiu.jpg',
          recipeIngredients: [
            { name: 'Cà phê bột', quantity: 10 },
            { name: 'Sữa đặc', quantity: 35 },
            { name: 'Sữa tươi', quantity: 100 },
            { name: 'Đá', quantity: 100 },
          ],
        },
        {
          name: 'Cà phê đen đá',
          price: 29000,
          imageUrl: '/images/products/ca-phe-den-da.jpg',
          recipeIngredients: [
            { name: 'Cà phê bột', quantity: 20 },
            { name: 'Nước', quantity: 120 },
            { name: 'Đá', quantity: 100 },
          ],
        },
        {
          name: 'Cà phê muối',
          price: 42000,
          imageUrl: '/images/products/ca-phe-muoi.jpg',
          recipeIngredients: [
            { name: 'Cà phê bột', quantity: 20 },
            { name: 'Sữa đặc', quantity: 25 },
            { name: 'Kem sữa', quantity: 25 },
            { name: 'Muối', quantity: 1 },
            { name: 'Đá', quantity: 100 },
          ],
        },
        {
          name: 'Trà sữa trân châu',
          price: 45000,
          imageUrl: '/images/products/tra-sua-tran-chau.jpg',
          recipeIngredients: [
            { name: 'Trà khô', quantity: 8 },
            { name: 'Sữa tươi', quantity: 150 },
            { name: 'Đường', quantity: 15 },
            { name: 'Trân châu', quantity: 40 },
            { name: 'Đá', quantity: 100 },
          ],
        },
        {
          name: 'Trà vải',
          price: 40000,
          imageUrl: '/images/products/tra-vai.jpg',
          recipeIngredients: [
            { name: 'Trà khô', quantity: 8 },
            { name: 'Siro vải', quantity: 35 },
            { name: 'Nước', quantity: 180 },
            { name: 'Đá', quantity: 100 },
          ],
        },
        {
          name: 'Matcha latte',
          price: 49000,
          imageUrl: '/images/products/matcha-latte.jpg',
          recipeIngredients: [
            { name: 'Matcha', quantity: 8 },
            { name: 'Sữa tươi', quantity: 180 },
            { name: 'Đường', quantity: 10 },
            { name: 'Đá', quantity: 100 },
          ],
        },
        {
          name: 'Cacao sữa',
          price: 42000,
          imageUrl: '/images/products/cacao-sua.jpg',
          recipeIngredients: [
            { name: 'Bột cacao', quantity: 20 },
            { name: 'Sữa tươi', quantity: 180 },
            { name: 'Đường', quantity: 10 },
            { name: 'Đá', quantity: 100 },
          ],
        },
        {
          name: 'Trà chanh',
          price: 29000,
          imageUrl: '/images/products/tra-chanh.jpg',
          recipeIngredients: [
            { name: 'Trà khô', quantity: 8 },
            { name: 'Nước cốt chanh', quantity: 30 },
            { name: 'Đường', quantity: 15 },
            { name: 'Nước', quantity: 180 },
            { name: 'Đá', quantity: 100 },
          ],
        },
      ];

      for (const rec of recipesData) {
        const recipe = await tx.recipe.upsert({
          where: { name: rec.name },
          update: { price: rec.price, imageUrl: rec.imageUrl },
          create: {
            name: rec.name,
            price: rec.price,
            imageUrl: rec.imageUrl,
            isActive: true,
          },
        });

        // Xóa liên kết cũ và tạo lại định lượng mới để tránh trùng lặp
        await tx.recipeIngredient.deleteMany({
          where: { recipeId: recipe.id },
        });

        for (const item of rec.recipeIngredients) {
          const ingId = ingredientMap.get(item.name);
          if (!ingId) throw new Error(`Missing ingredient: ${item.name}`);
          await tx.recipeIngredient.create({
            data: {
              recipeId: recipe.id,
              ingredientId: ingId,
              quantity: item.quantity,
            },
          });
        }
      }
    },
    { timeout: 30_000 },
  );
  console.log('✅ Seed dữ liệu thành công hoàn tất!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi chạy seed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
