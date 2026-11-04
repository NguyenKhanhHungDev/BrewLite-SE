# Kiểm chứng nền database, seed và Auth

Ngày: 03/11/2026. Nhánh: `codex/fix-ingredient-recipe-migration`.
Đây là kết quả local trên working tree; chưa commit/push hoặc áp dụng vào DB demo.

## Thay đổi

- Sửa conflict schema, giữ Payment lịch sử và tham chiếu Product lịch sử.
- Migration `20261103020000_ingredient_recipe_admin` thêm bảng/trường và CHECK constraints.
- Guard đọc role từ DB qua AuthService; AuthModule export AuthService cho guard dùng trong OrdersModule.
- `/auth/me` trả role. Khách vẫn xem đơn của mình; Admin có thể xem toàn bộ.
- Seed dùng PrismaPg và import ESM đúng; toàn bộ seed trong một transaction.
  Chạy lại giữ stock/reserved, từ chối đổi unit không khớp và rollback nếu có lỗi.

## Kết quả thực tế

PostgreSQL tạm 18.6, UTF-8, riêng trên `127.0.0.1:55439`.
API build thật được chạy tạm ở cổng 55440; không dùng DB demo hay secret thật.

- `prisma migrate deploy`: áp dụng đủ migration lên database trống.
- Seed hai lần: 15 Ingredient, 10 Recipe, 42 RecipeIngredient; không nhân đôi.
- Sau sửa tồn thử thành stock=1500, reserved=40, seed lần hai giữ nguyên cả hai.
- OrderItem/Product và Payment.transactionRef giả lập lịch sử còn nguyên sau seed.
- Unit không khớp ở nguyên liệu cuối khiến seed thất bại và rollback thay đổi trước đó.
- HTTP đăng ký gửi role ADMIN bị 400; đăng ký thường mặc định CUSTOMER.
- `/auth/me` trả role hiện tại, không trả passwordHash.
- `/admin/orders`: thiếu/sai token 401, CUSTOMER 403, ADMIN 200.
- `/orders/100`: khách khác chủ nhận 404; ADMIN nhận 200.
- Sau hạ ADMIN về CUSTOMER, cùng token cũ bị 403 ở Admin API và 404 ở đơn khác chủ.

## Chạy lại

Từ `apps/api`, sau `npm ci`, generate client và `npm run build`.
Chuẩn bị **database mới trống** trên PostgreSQL test local cổng 55439, tên
`brewlite_auth_check` hoặc `brewlite_auth_check_<số>`, encoding UTF8.
Script từ chối hostname/port/tên DB khác, cần opt-in `VERIFY_FOUNDATION=1`.
Nó ghi fixture và giữ dữ liệu test sau khi chạy; để chạy lại hãy tạo DB test mới,
không chạy script trên DB demo hoặc reset dữ liệu hiện có.

```bash
DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:55439/brewlite_auth_check_3' \
VERIFY_FOUNDATION=1 node scripts/verify-foundation.mjs
```

Kết quả phiên kiểm tra: cả hai dòng `PASS` (seed/migration và HTTP) đều xuất hiện.
API con được dừng trong finally. PostgreSQL tạm cũng đã dừng sau phiên kiểm tra.

## Kiểm chứng bổ sung Recipes/Menu

Bộ script đã mở rộng và chạy đạt trên DB `brewlite_auth_check_5`: Recipes CRUD/quyền,
menu 10 Recipe, stock sau giữ kho, tạo trùng tên đồng thời, rollback FK khi thay nguyên liệu
và snapshot đơn cũ sau sửa công thức. Chi tiết ở `docs/recipes-products-handoff.md`.
Script hiện in ba nhóm PASS.

## Giới hạn

Chưa kiểm chứng Ingredients routes, giao diện, checkout thanh toán sandbox hoặc callback.
14 integration tests cũ vẫn skip trong lần chạy unit suite; không tính chúng là đạt.
Seed cập nhật giá/ảnh và định lượng demo; chỉ chạy trong môi trường đã xác minh,
không dùng seed để thay thế luồng quản trị công thức đang hoạt động.
