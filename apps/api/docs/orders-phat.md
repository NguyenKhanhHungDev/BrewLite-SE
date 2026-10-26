# Orders API — phần Phát (A1-06, A1-09, A1-10)

Các giá tiền là số nguyên VND. Không gửi `total`, `unitPrice` hoặc `discount` do client tự tính; server tự lấy giá từ Product trong database.

## Tạo đơn — `POST /orders`

Bắt buộc `Authorization: Bearer <accessToken>`. `Idempotency-Key` là header tùy chọn; nếu gửi, dùng lại cùng key và cùng payload sẽ trả về đơn đã tạo, còn dùng lại key với payload khác sẽ trả `409 Conflict`. Key có độ dài 1–200 ký tự.

```bash
curl -i -X POST http://localhost:3001/orders \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Idempotency-Key: checkout-20261026-001' \
  -d '{"items":[{"productId":1,"quantity":2,"size":"L","toppings":["PEARL"]}],"promoCode":"BREW10"}'
```

`promoCode` không bắt buộc. Mã demo hợp lệ hiện tại là `BREW10`, giảm 10% tổng tiền hàng. Mã khác bị từ chối. Response giữ contract hiện có: `orderId`, `status`, `total` (tổng tiền phải trả sau giảm giá).

## Lịch sử đơn — `GET /orders/me`

Bắt buộc JWT. User ID chỉ lấy từ token; endpoint không nhận userId qua query/body. Ví dụ:

```bash
curl -i http://localhost:3001/orders/me \
  -H 'Authorization: Bearer TOKEN'
```

Trả `[]` khi user chưa có đơn. Mỗi phần tử gồm `id`, `status`, `total`, `createdAt`, và `items` (productId, quantity, size, toppings, unitPrice, subtotal). Query giới hạn bằng userId của token và sắp xếp `createdAt DESC`.

## State machine và loyalty

`OrderStateService.transition(orderId, nextStatus)` là service backend, chưa tạo endpoint admin/barista. Luồng hợp lệ:

- `PENDING -> PAID | PAYMENT_FAILED | CANCELLED`
- `PAYMENT_FAILED -> PENDING | CANCELLED`
- `PAID -> PREPARING -> READY -> COMPLETED`

`COMPLETED` và `CANCELLED` là trạng thái kết thúc. Việc ghi trạng thái dùng `updateMany` với điều kiện status hiện tại để tránh ghi đè do request đồng thời.

Khi gọi service transition để chuyển đơn sang `PAID`, service yêu cầu `LoyaltyService` ghi điểm trong transaction. Điểm demo là `floor(total / 10000)`; `Order.loyaltyAwarded` và thao tác claim có điều kiện bảo đảm retry không cộng điểm lần hai. **Module Payments hiện chưa được nối vào OrderStateService/LoyaltyService** theo phạm vi này; khi tích hợp thanh toán, luồng thành công cần gọi state transition thay vì ghi trực tiếp `Order.status`.

## Database và kiểm thử

Migration mới `20261026130000_orders_business_features` chỉ bổ sung cột/index, không sửa migration cũ và không xóa dữ liệu. Chạy từ `apps/api`:

```bash
npx prisma generate --config ./prisma7.config.ts
npx prisma migrate deploy --config ./prisma7.config.ts
npm run build
npm test
```

Để xác nhận A1-06 với PostgreSQL thật, cần cấu hình `apps/api/.env`, khởi động PostgreSQL, đăng ký/đăng nhập để lấy token rồi gọi `POST /orders`. Bộ unit test không thay thế bước xác nhận ghi thật vào bảng `Order` và `OrderItem`.

Tuỳ chọn chạy integration test có ghi dữ liệu thử và tự dọn dữ liệu tạo ra (chỉ dùng database test/dev riêng):

```bash
cd apps/api
RUN_DB_INTEGRATION=1 npm test -- src/orders/orders.integration.spec.ts
```

Test cần PostgreSQL đang chạy, migration đã deploy, và `DATABASE_URL`/`JWT_SECRET` đã cấu hình. Mặc định test này được skip để `npm test` không phụ thuộc một database đang chạy.
