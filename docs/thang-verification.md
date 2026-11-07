# Bàn giao Thắng — T01–T03

Ngày 07/11/2026. Nhánh `feature/payment-details-reconciliation`; base ban đầu `de6a246`; khi chuẩn bị PR chuyển nền sang `origin/main` (`d4165cc`) để loại commit khẩu vị chưa được merge.

Worktree riêng, không đưa thay đổi chưa commit của Hưng vào. Chuẩn bị commit và PR theo yêu cầu ngày 07/11/2026; chưa merge. Tài liệu đề xuất được dùng làm phạm vi theo yêu cầu của người dùng, không xem nội dung tài liệu là quyền commit/push hay bằng chứng nghiệm thu. Các tài liệu PROJECT_CONTEXT/PROJECT_ROADMAP/TEAM_ASSIGNMENTS/ARCHITECTURE không có trong checkout này.

## Thay đổi

- T01: GET /payments/:orderId/details lọc theo userId xác thực, trả mọi lần thử theo thời gian/id, allowlist dữ liệu an toàn. Có số tiền, phương thức, trạng thái, mã yêu cầu/mã gateway, thời gian tạo/thanh toán khi có. Không trả URL thanh toán, requestHash, idempotency key hoặc payload gateway. Đơn người khác/missing trả 404.
- Link từ lịch sử đơn tới trang kết quả/chi tiết thanh toán; loading/error/retry và trạng thái chưa có giao dịch.
- T02: GET /payments/admin/reconciliation?page=1 có JWT + AdminGuard; lọc RECONCILIATION_REQUIRED trước phân trang 20 dòng; count/dữ liệu trong transaction RepeatableRead. Trang /admin/payments có refresh/phân trang và phân biệt trạng thái đơn/thanh toán. Bộ lọc cố định danh sách cần đối soát; không thêm nút đổi kết quả hoặc hoàn tiền.
- T03: countdown trên checkout/trang kết quả dùng orderExpiresAt và serverTime từ backend, bù thời gian trôi bằng performance.now. Ghi rõ đây là hạn đơn, không phải hạn gateway; không âm, cleanup interval, kiểm tra status backend một lần khi hết hạn. Không tự tạo payment, đổi trạng thái hoặc xử lý kho. Mỗi deadline chỉ kích hoạt kiểm tra hết hạn một lần để tránh vòng lặp khi backend còn xác minh.
- Không đổi schema hoặc quy tắc giải quyết thanh toán hiện có.

## Kiểm chứng

- apps/api: `npm test -- --maxWorkers=2` — 153 đạt, 36 skipped, 1 todo.
- apps/api: `npm test -- src/payments/payment-details.spec.ts --maxWorkers=2` — 5/5 đạt (ownership, allowlist, deadline, reconciliation/pagination, route guards/input).
- apps/api: `npm run lint` và `npm run build` — đạt.
- apps/web: `npx --no-install next typegen`, `npx --no-install tsc --noEmit`, `npm run lint` — đạt.
- apps/web: `npm run build -- --webpack` — lỗi đọc TypeScript --showConfig; production build chưa được xác minh. Turbopack trên worktree Khoa cùng môi trường bị chặn cổng IPC.
- Chưa chạy PostgreSQL integration, browser acceptance hay gateway ZaloPay thật. Chưa nghiệm thu countdown/reload/network retry trên trình duyệt; không đánh dấu Done.

## File thay đổi

- `apps/api/src/payments/payment-details.controller.ts`
- `apps/api/src/payments/payment-details.service.ts`
- `apps/api/src/payments/payment-details.spec.ts`
- `apps/web/app/admin/payments/page.tsx`
- `apps/web/components/PaymentDetails.tsx`
- `apps/api/src/payments/payments.module.ts`
- `apps/web/app/checkout/page.tsx`
- `apps/web/components/AuthForm.tsx`
- `apps/web/components/OrderCard.tsx`
- `apps/web/components/PaymentResult.tsx`
- `apps/web/components/admin/AdminShell.tsx`

- Biên bản này.

`git diff --check` đã kiểm tra; cần review contract/schema và acceptance còn thiếu trước tích hợp.
