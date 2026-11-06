# Bằng chứng kiểm toán 06/11/2026

Các dữ liệu này được lấy từ mã 4.0.1/source ID `59d67c93a8c3dd8839db1091c8760329f8d11c63984761ee5fe8342833bdff77`. DB và tài khoản trong phép thử là dữ liệu tổng hợp. Không ghi hoặc sửa dữ liệu production; website chỉ đọc hai endpoint trạng thái công khai.

## 1. Tổng hợp và tính nguyên vẹn

- [summary.json](summary.json): điểm, điều kiện kiểm tra, exit code và giới hạn.
- [baseline.json](baseline.json): fingerprint ban đầu, danh sách hash tệp tracked; HEAD cũ có thay đổi chưa commit nên phải dùng source ID để nhận diện bản kiểm tra.
- [source-integrity.json](source-integrity.json): **440 tệp tracked được so sánh, 0 tệp thay đổi; runtime source ID không đổi** sau kiểm toán. Tài liệu/bằng chứng mới không phải sửa mã sản phẩm.
- [prompt-source.txt](prompt-source.txt): bản tệp yêu cầu do chủ dự án cung cấp; phần TKB không áp dụng được phân loại trong báo cáo.
- [public-website.json](public-website.json): response và thời điểm đọc URL công khai, vẫn 3.9.0-rc.1; không phải đo tốc độ bản 4.0.1.

`HANDOFF_MANIFEST.json` ở thư mục cha ghi SHA-256 và kích thước mọi tệp bàn giao trừ chính manifest. Các log đầu tiên bị sandbox chặn được giữ trong `test-results/` tại máy chạy; gói này ưu tiên log lần chạy có quyền phù hợp để phân biệt lỗi môi trường và lỗi sản phẩm.

## 2. Kết quả kiểm tra chuẩn

| Bằng chứng | Nội dung và cách diễn giải |
| --- | --- |
| [typecheck.txt](typecheck.txt) | TypeScript exit 0 |
| [npm-test-approved.txt](npm-test-approved.txt) | Release 12 đạt; online 263 đạt; cloud 46 đạt/1 lỗi version kỳ vọng; npm test exit 1 |
| [map.txt](map.txt) | 26 đạt, chạy riêng vì npm test dừng trước nhóm này |
| [curriculum.txt](curriculum.txt) | 1 kiểm tra schema đạt, không xác nhận đủ 384 câu hoặc duyệt thật |
| [pilot-simulation.txt](pilot-simulation.txt) | 1 kiểm tra mô phỏng đạt, không phải người dùng thật |
| [build-approved.txt](build-approved.txt) | Build production đạt |
| [assets.txt](assets.txt) | 113 tệp, 5,08 MiB theo ngưỡng hiện tại 8 MiB |
| [browser-summary.json](browser-summary.json) | Đầy đủ 182 ca cấu hình: 180 đạt/2 bỏ qua, 0 chưa chạy và 0 lỗi; mỗi ca có tệp, dòng, project, trạng thái và thời gian |

Report Playwright gốc và log đầy đủ ở `test-results/audit-2026-11-06/browser-report.json`, `browser.log` trên máy chạy. Gói lưu bản rút gọn đủ danh sách ca để tránh mang theo toàn bộ stdout/traces không cần thiết.

## 3. Tái hiện lỗi độc lập

**PASS/assertion thành công trong các reproduction có nghĩa lỗi hiện tại tái hiện được, không phải sản phẩm đạt nghiệm thu.** Các ca dùng fault injection hoặc điều khiển timing để xác minh tính đúng; không dùng thời gian này làm benchmark.

| Bằng chứng | Điều đã xác nhận |
| --- | --- |
| [security-reproductions-401.json](security-reproductions-401.json), [log](security-reproductions-401.txt) | PIN khóa bị bỏ qua qua setup; SQL đổi dù restore lỗi; restore/preview báo tốt sai; migration bị ngắt; backup không snapshot |
| [shuffle-history-reproduction.json](shuffle-history-reproduction.json) | Lịch sử chống lặp quên sau 5 play hoặc cache instance cũ; adapter/review schema thi thử chưa phù hợp |
| [contest-timeout-reproduction.json](contest-timeout-reproduction.json) | Đáp án đúng đã lưu bị timeout gửi object rỗng và chấm 0 |
| [contest-autosave-reproduction.json](contest-autosave-reproduction.json) | Request cũ tới sau làm mất đáp án mới |
| [shuffle-client-reproduction.json](shuffle-client-reproduction.json) | UI không gửi presentationId và stale UI chọn nội dung đúng bị chấm sai |
| [contest-review-reproduction.json](contest-review-reproduction.json) | Ôn sai gọi API thành công nhưng không tạo/mở phiên học |
| [preview-focus-reproduction.json](preview-focus-reproduction.json) | Handler focus làm preview đang có biến mất, chưa publish |
| [ui-accessibility-observation.json](ui-accessibility-observation.json) | Axe đầy đủ trên map/town đã render ở 390×844; contrast/name/ARIA/scroll issues |
| [a11y-scope-reproduction.json](a11y-scope-reproduction.json) | Fixture a11y hiện hành không có map/grid thật, quét Suspense fallback nên rỗng |
| [staging-runner-false-success.json](staging-runner-false-success.json) | 21 HTTP lỗi cố ý vẫn được runner báo 0 lỗi; không phải chạy tải thật |

