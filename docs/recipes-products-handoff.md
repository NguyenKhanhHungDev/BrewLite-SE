# Bàn giao Recipes/Products — Hưng

Ngày kiểm tra: 01/11/2026. Nhánh: `feature/recipe-products-api`.
Nguồn yêu cầu: `02_HUNG_LINUX_RECIPES_TICH_HOP.md` do Hưng cung cấp.

## Trạng thái

**Chuẩn bị bằng interface/mock, chưa nghiệm thu tích hợp.** Schema hiện tại chưa có
Ingredient, Recipe, RecipeIngredient, OrderIngredient, User.role và snapshot
recipeId/recipeName. Chưa có AdminGuard. Orders vẫn tham chiếu Product.
Không bật menu dùng Recipe.id khi Orders còn hiểu productId là Product.id.

Các tài liệu PROJECT_CONTEXT, PROJECT_ROADMAP, TEAM_ASSIGNMENTS, ARCHITECTURE
được skill tham chiếu không có trong checkout này. Những tài liệu Malware Detection
trong hướng dẫn IDE cũng không có và thuộc dự án khác. Không suy đoán nội dung các file thiếu.

## File thêm

- `apps/api/src/recipes/dto/create-recipe.dto.ts`: validate tên, giá nguyên dương
  trong miền PostgreSQL Int, ảnh `/images/products/<slug>.jpg`, boolean,
  nguyên liệu không rỗng và không trùng ID.
- `apps/api/src/recipes/dto/update-recipe.dto.ts`: PATCH từng trường; từ chối null.
- `apps/api/src/recipes/recipes.contract.ts`: interface repository/transaction,
  dữ liệu công thức kèm tên, đơn vị, tồn và reserved.
- `apps/api/src/recipes/recipes.service.ts`: đọc, tạo, sửa; kiểm tra tên trùng,
  tham chiếu nguyên liệu; yêu cầu mutation qua transaction của repository.
- `apps/api/src/products/recipe-menu.service.ts`: menu chỉ lấy công thức active,
  giữ shape frontend, tính min(floor(max(0, stock-reserved)/quantity)).
  Từ chối công thức rỗng, định lượng sai, tồn/reserved âm và nguyên liệu trùng.
- Hai file `*.spec.ts` tương ứng: 39 test bổ sung dùng mock, không truy cập DB.

Không thay `.env`, Compose, schema, migration, seed, Orders, Payment hay module đang chạy.
Không commit/push/merge hoặc liên hệ thành viên nhóm.

## Phần cần tích hợp sau

1. Khoa cung cấp schema/migration/seed 10 món đúng bảng yêu cầu và cơ chế role.
   Không hardcode Ingredient.id; đối chiếu tên và ảnh .jpg. Không xóa Product cũ.
2. Viết Prisma repository dùng client chung, map quan hệ thực tế sang contract.
   `transaction` phải dùng Prisma transaction thật; create/update liên kết phải
   nguyên tử. Map unique conflict kể cả race thành 409, thiếu tham chiếu thành
   400/404. Không ghi snapshot lịch sử đơn hàng.
3. Thêm controller/module Recipes có JwtAuthGuard + AdminGuard và validation;
   chỉ đăng ký vào AppModule khi dependencies đã sẵn sàng. Không mở route admin
   tạm thời thiếu guard. Kiểm tra 401/403 và token Admin thực tế.
4. Phát chuyển Orders sang Recipe, giữ request productId và transaction nguyên liệu.
   Khi đó mới nối ProductsService với RecipeMenuService. Huy bổ sung rewrites.
5. Kiểm thử DB rollback/concurrency, PATCH giữ lịch sử, seed thực trả đúng 10 món,
   VNPAY IPN và luồng demo. Mock hiện tại không chứng minh các tiêu chí này.

## Kiểm chứng local

Trong `apps/api`:

```bash
npx prisma generate --config ./prisma7.config.ts
npm test
npm run build
npm run lint
```

Baseline trước sửa: 57 passed / 10 skipped; build lỗi 31 lỗi TypeScript do client
generated cũ thiếu Order/Payment. Generate lại client từ schema hiện tại không
đụng DB và khắc phục lỗi build. Sau thêm: 96 passed / 10 skipped; build đạt.
10 test integration bị skip không được tính là đã kiểm thử DB.

API lint đạt, còn 2 cảnh báo no-base-to-string trong `payments/vnpay.service.ts`
dòng 112 và 114, ngoài phần thay đổi. Code mới không có cảnh báo lint.
Web: `npm run lint` đạt. `npm run build` thất bại: lần đầu không tải được
Google Fonts (DM Sans/Fraunces); lần chạy lại với yêu cầu quyền mở rộng gặp
Turbopack panic khi xử lý CSS do binding to a port: Operation not permitted.
Chưa có bằng chứng build Web thành công; không sửa frontend để né lỗi môi trường.
Root: `docker compose config --quiet` đạt; chưa khởi động Compose hay chạy migration/seed.
`curl --max-time 5 http://localhost:3001/products` và cổng 3000 đều không kết nối
được tại thời điểm kiểm tra; chưa có bằng chứng menu chạy hoặc ảnh/clip demo.

Các ảnh 10 món .jpg theo tài liệu đã tồn tại trong `apps/web/public/images/products/`.
Chưa xác minh dữ liệu DB hoặc cập nhật main từ remote; không tự merge nhánh người khác.
