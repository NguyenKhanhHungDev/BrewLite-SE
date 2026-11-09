# BrewLite-SE

Đồ án Công nghệ Phần mềm — Trường Đại học Sài Gòn (SGU).

BrewLite là ứng dụng đặt đồ uống, gồm giao diện khách hàng và trang quản trị dùng chung một trang đăng nhập.

## 1. Chức năng chính

| Người dùng | Chức năng |
| --- | --- |
| Khách hàng | Xem menu, chọn size/topping, quản lý giỏ hàng, đặt món, thanh toán ZaloPay Sandbox, xem lịch sử đơn và tài khoản |
| Admin | Quản lý nguyên liệu và biến động kho, chỉnh công thức món, quản lý trạng thái đơn, tra cứu và đối soát giao dịch |

Đăng nhập bằng tài khoản có quyền `ADMIN` sẽ chuyển tới trang quản trị. Tài khoản khách hàng tiếp tục sử dụng giao diện đặt món.

## 2. Chạy dự án bằng Docker

### Chuẩn bị và tải source

Cài và mở **Docker Desktop**; trên Linux có thể dùng Docker Engine và Docker Compose. Không cần cài riêng Node.js, npm hoặc PostgreSQL. Lần chạy đầu cần Internet để tải image và thư viện.

```bash
git clone https://github.com/NguyenKhanhHungDev/BrewLite-SE.git
cd BrewLite-SE
```

Có thể tải ZIP từ GitHub rồi giải nén. Các lệnh tiếp theo chạy tại thư mục chứa `compose.yaml`.

### Tạo cấu hình và khởi động

Windows PowerShell:

```powershell
if (-not (Test-Path .env)) { Copy-Item docs/docker.env.example .env }
docker compose up --build -d --wait --wait-timeout 180
```

Linux/macOS:

```bash
test -f .env || cp docs/docker.env.example .env
docker compose up --build -d --wait --wait-timeout 180
```

Các lệnh giữ nguyên `.env` nếu file đã tồn tại. Cấu hình mẫu dành cho demo local.

| Thành phần | Địa chỉ mặc định |
| --- | --- |
| Web | http://localhost:3000 |
| Trang đăng nhập | http://localhost:3000/login |
| Trang quản trị | http://localhost:3000/admin |
| API | http://localhost:3001 |

Docker khởi động theo thứ tự: **database → migrate/seed → API → Web**. Job `migrate` tạo cấu trúc database và dữ liệu mẫu rồi thoát thành công; dữ liệu đã chỉnh được giữ ở những lần chạy sau.

### Tạo tài khoản admin để demo

1. Đăng ký tài khoản trên Web.
2. Mở database local:

