# Cấu hình Supabase/Netlify — Bảo An Learning 3.9 (2D)

Ứng dụng cục bộ SQLite chạy được ngay, không cần Supabase. Phần dưới dùng để kiểm tra và vận hành bản cloud.

## 1. Điền tệp riêng trên máy

Mở `.env.cloud.local` ở thư mục gốc dự án bằng Notepad. Tệp đã được Git bỏ qua. Nếu tệp đã tồn tại, giữ nguyên các giá trị bạn đã điền.

| Biến | Bạn lấy/điền ở đâu | Bắt buộc |
|---|---|---|
| `BAO_AN_PUBLIC_ORIGIN` | Địa chỉ HTTPS của website, ví dụ staging đang dùng `https://gontogontet.netlify.app`; không thêm đường dẫn hoặc dấu `/` cuối | Có |
| `SUPABASE_DB_URL` | Supabase → **Connect → Transaction pooler**; sao URI PostgreSQL đầy đủ và thay mật khẩu database | Có |
| `SUPABASE_URL` | Supabase → Connect hoặc Project Settings → Data API → **Project URL** | Có |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → **API Keys → Secret keys**; dùng khóa `sb_secret_...` của máy chủ | Có |
| `BAO_AN_MEDIA_BUCKET` | Giữ `bao-an-media` nếu dùng bucket đã thiết lập | Có, đã có mặc định |
| `SUPABASE_DB_CA` | Database settings → SSL certificate; chỉ cần khi kết nối yêu cầu CA riêng. Dán PEM thành một dòng với `\n` | Khi cần |

