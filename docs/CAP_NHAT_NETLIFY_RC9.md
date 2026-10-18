# Cập nhật RC9 qua GitHub

RC9 bổ sung tuần mới 3–4 môn, tối đa 12 câu/môn, difficulty, null/ô lỗi Excel, mẫu Excel 36 câu, bảo vệ sửa tuần đã đóng và tải quản trị 20 mục/trang; giữ hành trình tóm tắt/phân trang, một presentation khi mở bài, chia màn ghép cặp, giải thích/giới hạn trò từng câu, sao riêng từng câu dùng chung mọi game, xác nhận chuyển tuần sau khi mọi câu đạt 2 sao và khóa tuần đã qua, học sinh đổi mật khẩu và sửa chọn giọng đọc Việt. Giữ API cũ và schema SQLite/PostgreSQL 1, cấu hình tuần được lưu có phiên bản trong JSON audit week.policy, không đổi bảng SQL. Tuần không có marker giữ cấu hình cũ. Sao lưu RC9 phải khôi phục bằng RC9; không hạ bản.

Trước cập nhật, tải bản sao lưu trong trang quản trị. Bản sao sinh sau khi chơi RC9 chứa luật sao mới; dùng RC9 để khôi phục bản sao đó.

Chạy PowerShell trong dự án sau khi xem lại thay đổi:

Các lệnh dưới đẩy nhánh đang làm `feature/v37-premium-world`. Đối chiếu mục **Production branch** trong Netlify; nếu website chính dùng nhánh khác, cần hợp nhất thay đổi vào đúng nhánh đó để website chính được cập nhật.

```powershell
cd 'D:\Phần mềm 2026\BAO_AN_LEARNING_lam lại'
git add package.json package-lock.json README.md src server tests docs
git add public/question-templates/online-week.xlsx public/question-templates/bo-mau-day-du.xlsx public/question-templates/bo-mau-day-du.zip
git add tools/create_online_full_sample.mjs tools/online-template-build/build.mjs tools/package_release.mjs tools/release-files/HUONG_DAN_SU_DUNG.html
git add tools/benchmark_weekly_load.mjs
git add public/question-templates/online-week.docx tools/online-template-build/create-docx.py
git commit -m "Enforce weekly subject limits, validate null Excel input and reduce admin payloads"
git push origin feature/v37-premium-world
```

Các tệp Word có sẵn được giữ để tương thích dữ liệu/kiểm thử cũ; không tạo mẫu Word mới và giao diện chỉ cung cấp mẫu Excel.

Netlify cần triển khai UI và Function cùng commit: build `npm run build`, publish `dist`, Functions `netlify/functions`, đúng nhánh đã liên kết. Sau Published tải lại trang và làm phiếu nghiệm thu RC9. Dữ liệu riêng, `.env`, `.online`, `outputs` và thư mục mẫu người dùng giải nén không nằm trong các lệnh thêm trên.

Phiên làm việc này chỉ chuẩn bị mã/gói cục bộ; chưa commit, push hoặc xác nhận production.

Trước khi dùng luật sao mới: sao ví cũ giữ nguyên, không tự gán thành tích câu. Tuần mới 3 môn/36 câu tối đa 108 sao, 4 môn/48 câu tối đa 144 sao; đối chiếu ngân sách đổi quà và nghe thử mốc thời gian/giọng Việt trên thiết bị thật. Máy chủ chặn đổi nội dung câu trong tuần đã có học sinh chuyển qua: tuần cũ vẫn đóng, con trỏ không tự lùi. Xem kế hoạch [sao và khóa tuần](KE_HOACH_SAO_TUNG_CAU_VA_KHOA_TUAN_2026-10-17.md).

Kiểm tra công khai trước triển khai 2026-10-17: trang chủ HTTP 200, API status HTTP 200, build đang online `2bb9c2c7dbb008a8`. Đây chưa phải build RC9 cục bộ. Chưa có bằng chứng Production branch hoặc cùng commit UI/Function; đối chiếu trong Netlify trước khi đẩy nhánh. Kiểm tra chỉ đọc chưa tái hiện luồng đăng nhập/tải học liệu thật.

Gói RC9 cục bộ đã kiểm: build `19fa3bb921d42cad`, SHA-256 `e29512b4d35713310440bbe74f4ed8e185a7720950adcbd432d0ce442deb4c3d`. Sau triển khai, tải lại /sw.js để đối chiếu build của website; build online cũ ở trên không phải dấu hiệu bản sửa đã được xuất bản.
