# Quản lý lớp và bộ câu hỏi trên máy

Chạy cục bộ bằng Node.js **22.22.2 trở lên**, SQLite; không cần Supabase hay Internet sau khi cài đặt. Máy chủ phải chạy trong lúc sử dụng. Đăng nhập cùng máy chủ từ trình duyệt khác vẫn thấy dữ liệu của tài khoản.

## Mở và khởi tạo

Trong mã nguồn: npm run build rồi npm run online, hoặc mở MO_QUAN_LY_WINDOWS.cmd. Trong ZIP: mở MO_BAO_AN.cmd hoặc MO_QUAN_LY.cmd, không cần npm install. Truy cập http://127.0.0.1:4180/?online=1 bằng Edge/Chrome.

Lần đầu lấy mã riêng từ .online/bootstrap-token.txt (mã nguồn) hoặc data/bootstrap-token.txt (ZIP), rồi tự đặt tài khoản quản lý. **Kho câu hỏi ban đầu rỗng**; giáo viên nhập và giao học liệu của mình. Học sinh chưa được giao bài thấy thông báo chờ; không tự lấy câu mẫu. Cập nhật giữ lại câu đã nhập.

## Soạn, giao và cập nhật

1. Tạo lớp/khối và tài khoản học sinh. Mật khẩu cấp mới chỉ hiện một lần; lưu và gửi riêng.
2. Vào **Học liệu tuần**, tải mẫu trắng Word .docx hoặc Excel .xlsx. Giáo viên tự đặt môn/chủ đề, tuần và đáp án.
3. Nếu có tư liệu, tải lên trước và điền đúng tên tệp, kèm mô tả hình hoặc bản chép lời. PNG/JPEG/WebP; MP3/WAV/OGG; tối đa 8 MB mỗi tệp ở bản cục bộ. Ảnh tối đa 20 triệu điểm ảnh, 8192 điểm mỗi chiều; âm thanh hơn 0 đến 600 giây và phải phát được. Tệp cùng tên khác nội dung cần đổi tên trước.
4. Chọn tài liệu tối đa 1 MB. Mỗi nhóm cùng nhãn môn/dạng có 2–30 câu, một tuần tối đa 30 nhóm. **Kiểm tra & xem trước**, mở và thử từng câu, rồi **Giao tuần học cho lớp**. Lỗi một câu không giao một phần tuần.
5. Mã bộ tuần tùy chọn gồm 3–48 chữ thường/số/dấu gạch nối; để trống để tạo từ tên tuần. Mã tự sinh của câu không đổi khi đảo dòng. Cùng nội dung nhập lại không tạo tuần hoặc sao trùng.
6. Muốn sửa, chọn **Cập nhật tuần này** trong hành trình. Giữ nguyên nhóm môn/dạng và mã nguồn, tăng một phiên bản; có phần đối chiếu bản cũ trước xác nhận. Phiên bản đã chơi giữ nguyên đáp án/tư liệu trong lịch sử, lượt mới dùng bản mới. Thêm/bớt nhóm thì tạo tuần mới; không sửa trực tiếp bản lịch sử.

Tám dạng: trắc nghiệm, nối cặp, xếp câu, nhập số, điền từ, đọc chọn đáp án, nghe chọn đáp án, nghe điền từ. Đây là dạng luyện tập phổ biến; không phải định dạng nộp đề chính thức Trạng Nguyên, IOE hay Violympic.

## Học và đổi sao

Học sinh đăng nhập tài khoản được cấp; ứng dụng lấy bộ chưa đạt và mở các trò phù hợp, không yêu cầu chọn môn cố định. Đạt ít nhất 2 sao mọi bộ tuần để mở tuần sau. Một bộ nguồn tối đa 3 sao mỗi học sinh giữa các trò/phiên bản. Gửi lại đáp án sau mất mạng không cộng lặp. Sao đã đổi không khóa tuần đã đạt.

Quản lý bật đổi sao và đặt tỷ lệ. Gửi ước muốn giữ chỗ sao ngay; hủy/từ chối trả lại sao khả dụng. Yêu cầu giữ tỷ lệ lúc gửi. Chỉ xác nhận **Đã trao** sau khi trao tiền/quà thực tế; ứng dụng không chuyển tiền.

## Sao lưu và khôi phục

Kho mã nguồn: .online/bao-an.sqlite; ZIP: data/bao-an.sqlite. Hình/âm thanh nằm trong cùng cơ sở dữ liệu. Không xóa thư mục này khi cập nhật.

- Giao diện **Sao lưu & khôi phục → Tải bản sao lưu**; hoặc npm run online:backup trong mã nguồn / SAO_LUU_QUAN_LY.cmd trong ZIP. Bản sao nhất quán cả khi máy chủ đang chạy.
- Khôi phục qua giao diện: chọn tệp SQLite tối đa 32 MB, kiểm tra số lớp/học sinh/câu hỏi/lượt/sổ sao và hash; đánh dấu đồng ý rồi xác nhận. Tự tạo bản dự phòng trước khi thay; từ chối tệp hỏng/sai kho/sai schema. Phiên cũ hết hiệu lực, lượt đang dở kết thúc; đăng nhập lại bằng tài khoản trong bản sao.
- Đổi máy/thư mục sạch hoặc bản sao lớn hơn 32 MB (tối đa 512 MB): dừng máy chủ, chạy CLI xem trước, kiểm tra số liệu rồi xác nhận bằng đúng hash. Không thay/xóa tệp WAL/SHM bằng tay.

Trong ZIP đã giải nén:

~~~powershell
node restore-online.mjs --file "D:\Ban-sao\bao-an.sqlite" --data-dir "data"
node restore-online.mjs --file "D:\Ban-sao\bao-an.sqlite" --data-dir "data" --confirm "SHA256_DA_XEM"
~~~

Trong mã nguồn thay node restore-online.mjs bằng node --experimental-strip-types server/restore-online.mjs và data-dir thành .online. Lần chạy không có --confirm chỉ kiểm tra, không tạo/thay dữ liệu đích.

Bản khôi phục chỉ có lịch sử tới thời điểm sao lưu; đối chiếu trao quà thực tế sau mốc đó trước khi xử lý tiếp. Cất bản sao riêng vì chứa tài khoản và học liệu.

## Cập nhật và hồ sơ cũ

Hoàn tất lượt chơi, tải sao lưu rồi dừng máy chủ. Giải nén gói mới và giữ/chuyển nguyên thư mục data trước khi mở lại. Không mở hai máy chủ cùng kho. Manifest tách SQLite 1, PostgreSQL 1; không chạy bản cũ lên schema mới để hạ cấp. Khi cần quay về phải dùng gói và bản sao dữ liệu tương thích.

Giao diện cũ đã được gỡ. Các đường dẫn cũ mở giao diện tài khoản mới; ứng dụng không đọc, ghi hoặc xóa kho trình duyệt trước đây.

Netlify/Supabase để triển khai sau. Bản cục bộ không tự gửi hoặc đồng bộ dữ liệu lên mạng.
