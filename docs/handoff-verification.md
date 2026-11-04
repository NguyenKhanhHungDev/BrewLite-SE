# Kiểm chứng bản bàn giao — 04/11/2026

Kiểm tra working tree của nhánh `fix/finalize-demo-handoff` trước commit. Các kết quả này là kiểm tra local, không phải GitHub CI hoặc nghiệm thu thanh toán thực.

## Kết quả

| Kiểm tra | Kết quả |
| --- | --- |
| API: `npm test -- --exclude '**/*.integration.spec.ts'` | 148 test pass |
| API/Web: `npm run lint` | Pass |
| API: `npm run build`; Web: TypeScript | Pass |
| Build API/Web trong Docker | Pass |
| Migration trên DB mới và khởi động lại | Pass |
| Payments integration trên PostgreSQL riêng | 10 test pass |
| HTTP qua Web proxy | Pass |
| `docker compose config --quiet`, `git diff --check` | Pass |
| `npm audit --omit=dev` cho API/Web | 0 cảnh báo runtime |

API còn 2 cảnh báo moderate thuộc Nest CLI/minimatch trong dependency phát triển. Không dùng `npm audit fix --force` để ép đổi major CLI. Đã cập nhật platform-express trong major NestJS 12 và bỏ công cụ deploy Mau không dùng.

## Môi trường và lệnh đã chạy

Linux, Docker Engine 29.9.2, Docker Compose 5.6.1. Project `brewlite-final-check-01a1a6b2` dùng volume mới và cổng Web/API 13000/13001. Mật khẩu DB/JWT được tạo riêng trong file môi trường ngoài repo; không thay đổi database đang dùng của thành viên.

```bash
docker compose --env-file /tmp/brewlite-handoff-check.env -p brewlite-final-check-01a1a6b2 up --build -d --wait --wait-timeout 180
```

Đã tạo database riêng `brewlite_payment_test_final` trong container kiểm tra. Migration và test chạy trong container API với cả `DATABASE_URL` và `PAYMENTS_TEST_DATABASE_URL` trỏ đúng database này:

```bash
npx prisma migrate deploy --config ./prisma7.config.ts
npm test -- src/payments/payments.integration.spec.ts
```

Test từ chối URL không phải database local có tên `brewlite_payment_test_*`. Chỉ xóa bản ghi do test tạo; không truncate/reset database.

## Nội dung đã kiểm chứng

- Hai request khác key cùng đơn chỉ tạo được một payment đang hoạt động.
- URL thanh toán được lưu trong DB và replay được qua adapter mới.
- Hai callback thành công đồng thời chỉ tiêu thụ kho/cộng điểm một lần.
- Đơn đang có giao dịch chưa rõ kết quả giữ reservation khi qua mốc hết hạn; xác nhận gateway thành công vẫn tiêu thụ reservation còn giữ.
- Gateway từ chối rõ ràng có thể thử lại cùng key bằng mã giao dịch mới.
- Thất bại cuối giải phóng kho đúng một lần; thành công phát hiện sau thất bại chuyển sang đối soát.
- Batch đối soát luân phiên; sai số tiền rollback; đơn hết hạn không có giao dịch chưa rõ kết quả vẫn bị hủy.
- Unit tests kiểm tra phân loại từ chối/timeout, đối soát trước hết hạn và seed một lần.
- Smoke test: Web 200, menu 10 món, đăng ký/login/profile, đặt size S kèm PEARL, idempotency, chi tiết/lịch sử, 401 khi thiếu token.
- Trên DB demo, đổi tên công thức/nguyên liệu và đổi giá, restart API: vẫn đủ 10 món/15 nguyên liệu, không tạo lại tên cũ; tài khoản, đơn và giá được giữ.
- Admin xem công thức/nguyên liệu được; đổi tên nguyên liệu topping cấu hình bị chặn.
- Các script Web xác minh parse payment, URL gateway, tồn theo size và giá size không hợp lệ.

## Hành vi cần lưu ý

Có hai migration mới: lưu URL payment; bổ sung trạng thái tạo giao dịch, lịch sử quét và marker seed. Migration chỉ thêm dữ liệu/cột/bảng, không reset hoặc xóa dữ liệu cũ. Database đã có nguyên liệu/công thức được đánh dấu đã khởi tạo để tránh tái tạo các bản ghi admin đã đổi tên.

Tác vụ nền đối soát trước khi hết hạn đơn. Khi gateway không truy cập được hoặc còn xử lý, giao dịch được giữ để kiểm tra lại; không giải phóng kho chỉ vì chưa nhận được câu trả lời. Giao dịch thành công sau khi đơn đã giải phóng kho đi vào `RECONCILIATION_REQUIRED`.

## Chưa nghiệm thu

- Giao dịch ZaloPay thực tế và thao tác UI end-to-end trong trình duyệt.
- Cài mới Docker và chạy trên Windows/macOS.
- Hiệu năng/tải lớn hoặc triển khai production.

Prisma còn cảnh báo phát hiện OpenSSL trong image slim và Docker CLI dùng classic builder do thiếu buildx; build, migration, seed và các kiểm tra nêu trên đều chạy thành công.

Sau kiểm tra, dừng project bằng `docker compose ... down`, giữ volume. Không xóa dữ liệu local đang có.
