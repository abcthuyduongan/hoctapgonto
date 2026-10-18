# Nghiệm thu RC11: đăng nhập, mở tuần và vào trò chơi

RC11 giữ các tiêu chí nội dung, hình/âm thanh, sao, khóa tuần và phục hồi trong [phiếu RC10](NGHIEM_THU_CUC_BO_RC10.md). Phần bổ sung tập trung độ trễ. Không ghi lại mật khẩu, cookie hoặc dữ liệu học sinh vào biên bản đo.

1. Đăng nhập quản lý và học sinh; ghi thời gian từ bấm Đăng nhập tới khi hiện dữ liệu. Thử lần đầu sau một thời gian không sử dụng và ba lần tiếp theo.
2. Học sinh mở tuần hiện tại, vào một trò chơi, trả lời và sang câu kế tiếp; kiểm tra sao vẫn được máy chủ xác nhận. Thử khi hình/cảnh 3D tải chậm.
3. Chuyển cửa sổ rồi quay lại, kiểm tra tiến độ được làm mới; tạo học sinh hoặc sửa dữ liệu trong lúc đang làm mới không được hiện lại dữ liệu cũ.
4. Đăng xuất/khóa tài khoản khi đang mở bài; phiên cũ không được ghi đáp án. Tuần chưa mở và tuần đã đóng vẫn không chơi được.
5. Thử mất mạng và kết nối lại. Gửi lại cùng đáp án không cộng sao lần hai. Ghi thời gian, trình duyệt, mạng và mã hỗ trợ nếu có.

Các phép đo tự động cục bộ và phép đọc công khai được ghi trong báo cáo RC11 của mã nguồn. Đo mạng giả lập không thay thế kiểm tra tài khoản thật trên Netlify/Supabase. Chưa có nghiệm thu giáo viên/học sinh thì manifest giữ `releaseReady:false` và `humanPilotStatus:UNVERIFIED`.
