# Cổng nghiệm thu 3D cao cấp – Bảo An Learning (bản làm việc)

## Kết luận hiện tại
**CHƯA ĐỦ ĐIỀU KIỆN BÀN GIAO**. Bộ tạo hình WebGL thuần dùng các primitive có thật, nhưng chưa có mô hình nhân vật/đảo chất lượng cao; chưa xác minh production build React và WebGL GPU thật. Không đổi tên low-poly thành premium để đủ điều kiện.

## Yêu cầu bắt buộc để bàn giao
1. Đầy đủ 5 mô hình GLB theo `src/world3d/assets/premium-manifest.json`, có nguồn gốc/giấy phép hợp lệ. Các mô hình cùng phong cách, có bản quyền triển khai rõ ràng.
2. Cáo đồng hành có ít nhất trạng thái chờ, động viên và chiến thắng; model hoạt hình không dán ảnh vào cảnh và không cần cả khung nền đi kèm.
3. Render bằng vật liệu có texture và điều kiện ánh sáng thống nhất; không chỉ gắn GLB được mà texture bị bỏ qua.
4. Mở trang chủ desktop/tel là thấy đủ ba đảo, có nút thật; không cuộn sân khấu trái ý muốn và không tràn ngang ở 1920, 1440, 1366, 1024, 768, 390, 320px.
5. Ba game hoàn thành toàn bộ học liệu mẫu, Memory Match không khóa sau hai thẻ, bảng câu hỏi không nhảy khi trả lời, dữ liệu kết quả được ghi vào đúng phiên.
6. Kiểm thử performance trên thiết bị thực: tối ưu để duy trì cảm giác mượt, có lựa chọn chất lượng đồ họa và phương án khi WebGL không hỗ trợ. Ghi số đo cụ thể trước nghiệm thu, không đoán FPS.
7. `npm run build` thành công; kiểm thử React browser thật và trình duyệt di động; không dùng ảnh mock HTML/CSS để thay thế.
8. Ảnh chụp ứng dụng chạy thật được đối chiếu với concept đã chốt. Cần duyệt mỹ thuật bởi chủ dự án, không chỉ tính bằng số bài test.

## Trạng thái kỹ thuật hiện tại
- Parser GLB 2.0 được phát triển độc lập và kiểm tra đơn vị. Đây chỉ là tầng nạp hình học + màu, **chưa đọc texture PBR, skeleton và animation để hiển thị**.
- Mô hình GLB chất lượng cao và pipeline hoạt ảnh chưa tích hợp; cổng `npm run gate:premium-art` cố ý không cho qua nếu thiếu asset.
- Phương án kỹ thuật đáng tin cậy: bộ renderer hỗ trợ GLB PBR đầy đủ, ví dụ Three.js cùng hệ import GLTFLoader, dùng asset có nguồn gốc phù hợp. Thư viện cần được cài và kiểm thử trên môi trường có npm.

## Nguồn mô hình tiềm năng cần kiểm tra giấy phép khi lấy tệp
- Quaternius Ultimate Stylized Nature (CC0, glTF): https://quaternius.com/packs/ultimatestylizednature.html
- Quaternius Ultimate Platformer Pack (CC0, glTF, nhân vật hoạt ảnh): https://quaternius.itch.io/ultimate-platformer-pack
- Kenney Platformer Kit (CC0): https://kenney-assets.itch.io/platformer-kit
Các bộ sưu tập này có phong cách stylized/low-poly và **chưa tự động đủ chuẩn concept**; cần khâu chọn, chỉnh sửa, phối vật liệu và hoạt ảnh đồng bộ.
