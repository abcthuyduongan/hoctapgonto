# Bảo An Learning · 3.9.0-rc.1

Ứng dụng học tập 2D: giáo viên quản lý lớp và nhập học liệu Word/Excel; học sinh học bằng năm trò chơi, tám dạng câu hỏi, tích sao theo từng câu và đổi quà. Mã 3D, model, bộ sinh cảnh và các bản phát hành cũ đã được dọn. Tài khoản, học liệu và sao trong `.online/` được giữ nguyên.

## Chạy trên máy

Cài Node.js **22.22.2 trở lên**, rồi chạy tại thư mục dự án:

```powershell
npm ci
npm run build
npm run online
```

Mở http://127.0.0.1:4180/?online=1 và giữ máy chủ chạy. Bản ZIP chạy local có `MO_BAO_AN.cmd` và `MO_QUAN_LY.cmd`; không cần `npm install` trong gói đã giải nén. Cập nhật phải giữ thư mục dữ liệu: mã nguồn dùng `.online/`, gói ZIP dùng `data/`.

## Ảnh, âm thanh và kết quả học

- Ảnh được gộp yêu cầu và dùng lại trong RAM của lượt chơi; thoát/đổi phiên sẽ dọn tài nguyên. Sau câu đúng, chuẩn bị trước ảnh câu kế tiếp, không mở đồng hồ trước.
- Upload media lớn được nén truyền gzip khi server hỗ trợ; ảnh/âm thanh sau giải nén giữ nguyên bytes, SHA-256 và chất lượng. Máy chủ kiểm tra cả giới hạn trước/sau giải nén.
- Cloud dùng lại bytes media đã xác minh hash trong cache có giới hạn; quyền truy cập vẫn được kiểm tra mỗi yêu cầu. Thời lượng audio được xác minh và dùng lại, biên nhận câu nghe vẫn riêng theo lượt/câu.
- Câu có ảnh chỉ mở đồng hồ sau khi ảnh sẵn sàng. Sao do server xác nhận; tối đa ba sao mỗi câu nguồn, học lại chỉ cộng chênh lệch. Tuần đóng và lịch sử đổi quà được bảo toàn.

Tải bộ mẫu đầy đủ trong màn **Học liệu tuần**, giải nén rồi chọn Excel cùng ảnh/âm thanh. Bản cài mới không tự có học liệu. Xem [nhập học liệu](docs/ONLINE_QUESTION_IMPORT.md), [quản lý local/backup](docs/QUAN_LY_CUC_BO.md) và [luật sao/khóa tuần](docs/KE_HOACH_SAO_TUNG_CAU_VA_KHOA_TUAN_2026-10-17.md).

## Đưa lên GitHub và Netlify

Gói mã nguồn: `releases/bao-an-learning-3.9.0-rc.1-source.zip`. Gói local: `releases/bao-an-learning-3.9.0-rc.1.zip`.

Trong chính checkout đã dọn này, kiểm tra và đưa cả thay đổi lẫn các tệp đã xóa lên GitHub:

```powershell
git status --short
git add -A
git commit -m "Release 3.9.0-rc.1: lightweight 2D and media uploads"
git push
```

GitHub phải nhận cả các mục xóa để loại mã 3D cũ. Nếu dùng ZIP trên máy khác, giải nén thư mục source và dùng nội dung thư mục đó làm nguồn repo sạch. `SOURCE_MANIFEST.json` ghi hash và các đường dẫn đã loại; không đưa `.env.cloud.local`, dữ liệu, backup, node_modules hoặc kết quả test lên Git.

Netlify build từ toàn bộ repo: command `npm run build`, publish `dist`, Functions `netlify/functions`. Điền biến riêng theo [hướng dẫn cấu hình và SQL](docs/NETLIFY_SUPABASE.md), rồi deploy lại. Không kéo thả riêng `dist` cho bản cloud vì thiếu Functions.

**Bản 3.9 này không đổi schema SQLite/PostgreSQL phiên bản 1, không cần SQL nâng cấp trên dự án đã có.** Dự án Supabase mới dùng [migration ban đầu](supabase/migrations/202610150001_online.sql) và [SQL kiểm tra](supabase/verify.sql), hoặc `npm run cloud:setup` sau khi điền cấu hình.

## Kiểm tra và đóng gói

```powershell
npm run verify:local
npm run package:pilot
npm run package:source
```

Các nhóm hiện hành gồm syntax/TypeScript, nhập bài, auth/API/SQLite/PostgreSQL fixture, sao/ví/khôi phục, media và E2E Chrome/Edge qua máy chủ local. Cổng asset chặn GLB/Three.js và tệp riêng tư trong bản web. Kiểm thử dành riêng cho tính năng 3D đã gỡ cùng tính năng; các kiểm thử nghiệp vụ hiện hành vẫn được giữ.

Người dùng chọn nghiệm thu local và bỏ phép đo tải cloud trong đợt này. Gói vẫn ghi RC/pilot và trạng thái nghiệm thu thực tế đúng bằng chứng. Theo dõi triển khai trong [kế hoạch/báo cáo duy nhất](docs/KE_HOACH_TOI_UU_VA_PHAT_HANH_2026-11-02.md).
