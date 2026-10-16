# Bảo An Learning V3.0 — Alpha 2.7.3 World Hub

## Mục tiêu
Làm lại trang chủ để gần với concept “thế giới game học tập”, tránh cảm giác banner giới thiệu + danh sách trò chơi.

## Thay đổi chính
- Ba game xuất hiện ngay trong khung nhìn đầu tiên.
- Thêm lại nhân vật cáo đồng hành ở màn hình đầu.
- Bảng tiến độ hành trình được đặt trong khung riêng, không lẫn vào phần giới thiệu.
- Nút hành động phụ (Nhiệm vụ hôm nay / Bộ sưu tập / Thành tích / Cửa hàng sao) nằm trong cùng một không gian thị giác.
- Giữ các nút, bộ chọn học liệu và hành động là DOM thật, không in sẵn vào ảnh nền.

## Những gì chưa chốt cuối
- Mỹ thuật vẫn chưa đạt mức concept 2.5D cao cấp ở phần cảnh nền tổng thể.
- Các game card hiện đã hòa vào phong cách world hub tốt hơn, nhưng vẫn cần tiếp tục nâng độ “premium”.
- Chưa chạy build Vite thật trong môi trường hiện tại.

## Kiểm tra đã thực hiện
- Syntax parsing của src/*.ts và src/*.tsx: đạt.
- 25/25 kiểm thử lõi bằng Node (sdk, seed, validation, reports, portal-home): đạt.
- Responsive được xử lý bằng CSS ở các mốc 1240px, 1024px, 760px, 420px.
