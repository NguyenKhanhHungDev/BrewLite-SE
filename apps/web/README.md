# BrewLite — A1-03 Menu

Issue: [A1-03 — Menu đồ uống](https://github.com/NguyenKhanhHungDev/BrewLite-SE/issues/3).
Nhánh: `feature/a1-03-menu`. Giao diện tham chiếu: `brewlite-ui (7)`.

## Chạy

Cần API ở `http://localhost:3001`, PostgreSQL và `.env` theo
[README gốc](../../README.md). Cấu hình Prisma có sẵn tại
`apps/api/prisma7.config.ts`; truyền `--config prisma7.config.ts` khi chạy
Prisma CLI từ `apps/api`. Nếu chưa có database, nhờ Hưng xác nhận cấu hình.

```powershell
cd apps/web
npm.cmd ci
npm.cmd run dev -- --port 3000
```

Mở http://localhost:3000. Rewrite `/products` chuyển tiếp tới API NestJS
`http://localhost:3001/products` để frontend gọi cùng origin. Response là mảng
`{id, name, price, imageUrl, stock}`; kiểu dữ liệu tại `lib/products.ts`.

Menu có Header/Hero/Footer, lưới 3 cột desktop và 2 cột tablet/mobile,
loading/empty/error và nút thử lại. Size/topping, Detail và Cart thuộc task sau.

DM Sans/Fraunces được tải lúc build bằng `next/font/google` và phục vụ từ
Next.js; cần mạng khi build lần đầu. Arial/Georgia là font dự phòng.
Ảnh API lỗi hoặc chưa có dùng ảnh thay thế chung kèm “Ảnh đang cập nhật”.

## Kiểm tra

```powershell
npm.cmd run lint
npm.cmd run build
```

Kết quả và ảnh: [kiểm tra A1-03](docs/a1-03-verification.md).
