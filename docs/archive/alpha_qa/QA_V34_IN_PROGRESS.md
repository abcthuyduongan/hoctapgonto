# Bảo An Learning V3.4 — tiến độ kỹ thuật (CHƯA PHÁT HÀNH)

## Kết quả đã làm
1. Tạo mô hình cáo GLB 2.0 độc lập để thử đường nạp mô hình.
2. Kết nối `importGLB()` vào `LearningWorld3D.loadGuideModel()`.
3. Thay lưới 3D và cập nhật WebGL ARRAY_BUFFER sau khi GLB nạp thành công; giữ cảnh dự phòng nếu lỗi.
4. Hủy tải khi renderer bị dispose, chặn lần tải cũ ghi đè mới và giới hạn kích thước GLB 8 MB.
5. Thử tải mô hình, mô hình lỗi 404 và thoát khi đang tải bằng WebGL giả lập; tất cả đều đạt.
6. Mã Game SDK và dữ liệu trò chơi không thay đổi.

## Bằng chứng kỹ thuật
- Bộ lõi cũ: 44/44.
- Nhập GLB, GLB thực, thay buffer và xử lý lỗi/thoát: 10/10.
- Kiểm tra cú pháp TS/TSX: đạt.
- Kiểm tra kiểu TypeScript của bộ dựng + bộ nhập: đạt.

## Giới hạn và rào phát hành
- Tệp mẫu `fox-guide-prototype.glb` chỉ dùng xác minh kỹ thuật; chưa có texture PBR, rig, animation clips.
- Không có các mô hình chính thức cho ba đảo, lâu đài và môi trường.
- Chưa kiểm tra WebGL trên GPU vật lý, tốc độ khung hình thiết bị thật, và build React/Vite.
- Kiểm thử 3D còn dựa trên WebGL mock, không thể coi là nghiệm thu thẩm mỹ.
- `npm run gate:premium-art` phải **thất bại** cho tới khi đủ tài nguyên cao cấp có bản quyền rõ ràng.

## Kế tiếp
- Chuẩn hóa loader có texture/PBR, animation glTF, rigged mascot; bắt đầu bằng bộ asset chất lượng cao có giấy phép hợp lệ.
- Tạo pipeline đo FPS, memory và ảnh chụp ứng dụng React thật ở desktop/tablet/mobile.
- Chỉ bàn giao khi qua rào chất lượng mỹ thuật và gameplay đã thống nhất.
