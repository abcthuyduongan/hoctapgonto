# Lệnh kiểm tra, bằng chứng và cách phát hành

Ngày: **05/11/2026**. Các lệnh npm hiện hữu đã được đối chiếu với package.json; các script/test mới được đánh dấu đề xuất.

## 1. Chuẩn bị và cô lập dữ liệu

- Node hiện yêu cầu **>=22.22.2**; dùng phiên bản tương thích được chốt trong repo.
- Kiểm node --version và npm --version. Chạy npm ci khi dependencies thiếu hoặc lockfile thay đổi và môi trường cho phép truy cập registry.
- Chrome và Microsoft Edge phải có cho cấu hình hiện tại. Đừng đổi sang Chromium rồi ghi đã kiểm Edge.
- Các spec hiện có tự mở HTTP server và SQLite/PG fixture. Không cần mở máy chủ dùng dữ liệu thật trước khi chạy test.
- Không trỏ test tới .online, data của bản đang dùng hoặc Supabase production.
- Nếu localhost bị sandbox chặn EACCES/EPERM, ghi lỗi môi trường và dùng cơ chế cấp quyền của môi trường đó nếu được phép. Không bỏ assert hoặc nới auth để chạy được.
- PostgreSQL fixture là PGlite; test:cloud không tự có nghĩa là đã kiểm Supabase thật.

## 2. Những script hiện có

Các lệnh chạy ở thư mục dự án, theo thứ tự:

    npm run typecheck
    npm test
    npm run build
    npm run test:assets
    npm run test:online:browser

Có thể dùng cổng gộp **npm run verify:local** sau khi môi trường và test mới đã được đăng ký.

npm test hiện gồm syntax, release, online và cloud fixture. Nó chưa tự tìm mọi test mới trong tests; người triển khai phải đăng ký các test map.

Cấu hình Playwright:
- playwright.online.config.ts.
- Test dir tests/visual, chỉ match online hoặc online-<chữ>.spec.ts.
- Một worker, không retry để che lỗi, default hai project online-chrome và online-msedge.
- BAO_AN_BROWSER_CHANNEL giới hạn một channel nếu có. Lần nghiệm thu cuối cần kiểm biến này; không ghi hai browser nếu chỉ chạy một.
- Build dist phải được tạo sau lần sửa runtime cuối. Không chạy screenshot bản dist cũ rồi coi là UI mới.

## 3. Script mới cần thêm khi có đủ test

**Đề xuất test:map:**

    node --experimental-strip-types --test tests/world-map-assets.test.mjs tests/world-map-domain.test.mjs tests/world-map-store.test.mjs tests/world-map-api.test.mjs tests/world-map-performance.test.mjs

Đăng ký lệnh này trong package.json; nối test:map vào npm test hoặc cổng verify:local để nó không bị quên. Phương án ưu tiên trong gói này là **npm test gọi test:map**.

Các spec mới:
- tests/visual/online-worldmap.spec.ts.
- tests/visual/online-regionmap.spec.ts.
- tests/visual/online-mapflow.spec.ts.
- tests/visual/online-mapperformance.spec.ts.

Tên spec có thêm nhiều dấu gạch nối như online-world-map.spec.ts sẽ không match regex hiện có. Đừng đặt tên ngoài pattern mà tưởng full suite đã chạy.

Kiểm danh sách trước:

    npx playwright test --config=playwright.online.config.ts --list

Lệnh tập trung trong lúc làm map:

    npx playwright test --config=playwright.online.config.ts tests/visual/online-worldmap.spec.ts tests/visual/online-regionmap.spec.ts tests/visual/online-mapflow.spec.ts tests/visual/online-mapperformance.spec.ts --project=online-chrome

Lệnh tập trung chỉ cho Chrome không thay cổng Chrome + Edge cuối.

## 4. Ghi báo cáo trình duyệt bằng PowerShell

Sau khi tạo thư mục log phù hợp, ví dụ test-results/map-upgrade/final:

    $env:PLAYWRIGHT_JSON_OUTPUT_FILE='test-results/map-upgrade/final/browser-report.json'
    npx playwright test --config=playwright.online.config.ts --output=test-results/map-upgrade/final/browser-output --reporter=list,json

Phải đọc exit code, số passed/failed/skipped và project thực sự chạy. Cổng cuối không lấy retries làm thành công mà bỏ qua flaky; điều tra ca flaky và lưu trace.

Lệnh có thể chạy lâu. Giữ thông báo tiến độ vừa đủ; tránh gọi lặp vô hạn khi chưa hiểu lỗi.

## 5. Script hỗ trợ kèm bộ bàn giao

**RUN_CHECKS.ps1** có hai chế độ:
- Baseline: các script hiện có.
- Final: đòi test:map đã đăng ký trong npm test, không giới hạn BAO_AN_BROWSER_CHANNEL một browser và không dùng BAO_AN_STATIC_ROOT trỏ sang build khác.

Ví dụ Windows PowerShell, thay đường dẫn bằng nơi đặt repo:

    pwsh -NoProfile -File docs/BAN_GIAO_NANG_CAP_2026-11-05/RUN_CHECKS.ps1 -ProjectRoot "D:\DuAn\BaoAn" -Mode Baseline
    pwsh -NoProfile -File docs/BAN_GIAO_NANG_CAP_2026-11-05/RUN_CHECKS.ps1 -ProjectRoot "D:\DuAn\BaoAn" -Mode Final

