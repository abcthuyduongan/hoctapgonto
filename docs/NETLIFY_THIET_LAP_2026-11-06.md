# Nhật ký thiết lập Netlify — 06/11/2026

## Phạm vi hiện tại

Ứng dụng dùng cho 1–2 người. Người dùng yêu cầu hoàn thiện đăng ký/cấu hình Netlify; phần đưa dữ liệu và nâng cấp database sẽ tự thực hiện sau. Không áp dụng migration trong lần thiết lập này.

## Đã kiểm tra

- Netlify dùng team `c2-tranphu-dlieya`; project `hoctapgonto` đã được tạo trên Edge ngày 06/11/2026. Lần build đầu thành công, có một Function được triển khai.
- Mã đã có trên GitHub: `abcthuyduongan/hoctapgonto`, nhánh `codex/bao-an-4-0-2`.
- Supabase trên Edge đã đăng nhập. Dự án hiện có `Học tập của Gôn tồ`, ref `fhkgqwdpbgnxjqquuxrs`, khớp tài liệu cấu hình của dự án. Không tạo database trùng.
- Đã xác thực kết nối PostgreSQL bằng thông tin người dùng cung cấp, dùng chứng chỉ CA tải từ liên kết trong dashboard Supabase và giữ xác minh TLS.
- Database hiện ở schema 1, đã có quản trị. Mã 4.0.2 yêu cầu schema 8. Chỉ đọc trạng thái; **chưa nâng cấp schema, chạy seed hoặc thay đổi dữ liệu**.
- URI hợp lệ, Project URL, tên bucket dự kiến và CA đã lưu vào tệp riêng `.online/private/netlify-database.env`, được Git bỏ qua. Tệp này có thông tin bí mật; không đưa vào commit, báo cáo công khai hoặc ảnh chụp.
- CA công khai: Supabase Root 2021 CA, hết hạn 26/04/2031; SHA-256 `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`.

## Cấu hình project cần dùng

| Mục | Giá trị |
| --- | --- |
| Repository | `abcthuyduongan/hoctapgonto` |
| Production branch | `codex/bao-an-4-0-2` |
| Base/package directory | Để trống |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |
| Node.js | `22.22.2` theo `netlify.toml` |

## Kết quả tạo project ngày 06/11/2026

- GitHub được kết nối trên Edge; đã chọn nhánh `codex/bao-an-4-0-2` và tên project `hoctapgonto`.
- URL: https://hoctapgonto.netlify.app
- Dashboard: https://app.netlify.com/projects/hoctapgonto/overview
- Deploy đầu: `6aeddb2e4a0c3fe9cb37b443`, commit `3ff86b5cf5ba85cdcd7ddde402546828acb83d22`, hoàn tất khoảng 20:51 Asia/Saigon, build/deploy 32 giây.
- Đã thêm `BAO_AN_PUBLIC_ORIGIN=https://hoctapgonto.netlify.app`. Các biến Supabase và nâng cấp database khi đó do người dùng tiếp tục thực hiện.

## Chẩn đoán và xử lý ngày 07/11/2026

Người dùng báo lỗi khi mở trang. Kiểm tra trên trang thật thấy “Máy chủ chưa sẵn sàng”, API không khởi tạo được kết nối dữ liệu; đây không phải lỗi tạo project hoặc lỗi build frontend.

- Trước khi sửa: production đang public, deploy `6aedf09963f8b8e17200c663`, cùng commit `3ff86b5`; Netlify hiển thị còn 135 credit tại thời điểm kiểm tra. Không chạy thêm agent Netlify hoặc deploy nhiều lần để chẩn đoán.
- Netlify đã có `SUPABASE_DB_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_URL`, `BAO_AN_SETUP_TOKEN` và public origin; chưa có `SUPABASE_DB_CA`.
- Mật khẩu được lưu từ ngày trước hiện bị database từ chối (`28P01`). Người dùng cung cấp hai giá trị mới; đã kiểm tra chỉ đọc và xác nhận giá trị gửi sau cùng kết nối thành công. Không ghi mật khẩu hoặc URI có mật khẩu vào hồ sơ này.
- Đối chiếu lúc khoảng 07:43 Asia/Saigon: database cùng project ref đã có đủ schema versions 1–8, không thiếu bảng trong `CLOUD_TABLES`; có quản trị; bucket `bao-an-media` private, giới hạn 2 MB và MIME đúng. Đây là cập nhật đã có trên dịch vụ khi kiểm tra, không phải migration do tác vụ này chạy.
- Đã thêm CA chính thức dưới biến `SUPABASE_DB_CA`; giữ `rejectUnauthorized:true` và hostname verification. Không tắt SSL hoặc thay đổi thiết lập bảo mật Supabase.
- Đã cập nhật **chỉ giá trị production** của `SUPABASE_DB_URL` bằng URI vừa xác thực, giữ chế độ secret. Không thêm mật khẩu vào context preview/local.
- Đã chạy một deploy nhận cấu hình mới: `6aee747670abba8754694cde`, nhánh `codex/bao-an-4-0-2`, commit `3ff86b5cf5ba85cdcd7ddde402546828acb83d22`. Deploy thành công lúc 07:45:13 Asia/Saigon, tổng 34 giây; một Function được triển khai.

## Xác minh sau sửa — 07/11/2026

- Tải lại trang production: xuất hiện màn “Chào mừng bạn trở lại” với tên đăng nhập/mật khẩu; không còn màn “Máy chủ chưa sẵn sàng”.
- `/api/online/status`: HTTP 200, `available:true`, `configured:true`, runtime 4.0.2.
- `/build-info.json`: HTTP 200, UI 4.0.2; source ID UI/API cùng là `556aba824efa09aa0766549a2ed91c02349cca5150f7e6c05b21e7d3f3bd89c0`.
- API vẫn trả `Cache-Control: no-store,private`.
- [Ảnh màn đăng nhập sau sửa](netlify-evidence-2026-11-07/login-restored.jpg).
- [Kết quả đối chiếu endpoint và build](netlify-evidence-2026-11-07/runtime-status.json).

Phạm vi xác minh: khôi phục bước mở website và khởi tạo API/database. Chưa đăng nhập tài khoản ứng dụng, chơi bài, phát media, cộng sao, xuất dữ liệu hoặc chạy tải. Nếu phát hiện lỗi trong những luồng đó cần ghi nhận và kiểm tra riêng; không lấy kết quả này làm nghiệm thu toàn bộ ứng dụng.

Không đổi mật khẩu database, nâng cấp gói, chạy migration, seed hoặc sửa dữ liệu người học trong tác vụ này. Các kiểm tra tài khoản/học liệu cần được ghi đúng phạm vi thực hiện, không coi trang đăng nhập hiện được là đã nghiệm thu mọi chức năng.
