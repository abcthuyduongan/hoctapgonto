# Cập nhật Netlify qua GitHub · RC5

Kho đã đối chiếu: `abcthuyduongan/hoctapgonto`, nhánh `feature/v37-premium-world`, commit gốc `e6c51ebb36fd4f07f40f43c23c34f7698b8619e3`.

Bản sửa giảm số lượt gửi âm thanh và tải dashboard, đồng thời chỉ dựng phần trả lời khi mở câu. Có thêm endpoint cloud `/api/online/media/batch`; cần triển khai cả mã giao diện và Netlify Function. Không chỉ chép riêng `dist` lên website.

## Cập nhật

1. Xem thay đổi trong thư mục dự án bằng `git diff`. Gói cập nhật GitHub chứa các tệp thay đổi so với commit gốc, có đường dẫn tương đối; không chứa `.git`, `.env`, database, bản sao lưu hoặc dữ liệu nhập của người dùng. Nếu dùng bản sao repo khác, giải nén vào thư mục gốc repo và kiểm tra thay đổi trước khi commit.
2. Kiểm tra đang ở đúng nhánh đã liên kết Netlify. Với thư mục dự án này, các lệnh dưới đây đưa mã đã sửa lên GitHub và có thể kích hoạt triển khai website:

```powershell
git add README.md package.json package-lock.json src server tests docs tools/package_release.mjs tools/release-files/HUONG_DAN_SU_DUNG.html
git commit -m "Improve question preview and batch cloud media uploads"
git push origin feature/v37-premium-world
```

3. Trên Netlify, kiểm tra deploy của commit mới hoàn tất thành công. Giữ cấu hình hiện có: build `npm run build`, publish `dist`, Functions `netlify/functions`. Không thay biến bí mật hoặc chạy lại khởi tạo dữ liệu.
4. Tải lại website sau deploy. Đăng nhập quản trị, tải 16 âm thanh, kiểm tra tiến độ và xem trước bộ câu hỏi. Giữ kiểm tra định dạng, quyền truy cập và hash. Không có migration database trong bản sửa này.

## Kiểm tra với tệp mẫu

Tệp `BAO_AN_LOP3_TUAN01_MOT_FILE_140_CAU.xlsx` gốc có các ô ghi chữ `null` ở cột không dùng. Ví dụ tại dòng 73, câu `fill-blank` vẫn có giá trị `null` trong A/B/C/D. Các ô không sử dụng cần để trống. Bản thử trong bộ nhớ sau khi bỏ placeholder nhập đủ 140 câu, 17 bộ; file gốc chưa bị chỉnh sửa.

Kết quả đo trong fixture cục bộ không thay cho tốc độ Netlify/Supabase thực tế. Cần đo lại trên website sau khi deploy. Kết nối GitHub hiện tại chỉ đọc (`push:false`); agent chưa commit, push hoặc triển khai website.
