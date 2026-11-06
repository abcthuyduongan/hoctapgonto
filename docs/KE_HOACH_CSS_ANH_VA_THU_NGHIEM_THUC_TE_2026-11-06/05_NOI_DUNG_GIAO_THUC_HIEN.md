# Nội dung giao cho người hoặc AI thực hiện

Thực hiện hai mục P2 của Bảo An Learning: (1) tách CSS game và tối ưu ảnh map/mobile; (2) chuẩn bị/chạy staging 100 phiên và usability thật. Đọc toàn bộ 00–04, baseline và matrix trong thư mục này trước khi sửa.

Mã lập kế hoạch: 4.0.2, source `b5f1c02e0b35b7ea54ce5bc70e2707538d8aafef46c95d7b2513ec8ee8ae697a`. Nếu mã đã đổi, xác minh lại baseline và giữ thay đổi của người khác. Không coi số đo kiểm toán trước là số đo của bản mới.

Thứ tự:

1. Chốt G0, fixture, định nghĩa game-ready/cold-warm, budget và đo trước.
2. Tách shared/per-game CSS thật; Vite đã cssCodeSplit nên chỉ bật lại cờ không giải quyết được. Giữ lazy loader/retry, không import eager toàn bộ.
3. Responsive variants/manifest/resolver cho map và nền game, giữ tọa độ và ảnh nguồn; tính tổng artifact và QA hình ảnh.
4. Đo ít nhất 30 lượt G1/G1W mỗi game ở profile chính; không dùng skeleton hay bỏ media bắt buộc làm ready. Hoàn thành PERF và RC hồi quy.
5. Nâng cấp load runner: login/cookie/CSRF/presentation/attempt thật, body timing, HTTP+nghiệp vụ error và đối soát. Chưa đúng runner thì chưa ký 100.
6. Staging riêng, seed dữ liệu thử, telemetry và giới hạn; chạy S0→S6, cold/first-in-instance được ghi đúng nguồn. Lưu raw data, không lấy PGlite/mock thay hạ tầng.
7. Chủ dự án bố trí người tham gia, thiết bị và xác nhận tham gia; chuẩn bị tài khoản thử/collector/biểu mẫu. Không tự tạo phỏng vấn/ngày dùng thật hoặc liên hệ người khác thay chủ dự án khi chưa được yêu cầu.
8. Usability vòng 1, sửa/rồi hồi quy, vòng 2; không ép trẻ thao tác/ghi hình, không đưa thông tin nhận dạng vào repo.
9. Bàn giao kết quả 48 ca, trước/sau, build/source, logs/ảnh đã lọc, giới hạn, rollback và nhật ký công việc trong dự án.

Giữ chấm/sao/clock/nghe/gợi ý/tuần đóng/quyền/phiên không đổi. Media học liệu do chủ dự án đưa có ID/hash bất biến; không ghi đè để lấy tốc độ. Không thêm engine đồ họa, danh mục kỹ năng hay bộ câu tự ký duyệt. Tối ưu phải làm được với UI DOM và tranh hiện có.

Mục tiêu G1 p95≤1.500 ms là điều kiện đo cụ thể; không hứa mọi media 2 MB hay mọi function cold đều dưới 1,5 giây. Mọi phần không chạy được ghi BLOCKED/CHUA_KIEM_CHUNG với nguyên nhân và cách kiểm chứng, tiếp tục việc độc lập còn làm được. Không đổi threshold/skip/xóa assert để có PASS.
