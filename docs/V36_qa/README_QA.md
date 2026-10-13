# Nghiệm thu V3.6 RC1 (2026-10-13)

## Đã xác nhận trong Chromium ở chế độ Canvas
- Trang chủ 1440×900 và 390×844: không tràn ngang/dọc, không lỗi JavaScript.
- Tải mô hình GLB ở Canvas dự phòng: thành công trên hai độ phân giải.
- Memory Match: chọn hai thẻ không gây khóa; thoát rồi mở lại chơi được.
- Math Quest: hết 8/8 câu, báo hoàn thành.
- Memory Match: ghép đủ 6/6 cặp, báo hoàn thành.
- Sentence Builder: hoàn thành 5/5 câu, báo hoàn thành.
- Góc phụ huynh: thấy ba lượt và tổng 19 sao; xuất được tệp JSON.
- Nút giảm chuyển động: hoạt động.

## Kiểm tra mã nguồn
- Core SDK, học liệu, xác thực dữ liệu: 44/44 đạt.
- GLB, tích hợp mô hình, an toàn runtime và chuyển động: 13/13 đạt.
- Engine 3D và TypeScript core: đạt kiểm tra biên dịch riêng.

## Chưa xác nhận và còn thiếu
- Build React/Vite production (npm registry không truy cập được).
- Render WebGL2 trên GPU thật và FPS ở thiết bị phổ thông.
- Khôi phục dữ liệu thực tế qua file JSON trên thiết bị người dùng và khả năng localStorage qua tải lại trang (giới hạn môi trường test).
- Tiêu chuẩn mỹ thuật cao cấp như bản concept: **chưa đạt**.

Các bằng chứng: `results.json`, `flow.json`, `world-1440.png`, `world-390.png`.
