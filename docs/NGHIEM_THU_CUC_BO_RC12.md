# Nghiệm thu RC12: giao diện nhẹ và tốc độ

RC12 là ứng viên cục bộ. Giữ các yêu cầu sao, khóa tuần, nội dung, riêng tư và phục hồi của RC10/RC11. Tham chiếu [kế hoạch tối ưu](KE_HOACH_TOI_UU_TOC_DO_VA_GIU_3D_2026-10-18.md).

1. Mở trang bằng cửa sổ mới: đăng nhập không tải quản trị, importer hoặc 3D. Học sinh mặc định thấy Chế độ nhẹ; chơi được mọi trò phù hợp bộ được giao.
2. Chủ động mở Khám phá 3D. Cảnh chỉ tải nhân vật/nền và đảo đang chọn; trở về Chế độ nhẹ hoặc vào trò thì canvas/context được dọn. Thử đổi chế độ 20 lần và đổi tab khi đang tải.
3. Chơi trọn 30 lượt qua năm trò. Kiểm tra cuộn, chọn đáp án và thẻ, hình dài/ngang, chữ dài, zoom 125–150%. Ghi FPS/frame-time, heap và thiết bị; test headless không chứng minh máy RAM 4/8 GB đã đạt.
4. Nhập Excel và âm thanh/hình cùng một lượt. Bấm xem trước, dừng và thử lại; file không được câu hợp lệ tham chiếu không cần tải. Duyệt các trang câu hỏi, loại đúng lỗi/null và nạp được phần hợp lệ đáp ứng cấu hình tuần.
5. File 140 câu của tác giả có lỗi Excel F122 và vượt quy định tuần mới. Kiểm preview, vị trí lỗi và tốc độ; không tự sửa/cắt file hoặc giao toàn bộ 139 câu như một tuần mới. Thử mẫu ZIP 36 câu để giao đủ tám dạng.
6. Mất mạng, chậm ACK, tải ảnh lỗi, audio hỏng, đổi mật khẩu và khóa tài khoản. Đồng hồ chờ ảnh/audio đúng quy tắc; retry không nhân sao. Tất cả câu đạt 2 sao, xác nhận chuyển tuần rồi tuần cũ mới khóa.
7. Đo Netlify/Supabase trên môi trường staging riêng: ít nhất 50 mẫu ấm/luồng và 10 lần tải đầu; đối chiếu API/DB/Storage và thử tải 30 rồi 100 học sinh giả. Không dùng website học sinh thật để stress test.
8. Thử hỗn hợp đủ 60 phút và phục hồi PostgreSQL + Storage vào môi trường cách ly. Người phụ trách ghi cấu hình, ngày, build, kết quả và RPO/RTO.

Người dùng xác nhận ngày 18/10/2026 chưa có staging riêng. Các cổng cloud, tải đồng thời, ngâm đủ 60 phút và nghiệm thu giáo viên/học sinh chưa được thay bằng test fixture. Manifest tiếp tục `releaseReady:false`, `humanPilotStatus:UNVERIFIED`. Chỉ đổi trạng thái sau khi có chứng cứ đạt; rollback ứng dụng phải tương thích dữ liệu, không reset ví hoặc restore DB cũ như thao tác thường lệ.
