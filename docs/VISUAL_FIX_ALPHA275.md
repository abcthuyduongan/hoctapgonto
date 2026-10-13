# Kiểm tra chất lượng Alpha 2.7.5

## Phát hiện từ ảnh thực tế

1. Trang chủ: lớp xanh chiếm tỷ trọng lớn; phong cảnh chưa đủ chi tiết dù đã dùng artwork cao cấp.
2. Math Quest: vẫn dùng `original-math.webp` (phong cảnh vector); hình cáo bị lỗi hiển thị trên máy người dùng. Không thể kết luận từ ảnh alone lỗi 404 hay lỗi cài đặt, vì tệp cũ có tồn tại trong ZIP; giải pháp là dùng tài nguyên cùng bộ và fallback.
3. Trải nghiệm: hệ thống phản hồi đúng/sai vẫn phải giữ chiều cao ổn định và không làm layout nhảy.

## Đã sửa

- Thay nhóm CSS cuối bằng asset premium thật, giảm overlay xanh.
- Tạo `GameMascot.tsx` chống ảnh hỏng và tái sử dụng cho ba game.
- Ba nền game `premium-game-*.webp` mới; không in câu hỏi hoặc nút giả trong ảnh.
- Kiểm tra tệp tồn tại, unit tests và typecheck phần lõi.

## Kiểm thử

- Core tests: 51/51 đạt.
- TypeScript syntax parser: đạt.
- Core typecheck: đạt.
- Browser screenshot: 1440 / 390 / 320 cho `home` và `math` — 6 ca, ảnh DOM đều tải được, không tràn ngang.

## Chưa nghiệm thu

- `npm run build` với React/Vite thật và runtime Game SDK trên máy người dùng.
- Thử hỏng asset khi chạy game thật; fallback đã viết và kiểm thử tĩnh, chưa chạy trong React browser.
- Mỹ thuật cao cấp đạt ngang concept: cần dựng scenery mới sạch và đánh giá side-by-side với ảnh React thật.

Đề xuất: Sau khi chạy build, chụp một ảnh desktop 1920x1080, một ảnh Math Quest khi trả lời và một ảnh mobile để nghiệm thu thực tế, không dựa trên ảnh HTML tĩnh.
