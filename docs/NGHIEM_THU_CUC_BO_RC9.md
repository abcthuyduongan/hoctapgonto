# Phiếu nghiệm thu · 3.8.0-rc.9

Chưa có xác nhận dùng thử của giáo viên/học sinh trên website thật. Ghi người thử, ngày, thiết bị, trình duyệt và build ID/SHA-256 của bản đang dùng.

- [ ] Nhập tài liệu + ảnh/âm thanh một lần; chỉ câu hợp lệ được giao, chỉ rõ lỗi từng câu.
- [ ] Bảng phù hợp trò chỉ rõ từng câu; câu 2 chỉ giới hạn hai game thì cả bộ mở hai game chung. Mẫu Excel có cột allowedGameIds tùy chọn; không tự bỏ câu.
- [ ] Trang học sinh tải danh sách tóm tắt, mỗi lần tối đa 20 bộ; Xem thêm không tải nội dung mọi tuần. Chọn trò để ôn mới mở danh sách trò; chuyển trang thay danh sách cũ.
- [ ] Mỗi câu có sao riêng dùng chung mọi game. Tuần 2 khóa khi một câu tuần 1 chưa đạt 2 sao; đủ yêu cầu thì báo số câu 2/3 sao và chọn ôn hoặc xác nhận sang tuần. Sang tuần 2 không quay lại tuần 1, kể cả request đang chờ/thiết bị khác.
- [ ] Trí Nhớ/Nối Từ 13 cặp chia 5+4+4 trên máy tính, điện thoại tối đa 4 cặp/màn. Đổi kích thước không xáo lại màn; ghép đúng lưu sao từng câu ngay; chuyển màn/hoàn tất không cộng thêm.
- [ ] Câu dài, ảnh, đọc/nghe/điền và thẻ ở 360×740, 390×844, 766×471, 768×600, 1219×615, 1440×1000 không tràn ngang/cắt chữ; cuộn xem đầy đủ và bấm được.
- [ ] Chỉ một âm thanh câu hỏi phát; sang màn/thoát dừng âm thanh và lời đọc. Thử 20 lần vào/thoát, không tạo thêm canvas/context.
- [ ] Nghe đọc tiếng Việt bằng giọng Việt trên thiết bị thật. Thiếu giọng Việt báo rõ; không đọc bằng tiếng Anh. Thử lần mở đầu khi danh sách giọng còn tải.
- [ ] Đổi mật khẩu sai hiện tại giữ phiên và báo tại form; đúng thì mọi thiết bị đăng nhập lại, mật khẩu cũ thất bại, tiến độ/sao không đổi.
- [ ] Mạng chậm, ảnh/cảnh/chunk lỗi vẫn có thử lại/thoát; đáp án gửi lại không ghi trùng; mỗi câu tối đa 3 sao qua game/phiên bản: 1 lên 3 chỉ thêm 2, replay 3 thêm 0.
- [ ] Sau Netlify Published, ghi thời gian vào trang/bài/gửi đáp án, điều kiện mạng và so với bản trước. Số đo fixture không dùng để cam kết tốc độ thực tế.

- [ ] Thời gian riêng cho đọc/nghe/nhập; câu nghe tính sau khi nghe hết, trả lời sai được sửa. Mạng chậm ảnh hưởng thời gian cần đo thật.
- [ ] Sao cũ/số dư giữ nguyên, không tự gán sao từng câu. Kiểm tra ngân sách đổi quà: 140 câu tối đa 420 sao, tỷ lệ hiện tại giữ nguyên.

Kết quả thực tế/lỗi còn lại: …

- [ ] Giao tuần mới 3 hoặc 4 môn, tối đa 12 câu/môn tính chung các bộ; bản xem trước báo số câu/độ khó/tổng sao. Tuần cũ giữ cấu hình cũ.
- [ ] Thử ô bắt buộc null/NULL, ô tùy chọn null, số 0, false và lỗi #NULL!: báo đúng dòng/cột, chỉ giao câu hợp lệ.
- [ ] Bộ mẫu Excel 36 câu có 12 câu mỗi môn, gợi ý 4 nền tảng/5 vận dụng/3 nâng cao; giáo viên kiểm lại đáp án và độ vừa sức.
- [ ] Danh sách quản trị/thư viện 20 mục/trang; file ảnh/âm thanh ngoài trang thư viện vẫn ghép đúng khi tham chiếu tên.
- [ ] Tuần đã có học sinh xác nhận sang tuần sau: đổi nội dung bị chặn, sửa lời giải giữ sao; bản sao lưu/khôi phục giữ cấu hình môn.
- [ ] Tiếp tục các câu chưa đạt 2 sao mở đúng câu cần học, cặp đối chiếu không tạo thêm sao trùng.
- [ ] UI và Netlify Function cùng commit RC9; khôi phục PostgreSQL + Storage trên môi trường riêng. Dùng RC9 để khôi phục dữ liệu RC9, không hạ bản.
