# Phiếu nghiệm thu · 3.8.0-rc.10

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
- [ ] UI và Netlify Function cùng commit RC10; khôi phục PostgreSQL + Storage trên môi trường riêng. Dùng RC10 để khôi phục dữ liệu RC10, không hạ bản.

## Bổ sung bắt buộc RC10

- Mở câu lần lượt; đáp án, lời giải và bản chép lời chưa có trước khi trả lời đúng. Gợi ý có biên nhận máy chủ.
- Bài nghe phải được tải trong đúng lượt/câu và đủ thời lượng máy chủ xác minh trước khi mở câu. Thử thiếu tệp, tua nhanh, mất mạng và tải lại. Không coi biên nhận là bằng chứng trẻ thực sự nghe.
- Cập nhật cùng ID nhưng đổi nội dung chấm phải bị chặn; câu mới dùng ID mới, bắt đầu chưa đạt sao. Sửa lời giải giữ sao; ví và lịch sử cũ không mất.
- Nhập tên file dài ở 320/360/390px và font lớn; không tràn ngang, vẫn xem được lý do loại câu.
- UI và Function cùng phiên bản; tab cũ hoặc Function cũ phải có hướng dẫn tải lại.
- Kiểm tra mã hỗ trợ khi lỗi máy chủ, nhật ký không chứa mật khẩu/token/dữ liệu học sinh; cấu hình cảnh báo tại nhà cung cấp trước phát hành rộng.
- WAV có chữ ký đúng nhưng nội dung hỏng bị từ chối trước lưu; cùng đợt có tệp tốt vẫn giao được các câu hợp lệ. Lỗi máy chủ không sinh đợt tải lại từng tệp.
- Bấm gợi ý Xếp Câu/Bậc Thang được máy chủ ghi nhận và giảm sao; lỗi/chờ gợi ý không cho gửi đáp án để né phạt.
- Chọn quá 100 tư liệu hoặc tổng 32 MB được chặn trước đọc/tải; lựa chọn trước không mất. Không giữ base64 của mọi tệp cùng lúc.
- Nâng cấp nhiều bản chỉ giữ cache build hiện tại và hai bản trước; tab quá cũ có nút tải lại. Dữ liệu tài khoản không bị dọn cùng cache.

Các kết quả tự động được ghi trong báo cáo bàn giao. Các mục máy thật, UAT, cloud/khôi phục và ký duyệt vẫn chưa đánh dấu đạt chỉ từ kiểm thử cục bộ.
