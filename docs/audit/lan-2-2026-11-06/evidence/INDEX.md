# Bằng chứng lần 2 — 06/11/2026

Baseline 4.0.1 source ID `5d9b56a43e18706af1f541af5ef12477c679a8d2fa0c0b1e667f45f1b48261a8`. Dữ liệu và tài khoản thử là tổng hợp; PostgreSQL API sử dụng cloud adapter/PGlite trong máy thử. Website chỉ đọc endpoint công khai. Không có thao tác ghi dữ liệu production.

## Tổng hợp và nguồn yêu cầu

- [summary.json](summary.json): điểm, cổng kiểm tra và giới hạn.
- [baseline.json](baseline.json), [changes-since-prior.json](changes-since-prior.json): nguồn mới và 23 tệp đổi từ lần 1.
- [source-integrity.json](source-integrity.json): 445 tệp so sánh, 0 đổi; runtime identity giữ nguyên sau đánh giá.
- [prompt-source.txt](prompt-source.txt): tệp prompt được chủ dự án yêu cầu áp dụng.
- [report-provided.md](report-provided.md): bản báo cáo triển khai được đưa vào đối chiếu; các tuyên bố trong đó không tự là kết quả kiểm toán.
- [architecture-current.json](architecture-current.json): inventory 155 tệp mã/CSS và bundle/gzip cục bộ.
- [release-identity.json](release-identity.json), [public-website.json](public-website.json): dist mới, ZIP cũ và website khác build.

## Kiểm tra chuẩn

| Tệp | Kết quả / ý nghĩa |
| --- | --- |
| [typecheck.txt](typecheck.txt) | Exit 0 |
| [npm-test.txt](npm-test.txt) | Exit 0, tổng 350 ca: release 12, online 263, cloud 47, map 26, curriculum 1, pilot simulation 1 |
| [build.txt](build.txt) | Production build exit 0 |
| [assets.txt](assets.txt) | 113 tệp/5,08 MiB, PASS theo ngưỡng 8 MiB hiện hành |
| [browser-summary.json](browser-summary.json) | 182 ca cấu hình; 152 đạt, 24 lỗi, 2 skip thiếu tệp, 4 blocked serial; JSON gốc gộp 6 thành skipped |
| [browser-failures.json](browser-failures.json) | Tệp/dòng/project và thông báo của 24 ca thất bại; nhiều lỗi dừng ở locator/kỳ vọng cũ |

Report và trace gốc vẫn ở `test-results/audit-lan-2-2026-11-06/browser-report.json`, `browser-output/` trên máy chạy. Gói này giữ kết quả rút gọn đủ danh sách và lỗi, không mang toàn bộ trace/browser artifacts lớn.

## Kiểm tra độc lập: lỗi và đường đã sửa

**Phải đọc loại ca:** assert xác nhận hành vi lỗi PASS không phải sản phẩm PASS. `CONTROL`/`FIX_VERIFIED_FOR_TESTED_PATH` chỉ xác nhận đường sửa đã được thử, không chứng nhận toàn bộ tính năng.

- [independent-recheck.json](independent-recheck.json), [log](independent-recheck.txt): 14 assert, gồm 11 tái hiện lỗi và 3 control. Bao gồm DTO lộ đáp án, autosave sửa cùng câu, quyền review, PIN, lookup ID có dấu chấm, migration, restore và snapshot/media.
- [leak-endpoint-detail.json](leak-endpoint-detail.json), [log](leak-endpoint-detail.txt): xác định chính xác lỗi lộ ở reopen `POST /play/compact` trên hai backend; `/student/summary` không lộ map trong mẫu.
- [contest-timeout-reproduction.json](contest-timeout-reproduction.json), [log timeout](ui-timeout.txt): đường timeout cũ đã giữ đáp án và điểm trong fixture.
- [contest-autosave-reproduction.json](contest-autosave-reproduction.json), [log autosave](ui-autosave.txt): hai câu khác nhau được giữ; không thay cho kiểm tra sửa cùng câu trong independent-recheck.
- [preview-focus-reproduction.json](preview-focus-reproduction.json), [log preview](preview-focus.txt): preview giữ sau handler focus.
- [shuffle-client-reproduction.json](shuffle-client-reproduction.json), [log](shuffle-client.txt): MathQuest gửi ID, stale ID bị 409; lần làm lại vẫn chỉ một request mở câu.
- [contest-review-reproduction.json](contest-review-reproduction.json): review trả quiz và mở learning dialog; quyền B/A được thử riêng.
- [ui-accessibility-observation.json](ui-accessibility-observation.json): map/town đủ dữ liệu ở 390×844, axe mặc định không có violations trong mẫu.
- [staging-runner-false-success.json](staging-runner-false-success.json), [log](staging-runner-false-success.txt): 21 HTTP lỗi cố ý vẫn báo 0 lỗi; đây là false-positive reproduction, không phải đo tốc độ/tải thật.

