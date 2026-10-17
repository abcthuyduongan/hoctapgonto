# Cập nhật Netlify qua GitHub · RC6

Kho: `abcthuyduongan/hoctapgonto`; nhánh đã đối chiếu `feature/v37-premium-world`; commit gốc `e6c51ebb36fd4f07f40f43c23c34f7698b8619e3`. Kiểm tra nhánh Netlify đang liên kết trước khi đẩy mã.

Bản sửa gồm nhập chung câu hỏi/hình/âm thanh, danh sách tuần, báo và loại từng câu lỗi, bộ mẫu đầy đủ, xem trước nhẹ và endpoint cloud `/api/online/media/batch`. Cần triển khai cả giao diện lẫn Function, giữ nguyên biến môi trường và database. Không có migration.

1. Đối chiếu `git diff` và báo cáo rà soát. Gói `bao-an-learning-rc6-cap-nhat-github.zip` chứa đường dẫn nguồn tương đối cùng manifest hash; giải nén vào gốc bản sao repo nếu cần. Gói không có `.env`, `.git`, cơ sở dữ liệu hoặc tệp riêng của người dùng.
2. Commit và đẩy lên đúng nhánh liên kết:

```powershell
git add README.md package.json package-lock.json src server tests docs public/question-templates tools/package_release.mjs tools/serve_release.mjs tools/release-files/HUONG_DAN_SU_DUNG.html tools/create_online_full_sample.mjs tools/create_online_sample_audio.ps1
git commit -m "Import valid questions with combined media and weekly selection"
git push origin feature/v37-premium-world
```

3. Netlify giữ build `npm run build`, publish `dist`, Functions `netlify/functions`. Đợi deploy thành công và tải lại website. Không đưa riêng ZIP cục bộ lên static hosting để thay cho Function.
4. Đăng nhập, tải **Bộ mẫu đầy đủ (.zip)**, giải nén và chọn Excel + tư liệu cùng lúc; chọn tuần, kiểm tra đủ 16 câu/tám dạng, rồi giao nếu muốn. Chọn một tài liệu có lỗi để xác nhận chỉ các câu hợp lệ được giao.

File gốc 140 câu của người dùng được kiểm tra nguyên trạng: **84 câu hợp lệ trong 12 bộ, 56 câu bị loại** với vị trí và lý do; ví dụ dòng 73 có chữ `null` ở trường A không thuộc dạng `fill-blank`. Không sửa tự động file gốc hoặc đáp án. Bỏ các placeholder sai rồi kiểm tra lại để bổ sung qua cập nhật tuần, giữ đủ nhóm của tuần đã giao.

Kiểm thử và số đo fixture cục bộ không thay thế nghiệm thu trên Netlify/Supabase thật. Kết nối GitHub đã kiểm tra chỉ có quyền đọc; chưa commit/push/deploy từ phiên làm việc này.
