# Bàn giao Recipes/Products — Hưng

Cập nhật 03/11/2026, nhánh `codex/fix-ingredient-recipe-migration`.
Nguồn phân công: `02_HUNG_LINUX_RECIPES_TICH_HOP.md` do Hưng cung cấp.
Trạng thái: đã triển khai và kiểm chứng API local với DB test riêng; chưa commit/push,
chưa nghiệm thu giao diện hoặc toàn bộ luồng thanh toán sandbox.

## Code và hợp đồng

- RecipesPrismaAdapter dùng PrismaPg, một client được chia sẻ cho Recipes và Products,
  đóng client khi module destroy. Create/update chạy trong Prisma transaction.
- Cập nhật khóa dòng Recipe trước khi thay liên kết nguyên liệu; lỗi unique map 409,
  thiếu ingredient/FK map 400, record bị xóa map 404. Không sửa snapshot Order.
- RecipesModule được đăng ký vào AppModule; ProductsModule dùng repository được export.
- `GET /recipes`, `GET /recipes/:id`, `POST /recipes`, `PATCH /recipes/:id` đều dùng
  JwtAuthGuard + AdminGuard đọc role từ DB. Không token 401; Customer 403.
- Response Recipe: `{id,name,price,imageUrl,isActive,ingredients:[{ingredientId,name,unit,quantity}]}`.
- Create yêu cầu name, price nguyên dương, ảnh `/images/products/<slug>.jpg`, isActive,
  ingredients không rỗng/trùng ID, quantity nguyên dương. PATCH bỏ qua trường không gửi,
  từ chối null và trường lạ. Các validation nghiệp vụ ở RecipesService dùng chung.
- Products đọc Recipe active; trả đúng `{id,name,price,imageUrl,stock}` cho frontend,
  id = Recipe.id như Orders. Stock là số ly M không topping từ available nhỏ nhất.
- Product cũ vẫn giữ để đọc lịch sử, không còn được dùng làm menu.

## Minh chứng

Trong `apps/api`:

```bash
npm run build
npm run lint
RUN_DB_INTEGRATION=0 npm test -- --maxWorkers=2
```

Build đạt; lint đạt với 3 cảnh báo cũ ngoài phần Recipes/Products.
Unit suite: 108 passed / 14 skipped. Các test Product cũ phụ thuộc truy vấn Product
đã được thay bằng test hành vi Recipe/available/ẩn món; test RecipeMenu và RecipesService
vẫn được giữ. Các bài skip không được tính là đã kiểm chứng DB.

Bài kiểm chứng DB/HTTP: `scripts/verify-foundation.mjs`, hướng dẫn chuẩn bị DB riêng tại
`docs/foundation-verification.md`. Phiên chạy thành công dùng PostgreSQL 18.6 UTF8,
DB tạm `brewlite_auth_check_5`, API tạm cổng 55440. Ba nhóm PASS:

1. Migration, seed hai lần, giữ tồn/reserved và dữ liệu lịch sử, seed rollback.
2. Recipes create/list/PATCH, quyền truy cập, menu 10 Recipe, không lấy Product legacy;
   đủ/giảm available; hai create cùng tên nhận 201/409; lỗi FK trong transaction update
   rollback được liên kết cũ; snapshot OrderItem/OrderIngredient giữ nguyên sau PATCH/ẩn món.
3. Auth/me, 401/403/200, quyền xem đơn theo chủ sở hữu và role DB có hiệu lực ngay.

Ví dụ kiểm chứng số học: recipe thử cần 20g, kho 1500g và reserved 40g → menu 73 ly.
Đặt 2 ly giữ thêm 40g, đổi định lượng thành 30g → menu 47 ly; đơn cũ vẫn ghi 40g.
API test và PostgreSQL tạm đã dừng; không áp dụng migration/seed vào DB demo.

## Phần còn lại theo chủ module

- Huy: Ingredients API, Admin UI, rewrite `/ingredients/:path*`, `/recipes/:path*`,
  `/api/admin/orders`; kết nối checkout thanh toán sandbox và `/payment/result`.
- Thắng + Phát: nối Payment/callback với consume/release trong cùng transaction; kiểm thử
  idempotency, hết hạn, thất bại và thanh toán muộn. Chưa xác nhận luồng này hoàn tất.
- Hưng: kiểm thử giao diện và tổng duyệt end-to-end sau các phần trên; cập nhật README
  và minh chứng demo. Chưa có bằng chứng frontend build/browser demo cho phiên này.
- PostgreSQL test hiện dùng bản 18.6; cần xác nhận lại trên PostgreSQL 17 của Compose
  trước nghiệm thu cuối.
