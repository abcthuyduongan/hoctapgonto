# Đưa Bảo An Learning lên GitHub, Netlify và Supabase

Làm theo thứ tự: **đưa mã nguồn lên GitHub → tạo Netlify để lấy tên miền → thiết lập Supabase → đặt biến Netlify và deploy lại → tạo quản lý đầu tiên**. Bạn tự điền tên dự án và khóa riêng khi thực hiện; các tệp trong repo không chứa thông tin tài khoản thật.

Chuẩn bị tài khoản GitHub, Netlify, Supabase; cài Git và Node.js **22.22.2 trở lên**. Dùng thư mục mã nguồn hiện tại để đưa lên GitHub, vì ZIP RC2 dành cho chạy cục bộ không thay thế toàn bộ repo cloud có `netlify/functions`, `supabase` và `package-lock.json`.

## 1. Kiểm tra mã nguồn trên máy

Mở PowerShell, chạy từng dòng và dừng nếu một lệnh báo lỗi:

```powershell
Set-Location -LiteralPath 'D:\Phần mềm 2026\BAO_AN_LEARNING_lam lại'
node --version
git --version
npm ci
npm run typecheck
npm test
npm run test:assets
npm run build
git status --short
git remote -v
```

`.gitignore` đã loại `node_modules`, `dist`, `.online`, `backups`, `releases`, `test-results` và `.env.*.local`. Những thư mục đó chứa dữ liệu máy, tệp sinh ra hoặc bí mật và không cần đẩy lên GitHub. Giữ các tệp `.env.example`/`.env.cloud.example` vì chỉ là mẫu cấu hình.

Kiểm tra thêm các tệp đã bị Git theo dõi từ trước, vì `.gitignore` không tự bỏ một tệp đã được commit:

```powershell
git ls-files -- .online backups releases .env .env.local .env.cloud.local
```

Lệnh này cần không liệt kê dữ liệu/khóa riêng. Nếu có, dừng bước commit để xử lý đúng tệp đó trước. Không dán khóa, mật khẩu hay toàn bộ `.env.cloud.local` vào GitHub issue/chat. Repo **Private** vẫn cần giữ bí mật ngoài Git.

## 2. Tạo repo GitHub và đẩy mã nguồn

