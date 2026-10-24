# A1-03 — Kiểm tra Menu

Ngày kiểm tra: 24/10/2026. Nhánh: `feature/a1-03-menu`, tạo từ main `5000ee3`.
Phạm vi: `apps/web`; Next.js 16.4.2, Node.js 24.16.0, Windows, Microsoft Edge
156.0.4314.42 chạy headless bằng Playwright.

## Dữ liệu thật

- PostgreSQL local riêng, migration `20261023093136_create_product` và seed gốc
  `apps/api/prisma/seed.ts`; không sửa backend/schema/seed để làm Menu.
- Đọc bảng Product bằng SQL rồi so sánh với `GET localhost:3001/products` và
  response `/products` qua rewrite Next.js: cả ba trùng nhau, 3 sản phẩm.
- Cà phê sữa: 35.000 VND; Trà đào: 39.000 VND; Bạc xỉu: 38.000 VND.
- Tên/giá trên từng card khớp response; Hero dùng sản phẩm đầu tiên của response.
- Ảnh gốc trong seed chưa có file tương ứng. UI thử tải `imageUrl`, khi lỗi
  dùng ảnh thay thế chung và ghi “Ảnh đang cập nhật”.

## Kết quả

| Kiểm tra                                      | Kết quả                                                         |
| --------------------------------------------- | --------------------------------------------------------------- |
| `npm.cmd run lint`                            | Đạt                                                             |
| `npm.cmd run build`                           | Đạt, bao gồm TypeScript và prerender                            |
| 1280px                                        | 3 cột Menu, 2 cột Hero, Header 76px, không tràn ngang           |
| 768px                                         | 2 cột Menu, 1 cột Hero, không tràn ngang                        |
| 390px                                         | 2 cột Menu, 1 cột Hero, Header 66px, không tràn ngang           |
| Explore drinks                                | Cuộn tới Menu bằng liên kết `#menu`                             |
| Loading                                       | Hiện đang tải, chưa hiển thị nhầm trạng thái trống              |
| Response `[]`                                 | Chưa có sản phẩm; Hero trang trí không truy cập phần tử chưa có |
| HTTP 500, mất kết nối                         | Hiện lỗi; Thử lại lấy API thật thành công                       |
| JSON lỗi, response sai cấu trúc, giá sai kiểu | Hiện lỗi; Thử lại lấy API thật thành công                       |
| Stock = 0, tên dài                            | Nhãn Hết hàng; chữ xuống dòng, mobile không tràn                |
| DM Sans/Fraunces                              | Đã tải thật trên trình duyệt, xác nhận bằng FontFaceSet         |
| Chặn tải file font                            | Font dự phòng và bố cục Menu vẫn hoạt động                      |
| JavaScript page errors                        | 0 trong lượt kiểm tra đạt                                       |

Các tình huống loading/rỗng/lỗi/stock 0/tên dài được giả lập bằng chặn response
**chỉ trong trình duyệt kiểm thử**. Không thay dữ liệu PostgreSQL để tạo bằng
chứng; frontend nộp bài vẫn gọi API thật, không chứa danh sách món fixture.
Lượt kiểm tra dữ liệu thật không chặn API response.

## Ảnh và log

- [Desktop 1280px](menu-evidence/menu-1280.png)
- [Tablet 768px](menu-evidence/menu-768.png)
- [Mobile 390px](menu-evidence/menu-390.png)
- [Đang tải](menu-evidence/state-loading.png)
- [Danh sách trống](menu-evidence/state-empty.png)
- [Lỗi](menu-evidence/state-error.png)
- [Kết quả kiểm thử trình duyệt](menu-evidence/results.json)

Ảnh Menu dùng dữ liệu API/PostgreSQL thật và ảnh thay thế chung.
Ảnh các trạng thái là fixture kiểm thử. Nút công cụ Next.js development được
ẩn khi chụp ảnh, không thay nội dung Menu.

## Phần còn lại để nghiệm thu

- Review thay đổi và cấu hình database local; Prisma dùng `apps/api/prisma7.config.ts`
  có sẵn. Không đưa `.env` lên Git.
- Nhóm bổ sung ảnh thật tương ứng `imageUrl` khi có; hiện đã có fallback.
- PR cần review/merge và Issue #3 được đóng theo hướng dẫn.
