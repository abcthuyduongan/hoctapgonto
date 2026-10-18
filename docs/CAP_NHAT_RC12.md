# Bàn giao RC12 và bước tiếp theo

RC12 đã build và kiểm thử cục bộ, chưa đẩy nhánh liên kết Netlify. Người dùng xác nhận chưa có môi trường thử riêng. Giữ website hiện tại trong khi chuẩn bị nghiệm thu; không thử tải dữ liệu thật.

## Chạy ZIP trên Windows

1. Cài Node.js từ 22.22.2 trở lên.
2. Giải nén `bao-an-learning-3.8.0-rc.12.zip` vào thư mục riêng. Mở `MO_QUAN_LY.cmd`, giữ cửa sổ máy chủ chạy.
3. Mở địa chỉ được hiển thị. Lần đầu lấy mã riêng từ `data/bootstrap-token.txt`, tự đặt tài khoản quản lý và tạo dữ liệu thử. Không có tài khoản hay câu hỏi thật đi kèm.
4. Dùng mục mẫu Excel đầy đủ để tải ZIP 36 câu, hình/âm thanh và hướng dẫn. Giải nén mẫu trước khi chọn các tệp. Không có mẫu Word mới.

Không chép đè/xóa thư mục dữ liệu để cập nhật. Sao lưu và thử khôi phục vào môi trường tách biệt theo hướng dẫn đi kèm; không chạy hai máy chủ cùng DB.

## Chạy mã nguồn

Giải nén `bao-an-learning-3.8.0-rc.12-source.zip`. Gói không chứa `.env`, DB, Git hoặc node_modules. Trong thư mục đã giải nén:

~~~powershell
npm ci
npm run build
npm run online
~~~

Kiểm tra hash trong `SOURCE_MANIFEST.json`; `baseCommit` xác định commit mã nguồn lúc đóng gói. Gói ZIP ứng dụng có build `de06e2fc1718f734`, schema SQLite/PostgreSQL 1 và protocol 1.

## Đưa lên GitHub và Netlify sau nghiệm thu

1. Tạo site Netlify staging và dự án Supabase riêng, dùng dữ liệu giả. Nhánh/site này không được ghi vào DB/Storage production. Dùng cấu hình mẫu và [hướng dẫn cloud](NETLIFY_SUPABASE.md), không chép bí mật vào Git hoặc biến `VITE_*`.
2. Giữ nguyên lệnh build `npm ci` / `npm run build` và cấu hình `netlify.toml`; xác minh runtime trả `3.8.0-rc.12`, UI/protocol cùng bản. Triển khai nhánh thử theo quy trình dự án, đối chiếu hash/commit.
3. Hoàn thành các cổng trong [báo cáo RC12](BAO_CAO_TOI_UU_RC12_2026-10-18.md): đo cloud, tải giả 30 rồi 100, ngâm 60 phút, phục hồi DB/Storage và dùng thử Windows thật. Chỉ xác nhận quy mô thực sự đạt.
4. Khi các cổng đạt, chuyển commit đã nghiệm thu sang nhánh production liên kết GitHub của Netlify và rollout nhóm nhỏ trước. Ghi lại commit/build và có bản ứng dụng tương thích để quay lui; không reset sao hay restore DB cũ như rollback thường lệ.

Việc push nhánh đang liên kết Netlify sẽ phát hành website. Bản bàn giao này giữ `releaseReady:false`, `humanPilotStatus:UNVERIFIED`; không coi kiểm thử fixture cục bộ là phê duyệt production.
