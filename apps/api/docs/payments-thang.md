# Tài liệu API Payment & Đọc Điểm Thưởng (A1-08 / A1-10)

## 1. Thanh toán đơn hàng — `POST /payments`

### Headers bắt buộc
- `Authorization: Bearer <JWT>`
- `Idempotency-Key: <chuỗi 1..200 ký tự, riêng biệt cho mỗi lần thử thanh toán>`
- `Content-Type: application/json`

### Request Body
```json
{
  "orderId": 123,
  "method": "WALLET",
  "simulateResult": "SUCCESS"
}