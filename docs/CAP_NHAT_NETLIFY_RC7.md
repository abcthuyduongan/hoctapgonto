# Cập nhật căn chỉnh và tốc độ tải · RC7

Được chuẩn bị trên nhánh `feature/v37-premium-world` sau commit RC6 `ab202e9`. Gồm bộ căn chỉnh câu hỏi dùng chung, sửa thẻ Trí Nhớ tràn chữ, cho mở bài khi cảnh đang tải, tải mã trò song song, giới hạn chờ và tối ưu đọc dữ liệu cloud. Giữ schema, dữ liệu và lịch sử; không cần migration.

Chạy PowerShell tại thư mục dự án:

```powershell
cd 'D:\Phần mềm 2026\BAO_AN_LEARNING_lam lại'
git add package.json package-lock.json README.md src server tests docs tools/package_release.mjs tools/release-files/HUONG_DAN_SU_DUNG.html
git commit -m "Fit question layouts and reduce game loading delays"
git push origin feature/v37-premium-world
```

Netlify cần build đúng nhánh, build `npm run build`, publish `dist`, Functions `netlify/functions`. Triển khai UI và Function cùng commit. Sau khi Published, tải lại website. Dùng tài khoản học sinh thử cảnh chậm, mở trò, câu hỏi dài/có ảnh và gửi đáp án.

Các ZIP RC6 cũ được giữ nguyên. Gói RC7 là bản riêng; không ghi đè cùng tên bằng nội dung khác. Kết quả cục bộ không thay thế nghiệm thu tốc độ Netlify/Supabase thật. Phiên này chưa commit/push/deploy bản RC7.
