
# BrewLite

Đồ án môn Công nghệ Phần mềm - Trường Đại học Sài Gòn.

## Giới thiệu

BrewLite là ứng dụng đặt đồ uống không dùng tiền mặt.

Ứng dụng cho phép khách hàng xem menu, lựa chọn sản phẩm,
thêm vào giỏ hàng, đặt đơn và thanh toán giả lập.

## Công nghệ

- Frontend: Next.js (TypeScript)
- Backend: NestJS (TypeScript)
- Database: PostgreSQL
- Container: Docker

## Cấu trúc dự án

```text
BrewLite-SE/
├── apps/
│   ├── web/         # Frontend Next.js
│   └── api/         # Backend NestJS
├── .env.example
├── .gitignore
└── README.md
```

## Yêu cầu môi trường

- Node.js
- npm
- Git

## Cài đặt và chạy dự án

### 1. Clone repository

```bash
git clone https://github.com/NguyenKhanhHungDev/BrewLite-SE.git
cd BrewLite-SE
```

### 2. Chạy Frontend

```bash
cd apps/web
npm install
npm run dev
```

Frontend chạy tại:

http://localhost:3000

### 3. Chạy Backend

Mở Terminal khác, từ thư mục gốc dự án:

```bash
cd apps/api
npm install
npm run start:dev
```

Backend chạy tại:

http://localhost:3001

API mặc định trả về `Hello World!`.

## Kiểm tra build

Frontend:

```bash
cd apps/web
npm run build
```

Backend:

```bash
cd apps/api
npm run build
```

## Trạng thái dự án

Đang thực hiện Assignment 1 - BrewLite.

## Cấu hình Database

Backend sử dụng PostgreSQL và Prisma ORM.

### 1. Chuẩn bị PostgreSQL

Cần có PostgreSQL đang chạy và một Database tên `brewlite`.

### 2. Cấu hình môi trường

Trong `apps/api`, tạo file `.env` dựa trên `.env.example`.

Cập nhật `DATABASE_URL` theo PostgreSQL trên máy.

Không commit file `.env` lên GitHub.

### 3. Cài đặt và tạo Prisma Client

```bash
cd apps/api
npm install
npx prisma generate
```

### 4. Chạy Migration

```bash
npx prisma migrate dev
```

### 5. Thêm dữ liệu mẫu

```bash
npx prisma db seed
```

### 6. Chạy Backend

```bash
npm run start:dev
```

### 7. Kiểm tra Products API

- `GET http://localhost:3001/products`
- `GET http://localhost:3001/products/1`

API trả về dữ liệu sản phẩm được lưu trong PostgreSQL.