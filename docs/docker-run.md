# Hướng dẫn chạy BrewLite-SE bằng Docker Compose

Tài liệu cho **Assignment 1**. Các lệnh Linux chạy trong terminal tại thư mục gốc `BrewLite-SE`, trừ khi có ghi chú khác. Compose hiện có ba service: `db` (PostgreSQL 17), `api` (NestJS) và `web` (Next.js).

## 1. Kiểm tra công cụ

Trên Linux, cần Git, Docker Engine và plugin Docker Compose V2. Trên Windows dùng Docker Desktop đã bật Linux containers.

```bash
git --version
docker --version
docker compose version
```

Nếu Linux báo lỗi quyền truy cập Docker daemon, kiểm tra dịch vụ/quyền của người dùng theo hướng dẫn cài Docker của hệ điều hành; không sửa quyền bừa bãi. `docker compose` (có khoảng trắng) là cú pháp Compose V2.

## 2. Clone repo và tạo `.env` ở root

Máy mới:

```bash
git clone https://github.com/NguyenKhanhHungDev/BrewLite-SE.git
cd BrewLite-SE
```

Máy đã clone: vào thư mục dự án, không clone lại. Kiểm tra `git status` trước khi cập nhật nhánh.

**Linux:**

```bash
cp docs/docker.env.example .env
gedit .env
```

Nếu không có `gedit`, dùng editor bất kỳ (VS Code, nano, v.v.). **Windows PowerShell:**

```powershell
Copy-Item docs/docker.env.example .env
notepad .env
```

Thay các placeholder trong `.env`:

```dotenv
DB_USER=brewlite
DB_PASSWORD=MAT_KHAU_DB_LOCAL
DB_NAME=brewlite
JWT_SECRET=CHUOI_NGAU_NHIEN_DU_DAI
```

Tạo secret trên Linux bằng `openssl rand -hex 32` rồi **dán kết quả vào máy của bạn, không chia sẻ công khai**. Tránh dùng dấu URL đặc biệt trong DB password nếu chưa mã hóa chúng cho `DATABASE_URL`. Không đưa `.env` vào commit hoặc PR. `docs/docker.env.example` chỉ chứa mẫu không phải mật khẩu thật.

## 3. Kiểm tra và khởi động ba service

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

`config --quiet` kiểm tra cấu hình; `up --build -d` xây image và chạy ở chế độ nền. Trong `docker compose ps`, cần thấy `db`, `api`, `web` đang chạy (DB cần đạt healthcheck).

Nếu dịch vụ chưa sẵn sàng, xem log:

```bash
docker compose logs --tail=100 db
docker compose logs --tail=100 api
docker compose logs --tail=100 web
```

Đợi API/Web khởi động xong trước khi thử `curl`. URL dùng từ **máy chạy Docker**:

- Web: http://localhost:3000
- API: http://localhost:3001

Theo `compose.yaml`, chỉ `web` và `api` ánh xạ cổng đến `127.0.0.1`; **DB không publish cổng**. API kết nối `db:5432` qua mạng nội bộ Compose.

## 4. Kiểm tra dữ liệu sản phẩm

```bash
curl -i http://localhost:3001/products
curl -i http://localhost:3001/products/1
```

Kỳ vọng HTTP `200`, trả danh sách sản phẩm có `id`, `name`, `price`, `imageUrl`, `stock`. Mở http://localhost:3000 để xem menu. Nếu sản phẩm không xuất hiện, đọc log API để kiểm tra migration/seed; không hardcode dữ liệu thay cho DB.

## 5. Kiểm tra đăng ký, đăng nhập và tạo đơn hàng

**5.1 Đăng ký tài khoản demo** (làm một lần; đăng ký lại email cũ có thể bị từ chối):

```bash
curl -i -X POST http://localhost:3001/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"hung.demo@example.com","password":"TestPass123!"}'
```

**5.2 Đăng nhập và giữ JWT trong biến shell** (Linux/Bash):

```bash
TOKEN=$(curl -sS -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"hung.demo@example.com","password":"TestPass123!"}' \
  | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).accessToken')
```

Lệnh này cần Node.js trên máy để đọc JSON. Chạy ngay lệnh tiếp theo trong **cùng terminal**. Không in token ra ảnh chụp màn hình, issue hay PR.

**5.3 Tạo đơn hàng hợp lệ:**

```bash
curl -i -X POST http://localhost:3001/orders \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"items":[{"productId":1,"quantity":2,"size":"M","toppings":[]}]}'
```

Kỳ vọng `201 Created`, response có `orderId`, `status: PENDING`, `total`. Với sản phẩm #1 giá 35.000đ (dữ liệu mẫu tại thời điểm kiểm thử), 2 ly size M không topping có tổng 70.000đ. Giá có thể thay đổi khi dữ liệu DB được cập nhật.

