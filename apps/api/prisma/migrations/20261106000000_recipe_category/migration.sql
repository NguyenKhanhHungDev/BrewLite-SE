CREATE TYPE "ProductCategory" AS ENUM ('COFFEE', 'TEA', 'OTHER');

ALTER TABLE "Recipe" ADD COLUMN "category" "ProductCategory" NOT NULL DEFAULT 'OTHER';

UPDATE "Recipe" SET "category" = 'COFFEE'
WHERE "name" IN ('Cà phê sữa', 'Bạc xỉu', 'Cà phê đen đá', 'Cà phê muối');

UPDATE "Recipe" SET "category" = 'TEA'
WHERE "name" IN ('Trà đào', 'Trà sữa trân châu', 'Trà vải', 'Trà chanh');