Nguồn chương trình nằm trong `source/`, giữ nguyên byte. Chúng dùng đường import tương đối theo vị trí chạy ban đầu. Muốn chạy lại, **chép về `test-results/audit-2026-11-06/` với đúng tên rồi chạy từ gốc repository**, trên đúng mã/phụ thuộc/browser của baseline. Không chạy trực tiếp từ `evidence/source/` vì mức thư mục khác. Chạy sau sửa có thể làm assert xác nhận lỗi thất bại; đó không tự chứng minh tất cả tiêu chí an toàn đã đạt, cần test hồi quy mới.

```powershell
node --experimental-strip-types --test test-results/audit-2026-11-06/security-reproductions-401.test.mjs
node --experimental-strip-types --test test-results/audit-2026-11-06/shuffle-history-reproduction.test.mjs
node --experimental-strip-types test-results/audit-2026-11-06/ui-repro.mjs timeout
node --experimental-strip-types test-results/audit-2026-11-06/ui-repro.mjs autosave
node --experimental-strip-types test-results/audit-2026-11-06/preview-focus-repro.mjs
node --experimental-strip-types test-results/audit-2026-11-06/shuffle-client-repro.mjs
node --experimental-strip-types test-results/audit-2026-11-06/a11y-scope-repro.mjs
node --experimental-strip-types test-results/audit-2026-11-06/staging-runner-false-success.mjs
```

## 4. Đo hiệu năng

- [performance-summary.json](performance-summary.json): bảng ba mẫu theo profile/kịch bản, điều kiện và giới hạn.
- [performance/browser-lab.json](performance/browser-lab.json): 54 mẫu có Performance Timing, resource waterfall/bytes, DOM, target nhỏ, Event Timing và long task.
- [browser-lab.txt](browser-lab.txt): log từng mốc; harness hoàn tất exit 0, không có exception/pageerror được thu thập.
- [admin-scale-benchmark.json](admin-scale-benchmark.json): SQLite data-access, 23 lớp/1.000 học sinh/32.000 awards; **không phải đo Supabase**.
- [architecture-metrics.json](architecture-metrics.json): inventory module/bundle, thống kê đường evidence thiếu và browser report nhóm con trước kiểm toán.
- [Desktop CSS coverage](performance/desktop-local-1-css-coverage.json), [mobile CSS coverage](performance/mobile-limited-4g-1-css-coverage.json): chỉ trong chuỗi màn được chạy, không chứng minh toàn bộ CSS chưa dùng là xóa được.
- [Axe quản trị desktop](performance/desktop-local-admin-axe.json), [axe quản trị mobile](performance/mobile-limited-4g-admin-axe.json): bổ sung quét theo fixture quy mô, không thay zoom/thiết bị thật.

Chương trình browser lab và benchmark cũng ở `source/`. Điều kiện máy/profile, cách lấy FCP/LCP/CLS, giới hạn INP và phân biệt byte cache/nén nằm trong [báo cáo 04](../04_HIEU_NANG_VA_TRUY_XUAT_DU_LIEU.md). Chạy lab riêng sau khi suite nặng dừng; không so hai lần chạy khác profile như hiệu quả tối ưu.

## 5. Ảnh quan sát

| Ảnh | Nội dung |
| --- | --- |
| [Mobile bản đồ](images/student-home-mobile.png) | Dữ liệu thử, bản đồ và các control hiện tại |
| [Mobile thị trấn](images/town-mobile.png) | Grid/nút/vùng cuộn trong fixture có nội dung |
| [A11y quét loading](images/a11y-empty-fixture-town.png) | Bài hiện hành chưa tới nội dung thật |
| [Timeout kết quả](images/contest-timeout-result.png) | Kết quả sau ca mất đáp án khi hết giờ |
| [Autosave đảo thứ tự](images/contest-autosave-reordered.png) | UI đã chọn hai câu trong khi DB có thể bị bản cũ ghi đè |
| [Stale câu](images/shuffle-stale-client.png) | Nội dung đúng ở UI cũ bị chấm sai sau hoán vị mới |
| [Ôn sai về map](images/contest-review-returns-map.png) | Không có phiên ôn được mở |
| [Preview trước](images/preview-before-focus.png), [sau focus](images/preview-after-focus.png) | Bản nháp biến mất khi refresh nền |
| [Admin desktop quy mô](images/desktop-local-admin.png) | 23 lớp/1.000 hồ sơ thử, trang 20 học sinh |
| [Auth mobile lab](images/mobile-limited-4g-auth.png) | Viewport 390×844 |
| [Admin mobile lab](images/mobile-limited-4g-admin.png) | Form và danh sách ở profile mobile |
| [Student mobile lab](images/mobile-limited-4g-student.png) | Bản đồ/hành trình với bộ thử hiệu năng |
| [Game mobile lab](images/mobile-limited-4g-game.png) | Game có lựa chọn/ACK trong phép đo |

Ảnh là browser viewport giả lập, một số ảnh full-page dài hơn viewport; không coi chiều cao ảnh là kích thước màn hình hay chứng nhận đã dùng bằng một tay trên thiết bị thật.
