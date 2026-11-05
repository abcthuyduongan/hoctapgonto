# Kiểm thử hiện hành

`npm test` chạy syntax, release/build identity, học liệu, auth/API/SQLite/khôi phục, media, sao/ví, PostgreSQL fixture và cloud adapter local.

`npm run test:online:browser` chạy các tệp `online*.spec.ts` trên Chrome và Edge, gồm năm game/tám dạng câu, ảnh/audio, tải lỗi/chậm, retry, sao, đổi thưởng, cập nhật và phục hồi.

`npm run test:assets` kiểm tra artifact web không có 3D/tệp riêng và không vượt ngân sách dung lượng. `npm run verify:local` chạy toàn bộ các cổng hiện hành theo đúng thứ tự build trước khi kiểm tra artifact.

Các test và helper chỉ dành cho 3D, IndexedDB/ứng dụng cũ hoặc import module đã được gỡ đã được dọn theo yêu cầu chủ dự án. Không tắt các kiểm tra nghiệp vụ hiện hành để làm bộ test đạt. Kiểm thử cần tệp gốc của người dùng vẫn ghi rõ skip nếu chưa có đầu vào, không tính là PASS.
