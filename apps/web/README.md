# BrewLite — Frontend

Menu A1-03, Detail A1-04, Cart A1-05 và UI xác nhận/lịch sử A1-09.
Giao diện tham chiếu: `brewlite-ui (7)`.

## Chạy

Cần Node.js 24, API ở `http://localhost:3001` và PostgreSQL.
Khởi động API/database theo [README gốc](../../README.md).

Trong Git Bash, từ thư mục gốc repo:

```bash
cd apps/web
npm ci
npm run dev -- --port 3000
```

Mở http://localhost:3000. Các API dùng rewrite cùng origin, cấu hình địa chỉ
backend qua `API_INTERNAL_URL` (mặc định `http://localhost:3001`).

Nếu dùng PowerShell, thay `npm` bằng `npm.cmd`. Không chạy thêm web container
khi đang dùng cổng 3000 cho `npm run dev`.

Các trang: `/`, `/products/1`, `/cart`, `/login`, `/checkout`, `/history`,
`/confirmation/{orderId}`. Detail đọc JSON qua `/api/products/:id` để không
trùng URL HTML `/products/:id`. Auth/Orders/Payments dùng rewrite cùng origin.

Giá gốc là size M; S −5.000, L +5.000; PEARL +5.000, CREAM +7.000 VND.
Detail và Cart dùng chung `lib/pricing.ts`. Giỏ lưu trong localStorage;
size/tập topping phân biệt dòng, badge đếm tổng ly. Giá/tồn được đọc lại
trước khi tạo đơn. Body tạo đơn chỉ có `items`; tổng chính thức lấy từ backend.

Đăng ký/đăng nhập bằng tài khoản tự tạo. JWT chỉ giữ trong bộ nhớ; tải lại trang
cần đăng nhập lại. Giỏ vẫn còn; chủ động đăng xuất xóa giỏ. Khóa yêu cầu tạo
đơn/thanh toán lưu trong sessionStorage, không chứa JWT hay mật khẩu.
HTTP retry giữ nguyên khóa và nội dung; chưa xác nhận thì giữ giỏ.

DM Sans/Fraunces được tải lúc build bằng `next/font/google` và phục vụ từ
Next.js; cần mạng khi build lần đầu. Arial/Georgia là font dự phòng.
Ảnh API lỗi hoặc chưa có dùng ảnh thay thế chung kèm “Ảnh đang cập nhật”.

## Kiểm tra

```bash
npm run lint
npm run build
```

Kiểm tra: Menu → Detail → thêm cùng/khác tùy chọn → sửa/xóa/refresh Cart →
đăng nhập → tạo đơn → kiểm tra tổng từ backend → chọn WALLET/CARD → xem kết quả
và lịch sử. Thử lỗi số ly, vượt tồn, API lỗi, giỏ trống và màn hình nhỏ.

**Tích hợp đã kiểm tra trên main `84f0e29`:** Products, Auth, Orders và History
dùng API thật. `POST /payments` trả 404; web báo lỗi và giữ giỏ. Các nhánh
PAID/PAYMENT_FAILED mới được kiểm thử bằng phản hồi mô phỏng trong trình duyệt,
không có dữ liệu thanh toán giả trong ứng dụng. Chưa nghiệm thu thanh toán
end-to-end hoặc toàn bộ A1-09.

Kết quả Menu trước đây: [kiểm tra A1-03](docs/a1-03-verification.md).
