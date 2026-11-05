# Kiến trúc hiện hành — Bảo An Learning 3.9

Frontend React/TypeScript dùng một giao diện 2D. Màn đăng nhập, quản trị, học sinh và game tải theo nhu cầu. `src/games/loaders.ts` mở đúng game từ registry; không có engine/model 3D.

Trình duyệt gọi API cùng origin `/api/online/*`. Hai adapter sử dụng cùng hợp đồng và nghiệp vụ: `server/online-server.mjs` + SQLite cho local; `server/cloud-api.mjs` + PostgreSQL và Storage riêng cho Netlify. Hai kho không tự đồng bộ.

Máy chủ kiểm tra phiên, CSRF, vai trò, workspace/lớp và tuần được giao. Lượt chơi, câu mở, trả lời, sao và đổi quà được xác nhận ở server. Tối ưu media không thay bytes học liệu, hash nguồn, ID câu hay quy tắc sao.

Ảnh dùng cache RAM có phạm vi lượt chơi và giới hạn tài nguyên. Ảnh câu kế tiếp chỉ chuẩn bị sau câu đúng; không mở sớm đồng hồ. Upload JSON media lớn có thể dùng gzip theo khả năng server; giải nén bất đồng bộ có ngân sách output. Storage cache chỉ giữ bytes đã xác minh hash, sau kiểm tra quyền của API. Audio không được dùng cache để bỏ qua biên nhận từng câu nghe.

Build sinh `build-info.json`, hash nguồn bao gồm thay đổi local và commit nền khi có. Frontend root và status API công bố cùng source ID để đối chiếu. Worker tương thích tự gỡ, không precache dữ liệu riêng. Manifest phát hành giữ hash từng tệp và schema SQLite/PostgreSQL 1.

Hướng dẫn vận hành: `QUAN_LY_CUC_BO.md`; cấu hình cloud/SQL: `NETLIFY_SUPABASE.md`; các việc triển khai: `KE_HOACH_TOI_UU_VA_PHAT_HANH_2026-11-02.md`.
