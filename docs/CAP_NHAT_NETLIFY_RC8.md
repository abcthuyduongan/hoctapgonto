# Cập nhật RC8 qua GitHub

RC8 gồm hành trình tóm tắt/phân trang, một presentation khi mở bài, chia màn ghép cặp, giải thích/giới hạn trò từng câu, sao riêng từng câu dùng chung mọi game, xác nhận chuyển tuần sau khi mọi câu đạt 2 sao và khóa tuần đã qua, học sinh đổi mật khẩu và sửa chọn giọng đọc Việt. Giữ API cũ và schema SQLite/PostgreSQL 1, không cần migration.

Trước cập nhật, tải bản sao lưu trong trang quản trị. Bản sao sinh sau khi chơi RC8 chứa luật sao mới; dùng RC8 để khôi phục bản sao đó.

Chạy PowerShell trong dự án sau khi xem lại thay đổi:

Các lệnh dưới đẩy nhánh đang làm `feature/v37-premium-world`. Đối chiếu mục **Production branch** trong Netlify; nếu website chính dùng nhánh khác, cần hợp nhất thay đổi vào đúng nhánh đó để website chính được cập nhật.

```powershell
cd 'D:\Phần mềm 2026\BAO_AN_LEARNING_lam lại'
git add package.json package-lock.json README.md src server tests docs
git add public/question-templates/online-week.docx public/question-templates/online-week.xlsx public/question-templates/bo-mau-day-du.xlsx public/question-templates/bo-mau-day-du.zip
git add tools/create_online_full_sample.mjs tools/online-template-build/build.mjs tools/online-template-build/create-docx.py tools/package_release.mjs tools/release-files/HUONG_DAN_SU_DUNG.html
git commit -m "Add per-question stars, confirmed weekly progression and bounded student loading"
git push origin feature/v37-premium-world
```

Netlify cần triển khai UI và Function cùng commit: build `npm run build`, publish `dist`, Functions `netlify/functions`, đúng nhánh đã liên kết. Sau Published tải lại trang và làm phiếu nghiệm thu RC8. Dữ liệu riêng, `.env`, `.online`, `outputs` và thư mục mẫu người dùng giải nén không nằm trong các lệnh thêm trên.

Phiên làm việc này chỉ chuẩn bị mã/gói cục bộ; chưa commit, push hoặc xác nhận production.

Trước khi dùng luật sao mới: sao ví cũ giữ nguyên, không tự gán thành tích câu. Mỗi 140 câu có tối đa 420 sao; đối chiếu ngân sách đổi quà và nghe thử mốc thời gian/giọng Việt trên thiết bị thật. Tránh sửa/thêm câu vào tuần học sinh đã chuyển qua: tuần cũ vẫn đóng, con trỏ không tự lùi. Xem kế hoạch [sao và khóa tuần](KE_HOACH_SAO_TUNG_CAU_VA_KHOA_TUAN_2026-10-17.md).
