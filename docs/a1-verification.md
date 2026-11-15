# Kiểm chứng Assignment 1

Các lệnh dưới đây chạy trên nhánh audit/fix, chỉ dùng database local/test riêng. Không chạy integration trên database demo chung hay dữ liệu thật. Không dùng các container đang chạy của nhóm làm đích kiểm thử. Không xóa volume/database để làm test xanh.

## Cài và kiểm tra không cần DB

Node 24, npm; mỗi app có lockfile riêng. Từ thư mục gốc:

```bash
cd apps/api
npm ci --no-audit --no-fund
DATABASE_URL='postgresql://a1_test:a1_test@127.0.0.1:55432/brewlite_huy_test_a1' npx --no-install prisma generate --config ./prisma7.config.ts
npm run build
npm run lint
npm test -- --maxWorkers=2
cd ../web
npm ci --no-audit --no-fund
npm run lint
npx --no-install tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
../api/node_modules/.bin/tsx scripts/check-cart-stock.ts
../api/node_modules/.bin/tsx scripts/check-payment-contract.ts
```

Lệnh test mặc định skip các integration cần biến opt-in. Vì vậy 0 fail ở đây chưa chứng minh Task 10 trên PostgreSQL. Build web không cần backend đang chạy nhưng hành trình UI cần API/DB thật.

## PostgreSQL riêng và toàn bộ test

Ví dụ dành riêng cho test, các mật khẩu trong ví dụ không dùng cho production. Nếu tên container hoặc port đã tồn tại, dùng tài nguyên test mới; không xóa tài nguyên cũ.

```bash
docker run -d --name brewlite-a1-audit-db \
  -e POSTGRES_USER=a1_test -e POSTGRES_PASSWORD=a1_test \
  -e POSTGRES_DB=brewlite_huy_test_a1 \
  -p 127.0.0.1:55432:5432 \
  --health-cmd='pg_isready -U a1_test -d brewlite_huy_test_a1' \
  --health-interval=2s --health-retries=20 postgres:17
docker inspect --format '{{.State.Health.Status}}' brewlite-a1-audit-db
# Chỉ tiếp tục khi healthy.
docker exec brewlite-a1-audit-db createdb -U a1_test brewlite_payment_test_a1
docker exec brewlite-a1-audit-db createdb -U a1_test brewlite_huy_test_operations
cd apps/api
export DATABASE_URL='postgresql://a1_test:a1_test@127.0.0.1:55432/brewlite_huy_test_a1'
export INGREDIENTS_TEST_DATABASE_URL="$DATABASE_URL"
export PAYMENTS_TEST_DATABASE_URL='postgresql://a1_test:a1_test@127.0.0.1:55432/brewlite_payment_test_a1'
export OPERATIONS_TEST_DATABASE_URL='postgresql://a1_test:a1_test@127.0.0.1:55432/brewlite_huy_test_operations'
export JWT_SECRET='a1-isolated-audit-secret'
export RUN_DB_INTEGRATION=1
npx --no-install prisma migrate deploy --config ./prisma7.config.ts
DATABASE_URL="$PAYMENTS_TEST_DATABASE_URL" npx --no-install prisma migrate deploy --config ./prisma7.config.ts
DATABASE_URL="$OPERATIONS_TEST_DATABASE_URL" npx --no-install prisma migrate deploy --config ./prisma7.config.ts
npm run build
npm test -- --maxWorkers=1 --no-file-parallelism
```

Giữ chạy tuần tự giữa các file do có module dùng process.env, timer expiration và test sửa stock topping. Ba database đáp ứng tên được guard của suite yêu cầu. Không seed là chủ ý: fixtures tạo dữ liệu test, không thay nghiệp vụ bằng mock database. Các payment fixtures/mock HTTP gateway không chứng minh giao dịch sandbox thật.

Chạy riêng hồi quy audit:

```bash
npm test -- src/orders/orders.integration.spec.ts --maxWorkers=1 -t 'A1 audit regressions'
```

Test kiểm soát thứ tự hai HTTP request cùng key: request đầu lookup chưa thấy đơn, request thứ hai hoàn tất giữ chỗ suất nguyên liệu cuối, request đầu mới đọc menu. Cùng payload phải trả cùng orderId, khác payload phải 409; kho chỉ được giữ một lần. Các ca ID vượt int32 phải 400 thay vì lỗi SQL.

## Docker/Browser riêng

Từ thư mục gốc, dùng Compose project riêng, port web 55430/api 55431; các giá trị dưới đây chỉ dành cho demo kiểm thử. Để trống key ZaloPay để kiểm tra trạng thái lỗi cấu hình an toàn.

```bash
export DB_USER=a1_demo DB_PASSWORD=a1_demo_local DB_NAME=brewlite_a1_demo
export JWT_SECRET=a1-demo-only-isolated-secret BFF_PROXY_SECRET=a1-demo-only-bff-secret
export API_PORT=55431 WEB_PORT=55430 APP_ORIGIN=http://127.0.0.1:55430
export ZALOPAY_APP_ID= ZALOPAY_KEY1= ZALOPAY_KEY2=
export ZALOPAY_RETURN_URL=http://127.0.0.1:55430/payment/result
docker compose -p brewlite-a1-audit config --quiet
docker compose -p brewlite-a1-audit up --build -d --wait --wait-timeout 180
docker compose -p brewlite-a1-audit ps -a
```

Mở `http://127.0.0.1:55430`. Kiểm tra menu/chi tiết S/M/L/topping, giỏ thêm/sửa/xóa và tổng, login, tạo đơn, refresh, lỗi thanh toán 503 không chuyển thành thành công, lịch sử và ngăn customer vào admin. Với bộ key hợp lệ, cần kiểm tra bổ sung QR/URL, đúng số tiền, giao dịch thành công/thất bại, callback/query, confirmation, không cộng điểm/trừ kho hai lần. Không mô phỏng OTP và ghi là sandbox đã đạt.

Giữ dữ liệu khi dừng: `docker compose -p brewlite-a1-audit stop`, `docker stop brewlite-a1-audit-db`. Không dùng `down -v`, reset hoặc xóa database.

## Đọc kết quả

Tài liệu API: [Orders](../apps/api/docs/orders-phat.md), [Payments](../apps/api/docs/payments-thang.md).
