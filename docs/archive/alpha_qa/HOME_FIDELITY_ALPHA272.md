# Bảo An Learning V3 Alpha 2.7.2 — sửa Game Center

## Nguyên nhân trực tiếp

- `StudentScreen.tsx` Alpha 2.7.1 dựng một `.world-hero` riêng, phía dưới là `.world-card-grid`: phải cuộn qua banner lớn mới đến điểm chọn game.
- `original-world.webp` (cũng tồn tại trong dự án dưới dạng SVG tương ứng) là tranh vector phẳng, không phải tranh 2.5D đã thể hiện trong concept.
- Alpha 2.7.1 dành công sức chỉnh kích cỡ **màn chơi**, không thay đổi hình thức Game Center tương ứng với concept.

## Thay đổi trong Alpha 2.7.2

- Thay banner + catalog bằng **một sân khấu Game Center**, chứa trực tiếp 3 thế giới và 3 nút chơi có thao tác thực.
- Giữ bảng chọn học liệu tương thích với game, luồng gọi `onPlay`, trạng thái đang mở, thông báo khi chưa có bộ học liệu.
- Giữ toàn bộ kết quả học tập và schema IndexedDB; không thay đổi dữ liệu, API hay Game SDK.
- Thêm phong cảnh từ 3 hình minh họa không chứa chữ/nút giả; logo, chữ, bảng chọn, nút chơi là DOM và CSS riêng.
- Giao diện đáp ứng màn hình ngang / điện thoại dọc và hỗ trợ `prefers-reduced-motion`.

## Bằng chứng kiểm tra

- 44/44 bài kiểm thử lõi, cấu trúc, regression đạt.
- Kiểm tra cú pháp TS/TSX đạt.
- Kiểm tra bố cục HTML/CSS bằng Chromium 1440x900, 1920x1080, 390x844, 320x700: 4/4 không tràn ngang.
- Xem hình trong `docs/worldhome272/worldhome-{width}.png`.
- `preview/portal272.html` là HTML/CSS tĩnh; chỉ mô tả bố cục, không phải ứng dụng React đang chạy.

## Chưa đạt / điều kiện phát hành

- Tranh phong cảnh vẫn chưa chi tiết như concept high-end 2.5D. Các bìa minh họa có chất lượng khá nhưng **không đồng nghĩa trang chủ đã bám sát 100% hình minh họa**.
- Chưa chạy được lệnh `npm run build` với môi trường thiếu cài đặt npm; bắt buộc build trên Windows và chụp màn hình ứng dụng React thực tế.
- Cần asset chuyên biệt: cảnh đảo nổi ngang, nhân vật toàn thân nền trong suốt, biểu tượng ba đảo, các lớp parallax trước/sau — đều KHÔNG chứa chữ, HUD hay nút giả.
- Phải nghiệm thu so sánh screenshot React với concept ở kích cỡ 1440/1920 và mobile, kể cả với học liệu dài.

## Kiểm tra Windows

```
npm install
npm run build
npm run dev
```

Kiểm tra: mỗi nút Bắt đầu mở game tương ứng, chọn học liệu thay đổi chính xác, quay lại không nhảy cuộn, trường hợp không có học liệu phải khoá nút, phụ huynh và biên soạn vẫn hoạt động. Nên giải nén thành thư mục riêng, không ghi đè phiên bản cũ.
