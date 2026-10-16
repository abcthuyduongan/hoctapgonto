# Hoàn thiện Bảo An Learning · kế hoạch hiện hành

Ngày 16/10/2026. Theo yêu cầu cập nhật của chủ dự án: chỉ giữ giao diện quản lý lớp và học sinh mới; gỡ giao diện App/IndexedDB, trang soạn, mini-app, mẫu và công cụ cũ không còn dùng. Giữ dữ liệu máy chủ và các thành phần đang phục vụ năm game/đồ họa dự phòng.

| Mốc | Nội dung | Trạng thái |
|---|---|---|
| M1 | Một luồng tài khoản, phân vai, bỏ giao diện cũ; URL cũ mở luồng mới | Đã thực hiện và kiểm thử rc.2 |
| M2 | Word/Excel trắng, tám dạng, tư liệu, duyệt/thử mọi câu, mã ổn định và cập nhật phiên bản | Đã thực hiện |
| M3 | Sao/tuần/đổi thưởng trên máy chủ, sao lưu và phục hồi thật vào thư mục sạch | Đã thực hiện |
| M4 | Bộ kiểm thử cho luồng hiện hành, CI Windows/Chrome/Edge, ZIP độc lập, bản cài rỗng | 190 kiểm thử và 18/18 ca Chrome/Edge đạt; CI đã cấu hình, chờ workflow GitHub |
| M5 | Giáo viên/học sinh dùng nội dung thật và xác nhận trên Windows Edge/Chrome | Chưa có xác nhận |
| M6 | Netlify/Supabase thật, chuyển dữ liệu, nhiều thiết bị, phục hồi PostgreSQL+Storage | Để triển khai sau theo yêu cầu |

Bản cài mới có kho câu hỏi rỗng; giáo viên tự đặt môn, soạn và giao bộ câu theo tuần. Học sinh chưa có bài chờ giáo viên; không tự nạp câu mẫu. Cập nhật ứng dụng giữ học liệu đã nhập.

Không mở trò mới, không tự xây chương trình thay giáo viên, không chuyển tiền tự động và không nhận là mẫu nộp đề chính thức của Trạng Nguyên/IOE/Violympic. Điện thoại thật chưa nằm trong phạm vi nghiệm thu đầu tiên.

Điều kiện phát hành: kiểm thử hiện hành và phục hồi đạt trên đúng gói, không lỗi nghiêm trọng còn mở; có xác nhận thực tế của người soạn và học sinh. Manifest giữ releaseReady:false/humanPilotStatus:UNVERIFIED tới khi có xác nhận. CI đã cấu hình nhưng chưa chạy workflow GitHub trong phiên này.

Tài liệu: QUAN_LY_CUC_BO.md, ONLINE_QUESTION_IMPORT.md, NGHIEM_THU_CUC_BO_RC2.md, NETLIFY_SUPABASE.md. Nhật ký dọn và báo cáo kỹ thuật trong V38_qa.