Script chỉ chạy kiểm tra local/fixture và ghi log dưới test-results/map-upgrade. Không tự npm ci, đổi version, chạy migration, đóng gói, push hoặc deploy. Phải review/cập nhật nó nếu cấu hình repo đổi.

Trong đợt lập kế hoạch, script được kiểm cú pháp; **không chạy các suite ứng dụng bằng script này**.

## 6. Lộ trình chạy theo thay đổi

| Loại thay đổi | Kiểm tập trung trước | Cổng trước bàn giao |
| --- | --- | --- |
| Pure region/chapter adapter | domain + summary/journey test liên quan | npm test + build + browser |
| Map API/store | contract hai backend, API auth/leak/readonly + latency count | npm test + build + full browser |
| Layout/ảnh | manifest/asset + map UI, responsive, keyboard, lỗi ảnh | build + assets + full browser |
| Game host/state | studentflow, imageclock, questionclock, rounds, games, mapflow | npm test + build + full browser |
| Admin/import/export | import, management, weekplan, export unit + map invalidation | npm test + build + full browser |
| Build/package | build identity, release-package, asset audit + extract/run pilot | verify:local + package/smoke |

Không viết test chỉ để xác nhận className hoặc công thức vừa chép từ implementation. Kiểm hành vi: đúng bộ/version, đúng quyền, đúng số sao, giữ lựa chọn, không rò dữ liệu, có thao tác bằng bàn phím.

## 7. Dữ liệu và bằng chứng phải lưu

Tạo thư mục test-results/map-upgrade/<đợt-hoặc-sourceId> để chứa:
- metadata môi trường/version/build; sourceId và commit/working-tree snapshot.
- từng lệnh, exit code, duration và stdout/stderr.
- Playwright JSON, screenshot và trace lỗi.
- JSON kết quả 80 ca, dùng CASE_RESULTS_TEMPLATE.json.
- số bytes asset, payload UTF-8, query counts, danh sách request và điều kiện đo PF.
- hash ZIP/source/local artifact khi có.

Không đưa log có token, cookie, mật khẩu hoặc dữ liệu thật của trẻ vào repo/gói công khai.

Ảnh QA nên có:
- world + một region ở 320,390,768,1024,1440.
- phone landscape với bottom sheet mở.
- current/closed/locked/empty/error và label dài.
- năm trò, ít nhất một câu ảnh và một câu nghe/đọc dài.
- wallet, đăng nhập và quản trị sau khi đổi UI.
Ảnh không thay cho kiểm quyền/sao hoặc biên nhận lưu.

## 8. Mẫu báo cáo từng ca

- Case ID:
- Tệp test hoặc cách kiểm thủ công:
- Môi trường/build/sourceId:
- Fixture/seed:
- Bước đã chạy:
- Expected:
- Actual:
- Status: CHUA_CHAY / DAT / LOI / BI_CHAN / KHONG_AP_DUNG.
- Evidence: đường dẫn log/ảnh/trace.
- Lỗi liên quan và ảnh hưởng:
- Người/thời điểm kiểm:

KHONG_AP_DUNG cần lý do và phạm vi không có trong bản phát hành. Không dùng nó cho ảnh chưa nhận, không có browser, chưa có môi trường cloud hay chưa có người thử; những trường hợp đó là BI_CHAN/CHUA_CHAY.

## 9. Báo cáo kết thúc mỗi cổng

    Cổng / đầu việc:
    Bản nguồn:
    Đã thay đổi:
    Tệp:
    Case ID đã kiểm + kết quả:
    Lệnh và exit code:
    Ảnh/trace/log:
    Dữ liệu được giữ:
    Còn thiếu / bị chặn:
    Đầu việc kế tiếp:

Không báo “mọi thứ đều pass” nếu chỉ chạy 16/22 test đã có trước. Không nhận 80 ca đặc tả là 80 test đã tự động hóa.

## 10. Đóng gói và rollout

Sau cổng local đạt:
1. Chốt version mới phù hợp; cập nhật theo cơ chế hiện hữu.
2. Build cuối và đối chiếu build-info, /status, data-source-id ở root.
3. Chạy npm run package:pilot và npm run package:source.
4. Nếu đích cùng version đã có nội dung khác, giữ gói cũ; dùng version mới, không xóa để vượt điều kiện.
5. Giải nén gói ở thư mục tạm, dùng dữ liệu test, kiểm launcher và đường ảnh/API.
6. Kiểm danh sách trong ZIP và hash, không chỉ việc file ZIP tồn tại.
7. Ghi trạng thái pilot và humanPilotStatus đúng bằng chứng. Công cụ hiện giữ releaseReady=false/UNVERIFIED; không đổi các cờ chỉ để làm báo cáo đẹp.
8. Staging/production theo quyền và phạm vi đã được chủ dự án giao; lưu URL/build và kết quả smoke nếu thực hiện.

Nếu chưa deploy: báo **đã nâng cấp mã local**, không nói website đã được cập nhật.

Quay lại presentation cũ dùng cờ/gói build được đối chiếu, giữ cùng DB/protocol/source IDs. Vì thiết kế map không cần migration, không dùng khôi phục DB để chỉ đổi giao diện.