```bash
docker compose exec db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

3. Thay email bên dưới bằng email vừa đăng ký, rồi chạy SQL:

```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'admin.demo@example.com';
```

4. Kết quả phải là `UPDATE 1`. Nhập `\q` để thoát, sau đó đăng nhập lại trên Web.

Bước cấp quyền trực tiếp này chỉ dùng cho database demo local.

### Thử đặt món và thanh toán

1. Đăng ký hoặc đăng nhập tài khoản khách hàng.
2. Chọn món, size/topping và thêm vào giỏ.
3. Tạo đơn, chọn thanh toán ZaloPay Sandbox.
4. Thực hiện các bước trên cổng sandbox và quay về trang kết quả.
5. Nếu trạng thái chưa cập nhật, bấm **Kiểm tra lại**; xem đơn trong lịch sử đơn hàng.

ZaloPay ở đây là môi trường thử nghiệm. Gateway cần kết nối Internet và bộ key sandbox hợp lệ. Cấu hình demo để trống callback; backend truy vấn lại giao dịch định kỳ và khi khách kiểm tra kết quả. Việc chạy Web/API thành công chưa xác nhận giao dịch sandbox thực tế đã được nghiệm thu.

## 3. Cấu trúc code

Công nghệ: **Next.js 16 · React 19 · NestJS 12 · Prisma 7 · PostgreSQL 17**.

```text
BrewLite-SE/
├── apps/
│   ├── web/                         # Frontend khách hàng và admin
│   │   ├── app/                     # Các trang và route phía Web
│   │   ├── components/              # Thành phần giao diện
│   │   │   └── admin/
│   │   │       ├── ingredients/     # Nguyên liệu và kho
│   │   │       ├── recipes/         # Công thức món
│   │   │       ├── orders/          # Đơn hàng
│   │   │       └── payments/        # Giao dịch và đối soát
│   │   ├── lib/                     # Hàm gọi API, kiểu dữ liệu, tiện ích
│   │   └── server.mjs               # Khởi động Web và xác định IP client
│   └── api/                         # Backend
│       ├── src/                     # Module theo chức năng
│       └── prisma/                  # Schema, migration và dữ liệu mẫu
├── docs/docker.env.example          # Cấu hình mẫu cho Docker
├── compose.yaml                     # Kết nối và chạy các dịch vụ
└── README.md
```

### Frontend: tìm file theo việc cần sửa

| Cần sửa | Vị trí |
| --- | --- |
| Đường dẫn và nội dung trang | `apps/web/app/` |
| Đăng nhập và phiên người dùng | `components/AuthForm.tsx`, `components/AuthProvider.tsx`, `lib/session.ts`, `lib/session-server.ts` trong `apps/web/` |
| Menu, thẻ món, chi tiết món | `apps/web/components/MenuList.tsx`, `ProductCard.tsx`, `ProductDetail.tsx` |
| Giỏ hàng | `apps/web/components/CartProvider.tsx`, `CartDrawer.tsx` |
| Màn hình admin | Thư mục chức năng trong `apps/web/components/admin/` |
| Hàm dùng chung và giao tiếp API | `apps/web/lib/` |
| Kiểu dáng chung | `apps/web/app/globals.css` |
| Kiểu dáng admin | `apps/web/app/admin/admin.css` |

Trong mỗi thư mục admin, các file được chia theo vai trò:

| Tên file | Vai trò |
| --- | --- |
| `*Manager.tsx` | Ghép các phần thành màn hình hoàn chỉnh |
| `*Filters.tsx` | Hiển thị bộ lọc và tìm kiếm |
| `*Table.tsx` / `*Grid.tsx` | Hiển thị danh sách |
| `*Form.tsx` | Hiển thị biểu mẫu nhập và sửa |
| `*Details*.tsx` | Hiển thị chi tiết bản ghi |
| `use*.ts` | Quản lý state, gọi API và xử lý thao tác |
| `*-config.ts` | Chứa các lựa chọn và cấu hình cố định |

Các trang `app/admin/<chức năng>/page.tsx` mở component quản lý tương ứng. Khi sửa bảng hoặc biểu mẫu, tìm trong thư mục component của chức năng đó.

### Backend: module và trách nhiệm

| Module trong `apps/api/src/` | Trách nhiệm |
| --- | --- |
| `auth/` | Đăng ký, đăng nhập, kiểm tra phiên và quyền |
| `products/` | Dữ liệu món hiển thị cho khách |
| `ingredients/` | Nguyên liệu, tồn kho và lịch sử biến động |
| `recipes/` | Công thức và thành phần món |
| `orders/` | Tạo đơn, tính tiền, trạng thái và hủy đơn |
| `payments/` | Thanh toán, callback, tra cứu và đối soát |
| `loyalty/` | Tích điểm thành viên |

| Loại file | Vai trò |
| --- | --- |
| `*.controller.ts` | Nhận request HTTP, khai báo route và áp dụng kiểm tra quyền |
| `dto/` | Khai báo và kiểm tra dữ liệu đầu vào |
| `*.service.ts` | Xử lý nghiệp vụ |
| `*.prisma-adapter.ts` | Đọc/ghi database và thực hiện transaction |
| `*.contract.ts` | Định nghĩa kiểu dữ liệu và hợp đồng giữa các phần |
| `*.module.ts` | Đăng ký và kết nối các thành phần của module |
| `*.spec.ts` | Kiểm thử |

Riêng module thanh toán được chia rõ hơn:

| File trong `apps/api/src/payments/` | Vai trò |
| --- | --- |
| `payments.service.ts` | Điều phối tạo thanh toán và xử lý callback |
| `zalopay.service.ts` | Gọi gateway và kiểm tra chữ ký |
| `zalopay-reconciliation.ts` | Truy vấn lại kết quả và đối soát |
| `payment-details.service.ts` | Đọc giao dịch của khách theo chủ đơn |
| `payment-admin.service.ts` | Tra cứu và ghi chú giao dịch cho admin |
| `payment-select.ts` | Chọn trường dữ liệu được trả ra |
| `payment-read-database.ts` | Kết nối database dùng chung cho các service đọc và ghi chú |
| `payments.prisma-adapter.ts` | Cập nhật thanh toán, đơn hàng và kho trong transaction |

Luồng tổng quát: **giao diện → hàm gọi API → controller → service → database**. Các request cần phiên đăng nhập đi qua route Web `/api/session/`. Backend quyết định quyền truy cập, trạng thái thanh toán và tồn kho.

## 4. Các lệnh thường dùng

| Mục đích | Lệnh tại thư mục gốc |
| --- | --- |
| Dừng, giữ dữ liệu | `docker compose down` |
| Chạy lại | `docker compose up -d --wait --wait-timeout 180` |
| Build lại sau khi cập nhật source | `docker compose up --build -d --wait --wait-timeout 180` |
| Xem trạng thái | `docker compose ps -a` |
| Xem log Web/API | `docker compose logs --tail=100 api web` |
| Xem lỗi migration | `docker compose logs --tail=100 migrate` |
| Nạp lại `.env` | `docker compose up -d --force-recreate --wait --wait-timeout 180` |

Không chạy `docker compose down -v` nếu muốn giữ tài khoản, đơn hàng và dữ liệu kho.

## 5. Khi gặp lỗi

| Hiện tượng | Cách xử lý |
| --- | --- |
| Không kết nối được Docker | Mở Docker Desktop và chờ Docker sẵn sàng |
| Không nhận tùy chọn `--wait` | Cập nhật Docker Desktop hoặc Docker Compose |
| Cổng 3000/3001 bị chiếm | Dừng tiến trình dùng cổng hoặc đổi `WEB_PORT` / `API_PORT` trong `.env` |
| API không chạy | Xem log `api` và `migrate`; kiểm tra cấu hình database |
| Sai mật khẩu database sau khi sửa `.env` | Dùng lại mật khẩu đã tạo volume; không tự xóa volume |
| Thanh toán báo 503 | Kiểm tra cấu hình ZaloPay và kết nối tới gateway |
| Thanh toán chưa xác nhận | Bấm Kiểm tra lại ở trang kết quả trước khi tạo giao dịch khác |

Nếu đổi `WEB_PORT`, mở Web bằng cổng mới và sửa `ZALOPAY_RETURN_URL` tương ứng. Nếu có đặt `APP_ORIGIN`, cập nhật cùng địa chỉ Web.

## 6. Cấu hình khi triển khai

Các giá trị database, JWT, `BFF_PROXY_SECRET` và key sandbox trong cấu hình mẫu chỉ phục vụ demo local. Triển khai thật cần cấu hình riêng.

- `BFF_PROXY_SECRET` phải giống nhau ở API và Web; không gửi giá trị này ra trình duyệt.
- Web giữ phiên bằng cookie HttpOnly với thời hạn JWT một giờ. Tải lại trang hoặc quay về từ gateway không gia hạn phiên.
- Chạy Web qua `server.mjs` như Docker đã cấu hình để lấy IP từ kết nối thực. Nếu thêm reverse proxy, cần kiểm chứng lại cấu hình IP.
- Khi dùng HTTPS, đặt `APP_ORIGIN` đúng địa chỉ HTTPS để cookie Secure và kiểm tra cùng nguồn hoạt động đúng.
- Bộ giới hạn đăng nhập hiện lưu trong bộ nhớ một API instance; nhiều instance cần bộ đếm dùng chung.
- Khi sửa kho hoặc thanh toán, giữ các transaction, kiểm tra trạng thái và cơ chế chống xử lý trùng hiện có.
