# Cấu hình Supabase cho Netlify

Dự án `fhkgqwdpbgnxjqquuxrs` đã được tạo schema và bucket riêng tư ngày 16/10/2026. Xem [kết quả thiết lập thực tế](SUPABASE_DA_THIET_LAP.md); phần kết nối Netlify và biến riêng vẫn cần làm theo hướng dẫn bên dưới.

Nếu làm lần đầu, đi theo [hướng dẫn GitHub → Netlify → Supabase](DUA_LEN_GITHUB_NETLIFY.md). Tài liệu này giải thích các tệp thiết lập, biến máy chủ và cách kiểm tra khi có lỗi. Các bước kết nối thật chỉ chạy sau khi bạn điền cấu hình của mình; build và kiểm thử không tự tạo dữ liệu trên Supabase.

## Cách dữ liệu hoạt động

Trình duyệt gọi `/api/online/*` cùng tên miền Netlify. Netlify Function kiểm tra phiên cookie HttpOnly, CSRF, quyền quản lý/học sinh và lớp được giao; PostgreSQL lưu tài khoản, câu hỏi, lịch sử và sổ sao trong schema riêng `bao_an`. Supabase Storage lưu hình/âm thanh trong bucket riêng tư, đọc qua API có kiểm tra quyền của ứng dụng.

