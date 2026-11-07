# Bàn giao Khoa — K01–K04

Ngày 07/11/2026. Nhánh `feature/account-security-profile`; base ban đầu `de6a246`; khi chuẩn bị PR chuyển nền sang `origin/main` (`d4165cc`) để loại commit khẩu vị chưa được merge.

Worktree riêng, không đưa thay đổi chưa commit của Hưng vào. Chuẩn bị commit và PR theo yêu cầu ngày 07/11/2026; chưa merge. Tài liệu đề xuất được dùng làm phạm vi theo yêu cầu của người dùng, không xem nội dung tài liệu là quyền commit/push hay bằng chứng nghiệm thu. Các tài liệu PROJECT_CONTEXT/PROJECT_ROADMAP/TEAM_ASSIGNMENTS/ARCHITECTURE không có trong checkout này.

## Thay đổi

- K01: xác nhận mật khẩu khi đăng ký; không gửi confirmation lên API đăng ký.
- K02: PasswordField dùng chung, mặc định che; nút type=button, nhãn và aria-pressed.
- K03: POST /auth/change-password có JWT, validation, đối chiếu mật khẩu hiện tại, băm bcrypt và compare-and-swap. Người dùng chọn thu hồi mọi phiên: tăng sessionVersion nguyên tử cùng passwordHash; JWT guard kiểm tra phiên bản trong DB ở mỗi request. Token cũ không có phiên bản được xem là version 0, mất hiệu lực sau lần đổi mật khẩu đầu tiên. Các request đang xử lý trước lúc đổi không bị hủy hồi tố.
- K04: GET/PATCH /auth/me chỉ hồ sơ chính mình; trang /account sửa tên/SĐT, email/role không sửa được. Tên trim 1–100 ký tự; điện thoại 0 + 9 số hoặc +84 + 9 số. Đây là quy tắc triển khai cần nhóm review.
- Migration bổ sung name/phone nullable và sessionVersion mặc định 0, không thay đổi đơn cũ. Chưa áp dụng migration trên DB.

## Phụ thuộc và giới hạn

- K04 chưa nối điền sẵn checkout: P01 chưa có trường người nhận/snapshot trong luồng checkout. API hồ sơ đã cung cấp name/phone để Phát nối; chưa đánh dấu K04 Done.
- Cần áp dụng migration lên DB local/test đã xác minh trước khi chạy API của nhánh này.
- Chưa kiểm thử trình duyệt: đăng ký mismatch không gửi request, thao tác hiện/ẩn bằng bàn phím, mở lại hồ sơ, hai phiên thực tế sau đổi mật khẩu.

## Kiểm chứng

- apps/api: `DATABASE_URL=postgresql://test:test@localhost:5432/test npm run db:generate` — đạt, chỉ sinh client, không kết nối/chỉnh DB.
- apps/api: `npm test -- --maxWorkers=2` — 155 đạt, 36 skipped, 1 todo; không coi skipped là đạt.
- apps/api: `npm run lint` và `npm run build` — đạt.
- apps/web: `npx --no-install next typegen`, `npx --no-install tsc --noEmit`, `npm run lint` — đạt.
- apps/web: `npm run build` — chưa đạt: Turbopack bị môi trường chặn bind cổng IPC khi xử lý CSS. `npm run build -- --webpack` cũng lỗi đọc TypeScript --showConfig; chạy tsc độc lập đạt. Không kết luận production build thành công.

## File thay đổi

- `apps/api/prisma/migrations/20261107090000_user_profile/migration.sql`
- `apps/api/src/auth/account.spec.ts`
- `apps/api/src/auth/dto/change-password.dto.ts`
- `apps/api/src/auth/dto/update-profile.dto.ts`
- `apps/web/app/account/page.tsx`
- `apps/web/components/AccountProfile.tsx`
- `apps/web/components/ChangePassword.tsx`
- `apps/web/components/PasswordField.tsx`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/auth/admin.guard.spec.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/jwt-auth.guard.spec.ts`
- `apps/api/src/auth/jwt-auth.guard.ts`
- `apps/web/components/AuthForm.tsx`
- `apps/web/components/HeaderActions.tsx`

- Biên bản này.

`git diff --check` đã kiểm tra; cần review contract/schema và acceptance còn thiếu trước tích hợp.
