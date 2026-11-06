# Nội dung giao thực hiện sau kiểm toán lần 2

Đọc `01_TONG_QUAN_DANH_GIA.md`, các báo cáo 02–04, kế hoạch 05 và evidence trong cùng thư mục. Kiểm tra source ID hiện tại so với baseline `5d9b56a43e18706af1f541af5ef12477c679a8d2fa0c0b1e667f45f1b48261a8` trước khi sửa; giữ thay đổi của chủ dự án.

Ưu tiên N01 rò đáp án và N02 restore không nguyên tử, sau đó N03–N08 và E2E. Không chỉ vá để một reproduction hết lỗi; viết ca an toàn dương/âm cho mọi tuyến liên quan và cả hai backend. Không dùng “assert cũ fail” hoặc nhóm test con để tuyên bố hoàn tất.

Học liệu do chủ dự án/giáo viên đưa và duyệt. Giữ giao diện bản đồ nhẹ, không thêm engine nhân vật hay danh mục kỹ năng. Chỉ thực hiện tính năng ngoài kế hoạch khi chủ dự án yêu cầu.

Với mỗi công việc: ghi nguyên nhân/phương án/tệp ảnh hưởng, thay đổi mã và migration nếu có, chạy các ca R2xx, lưu log/actual/build/evidence, ghi phần còn chờ. Dùng dữ liệu thử/bản sao; không thử fault injection hoặc restore phá hủy trên production. Sửa chung policy/DTO khi thích hợp để SQLite và PostgreSQL không lệch.

Kết thúc: full Node + Chrome/Edge, lab cùng profile trước/sau, kiểm tra evidence tồn tại; staging/backup/rollback/người dùng/học liệu thật ghi trạng thái thực. Đề xuất phiên bản phát hành mới sau khi đóng cổng; không ghi đè artifact 4.0.1 cũ. Lưu nhật ký và kết quả thực hiện vào dự án.