Các lệnh Bash sử dụng `TOKEN=...` **không áp dụng nguyên xi trong PowerShell**; trên Windows có thể đăng nhập bằng công cụ HTTP/REST của PowerShell và gửi JWT trong header tương ứng.

**5.4 Thử các request phải bị từ chối:**

- Không gửi Authorization → `401 Unauthorized`.
- `quantity: 0` → `400 Bad Request`.
- `items: []` → `400 Bad Request`.
- `productId: 999999` (không có trong DB) → `404 Not Found`.
- Gửi thêm `userId` trong body → `400 Bad Request` (không cho tự chỉ định người sở hữu đơn).

Các mã phản hồi trên đã được đối chiếu thủ công ngày 26/10/2026 tại commit `d4935f0`. Khi có code mới, hãy chạy lại.

## 6. Xác minh PostgreSQL lưu đơn hàng thật

Mở PostgreSQL trong container (không cần publish DB port):

```bash
docker compose exec db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Trong prompt `brewlite=#`, nhập SQL (thay số `2` bằng `orderId` vừa nhận):

```sql
SELECT * FROM "Order" WHERE id = 2;
SELECT * FROM "OrderItem" WHERE "orderId" = 2;
```

Kỳ vọng có Order thuộc tài khoản đang đăng nhập, `PENDING`, tổng tiền khớp; OrderItem có đúng sản phẩm, size, số lượng, đơn giá, thành tiền. Thoát bằng `\q`. Đây là truy vấn chỉ đọc.

## 7. Chạy lint, test và build

Các bước sau cần Node.js/npm trên máy. Từ root repo:

```bash
cd apps/api
npm ci
npm run db:generate
npm run lint
npm test
npm run build
```

Mở terminal khác từ root repo:

```bash
cd apps/web
npm ci
npm run lint
npm run build
```

Nếu `next build` cần tải Google Fonts mà mạng bị chặn, ghi nhận đúng nguyên nhân, không đánh dấu build đạt khi chưa chạy xong.

## 8. Xem log, khởi động lại và dừng an toàn

Từ root repo:

```bash
docker compose ps
docker compose logs --tail=100 api
docker compose restart api
docker compose down
```

`restart api` chỉ dùng khi cần. `down` dừng/xóa container/network nhưng giữ volume `brewlite_pg_data`. **Không dùng `docker compose down -v`** trong quá trình phát triển nếu cần bảo toàn DB. Không tự chạy `prisma migrate reset` hoặc xóa volume khi gặp lỗi migration.

## 9. Xử lý lỗi thường gặp

| Vấn đề | Hướng kiểm tra |
| --- | --- |
| Thiếu `docker compose` | Cài Compose V2 / Docker Desktop |
| `config` lỗi thiếu biến môi trường | Kiểm tra file `.env` ở root có đủ `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET` |
| Web/API không truy cập được | `docker compose ps`, log tương ứng, kiểm tra cổng 3000/3001 đang bị chiếm |
| DB unhealthy hoặc API không kết nối | `docker compose logs --tail=100 db` và `api`, kiểm tra mật khẩu DB và volume cũ |
| `/products` không có dữ liệu | Kiểm tra seed/migration/log, không tự ý reset DB |
| `401 Missing token` | Đăng nhập lấy JWT, gửi đúng header `Authorization` |
| `401 Invalid or expired token` | Đăng nhập lại, không dùng chữ placeholder `TOKEN_NHAN_DUOC` |
| Payment `404` hoặc `503` | Module Payment tại mốc kiểm tra chưa hoàn tất tích hợp; chờ PR đạt điều kiện |
| Web build lỗi Google Fonts | Kiểm tra mạng/DNS lúc build |

## 10. Checklist bàn giao A1

- [ ] Một người khác clone mới và chạy được ba service theo tài liệu.
- [ ] Menu lấy dữ liệu từ API/PostgreSQL; ảnh/tên/giá chính xác.
- [ ] Auth và Orders hoạt động với JWT, lưu DB thật.
- [ ] Sau khi merge: Product Detail, Cart, Payment mô phỏng, Confirmation/History hoạt động end-to-end.
- [ ] Kiểm thử trường hợp payment thành công/thất bại, gọi lại cùng idempotency key, trạng thái đơn sai, đặt đồng thời vượt tồn kho, khuyến mãi/loyalty theo đúng phạm vi Assignment 1.
- [ ] Không có `.env`, JWT, mật khẩu, `node_modules`, `dist`, `.next` hoặc Prisma generated files trong PR.

Chỉ đánh dấu những mục đã chạy và xác nhận thực tế trên `main` mới nhất; không xem một PR đã merge là bằng chứng đầy đủ của chức năng.
