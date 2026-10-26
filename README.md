# BrewLite-SE

Đồ án **Công nghệ Phần mềm – Trường Đại học Sài Gòn (SGU)**. Repository này tập trung triển khai **Assignment 1**.

BrewLite là ứng dụng đặt đồ uống với các bước: xem menu, chọn sản phẩm, giỏ hàng, đặt đơn và **thanh toán giả lập**. Không tích hợp cổng thanh toán tiền thật.

## Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | Next.js, TypeScript |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Chạy tích hợp | Docker Compose |

## Cấu trúc chính

```text
BrewLite-SE/
├── apps/
│   ├── api/                  # NestJS, Prisma, API và kiểm thử
│   └── web/                  # Next.js
├── docs/
│   ├── docker.env.example    # Mẫu biến môi trường cho Compose
│   └── docker-run.md         # Hướng dẫn Docker chi tiết
├── compose.yaml              # PostgreSQL + API + Web
└── README.md
```

## Chạy nhanh bằng Docker Compose (khuyến nghị)

### 1. Chuẩn bị

- Cài **Git**, **Docker Engine + Docker Compose V2** (Linux) hoặc **Docker Desktop** (Windows).
- Kiểm tra bằng `git --version`, `docker --version` và `docker compose version`.
- Không cần cài PostgreSQL trực tiếp trên máy khi dùng Compose.

### 2. Clone và tạo cấu hình

```bash
git clone https://github.com/NguyenKhanhHungDev/BrewLite-SE.git
cd BrewLite-SE
cp docs/docker.env.example .env
```

Trong **Windows PowerShell**, thay lệnh `cp` bằng:

```powershell
Copy-Item docs/docker.env.example .env
```

Mở file `.env` ở **thư mục gốc**, thay các giá trị mẫu:

```dotenv
DB_USER=brewlite
DB_PASSWORD=MAT_KHAU_DB_CUA_BAN
DB_NAME=brewlite
JWT_SECRET=CHUOI_BI_MAT_DU_DAI_NGAU_NHIEN
```

Trên Linux, có thể tạo một JWT secret ngẫu nhiên bằng `openssl rand -hex 32` rồi dán kết quả vào `.env`. Dùng mật khẩu DB chỉ gồm chữ/số/ký tự URI-safe để tránh lỗi kết nối trong `DATABASE_URL`. **Không commit `.env`**, mật khẩu hoặc token lên Git.

### 3. Khởi động

Chạy từ **thư mục gốc**:

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Ba service cần có là `db`, `api` và `web`. Khi đã chạy:

| Dịch vụ | Địa chỉ trên máy |
| --- | --- |
| Giao diện Web | http://localhost:3000 |
| Backend API | http://localhost:3001 |

PostgreSQL **không được mở cổng trực tiếp ra máy host**; API kết nối DB qua mạng Compose (`db:5432`). Web/API chỉ được ánh xạ đến `127.0.0.1` theo `compose.yaml` đang dùng.

### 4. Kiểm tra nhanh

```bash
curl -i http://localhost:3001/products
curl -i http://localhost:3001/products/1
docker compose logs --tail=100 api
docker compose logs --tail=100 web
```

Menu nên hiện dữ liệu sản phẩm lấy từ API. Các bài test `POST /orders` cần đăng nhập và JWT; xem [hướng dẫn Docker](docs/docker-run.md) để biết cách kiểm tra chi tiết.

### 5. Dừng an toàn

```bash
docker compose down
```

Lệnh này dừng/xóa container và network của dự án nhưng **giữ volume PostgreSQL**. Không dùng `docker compose down -v` nếu muốn giữ dữ liệu.

## API contract của Assignment 1

| Phương thức / endpoint | Ý nghĩa | Trạng thái ở mốc `d4935f0` |
| --- | --- | --- |
| `GET /products` | Danh sách sản phẩm | Đã kiểm thử |
| `GET /products/:id` | Chi tiết dữ liệu sản phẩm | Đã kiểm thử |
| `POST /auth/register` | Tạo tài khoản | Đã kiểm thử |
| `POST /auth/login` | Đăng nhập, nhận `accessToken` | Đã kiểm thử |
| `POST /orders` | Tạo đơn hàng bằng JWT; lưu Order/OrderItem | Đã kiểm thử |
| `POST /payments` | Thanh toán **giả lập** WALLET/CARD | Đang tích hợp, chưa xác nhận endpoint hoạt động |
| `GET /orders/me` | Lịch sử đơn hàng của người đăng nhập | Chưa có ở mốc đối chiếu |

