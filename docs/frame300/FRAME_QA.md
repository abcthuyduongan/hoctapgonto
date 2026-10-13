# BẢO AN LEARNING V3 — World Frame Alpha 3.0 / Nghiệm thu kỹ thuật

## Phạm vi đã thay đổi
- Trang chủ đóng thành **một scene viewport** dưới thanh điều hướng, bỏ phần lặp Hành trình bên dưới. Không còn cuộn cả trang khi ở Góc học sinh.
- Bố cục 3 đảo game trên desktop/tablet; điện thoại chuyển thành 3 lựa chọn gọn trong cùng scene. Các nút Bắt đầu và select học liệu được nối với React thật, không phải chữ in trong hình.
- Bộ token và CSS thống nhất cho thanh đầu trang, nút, bảng sao và các phần gameplay.
- Thay nhân vật dùng chung bằng ảnh có alpha đã tách bớt cảnh nền `fox-scene-free.webp`; giữ fallback emoji khi ảnh không tải.
- Giữ nguyên schema IndexedDB, Game SDK, luồng lưu kết quả và bản sửa lỗi Memory Match trong React StrictMode.

## Kết quả đã xác minh ở môi trường tác giả
- `npm run verify:offline`: **80/80** bài kiểm thử Node đạt, cú pháp TS/TSX đạt, typecheck phần lõi đạt.
- Dựng bản kiểm tra HTML/CSS dùng đúng toàn bộ thứ tự stylesheet và tài nguyên ảnh; chụp Chromium tại 1920×1080, 1440×900, 1366×768, 1024×768, 768×900, 390×844, 320×700.
- 7/7 viewport có `scrollHeight === innerHeight`, `scrollWidth === innerWidth`; không có ảnh lỗi; 3 game và thanh hành động không vượt ngoài khung hình.
- Các ảnh trong `docs/frame300/home-*.png`; phép đo chi tiết `docs/frame300/layout-results.json`.

## Điểm **chưa** kiểm chứng/giới hạn
- Môi trường hiện tại không truy cập được npm registry nên **không chạy được `npm install`, `npm run build` và browser E2E của ứng dụng React thực**.
- Các ảnh QA là từ HTML/CSS mô phỏng DOM giao diện học sinh với chính CSS/tài nguyên của dự án; **không phải màn hình React chạy thật**.
- Chưa đủ cơ sở xác nhận pixel-perfect so với concept đồ họa 2.5D. Tranh nền dùng lại từ bộ cũ vẫn có chất lượng thấp hơn hình concept; không gọi bản này là Stable.
- Memory Match kiểm thử logic và các ca StrictMode từ phiên trước, nhưng chưa xác nhận qua máy Windows của người dùng sau khi cập nhật giao diện.
- Không bổ sung chức năng quản lý hồ sơ, cloud, phân quyền hoặc game mới.

## Bắt buộc kiểm tra trước khi chốt
1. `npm install`, `npm run build`, `npm run dev` trong thư mục project.
2. Ở desktop mở Home, bảo đảm 3 game và nút nằm trọn 1 khung, không xuất hiện thanh cuộn.
3. Trên điện thoại ở 390px và 320px chọn bài + mở đủ 3 game.
4. Lật liên tiếp 2 thẻ sai trong Memory Match: chờ khoảng 0,7 giây, các thẻ phải úp lại và cho phép lật tiếp. Làm tương tự với cặp đúng.
5. Trả lời Math Quest và Sentence Builder, xác nhận vùng đáp án không dịch chuyển khi hiện kết quả.
6. Làm xong bài, thoát ra, tải lại: dữ liệu điểm cũ vẫn còn.