Trên [GitHub](https://github.com/new), tạo repo tên tùy chọn, ví dụ `bao-an-learning`, chọn **Private**. Không chọn thêm README, `.gitignore` hoặc license vì thư mục này đã có lịch sử Git. [GitHub: đưa repo có sẵn lên](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).

Quay lại PowerShell. Thay `TEN_GITHUB` và tên repo bằng thông tin thật ở dòng remote:

```powershell
git add --dry-run -A
git add -A
git diff --cached --stat
git diff --cached --name-only
git commit -m "Prepare Bao An Learning for Netlify and Supabase"
git remote add origin https://github.com/TEN_GITHUB/bao-an-learning.git
git remote -v
$baoAnBranch = git branch --show-current
git push -u origin $baoAnBranch
```

Trước dòng `git commit`, xem danh sách staged: không có `.online`, database, backup hay `.env.cloud.local`. Nếu Git báo `nothing to commit`, tiếp tục từ dòng remote. Nếu chưa có tên/email tác giả, Git sẽ hướng dẫn cấu hình `user.name`/`user.email`; dùng thông tin GitHub của bạn rồi chạy lại commit.

Hướng dẫn giữ tên nhánh hiện tại; khi viết tài liệu, nhánh là `feature/v37-premium-world`. Không cần đổi sang `main`. Nếu đã có remote `origin` đúng, bỏ dòng `git remote add`; nếu remote đang trỏ repo khác, kiểm tra trước khi đổi. Không dùng `--force` để xử lý lỗi push. Khi Git mở đăng nhập, dùng Git Credential Manager/trình duyệt hoặc phương thức token/SSH của GitHub; mật khẩu tài khoản không dùng cho Git HTTPS. [GitHub: xác thực Git](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github).

Mở repo trên GitHub và kiểm tra có `package.json`, `package-lock.json`, `src`, `server`, `netlify`, `supabase`, `netlify.toml`. Repo không cần `dist` hoặc `node_modules`.

## 3. Kết nối GitHub với Netlify

Trên Netlify, chọn **Add new project → Import an existing project → GitHub**, cấp quyền cho repo vừa tạo rồi chọn nó. Nếu repo Private không xuất hiện, chỉnh quyền GitHub App của Netlify để được đọc đúng repo. Chọn **Production branch** trùng nhánh đã push ở bước 2. [Netlify: deploy từ repo](https://docs.netlify.com/start/quickstarts/deploy-from-repository/).

Kiểm tra các giá trị được đọc từ `netlify.toml`:

| Mục | Giá trị |
|---|---|
| Base directory | Thư mục gốc repo; để trống |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |
| Node dùng để build | `22.22.2` |

Tạo/deploy dự án để lấy URL dạng `https://TEN-CUA-BAN.netlify.app`. Có thể đổi tên hoặc gắn domain riêng trước khi cấu hình origin. Ghi lại **URL HTTPS cuối cùng**. Ở lượt đầu chưa đặt Supabase, giao diện có thể báo máy chủ chưa cấu hình; đó là trạng thái dự kiến, chưa tạo dữ liệu lớp.

Phải deploy toàn bộ repo có Function. Kéo riêng thư mục `dist` lên chỉ có giao diện, thiếu API quản lý.

## 4. Thiết lập Supabase

Dự án của bạn **Học tập của Gôn tồ** (`fhkgqwdpbgnxjqquuxrs`) đã có schema `bao_an` và bucket `bao-an-media`, dữ liệu câu hỏi rỗng. Xem [báo cáo thiết lập](SUPABASE_DA_THIET_LAP.md). Dùng chính dự án này để lấy thông tin kết nối; không cần tạo dự án mới hoặc xóa các bảng. Các lệnh setup bên dưới có thể chạy lại để đối chiếu cấu hình.

Trong dự án đã thiết lập ở trên, lấy mật khẩu database từ nơi lưu riêng của bạn. Trong **Connect**, lấy URI **Transaction pooler**, thường cổng `6543`, thay phần `[YOUR-PASSWORD]` bằng mật khẩu database đã mã hóa URI nếu có ký tự đặc biệt. Đây là `SUPABASE_DB_URL`. [Supabase: kết nối PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres).

Lấy Project URL cho `SUPABASE_URL`; vào **Settings → API Keys** lấy khóa server `sb_secret_…` cho `SUPABASE_SECRET_KEY`. Nếu dự án chỉ có khóa cũ, có thể dùng `service_role` ở `SUPABASE_SERVICE_ROLE_KEY`. Không dùng `anon`/publishable cho cấu hình máy chủ này. [Supabase: API keys](https://supabase.com/docs/guides/getting-started/api-keys).

Trong PowerShell tại repo, chỉ sao mẫu khi tệp riêng chưa có:

```powershell
Copy-Item -LiteralPath .env.cloud.example -Destination .env.cloud.local
notepad .env.cloud.local
```

Điền những mục cần thiết trong `.env.cloud.local`: origin HTTPS vừa lấy, URL/URI Supabase, **một** khóa server, tên bucket và mã khởi tạo. Bỏ các giá trị mẫu trước khi lưu. Có thể tạo mã khởi tạo ngẫu nhiên trên máy bằng:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Lưu chuỗi đó riêng vào `BAO_AN_SETUP_TOKEN` để dùng khi tạo quản lý đầu tiên. Nếu cần URI riêng để chạy migration, điền `SUPABASE_MIGRATION_DB_URL` bằng Direct/Session pooler của cùng dự án; cấu hình tùy chọn này không đưa lên Netlify. Chi tiết về TLS/CA và biến nằm trong [bảng cấu hình Supabase](NETLIFY_SUPABASE.md#biến-cấu-hình).

Sau khi lưu cấu hình:

```powershell
npm run cloud:setup
npm run cloud:check
```

Chỉ tiếp tục khi hai lệnh thành công. Setup tạo schema riêng `bao_an` cùng bảng/quyền và bucket **private** `bao-an-media` (hoặc tên đã chọn); không tạo câu hỏi hay tài khoản mẫu. Không thêm `bao_an` vào Exposed schemas, không chuyển bucket thành Public và không tạo tài khoản trong Supabase Auth. Ứng dụng tự quản lý tài khoản admin/học sinh. Nếu cần SQL Editor, xem [các tệp và cách chạy](NETLIFY_SUPABASE.md#thiết-lập-và-kiểm-tra).

## 5. Đặt biến Netlify và deploy lại

Vào **Project configuration → Environment variables**. Thêm từng biến sau cho **Production**. Chọn scope **Functions** nếu gói cho chọn; nếu không, giữ **All scopes**. Không chọn riêng scope tên **Runtime**. Không thêm tiền tố `VITE_` vào các khóa này. [Netlify: biến Functions](https://docs.netlify.com/build/functions/environment-variables/).

Scope và lựa chọn **Contains secret values** là hai mục riêng. Đánh dấu secret cho `SUPABASE_DB_URL` (chứa mật khẩu), `SUPABASE_SECRET_KEY` hoặc `SUPABASE_SERVICE_ROLE_KEY`, và `BAO_AN_SETUP_TOKEN`. Địa chỉ `SUPABASE_URL`, origin website và tên bucket là cấu hình không cần đánh dấu secret. Nếu đã đánh dấu URL là secret, vẫn có thể giữ biến đó; lưu giá trị thật trực tiếp trong Netlify, ngoài tài liệu/mã nguồn. Netlify không cho gỡ secret flag sau khi tạo. [Netlify: quản lý secret](https://docs.netlify.com/build/environment-variables/secrets-controller/).

| Tên biến | Nội dung điền |
|---|---|
| `BAO_AN_PUBLIC_ORIGIN` | URL HTTPS cuối cùng của Netlify/domain, không có dấu `/` cuối |
| `BAO_AN_SETUP_TOKEN` | Cùng mã ngẫu nhiên bạn đã lưu ở bước 4 |
| `SUPABASE_DB_URL` | URI Transaction pooler có mật khẩu database |
| `SUPABASE_URL` | Origin đúng dự án Supabase |
| `SUPABASE_SECRET_KEY` | Khóa server; hoặc dùng `SUPABASE_SERVICE_ROLE_KEY` thay thế |
| `BAO_AN_MEDIA_BUCKET` | Tên bucket đã thiết lập, mặc định `bao-an-media` |
| `SUPABASE_DB_CA` | Chỉ thêm khi cấu hình kết nối cần CA riêng |

Thêm `AWS_LAMBDA_JS_RUNTIME` giá trị `nodejs22.x` trong UI, scope **All scopes** nếu có. Biến này chọn phiên bản Node chạy Function và không đặt trong `netlify.toml`. [Netlify: Node runtime](https://docs.netlify.com/build/functions/configuration/#nodejs-version-for-runtime).

Không đưa các biến migration lên Netlify. Không cấp bộ khóa Production cho Deploy Preview/branch thử nghiệm; nếu cần thử online, dùng Supabase riêng và origin riêng cho bản thử.

Vào **Deploys → Trigger deploy → Deploy project** để biến mới có hiệu lực. Chờ deploy thành công và kiểm tra có Function `online`. Thay đổi environment variables cần một deploy mới, không chỉ tải lại trang. [Netlify: cập nhật biến](https://docs.netlify.com/build/environment-variables/get-started/).

## 6. Kiểm tra bản đang chạy

Mở `https://TEN-CUA-BAN.netlify.app/api/online/status`. Trước khi tạo quản lý, kết quả cần tương tự:

```json
{"available":true,"configured":false,"mediaMaxBytes":2097152}
```

Sau đó vào trang chính, nhập mã khởi tạo và tạo tài khoản quản lý của bạn. Không có tên đăng nhập/mật khẩu mặc định. Câu hỏi ban đầu phải bằng **0**. Sau khi tạo quản lý thành công, có thể xóa `BAO_AN_SETUP_TOKEN` trên Netlify rồi deploy lại; tài khoản đã tạo vẫn đăng nhập được.

Kiểm tra trước khi giao lớp thật:

1. Quản lý tạo một lớp và một tài khoản học sinh; học sinh chưa được giao bài phải thấy trạng thái chờ câu hỏi.
2. Tải mẫu Word/Excel trong giao diện, nhập bộ câu hỏi tuần do bạn soạn, tải hình/âm thanh thật rồi xem trước câu hỏi/đáp án trước khi giao lớp.
3. Đăng nhập học sinh bằng cửa sổ riêng hoặc trình duyệt khác, làm bài, kiểm tra sao và lịch sử ở tài khoản quản lý.
4. Thử đúng và sai, thử nộp lại; sao không tăng lặp với cùng thành tích. Nếu dùng đổi thưởng, thử yêu cầu và quản lý duyệt.
5. Đăng xuất: tài khoản chưa đăng nhập không được đọc câu hỏi hoặc tệp tư liệu riêng. Học sinh chỉ thấy nội dung lớp mình.
6. Deploy lại một lần, đăng nhập lại và kiểm tra lớp/câu hỏi/tiến độ còn nguyên. Dữ liệu phải nằm ở Supabase, không phụ thuộc ổ tạm của Netlify.

Cloud nhận Word/Excel tối đa **1 MB**, mỗi ảnh/âm thanh tối đa **2 MB**, tổng tư liệu mỗi đơn vị tối đa **256 MB** ở bản này. Chia hoặc nén tệp nghe lớn trước khi tải. Sao lưu database và Storage trước khi dùng cho lớp thật; xem [hướng dẫn sao lưu](NETLIFY_SUPABASE.md#sao-lưu-và-cập-nhật).

## 7. Đưa bản cập nhật lên sau này

Sửa/kiểm tra mã tại máy, chạy các kiểm tra ở bước 1 rồi:

```powershell
git status --short
git add --dry-run -A
git add -A
git diff --cached --stat
git diff --cached --name-only
git commit -m "Update Bao An Learning"
$baoAnBranch = git branch --show-current
git push origin $baoAnBranch
```

Xem danh sách staged trước khi commit để giữ khóa/dữ liệu ngoài Git. Push vào production branch đã kết nối sẽ kích hoạt Netlify build/deploy tự động. Không cần xóa database, bucket hoặc lớp học khi cập nhật giao diện. [Netlify: Git workflow](https://docs.netlify.com/build/git-workflows/overview/).

Nếu bản cập nhật có migration mới, sao lưu Supabase rồi chạy `cloud:setup`/`cloud:check` trước theo hướng dẫn bản cập nhật. Sau deploy lặp lại kiểm tra status, đăng nhập, làm một bài và kiểm tra ảnh/âm thanh. Nếu gặp lỗi, dùng [bảng xử lý lỗi](NETLIFY_SUPABASE.md#xử-lý-lỗi-thường-gặp); không gửi khóa hoặc URI có mật khẩu khi nhờ hỗ trợ.
