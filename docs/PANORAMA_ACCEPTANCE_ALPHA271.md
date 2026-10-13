# BẢO AN LEARNING — ALPHA 2.7.1 PANORAMA

## Vấn đề đã tìm thấy

- Trước đây `game-dialog` bị khống chế bởi `width:min(1220px,100%)`, `height:min(845px, ...)` và viền hộp thoại. Vì vậy game trông như một cửa sổ nhỏ nổi trên trang, không cùng tỉ lệ với concept ngang rộng.
- Layout Math/Sentence/Memory bị chặn `max-width` khoảng 980–1050px; phần cảnh quan hai bên thiếu đất diễn.
- CSS được chia nhiều tầng; cần có stylesheet cuối cùng để ngăn các media query cũ ép game về hộp thoại trên màn hình lớn.

## Các thay đổi được triển khai

1. `App.tsx`: gắn `immersive-overlay`, `immersive-dialog` khi mở game; trang Game Center có class riêng để mở rộng. Khóa cuộn nền và tạm bỏ vùng chừa cho scrollbar, trả lại cài đặt khi đóng game.
2. `src/styles/panorama271.css`: game chiếm `100vw × 100dvh`, thanh tiêu đề gọn, cảnh game kéo đến các cạnh; nội dung điều khiển nằm trong vùng đủ đọc. Breakpoint 950/760/360px.
3. Math Quest: nhân vật ở vùng phụ bên trái và khối câu hỏi lớn bên phải trên màn hình rộng; giữ vùng phản hồi cố định từ Alpha 2.7.
4. Memory Match: nhân vật và lời dẫn được hiển thị riêng trên desktop, bảng thẻ có không gian lớn hơn.
5. Sentence Builder: xưởng ngôn từ bố trí theo chiều ngang trên desktop; điện thoại giữ màn hình dọc, không ép thẻ quá nhỏ.
6. `src/main.tsx`: `stability27.css` luôn được nạp **trước** `panorama271.css`, tránh CSS từ module game tải muộn đè ngược bản nâng cấp.
7. IndexedDB và Game SDK V1: **không thay đổi schema hoặc hợp đồng dữ liệu**.

## Kiểm thử thực hiện tại môi trường tạo mã

- **40/40** bài test Node, bao gồm hồi quy Alpha 2.7 và 4 bài test bảo đảm lớp Panorama.
- TS/TSX parser: đạt; `tsc --noEmit -p tsconfig.core.json`: đạt phần lõi.
- Chromium qua `page.set_content()` với cùng chuỗi CSS sản phẩm, dùng dữ liệu hình ảnh nhúng vào fixture để tránh hạn chế truy cập file/localhost:
  - 3 game × 4 kích thước: **1440×900, 1920×1080, 390×844, 320×700**.
  - 12/12 ca: khung game bằng đúng `innerWidth`/`innerHeight`, không có tràn ngang document.
  - Một số màn hình hẹp cần cuộn **bên trong stage** — đây là hành vi dự kiến để giữ chữ/nút đủ lớn.
- Ảnh kiểm tra: `docs/panorama271/math-1440.png`, `math-390.png`, `memory-1440.png`, `memory-390.png`, `sentence-1440.png`, `sentence-390.png`.
- Kết quả kích thước: `docs/panorama271/layout-results.json`.

**Ranh giới xác minh:** đây là kiểm thử cấu trúc, logic và fixture HTML/CSS chạy trong Chromium. Chưa thể build Vite/React ở môi trường này vì không tải được gói npm; cần nghiệm thu bản ứng dụng **React thật** trên máy Windows của người dùng. Các ảnh không được gọi là ảnh chụp game tương tác React.

## Tiêu chí nghiệm thu trên máy Windows

1. Chạy `npm install`, `npm run build`, `npm run dev` trong **thư mục mới**.
2. Từ Game Center vào đủ ba game; trên máy tính 1366–1920px game phủ đầy viewport, không còn viền/hộp thoại nhỏ nằm giữa.
3. Math Quest: đọc được đáp án, nhân vật hiện bên trái, click đáp án đúng/sai không làm câu hỏi hoặc nút nhảy vị trí.
4. Memory Match: lật thẻ và hoàn tất, bối cảnh vẫn phủ toàn cảnh, không bị giới hạn khung hẹp.
5. Sentence Builder: chọn/kéo thả, kiểm tra và chuyển câu mà không nhảy màn hình.
6. Trên điện thoại 320/390px game hiển thị dọc tự nhiên, không tràn ngang; khi nội dung dài được cuộn riêng trong game.
7. Khi nhận thưởng, cảnh chơi vẫn giữ phía sau overlay; nhấn thoát quay về đúng Game Center.
8. Lịch sử/điểm vẫn giữ sau tải lại, Góc phụ huynh khớp dữ liệu trước nâng cấp.

## Giới hạn thiết kế cần phân biệt

- Đợt 2.7.1 ưu tiên **độ rộng và cách dùng không gian**, không phải bổ sung đồ họa 3D thực hay thay toàn bộ chất lượng hình vẽ. Bối cảnh sạch được giữ từ Alpha 2.7; chất lượng mỹ thuật vẫn cần tiếp tục nâng để thật sự bằng concept cao cấp.
- Góc phụ huynh và Creator Studio giữ bố cục ứng dụng công cụ; không nên mở toàn màn hình game cho hai phân hệ này.
