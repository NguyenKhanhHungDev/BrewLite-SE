# Hướng dẫn chạy BrewLite bằng Docker Compose

## 1. Yêu cầu công cụ
- Cài đặt Docker Engine hoặc Docker Desktop có kèm **Docker Compose V2** (`docker compose`).

## 2. Thiết lập biến môi trường
Tại thư mục gốc của repository, tạo file `.env` từ file mẫu:
```bash
cp docs/docker.env.example .env