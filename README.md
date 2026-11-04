# BrewLite-SE

Đồ án Công nghệ Phần mềm – Trường Đại học Sài Gòn (SGU).

Ứng dụng đặt đồ uống: xem menu, chọn size/topping, giỏ hàng, đăng ký/đăng nhập, đặt đơn, thanh toán ZaloPay Sandbox và lịch sử đơn. Admin quản lý nguyên liệu, công thức và xem đơn hàng.

## 1. Chuẩn bị

Cài và mở **Docker Desktop**, chờ Docker chạy xong. Trên Linux có thể dùng Docker Engine + Docker Compose.

**Không cần cài riêng Node.js, npm hay PostgreSQL.** Lần chạy đầu cần Internet để tải image và thư viện.

## 2. Tải source

Trên GitHub chọn **Code → Download ZIP**, giải nén và mở thư mục chứa file `compose.yaml`.

Trên Windows, gõ `powershell` vào thanh địa chỉ của thư mục rồi Enter để mở terminal tại đó.

Nếu đã cài Git, có thể tải bằng lệnh:

```bash
git clone https://github.com/NguyenKhanhHungDev/BrewLite-SE.git
cd BrewLite-SE
```

## 3. Chạy ứng dụng

Mở terminal trong thư mục chứa `compose.yaml`, copy và chạy các lệnh dành cho máy của bạn. Cấu hình demo local đã điền sẵn, **không cần nhập mật khẩu hoặc sửa file**.

**Windows PowerShell:**

```powershell
if (-not (Test-Path .env)) { Copy-Item docs/docker.env.example .env }
docker compose up --build -d --wait --wait-timeout 180
```

**Linux/macOS:**

```bash
test -f .env || cp docs/docker.env.example .env
docker compose up --build -d --wait --wait-timeout 180
```

Chờ lệnh hoàn tất rồi mở **http://localhost:3000**. Lần đầu có thể lâu do tải thư viện và build. Nếu lệnh báo lỗi, xem mục Khi gặp lỗi bên dưới.

Docker tự tạo database, áp dụng migration và khởi tạo dữ liệu mẫu một lần; lần chạy sau giữ nguyên dữ liệu đã chỉnh. Không cần chạy lệnh npm hoặc cài PostgreSQL riêng.

Các lệnh trên giữ nguyên `.env` nếu đã tồn tại. Nếu dùng cấu hình cũ, ứng dụng tiếp tục dùng giá trị trong file đó. Mật khẩu DB/JWT và key sandbox điền sẵn chỉ dành cho **demo local**; triển khai thật cần cấu hình riêng.

## 4. Dùng thử

1. Mở Web, đăng ký tài khoản mới; mật khẩu tối thiểu 8 ký tự.
2. Đăng nhập, chọn món và thêm vào giỏ.
3. Vào giỏ hàng, tạo đơn và chọn thanh toán ZaloPay Sandbox.
4. Hoàn tất luồng thử nghiệm trên cổng sandbox.
5. Quay về trang kết quả, bấm **Kiểm tra lại** nếu cần; xem đơn tại **Lịch sử đơn hàng**.

Đây là môi trường thanh toán thử nghiệm. Cấu hình demo local để trống callback; backend tự đối soát định kỳ và query thêm khi người dùng mở trang kết quả. Cần Internet và bộ key demo còn được gateway chấp nhận. Bộ key lấy từ [tài liệu ZaloPay](https://developers.zalopay.vn/v2/start/).

Web/API/database, luồng đặt đơn và kiểm thử transaction Payments đã được kiểm tra bằng Docker/PostgreSQL riêng trên Linux. Thanh toán sandbox thực tế và thao tác trên Windows/macOS chưa được nghiệm thu. Xem [kết quả kiểm tra](docs/handoff-verification.md).

## Dừng và chạy lại

Dừng ứng dụng, giữ dữ liệu:

```bash
docker compose down
```

Chạy lại:

```bash
docker compose up -d --wait --wait-timeout 180
```

Sau khi cập nhật source:

```bash
docker compose up --build -d --wait --wait-timeout 180
```

Không dùng `docker compose down -v` nếu muốn giữ tài khoản và đơn hàng.

## Khi gặp lỗi

Xem log:

```bash
docker compose logs --tail=100 api web
```

| Lỗi | Cách xử lý |
| --- | --- |
| Không kết nối được Docker | Mở Docker Desktop và chờ Docker sẵn sàng |
| Không nhận tùy chọn `--wait` | Cập nhật Docker Desktop/Compose |
| Cổng 3000/3001 bị chiếm | Dừng ứng dụng đang dùng cổng; hoặc đặt `WEB_PORT`, `API_PORT` khác trong `.env` |
| API không chạy hoặc chờ quá lâu | Xem log API; kiểm tra cấu hình và kết nối mạng |
| Sai mật khẩu DB sau khi đổi `.env` | Dùng lại mật khẩu của volume DB đã tạo; không tự xóa volume |
| Thanh toán lỗi 503 | Kiểm tra các dòng ZaloPay trong `.env` và mạng tới gateway |
| Thanh toán chưa xác nhận | Mở trang kết quả và bấm Kiểm tra lại; không tạo giao dịch khác ngay |

Sau khi sửa `.env`, nạp lại cấu hình bằng:

```bash
docker compose up -d --force-recreate --wait --wait-timeout 180
```

Nếu đổi `WEB_PORT`, mở Web bằng cổng mới và sửa `ZALOPAY_RETURN_URL` tương ứng.

## Chạy thử trang Admin — tùy chọn

Đăng ký tài khoản qua Web trước, sau đó mở database local:

```bash
docker compose exec db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Thay email bên dưới bằng tài khoản vừa đăng ký:

```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'admin.demo@example.com';
```

Kết quả cần là `UPDATE 1`. Nhập `\q` để thoát, đăng nhập lại và mở **http://localhost:3000/admin**. Chỉ thực hiện bước cấp quyền này trên database local phục vụ demo.

## Công nghệ

Next.js 16 · React 19 · NestJS 12 · Prisma 7 · PostgreSQL 17 · Docker Compose.

- `apps/web`: giao diện khách hàng và quản trị.
- `apps/api`: API, Prisma, migration, seed và kiểm thử.
- `docs/docker.env.example`: cấu hình mẫu.
- `compose.yaml`: khởi động Web, API và database.