Dự án Supabase đã được ghi nhận trước đây: [Học tập của Gôn tồ — fhkgqwdpbgnxjqquuxrs](https://supabase.com/dashboard/project/fhkgqwdpbgnxjqquuxrs). Kiểm tra đúng dự án staging của bạn trước khi sao thông tin. Không đặt lại mật khẩu database nếu đang có website dùng mật khẩu cũ mà chưa cập nhật cấu hình website.

`SUPABASE_DB_URL` dùng **mật khẩu database**, không dùng secret key hay mật khẩu đăng nhập Supabase. Nếu tự ghép URI, mật khẩu có ký tự đặc biệt cần URL-encode; ưu tiên sao đúng URI từ Connect, không tự đoán host/user pooler. Chọn transaction pooler phù hợp với serverless theo [hướng dẫn Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

Dùng secret key dành cho server theo [tài liệu API keys](https://supabase.com/docs/guides/getting-started/api-keys); không điền publishable/anon vào `SUPABASE_SECRET_KEY`. Các giá trị thật chỉ nằm trong tệp riêng và Netlify, không gửi trong chat hoặc commit.

## 2. Kiểm tra sau khi điền

Chạy trong PowerShell tại thư mục dự án:

```powershell
npm run cloud:check
```

Lệnh tự đọc `.env.cloud.local`, kiểm tra kết nối runtime, schema `bao_an`, quyền và bucket. Lệnh kiểm tra không tạo lớp, tài khoản hoặc câu hỏi. Nếu lỗi, giữ mã lỗi và sửa đúng biến, không xóa database/schema để làm lại.

Schema và bucket đã có từ trước thì bắt đầu bằng `cloud:check`. Chỉ dùng `npm run cloud:setup` khi thật sự cài một dự án mới hoặc có migration đã được rà soát; build ứng dụng không tự chạy migration.

`BAO_AN_SETUP_TOKEN` chỉ cần tạo quản lý đầu tiên trên một môi trường mới, dài tối thiểu 24 ký tự. Website đã có tài khoản quản lý không cần tạo lại tài khoản hoặc thay token để kiểm tra tốc độ.

## 3. Điền trên Netlify

Mở đúng website → **Project configuration → Environment variables**. Thêm các biến dưới đây cho đúng deploy context và scope **Functions**; nếu gói không cho chọn Functions thì chọn **All scopes**:

```dotenv
BAO_AN_PUBLIC_ORIGIN=https://gontogontet.netlify.app
SUPABASE_DB_URL=<URI Transaction pooler có mật khẩu database>
SUPABASE_URL=<Project URL>
SUPABASE_SECRET_KEY=<Secret key sb_secret_...>
BAO_AN_MEDIA_BUCKET=bao-an-media
```

Nếu staging dùng tên miền khác, đổi `BAO_AN_PUBLIC_ORIGIN` cho khớp chính xác. Không thêm tiền tố `VITE_` cho các biến này. Không cần đưa `BAO_AN_STAGING_USER`, `BAO_AN_STAGING_PASSWORD` hoặc URI migration lên Netlify; chúng dùng riêng cho thao tác kiểm thử/quản trị trên máy.

Cấu hình build đã có trong `netlify.toml`: command `npm run build`, publish `dist`, Functions `netlify/functions`, Node build 22.22.2. Netlify phải build từ **toàn bộ mã nguồn**, không chỉ kéo thả `dist` vì cách đó thiếu Functions. Sau khi đổi biến, **redeploy** để Functions nhận giá trị mới. Xem [Netlify environment variables](https://docs.netlify.com/build/environment-variables/get-started/).

## 4. Các thiết lập Supabase giữ đúng

- Database dùng schema riêng `bao_an`; không thêm schema này vào Exposed schemas của Data API.
- Bucket `bao-an-media`: **private**, giới hạn 2 MB/tệp; nhận PNG/JPEG/WebP và MP3/WAV/OGG.
- Ứng dụng có tài khoản riêng; không cần tạo học sinh trong Supabase Auth hoặc cấu hình Google login.
- Không xóa bảng hoặc media đang có. Database và Storage cần được sao lưu cùng nhau.
- Bản local SQLite và cloud là hai kho riêng; không tự đồng bộ bằng cách đổi biến môi trường.

## 5. Đối chiếu bản triển khai

Sau khi bản RC mới được triển khai:

1. Mở `/api/online/status`: HTTP 200, `available:true`, `configured:true` và `runtimeVersion:3.9.0-rc.1`.
2. Mở `/build-info.json` và đối chiếu `sourceId` với `build.sourceId` trong status. Hai giá trị phải giống nhau để xác nhận UI/API cùng nguồn.
3. Đăng nhập quản lý, xem lớp đang có; đăng nhập học sinh test và thử ảnh/âm thanh, trả lời, sao và thoát bài.

Trong đợt này, người dùng chọn nghiệm thu local và không yêu cầu đo tải cloud. Không cần điền tài khoản test staging để build/chạy local hoặc để đưa mã lên GitHub. Nếu website đã có biến môi trường đúng, giữ nguyên các giá trị đó và redeploy mã mới.

## 6. Có cần chạy SQL không?

**Từ bản hiện tại lên 3.9.0-rc.1: không cần SQL nâng cấp.** Schema SQLite/PostgreSQL vẫn là phiên bản 1. Tối ưu ảnh/âm thanh chỉ đổi cách truyền/cache, không đổi bảng, ID hoặc dữ liệu học liệu.

Nếu tạo một dự án Supabase hoàn toàn mới:

1. Mở SQL Editor của đúng dự án, dùng vai trò postgres.
2. Mở tệp supabase/migrations/202610150001_online.sql trong mã nguồn, sao **toàn bộ** nội dung và Run.
3. Chạy toàn bộ supabase/verify.sql, kiểm tra các cột passed là true.
4. Tạo bucket bao-an-media private, giới hạn 2 MB/tệp và MIME nêu ở mục 4; hoặc dùng npm run cloud:setup sau khi điền .env.cloud.local để chuẩn bị cả schema và Storage.
5. Điền biến Netlify và redeploy. Chỉ môi trường mới chưa có quản lý mới cần BAO_AN_SETUP_TOKEN.

Không chạy lệnh xóa schema/bảng hoặc reset database để cập nhật bản này. Tài khoản ứng dụng được tạo trong Bảo An, không tạo học sinh trong Supabase Auth.

Gói nguồn và lệnh đưa lên GitHub ở README.md. Kết quả local và phần đã dọn được ghi trong KE_HOACH_TOI_UU_VA_PHAT_HANH_2026-11-02.md.
