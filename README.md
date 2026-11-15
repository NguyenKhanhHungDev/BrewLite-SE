# BrewLite

Ứng dụng đặt đồ uống không dùng tiền mặt, đồ án môn Công nghệ Phần mềm — Trường Đại học Sài Gòn.

**Công nghệ:** Next.js 16, React 19, NestJS 12, TypeScript, PostgreSQL 17, Prisma 7 và Docker Compose.

## Chức năng

- **Khách hàng:** xem menu, chọn size/topping, quản lý giỏ, đăng ký/đăng nhập, đặt món, thanh toán ZaloPay Sandbox và xem lịch sử đơn.
- **Admin:** quản lý nguyên liệu, biến động kho, công thức món, tiến độ đơn và đối soát giao dịch.
- **Nghiệp vụ:** kiểm soát trạng thái đơn, chống xử lý trùng bằng Idempotency-Key, giữ chỗ nguyên liệu trong transaction, mã giảm giá `BREW10` và tích điểm sau thanh toán.

## Chạy bằng Docker

Cần Git và Docker Compose v2 có hỗ trợ `--wait`. Khi chạy bằng Docker, không cần cài Node.js hoặc PostgreSQL trên máy.

```bash
git clone https://github.com/NguyenKhanhHungDev/BrewLite-SE.git
cd BrewLite-SE
```

Tạo `.env` ở thư mục gốc từ cấu hình mẫu, giữ nguyên nếu file đã tồn tại:

**Linux/macOS**

```bash
test -f .env || cp docs/docker.env.example .env
docker compose up --build -d --wait --wait-timeout 180
```

**Windows PowerShell**

```powershell
if (-not (Test-Path .env)) { Copy-Item docs/docker.env.example .env }
docker compose up --build -d --wait --wait-timeout 180
```

| Thành phần | Địa chỉ mặc định |
| --- | --- |
| Web | http://localhost:3000 |
| Đăng nhập | http://localhost:3000/login |
| Admin | http://localhost:3000/admin |
| API | http://localhost:3001 |

Compose khởi động **PostgreSQL → migration/seed → API → Web**. Job `migrate` thoát mã 0 sau khi hoàn tất; dữ liệu được giữ trong volume qua các lần khởi động.

### Cấu hình

Mẫu `.env` dành cho demo local; không commit `.env` thật.

| Biến | Mục đích |
| --- | --- |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Kết nối PostgreSQL trong Compose |
| `JWT_SECRET` | Ký và xác minh phiên đăng nhập |
| `BFF_PROXY_SECRET` | Giá trị dùng chung giữa Web và API; giữ ở server |
| `WEB_PORT`, `API_PORT` | Cổng máy chủ, mặc định 3000/3001 |
| `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2` | Thông tin ứng dụng sandbox |
| `ZALOPAY_RETURN_URL` | Địa chỉ Web nhận khách quay về sau thanh toán |
| `ZALOPAY_CALLBACK_URL` | Endpoint callback HTTPS có thể truy cập từ gateway; có thể để trống khi demo local dùng truy vấn đối soát |
| `APP_ORIGIN` | Origin công khai của Web khi cần cấu hình riêng |

Nếu đổi cổng Web, cập nhật `ZALOPAY_RETURN_URL` và `APP_ORIGIN` nếu đang sử dụng. Khi API báo 503 lúc thanh toán, kiểm tra cấu hình sandbox và kết nối Internet.

### Tài khoản admin cho demo local

Đăng ký tài khoản trên Web, rồi mở PostgreSQL:

