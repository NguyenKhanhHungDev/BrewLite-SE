
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