Ứng dụng dùng tài khoản tên đăng nhập/mật khẩu do quản lý tạo, mật khẩu băm scrypt; **không dùng Supabase Auth**. Không cần cấu hình email, Google login hay Auth redirect URL trong Supabase. Không thêm `bao_an` vào **Exposed schemas** của Data API và không tạo policy cho phép `anon`/`authenticated` đọc schema này. Đây là kết nối PostgreSQL trực tiếp từ máy chủ, không phải truy cập bảng bằng khóa trình duyệt. [Supabase: bảo vệ dữ liệu](https://supabase.com/docs/guides/database/secure-data).

Một dự án Supabase mới sau thiết lập có **0 câu hỏi và chưa có tài khoản quản lý**. Giáo viên tạo lớp, học sinh và nhập bộ Word/Excel theo tuần qua giao diện. SQLite cục bộ và Supabase là hai kho dữ liệu riêng; bản này chưa có lệnh chuyển toàn bộ tài khoản/tiến độ SQLite lên cloud.

## Những tệp cần dùng

| Tệp/lệnh | Công dụng |
|---|---|
| `.env.cloud.example` | Mẫu cấu hình, không chứa khóa thật; sao thành `.env.cloud.local` trên máy bạn |
| `supabase/migrations/202610150001_online.sql` | Tạo schema, bảng, khóa ngoại, chỉ mục và quyền dữ liệu; không chèn câu hỏi mẫu |
| `supabase/verify.sql` | Kiểm tra cấu trúc/quyền bằng Supabase SQL Editor |
| `npm run cloud:setup` | Áp dụng migration và chuẩn bị bucket riêng tư; chạy lại được |
| `npm run cloud:check` | Chỉ kiểm tra cấu hình, kết nối, schema/quyền và bucket; không nhập câu hỏi hay tạo tài khoản |
| `netlify.toml` | Build `npm run build`, publish `dist`, Functions `netlify/functions` |

Hai lệnh cloud tự đọc `.env.cloud.local` bằng Node; các biến đã đặt trong môi trường tiến trình được ưu tiên. Tệp này đã nằm trong `.gitignore`. Không đặt khóa thật vào `.env.cloud.example`, SQL, `netlify.toml`, Word/Excel hay mã React.

## Biến cấu hình

| Biến | Nơi dùng | Giá trị |
|---|---|---|
| `BAO_AN_PUBLIC_ORIGIN` | Netlify Functions | Origin HTTPS chính xác, ví dụ `https://bao-an-cua-ban.netlify.app`; không có dấu `/` cuối hoặc đường dẫn |
| `BAO_AN_SETUP_TOKEN` | Netlify Functions, lúc khởi tạo | Chuỗi ngẫu nhiên riêng tối thiểu 24 ký tự; nhập ở màn hình tạo quản lý đầu tiên |
| `SUPABASE_DB_URL` | Functions, setup/check | URI **Transaction pooler** ở nút **Connect** của đúng dự án Supabase, thường cổng `6543` |
| `SUPABASE_URL` | Functions, setup/check | Origin dự án, ví dụ `https://PROJECT_REF.supabase.co` |
| `SUPABASE_SECRET_KEY` | Functions, setup/check | Khóa server `sb_secret_…`, lấy ở **Settings → API Keys** |
| `SUPABASE_SERVICE_ROLE_KEY` | Thay thế khóa trên | Chỉ dùng nếu dự án còn dùng khóa `service_role` cũ; không cần đặt cả hai |
| `BAO_AN_MEDIA_BUCKET` | Functions, setup/check | Mặc định `bao-an-media`; tên bucket riêng của ứng dụng |
| `SUPABASE_DB_CA` | Tùy chọn, kết nối runtime | CA PEM từ Supabase Database Settings nếu kết nối cần; nhận xuống dòng hoặc `\n` |
| `SUPABASE_MIGRATION_DB_URL` | Tùy chọn, **chỉ máy bạn** | URI Direct connection hoặc Session pooler để chạy setup; bỏ trống thì dùng `SUPABASE_DB_URL`. Check luôn dùng URI runtime |
| `SUPABASE_MIGRATION_DB_CA` | Tùy chọn, **chỉ máy bạn** | CA PEM cho URI migration riêng |
| `AWS_LAMBDA_JS_RUNTIME` | Cấu hình Netlify | `nodejs22.x`, đặt bằng Netlify UI/CLI/API để chọn runtime Function |

`SUPABASE_DB_URL` chứa **mật khẩu database**, không phải API key. Nếu mật khẩu có ký tự đặc biệt, phần mật khẩu trong URI phải được percent-encode (ví dụ `@` thành `%40`, `#` thành `%23`, `%` thành `%25`). Giữ nguyên host và tên người dùng do **Connect** cung cấp.

Transaction pooler phù hợp Functions có kết nối ngắn. Driver `pg` của dự án không đặt tên prepared statement; mỗi Function giữ pool nhỏ. Direct/Session URI dùng cho migration có thể cần mạng IPv6/IPv4 tương ứng; chọn Session pooler nếu máy bạn không truy cập được Direct IPv6. `cloud:check` luôn thử URI runtime để tránh trường hợp migration thành công nhưng Function không kết nối được. [Supabase: kiểu kết nối](https://supabase.com/docs/guides/database/connecting-to-postgres).

TLS luôn xác minh chứng chỉ. Không đặt `NODE_TLS_REJECT_UNAUTHORIZED=0` hoặc sửa `rejectUnauthorized` thành `false`. Nếu có lỗi chứng chỉ, dùng CA đúng của dự án cho kết nối tương ứng; ứng dụng bỏ các tham số `sslmode`, `sslcert`, `sslkey`, `sslrootcert` trong URI để chúng không ghi đè cấu hình xác minh. [Supabase: SSL và CA](https://supabase.com/docs/guides/platform/ssl-enforcement).

## Thiết lập và kiểm tra

Mở PowerShell tại thư mục mã nguồn, sao mẫu **một lần** rồi điền giá trị thật trong tệp riêng:

```powershell
Copy-Item -LiteralPath .env.cloud.example -Destination .env.cloud.local
notepad .env.cloud.local
npm run cloud:setup
npm run cloud:check
```

Chỉ chạy dòng sao mẫu khi `.env.cloud.local` chưa tồn tại để tránh ghi đè cấu hình đã điền. Setup cần tài khoản kết nối có quyền tạo schema/bảng; runtime dùng chủ sở hữu bảng, thông thường là `postgres` trong URI Connect. Setup chạy SQL trong giao dịch rồi thiết lập bucket. Nếu có lỗi Storage sau khi SQL đã hoàn tất, sửa cấu hình/quyền và chạy lại; không xóa schema để làm lại.

Đường khuyến nghị là `cloud:setup` vì chuẩn bị cả database và Storage. Nếu quản trị viên muốn dùng SQL Editor, chạy **toàn bộ** `supabase/migrations/202610150001_online.sql`, sau đó `supabase/verify.sql`; tiếp tục chạy `cloud:setup` để kiểm tra/tạo bucket và `cloud:check` để xác nhận cấu hình. Chỉ chạy SQL chưa hoàn tất phần Storage.

Bucket phải **private**, giới hạn mỗi tệp **2 MB** và chỉ nhận PNG/JPEG/WebP, MP3/WAV/OGG. Không tạo policy công khai. Nếu bucket trùng tên đã public, chọn một tên mới trong `BAO_AN_MEDIA_BUCKET` thay vì dùng bucket đó. [Supabase: bucket riêng tư](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## Đặt biến trên Netlify

Vào **Project configuration → Environment variables**, thêm các biến dành cho Functions trong bảng trên cho context **Production**. Nếu gói cho chọn scope, chọn **Functions** cho bí mật. Nếu chỉ có **All scopes**, dùng lựa chọn đó; không chèn biến vào frontend. Không chọn riêng scope có tên **Runtime** vì scope này không có nghĩa là Functions. Không dùng tiền tố `VITE_` cho khóa server. Khóa `sb_secret_…`/`service_role` chỉ được lưu trên máy chủ. [Netlify: biến Functions](https://docs.netlify.com/build/functions/environment-variables/), [Supabase: server keys](https://supabase.com/docs/guides/getting-started/api-keys).

`AWS_LAMBDA_JS_RUNTIME=nodejs22.x` đặt qua UI với scope **All scopes** nếu có lựa chọn; biến này được Netlify dùng khi đóng gói Function. `NODE_VERSION=22.22.2` cho build đã có trong `netlify.toml`. Biến chọn runtime không được đặt trong `netlify.toml`. Sau khi đổi biến phải **deploy lại**. [Netlify: runtime Node.js](https://docs.netlify.com/build/functions/configuration/#nodejs-version-for-runtime).

Không đưa `SUPABASE_MIGRATION_DB_URL`/`SUPABASE_MIGRATION_DB_CA` lên Netlify. Deploy Preview/branch thử nghiệm dùng dự án Supabase riêng hoặc để API chưa cấu hình; không cấp bí mật Production cho mọi context.

## Xử lý lỗi thường gặp

| Hiện tượng | Kiểm tra |
|---|---|
| `/api/online/status` trả `available:false`, HTTP 503 | Đã deploy Functions; biến có context Production và scope Functions/All scopes; chạy setup rồi check; đã redeploy sau đổi biến |
| API trả HTML trang chủ | Đang deploy thiếu Function hoặc sai thư mục gốc; phải build từ toàn bộ repo, không kéo thả riêng `dist` |
| Kết nối PostgreSQL thất bại | Dự án Supabase đang hoạt động; dùng đúng Transaction pooler, user/host/password; kiểm tra TLS/CA bằng `cloud:check` |
| Không tạo được schema | URI migration có quyền DDL; không dùng khóa `anon`/publishable thay cho mật khẩu database |
| Tạo lớp/lưu bài báo sai origin | `BAO_AN_PUBLIC_ORIGIN` trùng chính xác tên miền đang mở, bao gồm `https://`; sau đổi origin cần redeploy và đăng nhập lại |
| Ảnh/âm thanh không tải lên | Bucket đúng tên, private, khóa server còn hiệu lực; tệp đúng loại và không quá 2 MB |
| Không thấy bảng trong `public` | Chọn schema `bao_an` trong Supabase; không chuyển bảng sang `public` hay exposed schemas |
| Build báo Secrets scanning tìm thấy giá trị biến trong tài liệu/mã | Xóa giá trị thật khỏi đúng tệp được báo, commit/push rồi deploy lại. Giữ biến trong Netlify; giữ cơ chế quét bật. Scope Functions khác tùy chọn Contains secret values. URI có mật khẩu, khóa server và mã khởi tạo cần secret flag; URL dự án không cần flag này |
| Đăng nhập bằng Supabase Auth không được | Tạo quản lý đầu tiên trong ứng dụng, sau đó quản lý tạo tài khoản học sinh trong ứng dụng |

## Sao lưu và cập nhật

Sao lưu **PostgreSQL và các đối tượng Storage** của Supabase theo phương án phù hợp với tài khoản của bạn; bản backup database không thay thế backup tệp ảnh/âm thanh. Chức năng khôi phục SQLite của bản cục bộ không khôi phục được Supabase. [Supabase: database backups](https://supabase.com/docs/guides/platform/backups).

Khi cập nhật mã, giữ nguyên dự án Supabase và bucket; push mã mới để Netlify build/deploy. Nếu bản mới có migration, sao lưu trước rồi chạy `cloud:setup` và `cloud:check` theo hướng dẫn bản đó. Build không tự chạy migration và không xóa câu hỏi đã nhập. Xem các bước kiểm tra sau deploy ở [hướng dẫn đưa lên Internet](DUA_LEN_GITHUB_NETLIFY.md#6-kiểm-tra-bản-đang-chạy).
