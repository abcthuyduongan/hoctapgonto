# Kiểm tra bố cục carousel V3.7

Yêu cầu hiện tại: ba đảo ban đầu có cùng chiều sâu, kích thước và khoảng cách; chưa đảo nào được chọn. Cáo đứng chờ ở góc trái màn hình, ngoài các đảo. Khi chọn một hoạt động, vòng đảo quay đưa đảo đó lên phía trước và cáo nhảy tới điểm đáp. Nút “Xem tất cả các đảo” đưa cáo về góc chờ.

Giao diện chính hiện dùng một cảnh 3D duy nhất, chỉ còn lựa chọn chất lượng. Cảnh dự phòng tự xuất hiện khi WebGL hoặc asset không khả dụng.

Đã chụp lại build cuối lúc 09:12 ngày 14/10/2026 (Asia/Saigon), qua preview 5180 bằng Edge 155 trong hồ sơ riêng. Chunk cảnh: `PremiumWorldRenderer-jEhZ5ih1.js`; chunk ứng dụng: `index-BmNCNoVt.js`. Đã xem trực tiếp đủ 12 ảnh: trạng thái đầu và từng đảo Toán, Trí nhớ, Ngôn từ trên 1440×900, 390×844, 320×640.

- Cáo và bệ chờ hiện trọn ở phía dưới bên trái của cảnh trên cả ba viewport; không che nút chơi. Lỗi cáo gần như nằm ngoài mép trái khi dùng tọa độ mobile -5.8 đã được sửa với tọa độ -3.7 và camera tính cả thể tích bệ/cáo.
- Ban đầu ba đảo có kích thước và chiều sâu tương đương. Mỗi lựa chọn đưa đúng đảo ra phía trước, làm đảo lớn hơn hai đảo sau; cáo đáp ở vị trí thấy rõ trên mặt đảo.
- Nút tổng quan nằm riêng khỏi các đảo. Ở 320 px, caption không còn bó thành nhiều dòng cạnh nút hoặc chồng lên chân cáo.
- Cả 12 trạng thái không tràn ngang, không có điều khiển ngoài viewport/bị lớp khác che, không có lỗi trang hoặc tài nguyên. Các nút chạm chính trên hai viewport nhỏ đều cao ít nhất 44 px.
- FPS trung vị từ renderer khoảng 59.9–60.2 trên máy Windows này; số draw call là 94 khi chờ và 88 khi chọn trên desktop, 49/46 trên hai viewport nhỏ. Điện thoại được mô phỏng trên cùng GPU desktop, chưa phải phép đo thiết bị thật.
- Mỗi hồ sơ viewport tải đúng hai GLB (Toán và cáo), không tải lại khi đổi đảo. Video `carousel-demo.webm` đã ghi lại chờ ở góc, chọn lần lượt ba đảo và quay về tổng quan; dung lượng 3,693,479 byte.

Kiểm thử `tests/visual/island-carousel.spec.ts` có 13 trường hợp. Ngoài tọa độ và trạng thái carousel, bốn trường hợp 1440×900, 768×1024, 390×844, 320×640 dùng renderer production để chiếu bounding box thật của mesh cáo có rig và bệ chờ qua camera. Chúng kiểm tra toàn bộ nhân vật/bệ nằm trong canvas lúc đầu và sau khi quay về tổng quan. Kiểm thử tổng quan còn xác nhận Enter đặt focus về nhóm “Tổng quan các đảo”. Kết quả thực thi cuối được ghi trong `browser-tests.txt`.

Chi tiết số liệu và ảnh: `capture-summary.md`, `carousel-browser-evidence.json`, `carousel-*.png`. Những ảnh này đã thay thế các capture có cáo ở giữa cảnh hoặc bị cắt mép trái.

Hai đảo Trí nhớ và Ngôn từ vẫn dùng mô hình tạm. Kiểm tra này xác nhận bố cục và tương tác; không thay thế nghiệm thu chất lượng asset premium.
