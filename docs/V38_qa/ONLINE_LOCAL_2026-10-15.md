# Quản lý cục bộ và bộ câu hỏi tuần — 2026-10-15

## Kết quả bàn giao

- Bản `3.8.0-pilot.3`, build `de1bd3a0fb73a1cf`, 143 tài nguyên.
- ZIP: `releases/bao-an-learning-3.8.0-pilot.3.zip`. Có máy chủ quản lý gói một tệp, nút mở và sao lưu Windows; không cần npm khi chạy từ ZIP, cần Node.js 22.22.2 trở lên.
- Máy chủ trên máy đã phản hồi HTTP 200 ở `http://127.0.0.1:4180/?online=1`; chưa tạo quản lý/học sinh hay nạp chương trình mẫu. Khởi tạo bằng mã trong `.online/bootstrap-token.txt`.
- Dữ liệu cục bộ: `.online/bao-an.sqlite`; bản ZIP dùng `data/bao-an.sqlite`. Tư liệu cũng nằm trong SQLite; không tải lên dịch vụ ngoài.

## Chức năng

Quản lý lớp, tài khoản, khóa/đặt lại mật khẩu; nhập Word/Excel theo tuần với tên môn tự do; 8 dạng câu và hình/âm thanh; xem trước rồi giao cho lớp; mở trò theo dạng câu. Hai sao ở mọi bộ mở tuần tiếp; mỗi bộ gốc tối đa ba sao. Sổ sao, giữ chỗ đổi thưởng, duyệt/từ chối/xác nhận đã trao và lịch sử đều lưu ở máy chủ.

Mẫu Word/Excel trắng, không tự tạo câu mẫu hay khẳng định tương thích định dạng nộp đề chính thức của các sân chơi. QA Word đã xem 9 trang, Excel đã xem cả 3 sheet; chứng cứ ở `test-results/online-template-qa/`.

## Kiểm thử

- `npm run build`, `npm run typecheck`, `npm run test:syntax`: đạt.
- Hồi quy trước đóng gói: `npm test`, 306 kiểm thử đạt; sau bổ sung cơ chế xuất gói dự phòng, `npm run test:release` 9/9 đạt.
- `npm run test:online`: 52/52 đạt, gồm parser, chấm bài, HTTP thật, phiên bị thu hồi trong khi gửi chậm và gói ZIP giải nén chạy độc lập, khởi động lại, sao lưu SQLite thật.
- `npm run test:online:browser`: Chrome 2/2 đạt. Đã thử nhập tài liệu, ảnh/âm thanh, trả lời thật, mất mạng rồi gửi lại không trùng, sao, đổi thưởng, tài khoản ở trình duyệt khác, 320/390px. Worker cũ được bỏ và bộ nhớ riêng được dọn trước khi gọi API; cache ngoài ứng dụng được giữ.
- Edge: 30/32 ca của bốn nhóm gameplay/journey/reward/mobile đạt lần đầu; hai ca Ghép Câu/Quy Luật phát hiện key React trùng khi chuyển câu. Đã sửa key tư liệu riêng và chạy lại cả hai ca, 2/2 đạt. Không đổi kiểm thử để bỏ qua lỗi.
- PostgreSQL/cloud API/config: 13/13 đạt qua PGlite và Request/Response thật; Supabase SDK Storage: 5/5 đạt với fetch giả lập. Chưa có kết nối hay triển khai Supabase/Netlify thật, theo yêu cầu cấu hình sau của người dùng.
- ZIP cuối được đọc lại, đối chiếu toàn bộ hash và manifest bằng lần `npm run package:pilot` thứ hai, `reused:true`.

Log chính trong `test-results/final-*.log`, ảnh và báo cáo Chrome ở `test-results/online-browser-output` và `online-browser-report.json`.

## Giới hạn rõ ràng

Chế độ tài khoản ở 4180 cần máy chủ cục bộ chạy, hoạt động không cần Internet; không phải mở trực tiếp bằng file://. Chế độ hồ sơ trình duyệt 4173 vẫn độc lập, chưa tự chuyển dữ liệu. Netlify/Supabase có mã và hướng dẫn cấu hình riêng trong `docs/NETLIFY_SUPABASE.md`, chưa triển khai. Chưa có công cụ chuyển toàn bộ SQLite lên Supabase. Đây là bản pilot đã kiểm thử tự động, vẫn cần người dùng thử học liệu thực tế và xác nhận trải nghiệm.
