# Supabase đã thiết lập cho Bảo An

Ngày 16/10/2026. Dự án **Học tập của Gôn tồ**, mã `fhkgqwdpbgnxjqquuxrs`.

Đã thực hiện trực tiếp qua SQL Editor và Storage của đúng dự án, trong phiên do chủ dự án đăng nhập:

- Áp dụng `supabase/migrations/202610150001_online.sql` trong giao dịch. Schema riêng `bao_an` có đủ **16 bảng**, phiên bản 1.
- **13/13 kiểm tra SQL đạt**: khóa ngoại/check đã xác nhận, RLS bật, PUBLIC và các vai trò API `anon`, `authenticated`, `service_role` không có quyền truy cập dữ liệu ứng dụng.
- **11 nhóm dữ liệu đều bằng 0**: tài khoản/đơn vị, lớp/học sinh, tuần/gói câu, tư liệu, lượt chơi/câu trả lời, sao và đổi thưởng. Chỉ có một dòng metadata phiên bản; không tạo tài khoản hoặc câu mẫu.
- Tạo bucket **bao-an-media**, Public bucket **tắt**, giới hạn **2 MB/tệp**; MIME: `image/png`, `image/jpeg`, `image/webp`, `audio/mpeg`, `audio/wav`, `audio/ogg`. Bucket chưa có tệp và chưa có policy công khai.
- Đối chiếu Data API: chỉ `graphql_public` và `public` được chọn; **bao_an không exposed**, **0/16 bảng được exposed**. Không thay đổi cài đặt Data API toàn dự án.

## Mở để xem

- [Dự án Supabase](https://supabase.com/dashboard/project/fhkgqwdpbgnxjqquuxrs)
- [Table Editor — schema bao_an](https://supabase.com/dashboard/project/fhkgqwdpbgnxjqquuxrs/editor?schema=bao_an): mở menu Table Editor để xem danh sách 16 bảng. Schema `public` vẫn rỗng vì ứng dụng dùng schema riêng.
- [Kho tư liệu](https://supabase.com/dashboard/project/fhkgqwdpbgnxjqquuxrs/storage/files/buckets/bao-an-media)
- Project URL dùng cho biến `SUPABASE_URL`: `https://fhkgqwdpbgnxjqquuxrs.supabase.co`.

Ảnh đối chiếu nằm trong `V38_qa/supabase-live`: `setup-summary.jpg`, `tables-bao-an.jpg`, `schema-checks.jpg`, `empty-data.jpg`, `private-bucket.jpg`, `unexposed-schema.jpg`. Truy vấn cuối xác nhận 16/16 bảng bật RLS, 0 gói câu hỏi, bucket riêng tư với giới hạn chính xác 2.097.152 byte và 0 tệp. Số liệu và hash SQL lưu trong `verification.json`. Không có mật khẩu hoặc khóa riêng trong báo cáo.

## Bước còn lại để ứng dụng chạy online

Thực hiện [hướng dẫn GitHub → Netlify](DUA_LEN_GITHUB_NETLIFY.md), dùng đúng dự án trên. Cơ sở dữ liệu và bucket đã có nên bước `cloud:setup` có thể chạy lại để đối chiếu; không xóa schema hoặc tạo câu mẫu. Điền URI Transaction pooler, khóa server và origin website vào cấu hình riêng, rồi chạy `cloud:check` để xác minh kết nối runtime trước khi triển khai.

Chưa đẩy GitHub hoặc deploy Netlify trong phiên này. Chưa kiểm tra TLS qua URI PostgreSQL/khóa Storage server của bạn, vì các bí mật đó chưa được cấu hình trên máy hoặc Netlify. Thao tác SQL và cấu hình Storage thật đã hoàn tất; kiểm tra ứng dụng qua Netlify và nghiệm thu giáo viên/học sinh vẫn là bước riêng.

Mã nguồn đã đạt TypeScript, build và **201 kiểm thử hiện hành**, gồm **29 kiểm thử cloud cục bộ**. Kết quả này bổ sung cho kiểm tra schema/bucket thật, không thay thế kiểm tra website Netlify sau deploy.