Ví dụ request tạo đơn hàng (cần `Authorization: Bearer <JWT>`):

```json
{
  "items": [
    { "productId": 1, "quantity": 2, "size": "M", "toppings": [] }
  ]
}
```

Kết quả đã kiểm thử: trạng thái `PENDING`, tổng tiền được backend tính từ sản phẩm/size/topping, dữ liệu ghi vào PostgreSQL. Trường `userId` do client tự gửi bị từ chối; server lấy danh tính từ JWT. Không gửi trực tiếp tổng tiền do trình duyệt tính như một giá trị được tin cậy.

> **Lưu ý tiến độ:** Bảng trên phản ánh việc đã xác minh tại commit `d4935f0` (26/10/2026), không tự động khẳng định các PR của Huy/Phát/Thắng/Khoa đã hoàn tất sau ngày đó. Cập nhật trạng thái khi tính năng được merge **và chạy thử thực tế**.

## Phát triển và kiểm thử bằng npm

Các lệnh dưới đây dùng khi đã cài Node.js/npm và dependency. Chạy riêng trong từng thư mục:

**Backend**

```bash
cd apps/api
npm ci
npm run db:generate
npm run lint
npm test
npm run build
```

**Frontend** (từ thư mục gốc, trong terminal khác):

```bash
cd apps/web
npm ci
npm run lint
npm run build
```

Các lệnh trên là **kiểm tra/build**, không khởi động database. Nếu chạy Backend ngoài Docker, cần một PostgreSQL riêng và `DATABASE_URL` hợp lệ trong cấu hình local `apps/api/.env`; chạy migration/seed tương ứng trước khi `npm run start:dev`. PostgreSQL của Compose không publish cổng ra host nên mặc định không kết nối trực tiếp được từ NestJS chạy trên host.

## Kiểm thử nghiệm thu

- [x] Products API trả sản phẩm thật từ PostgreSQL.
- [x] Register/Login hoạt động, tạo JWT.
- [x] Tạo đơn hàng trả `PENDING`, lưu Order/OrderItem đúng tổng tiền.
- [x] Orders chặn request không có JWT, số lượng `0`, giỏ trống, ID sản phẩm không tồn tại, `userId` không hợp lệ từ client.
- [ ] Kiểm thử giao diện Product Detail, Cart, Checkout sau khi các PR tương ứng merge.
- [ ] Kiểm thử Payment giả lập: thành công, thất bại, idempotency, trạng thái đơn.
- [ ] Kiểm thử lịch sử đơn hàng, tồn kho đồng thời, khuyến mãi/điểm thưởng theo yêu cầu A1.
- [ ] Tổng duyệt end-to-end trên `main` sau khi tích hợp.

Các ô đã đánh dấu là kết quả kiểm thử thủ công trên máy thành viên ngày 26/10/2026; không thay thế việc chạy lại test khi `main` thay đổi.

## Xử lý sự cố thường gặp

| Hiện tượng | Kiểm tra |
| --- | --- |
| `docker: command not found` | Cài Docker Engine/Desktop và Compose V2 |
| Không truy cập được cổng 3000/3001 | `docker compose ps`, kiểm tra ứng dụng khác đang dùng cổng |
| API không kết nối DB | Kiểm tra 3 biến DB trong `.env` và `docker compose logs --tail=100 api` |
| `/products` trống | Kiểm tra migration/seed và log API; không thay bằng danh sách hardcode ở Web |
| `401 Missing token` | Đăng nhập lấy JWT và gửi header `Authorization` |
| Lỗi build Google Fonts | Kiểm tra khả năng truy cập mạng của môi trường build Web |
| Payment `404`/`503` | Kiểm tra module Payment đã được tích hợp vào API hay chưa; không tính là đã hoàn tất |

Chi tiết khởi động, truy vấn DB và lưu dữ liệu: [docs/docker-run.md](docs/docker-run.md).