Ảnh hiện tại ở `images/`: timeout, autosave, preview trước/sau, stale client, review đã mở, map và town, cùng các ảnh admin/student/game của lab. Tất cả dùng tài khoản tổng hợp. Một số là full-page, không coi chiều cao ảnh là kích thước viewport.

## Hiệu năng

- [performance-summary.json](performance-summary.json): ba mẫu theo profile và kịch bản.
- [performance/browser-lab.json](performance/browser-lab.json), [log](browser-lab.txt): 54 mẫu, conditions, resources/bytes/timing, Event Timing/long tasks/DOM/vùng chạm; không có lỗi harness.
- [admin-scale-benchmark.json](admin-scale-benchmark.json), [log](admin-scale-benchmark.txt): SQLite in-memory 23 lớp/1.000 học sinh/32.000 awards, không phải Supabase.
- [CSS desktop](performance/desktop-local-1-css-coverage.json), [CSS mobile](performance/mobile-limited-4g-1-css-coverage.json): coverage theo chuỗi đã chạy, không cho phép xóa toàn bộ phần chưa dùng.
- [Axe admin desktop](performance/desktop-local-admin-axe.json), [admin mobile](performance/mobile-limited-4g-admin-axe.json): còn 6 node contrast ở mỗi mẫu.

Đọc [báo cáo hiệu năng](../04_HIEU_NANG_VA_TRUY_XUAT_DU_LIEU.md) trước khi dùng số liệu: localhost/CDP không phải mạng vật lý/Supabase, median ba mẫu không phải SLA/p95, Event Timing max không phải INP field.

## Chạy lại các chương trình

Nguồn ở `source/` giữ đường import theo vị trí chạy ban đầu. **Chép về `test-results/audit-lan-2-2026-11-06/` đúng tên rồi chạy từ gốc repository**, không chạy trực tiếp trong evidence/source vì độ sâu khác. Cần Node/dependency/browser theo dự án và dữ liệu thử; code không sử dụng DB production.

```powershell
node --experimental-strip-types --test test-results/audit-lan-2-2026-11-06/independent-recheck.test.mjs
node --experimental-strip-types test-results/audit-lan-2-2026-11-06/ui-repro.mjs timeout
node --experimental-strip-types test-results/audit-lan-2-2026-11-06/ui-repro.mjs autosave
node --experimental-strip-types test-results/audit-lan-2-2026-11-06/preview-focus-repro.mjs
node --experimental-strip-types test-results/audit-lan-2-2026-11-06/shuffle-client-repro.mjs
node --experimental-strip-types test-results/audit-lan-2-2026-11-06/staging-runner-false-success.mjs
node --experimental-strip-types test-results/audit-lan-2-2026-11-06/admin-scale-benchmark.mjs
node --experimental-strip-types test-results/audit-lan-2-2026-11-06/browser-lab.mjs
```

Browser lab chạy riêng sau suite nặng. Timeout component dùng đồng hồ rút ngắn và adapter thử để kiểm tra logic; không dùng thời gian của reproduction làm benchmark. Chạy sau sửa có thể làm assert tái hiện lỗi thất bại; cần thêm ca an toàn vào tests chuẩn để đóng lỗi, không chỉ lấy số assert fail làm chứng nhận.

`HANDOFF_MANIFEST.json` tại thư mục cha ghi byte/SHA-256 các tệp bàn giao, trừ chính manifest. Mẫu R201–R232 là đặc tả sau sửa, hiện `CHUA_CHAY`; không phải trạng thái của các reproduction baseline.