```bash
docker compose exec db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Thay email bằng tài khoản vừa đăng ký:

```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'admin.demo@example.com';
```

Kết quả cần là `UPDATE 1`. Nhập `\q`, đăng xuất rồi đăng nhập lại. Admin được chuyển tới trang quản trị; khách hàng tiếp tục giao diện đặt món.

### Kiểm tra luồng đặt món

1. Chọn món, size/topping và thêm vào giỏ.
2. Đăng nhập, nhập người nhận, kiểm tra tổng tiền và tạo đơn.
3. Mở cổng ZaloPay Sandbox, thực hiện thanh toán và quay về trang kết quả.
4. Bấm **Kiểm tra lại** nếu gateway chưa đồng bộ; xem mã đơn và lịch sử sau khi backend xác nhận.

Dự án sử dụng ZaloPay Sandbox thay cho mock payment trong đề mẫu. Chạy được Docker chưa chứng minh giao dịch sandbox thành công; QR, ngân hàng/OTP cần kiểm tra với sandbox thực tế. Đơn đã thất bại/hủy phải tạo đơn mới để thử lại; giao dịch chưa rõ kết quả cần được kiểm tra trước khi đặt tiếp.

### Các lệnh vận hành

```bash
docker compose ps -a                      # Trạng thái và health check
docker compose logs --tail=100 api web    # Log ứng dụng
docker compose logs --tail=100 migrate    # Log migration/seed
docker compose stop                      # Dừng, giữ nguyên dữ liệu
docker compose up -d --wait               # Khởi động lại
```

Khi sửa code, chạy lại lệnh `up --build` ở trên. Không dùng `docker compose down -v` nếu cần giữ dữ liệu. Nếu cổng 3000/3001 đã được sử dụng, đổi `WEB_PORT`/`API_PORT` trong `.env`.

## Cấu trúc dự án

```text
BrewLite-SE/
├── apps/
│   ├── api/
│   │   ├── src/          # Module NestJS: auth, products, recipes,
│   │   │                 # ingredients, orders, payments, promotions, loyalty
│   │   ├── prisma/       # Schema, migrations và seed
│   │   ├── scripts/      # Công cụ quản trị và kiểm chứng
│   │   └── docs/         # Hợp đồng Orders và Payments
│   └── web/
│       ├── app/          # Trang khách hàng, admin và route phiên đăng nhập
│       ├── components/   # Component UI; admin/ chia theo nghiệp vụ
│       ├── lib/          # API client, kiểu dữ liệu và logic dùng chung
│       ├── public/       # Ảnh món và ảnh dự phòng
│       └── server.mjs    # Custom server xác định IP client
├── docs/                 # Cấu hình mẫu và hướng dẫn kiểm thử
├── compose.yaml
└── README.md
```

Luồng xử lý: **Web → REST API → controller → service → database adapter → PostgreSQL**. Backend quyết định giá, quyền truy cập, trạng thái thanh toán và tồn kho. Test backend nằm cạnh module dưới dạng `*.spec.ts`.

## Kiểm thử

Cần Node.js 24 và npm để chạy kiểm tra ngoài Docker. Từ thư mục gốc:

```bash
cd apps/api
npm ci
DATABASE_URL='postgresql://test:test@localhost:5432/test' npx prisma generate --config ./prisma7.config.ts
npm run build
npm run lint
npm test -- --maxWorkers=2
```

`prisma generate` chỉ sinh client, không kết nối database. Dòng gán `DATABASE_URL` trên dùng cú pháp Bash; PowerShell đặt biến bằng `$env:DATABASE_URL='...'` trước khi chạy `npx prisma generate`.

```bash
cd apps/web  # Từ thư mục gốc repository
npm ci
npm run lint
npm run build
npx tsc --noEmit
```

Test mặc định bỏ qua integration cần database. Xem [hướng dẫn kiểm thử](docs/a1-verification.md) để chạy đầy đủ với PostgreSQL riêng, kiểm tra đồng thời/idempotency và xác minh bằng trình duyệt.

## Tài liệu kỹ thuật

- [Orders API, state machine, tồn kho và loyalty](apps/api/docs/orders-phat.md).
- [ZaloPay Sandbox, callback và đối soát](apps/api/docs/payments-thang.md).
- [Hợp đồng tích hợp Orders–Inventory–Payments](apps/api/src/orders/ORDERS-INVENTORY-HANDOFF.md).
