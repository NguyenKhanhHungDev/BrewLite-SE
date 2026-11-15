# Orders API — Assignment 1 (Task 6, 9, 10)

Cập nhật theo code ngày 15/11/2026. Giá là số nguyên VND. ID và số lượng phải nằm trong khoảng 1–2147483647. Backend tự tính giá từ Recipe; trường `productId` của API hiện ánh xạ tới `Recipe.id`. Product cũ chỉ giữ cho lịch sử.

## Tạo đơn — POST /orders

Bắt buộc JWT. `Idempotency-Key` tùy chọn, 1–200 ký tự sau trim; frontend luôn gửi và lưu key trước request. Cùng người dùng/key/payload trả đơn đã lưu; khác payload trả 409. Hai request đồng thời được bảo vệ bằng advisory transaction lock và unique index. Khi request khác đã tạo đơn trong lúc lookup/validation ban đầu, backend đọc lại kết quả đã lưu thay vì báo sai hết nguyên liệu.

```json
{
  "recipientName": "Nguyen Van A",
  "items": [{
    "productId": 1,
    "quantity": 2,
    "size": "L",
    "toppings": ["PEARL"],
    "sugarLevel": 50,
    "iceLevel": "LESS",
    "note": "Mang di"
  }],
  "promoCode": "BREW10"
}
```

Tên người nhận bắt buộc, 2–100 ký tự sau trim. Size mặc định M, cho phép S/M/L; topping PEARL/CREAM không trùng. Đường 0/50/100, đá NONE/LESS/NORMAL, ghi chú tối đa 200 ký tự là các trường tùy chọn. Không nhận giá, tổng tiền, chiết khấu hoặc số điện thoại từ client.

Giá size S = giá gốc −5000, M = giá gốc, L = giá gốc +5000. PEARL +5000, CREAM +7000. `BREW10` giảm 10% (`floor(subtotal * 0.1)`); mã không hợp lệ bị từ chối. Tổng phải dương và không vượt int32.

Response HTTP 201, kể cả replay: `{ "orderId": 123, "status": "PENDING", "total": 63000 }`. Replay trả trạng thái hiện tại, không nhất thiết PENDING.

Order/OrderItem/OrderIngredient được ghi cùng transaction. Nguyên liệu được giữ chỗ, chưa trừ stock. Định lượng mỗi ly theo size: `ceil(base * 0.8/1/1.2)`; topping dùng 20g PEARL hoặc 20ml CREAM mỗi ly. Giữ chỗ bằng conditional UPDATE theo thứ tự ID; không vượt stock. Đơn mới có hạn giữ chỗ 15 phút.

## Chi tiết và lịch sử

- `GET /orders/me`: JWT, mảng lịch sử của chính user, mới nhất trước; không nhận userId từ client.
- `GET /orders/:id`: JWT; customer chỉ đọc đơn của mình (đơn người khác trả 404), ADMIN đọc mọi đơn theo role trong database.
- Snapshot giữ tên món/giá/tùy chọn/người nhận tại lúc đặt; sửa recipe về sau không đổi đơn cũ.

## Admin

JWT + database role ADMIN, customer nhận 403:

- `GET /admin/orders`: phân trang `page`, `limit` (1–50); lọc `status`, `paymentStatus`, `search`, `dateFrom`, `dateTo` (ngày Việt Nam YYYY-MM-DD). Lọc trước khi đếm/phân trang.
- `GET /admin/orders/:id`: chi tiết và thông tin hủy.
- `PATCH /admin/orders/:id/status`: body `{ "status": "PREPARING" }`, chỉ nhận PREPARING/READY/COMPLETED và phải đúng thứ tự.
- `POST /admin/orders/:id/cancel`: body `{ "reason": "Khach yeu cau huy" }`, lý do 1–300 ký tự; lưu actor/thời gian. Chỉ hủy PENDING/PAYMENT_FAILED không có giao dịch thành công/chưa rõ kết quả/cần đối soát.

Admin không được ép trạng thái PAID hoặc sửa kết quả tài chính.

## State machine, retry, expiry và loyalty

- `PENDING → PAID | PAYMENT_FAILED | CANCELLED`
- `PAYMENT_FAILED → CANCELLED`
- `PAID → PREPARING → READY → COMPLETED`
- COMPLETED/CANCELLED là trạng thái kết thúc.

**Không có `PAYMENT_FAILED → PENDING`.** Đơn đã thất bại được hoàn reservation; thử lại bằng cách tạo đơn mới (key mới) từ giỏ hàng, kiểm tra giá/tồn kho lại. Nếu gateway từ chối tạo giao dịch chắc chắn, đơn vẫn PENDING: có thể retry cùng payment key, reference mới. Nếu kết quả tạo giao dịch chưa rõ, giữ key/reference và kiểm tra trạng thái, không tạo giao dịch khác.

Payments xác minh chữ ký callback hoặc truy vấn gateway rồi cập nhật Payment/Order/kho/loyalty trong cùng transaction. Điểm = `floor(total / 10000)`; claim `loyaltyAwarded=false` bảo đảm chỉ cộng một lần. OrderStateService cũng dùng compare-and-set cho milestone nội bộ.

Job mỗi 60 giây đối soát trước khi xét đơn quá hạn. Giao dịch ZaloPay chưa rõ kết quả giữ reservation dù đồng hồ đã hết; không kết luận thất bại chỉ vì timeout. Success đã xác minh có thể tiêu thụ reservation còn giữ. Success đến sau khi reservation đã RELEASED chuyển payment sang RECONCILIATION_REQUIRED, không hồi sinh đơn hoặc trừ kho/cộng điểm.

## Kiểm thử

Xem [hướng dẫn kiểm thử riêng](../../../docs/a1-verification.md). Unit tests không thay cho PostgreSQL/HTTP hoặc giao dịch sandbox thực tế. Không bật biến integration trên database demo hoặc dữ liệu thật.
