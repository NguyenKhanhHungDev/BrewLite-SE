# BrewLite — Frontend

Menu A1-03, Detail A1-04, Cart A1-05 và UI xác nhận/lịch sử A1-09.

## Chạy

Cần Node.js 24, API ở `http://localhost:3001` và PostgreSQL.
Khởi động API/database theo [README gốc](../../README.md).

Từ thư mục gốc repo:

```bash
cd apps/web
npm ci
npm run dev -- --port 3000
```

Mở http://localhost:3000. Đổi địa chỉ API qua `API_INTERNAL_URL` nếu cần.

Nếu dùng PowerShell, thay `npm` bằng `npm.cmd`. Không chạy thêm web container
khi đang dùng cổng 3000 cho `npm run dev`.

Đăng ký tài khoản trên giao diện. Tải lại trang cần đăng nhập lại; giỏ vẫn còn.
Chủ động đăng xuất xóa giỏ.

## Kiểm tra

```bash
npm run lint
npm run build
```

Menu → bấm ảnh món → Detail → thêm/sửa/xóa giỏ → đăng nhập → tạo đơn → lịch sử.
Kiểm tra thêm lỗi số ly, vượt tồn, khôi phục giỏ và màn hình nhỏ.

Products, Auth, Orders và History dùng API thật. `POST /payments` hiện trả 404;
giao diện báo lỗi và giữ giỏ. PAID/PAYMENT_FAILED mới được kiểm thử bằng phản hồi
mô phỏng trong trình duyệt; chưa nghiệm thu thanh toán end-to-end.

Kết quả Menu trước đây: [kiểm tra A1-03](docs/a1-03-verification.md).
