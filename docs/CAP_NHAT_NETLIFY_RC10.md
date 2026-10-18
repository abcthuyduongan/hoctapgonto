# Cập nhật RC10 qua GitHub

RC10 sửa ba lỗi kiểm toán: lộ đáp án/thiếu bảo vệ bài nghe ở API; đổi nghĩa câu nhưng giữ sao cũ; tràn trang nhập với tên file dài và cỡ chữ lớn. Bổ sung gợi ý được máy chủ ghi nhận, kiểm tra giao thức UI/API, mã hỗ trợ lỗi và phiên bản runtime. Giữ các chức năng RC9 về sao từng câu, khóa tuần, 3–4 môn, null, đổi mật khẩu và nhập Excel/tư liệu chung.

Chưa tự commit, push hoặc deploy. Mã hiện ở nhánh `feature/v37-premium-world`, dựa trên `ab202e9`. Gói nguồn RC10 trong releases chỉ là các tệp thay đổi để cập nhật vào repo này; không phải bản sao đầy đủ của Git history hay cơ sở dữ liệu.

## Đưa mã lên GitHub

Chạy PowerShell trong dự án sau khi xem `git diff --stat` và báo cáo RC10:

```powershell
cd 'D:\Phần mềm 2026\BAO_AN_LEARNING_lam lại'
git status --short
git branch --show-current
git add package.json package-lock.json README.md netlify.toml playwright.online.config.ts
git add src server tests docs netlify/functions/online.mjs
git add public/question-templates/online-week.xlsx public/question-templates/bo-mau-day-du.xlsx public/question-templates/bo-mau-day-du.zip
git add tools/create_online_full_sample.mjs tools/online-template-build/build.mjs tools/package_release.mjs tools/release-files/HUONG_DAN_SU_DUNG.html tools/benchmark_weekly_load.mjs tools/offlineBuild.mjs tools/thirdPartyNotices.mjs tools/release-audit-2026-10-17
git add public/question-templates/online-week.docx tools/online-template-build/create-docx.py
git diff --cached --stat
git commit -m "Secure question scoring, preserve question identity and finish RC10 release checks"
git push origin feature/v37-premium-world
```

Các tệp Word đã có từ trước chỉ giữ tương thích/kiểm thử cũ, không thêm mẫu Word mới. Không dùng `git add .`: thư mục `outputs/`, mẫu rời người dùng giải nén `public/question-templates/bo-mau-day-du/`, bí mật, dữ liệu thật, test-results và releases không thuộc lần commit này. Không dùng force push.

Netlify cần build `npm run build`, publish `dist`, Functions `netlify/functions`, Node 22.22.2+. Dependency máy chủ music-metadata đã có trong package-lock và external_node_modules. Không đưa khóa Supabase vào biến VITE_ hay mã trình duyệt. Cài dependency theo lockfile (`npm ci`) khi kiểm lại từ clone sạch.

Đối chiếu Production branch trong Netlify. Nếu nhánh chính khác `feature/v37-premium-world`, tạo PR/hợp nhất vào đúng nhánh đã liên kết trước khi website chính đổi bản. Lệnh push nhánh làm việc không tự chứng minh website chính đã cập nhật. UI và Function phải cùng commit; tránh chỉ tải dist lên trong khi Function vẫn cũ.

## Kiểm sau Published

Làm trên staging riêng trước, với tài khoản thử. Tải lại tab/ứng dụng đã cài để nhận giao diện mới; phiên bản cũ sẽ được yêu cầu tải lại khi gọi API chơi cũ.

```powershell
$site = 'https://TEN-SITE-STAGING.netlify.app'
Invoke-RestMethod "$site/api/online/status" | Select-Object available,configured,runtimeVersion,questionProtocolVersion
(Invoke-WebRequest "$site/sw.js").Content | Select-String 'const BUILD_ID='
```

runtimeVersion phải `3.8.0-rc.10`, questionProtocolVersion phải 1. Gói cục bộ có BUILD_ID `572c8a1ac555136f`; đối chiếu thêm artifact và commit của chính lượt build Netlify nếu môi trường checkout/line ending tạo hash khác. Dùng URL site thử thực tế thay chỗ trống; không chạy kiểm thử ghi dữ liệu vào website thật chỉ từ ví dụ lệnh này.

Tải backup trước cập nhật. Khôi phục bản sao RC10 bằng RC10 trở lên; không hạ xuống RC9 dù SQL schema vẫn 1. Xem [phạm vi, staging và vận hành](PHAM_VI_VA_VAN_HANH_RC10.md) và [phiếu nghiệm thu RC10](NGHIEM_THU_CUC_BO_RC10.md). Snapshot PostgreSQL phải đi cùng Storage, không dùng backup SQLite thay cho backup cloud.

Chỉ chuyển sang phát hành rộng sau khi hoàn tất kiểm cloud, thiết bị/giọng đọc thật, giáo viên/học sinh dùng thử, cảnh báo và diễn tập khôi phục/rollback. Trạng thái gói vẫn `pilot:true`, `releaseReady:false`, `humanPilotStatus:UNVERIFIED` cho tới khi có bằng chứng nghiệm thu.
