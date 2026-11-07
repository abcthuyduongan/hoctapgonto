# Cập nhật kiểm tra khi dự án có thêm SafeTime

Sau lượt kiểm tra bản 4.1.0-rc.1, dự án có thêm các commit kết nối SafeTime tới `bed43c2`. Vì vậy, kết quả và gói 4.1 trước đó không chứng nhận mã nguồn hiện tại. Ứng viên mới là **4.3.0-rc.1**, SQLite schema 2, PostgreSQL schema 9.

Đã tái hiện và sửa:

- Học sinh chưa đặt PIN vẫn truy cập quản lý kết nối: nay bắt buộc có PIN và xác thực đúng phiên.
- PIN của con A hoặc phụ huynh của A có thể tạo mã cho B: nay kiểm tra từng học sinh được phép.
- Trạng thái kết nối lộ mã ghép đôi và thiết bị của con khác: nay lọc theo phạm vi quản lý.
- Thu hồi thiết bị của con khác và bật/tắt toàn không gian: thu hồi phải đúng phạm vi; công tắc toàn không gian chỉ dành cho quản trị.
- Tắt kết nối chưa chặn thiết bị đã ghép; vé SSO chưa dùng vẫn dùng được sau thu hồi: nay kiểm tra trạng thái kết nối khi xác thực và đổi vé.
- PostgreSQL có thể tiêu thụ vé đồng thời: cập nhật vé có điều kiện, chỉ một yêu cầu thành công.
- Liên kết tới môn học khi đang ở Danh sách không chuyển sang bản đồ: đã sửa chuyển chế độ và kiểm tra trên trình duyệt.
- Manifest gói còn ghi schema cũ: cập nhật SQLite 2/PostgreSQL 9.

35 ca kết nối/phân quyền đạt tại `evidence/safetime-latest-confirmed.log`. Kiểm tra giao diện PIN, giới hạn học sinh, mã ghép đôi, tương phản, màn 390/1440 px và liên kết môn học đạt tại `evidence/browser-safetime-accepted.json`.

Lượt nghiệm thu toàn bộ bản mới nằm tại `evidence/verify-latest-final.log`, `evidence/browser-latest-final.json` và `evidence/verify-latest-final-result.json`. Chỉ kết luận hoàn tất khi tệp kết quả ghi exitCode 0 và source ID khớp mã hiện tại. Các tài liệu 01–05 mô tả đợt trước; những nhận định SafeTime còn là lớp rỗng đã lỗi thời, không dùng làm hiện trạng mới.

SafeTime hiện có mã triển khai ở cả hai dự án; chưa nghiệm thu phối hợp thực tế trên Windows trong đợt này. Cầu nối hiện là giao thức cục bộ; chưa chứng nhận kết nối tự động từ Netlify. Chưa cập nhật web hoặc dữ liệu thật.

Trước triển khai cloud cần thử migration 9 và khôi phục trên kho thử, lập phương án chuyển phiên bản máy chủ cùng cơ sở dữ liệu. Không coi việc quay lại deploy cũ là đủ để hoàn tác thay đổi schema.

Bộ 20 quà giữ nguyên ảnh, giá và mức 1 sao = 500 đồng, không hiển thị ngày tham khảo. Xem `../BO_QUA_BAO_AN_20_MON/DANH_MUC_QUA.html`.
