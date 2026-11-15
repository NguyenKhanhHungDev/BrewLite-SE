# ZaloPay Sandbox — Task 8/10

Cập nhật theo code ngày 15/11/2026. Hệ thống dùng ZaloPay Sandbox; endpoint mock cũ `POST /payments` bị vô hiệu hóa (JWT hợp lệ nhận 410 Gone). Không gửi `method`, `simulateResult`, `amount` hoặc `total`.

## Tạo giao dịch

`POST /payments/zalopay/create` cần JWT và `Idempotency-Key` 1–200 ký tự sau trim. Body chỉ có `{ "orderId": 123 }`, ID nguyên dương int32. Số tiền lấy từ `Order.total` trong database, không tin client. Đơn phải thuộc user, PENDING và chưa hết hạn khi tạo giao dịch mới.

Response lần đầu HTTP 201, replay có URL đã lưu HTTP 200:

```json
{
  "orderId": 123,
  "paymentId": 456,
  "provider": "ZALOPAY",
  "transactionRef": "<reference-unique>",
  "amount": 63000,
  "status": "PENDING",
  "paymentUrl": "https://sbgateway.zalopay.vn/<gateway-path>"
}
```

URL ví dụ là mô tả contract, không dùng để thanh toán. Trạng thái response là trạng thái thực tại lúc đọc, có thể đã SUCCESS nếu callback về sớm. Frontend kiểm tra status API trước khi thông báo thành công.

Khóa Order tuần tự hóa tạo/settle/hủy; một order chỉ có một attempt ZaloPay PENDING chưa bị từ chối tạo. Cùng key khác order/payload trả 409. URL/reference lưu trong DB để refresh/restart dùng lại.

- Gateway từ chối tạo rõ ràng: creationStatus REJECTED, không tự kết luận đơn thất bại; retry cùng key có reference mới nếu đơn còn hợp lệ.
- Timeout/lỗi mạng/kết quả không rõ: UNKNOWN, giữ attempt và reservation; kiểm tra status trước khi retry, không phát sinh giao dịch mới.
- Đơn PAYMENT_FAILED/CANCELLED đã hoàn kho: tạo đơn mới để thử lại, không đổi về PENDING.

## Callback và tra cứu

- `POST /payments/zalopay/callback`: không cần JWT; nhận chuỗi `data` gốc và `mac`, xác minh HMAC-SHA256 với key2 bằng timingSafeEqual, kiểm tra app_id/reference/amount. Sai MAC/dữ liệu bị từ chối; body response theo giao thức callback. Callback thành công trùng không trừ kho/cộng điểm lại.
- `GET /payments/:orderId/status`: JWT, đúng chủ đơn; trả `{ orderId, orderStatus, latestPayment }`. Có thể gọi query ZaloPay để cập nhật kết quả trước khi trả.
- `GET /payments/:orderId/details`: JWT, đúng chủ đơn; trả orderStatus/orderExpiresAt/serverTime/payments. Không trả key, URL thanh toán hoặc ghi chú admin.
- Background đối soát lần lượt các attempt PENDING, kể cả khi không có callback public.

Success chỉ được ghi sau callback/query hợp lệ, amount khớp. Payment/Order/stock/reservation/loyalty commit hoặc rollback cùng transaction. Success muộn sau release chuyển RECONCILIATION_REQUIRED, giữ nguyên stock/điểm/trạng thái đơn. Giao dịch chưa rõ kết quả không bị coi là thất bại bởi lỗi mạng hoặc return URL từ trình duyệt.

## Admin

Tất cả cần JWT + role ADMIN trong DB:

- `GET /payments/admin/transactions`: page/limit/status/search/dateFrom/dateTo, lọc trước phân trang.
- `GET /payments/admin/transactions/:id`: chi tiết.
- `PATCH /payments/admin/transactions/:id/note`: `{ "note": "..." }`, tối đa 1000 ký tự, lưu actor/thời gian; không đổi trạng thái tài chính.
- `POST /payments/admin/transactions/:id/recheck`: query gateway và dùng chung settlement; RECONCILIATION_REQUIRED vẫn cần xử lý thủ công, không có nút ép thành công.
- `GET /payments/admin/reconciliation`: danh sách cần đối soát, có phân trang.

Điểm thành viên đọc qua `GET /auth/me` (JWT); không có endpoint cho client tự cộng điểm.

## Cấu hình và giới hạn xác minh

Biến server: ZALOPAY_APP_ID, ZALOPAY_KEY1, ZALOPAY_KEY2, ZALOPAY_API_BASE_URL, ZALOPAY_CALLBACK_URL, ZALOPAY_RETURN_URL. Thiếu key/cấu hình hợp lệ trả 503 trước khi tạo payment. Không đưa key vào frontend hoặc báo cáo.

Checkout hiện tạo QR của payment URL qua dịch vụ ảnh bên ngoài `api.qrserver.com`. Amount gắn với order gateway do backend tạo, không lấy từ QR do client tự nhập. QR này là URL mở cổng thanh toán, chưa có bằng chứng là payload QR native quét được bằng app ZaloPay. Đây là phần **NOT VERIFIED**; việc render ảnh QR không chứng minh quét được hoặc OTP được sandbox hỗ trợ.

Audit dùng mock ở ranh giới HTTP gateway trong test, không thay gateway sản phẩm. Chưa thực hiện thanh toán/QR/ngân hàng/OTP thực tế. Cần demo với sandbox hợp lệ và lưu bằng chứng đúng số tiền, thành công/thất bại, callback hoặc query đối soát. Xem [kiểm thử](../../../docs/a1-verification.md).
