# ALPHA 2.7.4 · PREMIUM WORLD HOME — GHI NHẬN KIỂM TRA

## Các hạng mục đã sửa
- Đổi cảnh trang chủ từ ảnh vector phẳng sang một bộ tài nguyên minh họa giàu chi tiết hơn, tách riêng bối cảnh, linh vật và ba thế giới.
- Bỏ các hộp game chữ nhật kiểu website. Ba điểm trò chơi được vẽ nổi trên cảnh thế giới, có bảng tên, bộ chọn bài và nút chơi thật (React).
- Căn giữa các thế giới trên desktop, chuyển bố cục dọc trên điện thoại; không thay API, Game SDK hoặc schema IndexedDB.
- Bỏ hai nhãn “Cửa hàng sao” và “Bộ sưu tập” vốn chưa có module vận hành; giữ liên kết thật Bảng cửu chương và Thành tích của con.

## Phương pháp kiểm thử
- `node --experimental-strip-types --test tests/*.test.mjs`: 48/48 ca đạt.
- `node tests/check-tsx.mjs`: đạt phân tích cú pháp TypeScript/TSX.
- `tsc --noEmit -p tsconfig.core.json`: đạt kiểm tra kiểu dữ liệu lõi.
- Dựng cấu trúc HTML/CSS của trang chủ với cùng các stylesheet, nhúng tài nguyên cục bộ rồi chụp trong Chromium ở 1440×900, 390×844, 320×700. Không có phần tử làm tràn chiều rộng khung nhìn theo phép đo `scrollWidth <= clientWidth`.
- Ảnh xem trước nằm tại `docs/visual274/home-1440.png`, `home-390.png`, `home-320.png`.

## Điều chưa được nghiệm thu
- Tại môi trường tạo mã, kho npm không kết nối được nên chưa chạy `npm run build` với đầy đủ React/Vite; vì vậy chưa chụp ảnh ứng dụng React đã build.
- Ảnh xem trước dùng dữ liệu minh họa trong HTML, **không phải ảnh sản phẩm React thực đang ghi kết quả**. Các phím tại bản xem trước không dùng để chơi thật.
- Thị giác đã cải thiện so với 2.7.3 nhưng vẫn chưa chứng minh đạt hoàn toàn concept cao cấp; cần so sánh screenshot React trên máy người dùng và có thể tiếp tục hiệu chỉnh.
- Game Center dùng ảnh minh họa từ bản concept đã được cắt chỉ giữ phần cảnh quan. Các chữ số/bảng chữ xuất hiện trong tranh là vật thể học tập trong cảnh, không phải nút điều khiển.

## Nghiệm thu thực tế trên Windows
1. Giải nén vào thư mục riêng; sao lưu dữ liệu từ bản Alpha hiện hành nếu đang dùng dữ liệu thực.
2. `npm install`, `npm run build`, `npm run dev`.
3. Mở màn hình desktop, kiểm tra ba đảo hiển thị cân đối, nút không bị linh vật che và có thể lựa chọn học liệu cho từng game.
4. Vào Math Quest, Memory Match, Sentence Builder và chơi tới kết quả; xác minh không nhảy vị trí, không mất dữ liệu.
5. Kiểm tra cùng trang ở chế độ thiết bị di động, không cuộn ngang hoặc mất nút chọn bài.
