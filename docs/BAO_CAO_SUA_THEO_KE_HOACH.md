# Báo cáo sửa và nâng cấp theo kế hoạch

Ngày bắt đầu: 14/10/2026. Yêu cầu: thực hiện kế hoạch Bảo An tự học lớp 3 và prompt sửa theo task; cập nhật một báo cáo duy nhất này. Working tree đã có thay đổi của người dùng trước khi bắt đầu; không reset hoặc ghi đè các thay đổi đó.

## Trạng thái chung

**NOT READY FOR FINAL LOCK.** Chỉ ghi PASS khi có kết quả kiểm tra. Mỗi task được sửa/kiểm chứng trước khi chuyển tới task kế tiếp; công việc đọc và chuẩn bị được phân công song song. Phạm vi nâng cấp lộ trình/sao/schema v4 đã được người dùng xác nhận thực hiện theo kế hoạch ngày 14/10/2026.

| Task | Status | Phạm vi / điều kiện còn lại |
|---|---|---|
| BA-01 | PASS | Typecheck/build; 7/7 Edge production cho stacking/mobile/focus |
| BA-02 | PASS | Typecheck/build; 12/12 Edge gồm BA-01 và chọn đủ 5 game qua DOM |
| BA-03 | PASS | Typecheck/build; 4/4 Edge hai tab, reload và không có Web Locks |
| BA-04 | PASS | Backup v2 năm store, v1 đọc được; 24 unit + 17 browser cases đạt; mở rộng tám store trong BA-08 |
| BA-05 | PASS | Đủ tài nguyên build, thoát lỗi chunk và cập nhật an toàn; 3/3 Edge |
| BA-06 | PASS | Đáp án/ID/mục tiêu/giới hạn được kiểm chứng; 4/4 Edge |
| BA-07 | PASS | 191 unit; 107 Edge + 21 Chrome production; CI được cấu hình |
| BA-08 | PASS | DB v4, validator/progress/backup tám store; 20/20 Edge mới |
| BA-09 | PASS | Event/review nguyên tử, retry/tuple/ngày Việt Nam; 8/8 Edge |
| BA-10 | PASS | Writer chấm/chốt/sao/resume; 31/31 Edge và 220 unit |
| BA-11 | PASS | Tự học/reader/1→2→3 sao; 25/25 Edge gồm offline/mobile |
| BA-12 | PASS | Runner ba môn/remediation/exposure legacy; 24/24 Edge + 225 unit |
| BA-13 | PASS | Sáu bài ×38 =228 mục; 26 learning unit +18 Edge |
| BA-14 | PASS | Ôn luyện/parent/settings/manual unlock; 25/25 Edge +5 xác minh interval |
| BA-15 | PASS | Format 2/nhập số/điền/đọc/nghe; 237 unit +22/22 Edge |
| BA-16 | PASS | Ba tuyến/prerequisite/timer/score/checklist; 11 unit +19/19 Edge cùng parent/backup/ví |
| BA-17 | PARTIAL | Gia đình chọn Windows; Edge tự động đã đạt, còn Bảo An dùng thử hai bài/môn |
| BA-18 | PARTIAL | Gói Windows/ZIP/server/hash và mở thử gói thật đã đạt; nghiệm thu cuối chờ BA17 |
| BA-19 | PASS | 48 mẫu thật + tệp thử lỗi; import/version/catalog/worker và 15/15 Edge đạt |
| BA-20 | PASS | Ví đổi sao theo tỷ lệ phụ huynh, số dư/giữ chỗ/lịch sử; 7 unit +5/5 Edge |

## BA-01 — Header, responsive và focus dialog

- **Status:** PASS.
- **Problem:** header che nút thoát game; menu 390 px chồng vùng chạm; dialog cho focus ra nền.
- **Root cause:** header z-index 100 cao hơn overlay 95; CSS desktop ghi đè breakpoint; nền chưa inert và chưa trap focus.
- **Baseline/evidence:** kết quả audit đã tái hiện bằng hit test; source trước sửa vẫn đúng root cause trên. Header z100, overlay z95; hai menu đầu tại 390 px không nhận hit tại tâm.
- **Files changed:** `src/App.tsx`, `src/styles/professional-design-system.css`, `src/screens/ProfileModal.tsx`, `tests/visual/b0-ui.spec.ts`, `playwright.v37.config.ts` (chọn test mới).
- **Fix:** thang lớp header/dialog, bố cục mobile có vùng chạm riêng; inert nền và giữ focus trong game/mini/profile; khôi phục focus; khóa đổi hồ sơ trong bài.
- **Verification:** `npm run typecheck`, `npm run build` đạt; `b0-ui.spec.ts` 7/7 Edge production đạt (15,6 giây).
- **Regression check:** chọn/chơi/thoát Math tại 1440/390/320 px; hit test menu 390/320 px; Tab/restore focus ở profile/mini; touch thoát Math 390 px đều đạt.
- **Remaining risk:** chưa xác nhận trên điện thoại thật; không coi emulation là nghiệm thu thiết bị.

## BA-02 — Chọn trò chơi qua DOM

- **Status:** PASS.
- **Problem / root cause:** nút chơi phụ thuộc lựa chọn từ canvas; khi canvas/WebGL lỗi hoặc dùng bàn phím, không chọn đủ trò chơi.
- **Files changed:** `StudentScreen.tsx`, `premium-world37.css`, `b0-ui.spec.ts`.
- **Fix:** năm nút chọn luôn hiện lấy từ registry, đồng bộ lựa chọn với carousel và một thẻ học liệu; giữ thao tác bắt đầu riêng. Bố cục dành chỗ cho nút ở 320 px.
- **Verification:** typecheck/build đạt; 12/12 Edge production (33,8 giây).
- **Regression check:** BA-01 7 test vẫn đạt; không có canvas context tại 1440/390/320 px, không có WebGL và carousel thật đều mở đủ năm game. Math ghi được một event vào IndexedDB.
- **Remaining risk:** thiết bị thật thuộc BA-17.

## BA-03 — Ownership phiên học

- **Status:** PASS.
- **Problem / root cause:** effect startup phụ thuộc `refresh`/hồ sơ và abandon tất cả phiên active, kể cả tab khác đang chơi.
- **Files / dependency:** App, contracts và session-manager mới; dựa trên BA-01 đã khóa đổi hồ sơ trong game.
- **Expected / PASS:** phiên đang giữ Web Lock không bị tab khác kết thúc; reload phiên free-practice cũ vẫn bảo toàn event; đổi hồ sơ không chạy lại cleanup; kiểm chứng bằng hai tab thật.
- **Fix:** khóa trình duyệt theo phiên, giữ tới khi kết thúc; marker ownership cho phiên mới; startup chỉ kết thúc phiên managed không còn khóa. Tách startup khỏi đổi hồ sơ và bỏ kết quả refresh cũ khi đổi nhanh. Giữ phiên không xác định ownership; không dùng timeout cho tab ẩn.
- **Verification:** typecheck/build đạt; 4/4 Edge production (11,7 giây).
- **Regression check:** A ghi câu đầu, B mở/đổi hồ sơ, A vẫn hoàn tất đủ 8 câu và giữ đúng hồ sơ; reload giữ event; phiên legacy và môi trường thiếu Web Locks không bị kết thúc ngoài ý muốn.
- **Remaining risk:** khi không có Web Locks, không tự dọn phiên dở. Adapter tiếp tục bài mới thuộc BA-08/12; không giả định game legacy có checkpoint.

## BA-04 — Backup đầy đủ

- **Status:** PASS cho nền DB v3; mở rộng DB v4 thuộc BA-08.
- **Problem / root cause:** validator không nhận profileId/hai module mới; backup đọc ba store, bỏ profiles/reviews.
- **Files / dependency:** backup-io, backup-storage, LearningProfileBackup, tests; BA-03 đã PASS. Ownership là dữ liệu vận hành, không chuyển trong backup.
- **Expected / PASS:** v2 xuất đủ năm store hiện tại và ba collection tương lai rỗng; đọc v1, đủ năm module; restore nguyên tử, không ghi đè và rollback lỗi/quota.
- **Fix:** backup v2 năm collection hiện tại + ba collection tương lai rỗng; validator từ chối dữ liệu tương lai không được hỗ trợ. Kiểm tra danh tính, thời gian, đồ thị session/event/review và đủ năm game; loại ownerTabId khi xuất/so trùng. Restore add-only năm store nguyên tử, kiểm tra lại xung đột trong transaction. Tạo hồ sơ mặc định dùng một timestamp duy nhất để nhận diện đúng hồ sơ chưa chỉnh.
- **Files changed:** `backup-io.ts`, `backup-storage.ts`, `LearningProfileBackup.tsx`, `storage.ts` (timestamp seed), `backup-io.test.mjs`, `backup-profile.spec.ts`.
- **Verification:** typecheck/build, 24/24 unit đạt; browser 16 case đạt lần đầu, case tải/khôi phục năm game đạt khi chạy lại sau sửa selector chữ đề bài (15,2 giây). Tổng đủ 17 case đã đạt, không bỏ test.
- **Regression check:** BA-01/02/03 16/16 browser vẫn đạt (42,9 giây). Khôi phục sang context mới giữ hồ sơ/review/history; nhập lại không tăng; xung đột ở năm collection, quota và lỗi muộn ở profiles/reviews đều rollback bytes nguyên trạng. Backup v1 và đồng hồ lùi đã thử.
- **Remaining risk:** chưa nhận result/progress mới cho tới BA-08; validator hiện từ chối phần đó rõ ràng.

## BA-05 — Ngoại tuyến và cập nhật bản dựng

- **Status:** PASS.
- **Problem / root cause:** SW chỉ cache bốn URL; chunk lazy chưa mở bị thiếu khi offline, không có ErrorBoundary; tên cache cố định làm HTML/models cũ và xóa cache ngoài ứng dụng.
- **Files / dependency:** `tools/offlineBuild.mjs`, `tools/offlineBuild.d.mts`, `vite.config.ts`, `public/sw.js`, `src/core/offline.ts`, `src/core/session-manager.ts`, `src/components/AsyncBoundary.tsx`, `src/main.tsx`, `src/App.tsx`, `src/screens/ParentScreen.tsx`, CSS và test offline; BA-04 PASS.
- **Expected / PASS:** precache đủ chunk/media của đúng build, readiness chỉ báo khi cache đủ; game chưa mở chạy offline; lỗi chunk có đường thoát; bản A→B chờ lúc an toàn, giữ dữ liệu và cache ngoài ứng dụng.
- **Fix:** worker sản xuất được sinh sau Vite, băm toàn bộ 60 tài nguyên để đặt cache theo build và nạp đủ chunk/media. Điều hướng ưu tiên mạng rồi fallback; asset ưu tiên cache bản hiện hành và chỉ dò cache cũ của ứng dụng khi cần. Cache ngoài ứng dụng và cache bản trước được giữ. Update chỉ kích hoạt khi không có phiên sống ở tab nào; người học chủ động bấm cập nhật. Error boundary cho root/game/mini/backup có đường về màn hình chính và tải lại. Trạng thái offline hiển thị độc lập với footer ẩn.
- **Verification:** `npm run typecheck`, `node --check tools/offlineBuild.mjs`, `npm run build` đạt; manifest worker có 60 URL và 14 JavaScript. Edge thật đã đăng ký controller, cache đủ 60 mục và mở Word Connect khi ngắt mạng. `b0-offline.spec.ts` 3/3 đạt: mở ngoại tuyến cả năm game, mini-app và backup; lỗi lazy chunk có thể thoát và hồi phục; cập nhật A→B chờ phiên ở tab khác kết thúc, giữ event/IndexedDB, model mới, chunk cũ và cache không thuộc ứng dụng.
- **Regression check:** BA-01/02/03 16/16 Edge đạt sau thay đổi; backup unit 24/24 vẫn đạt.
- **Remaining risk:** nghiệm thu điện thoại thật và gói cài đặt thuộc BA-17/18.

## BA-06 — Nhập Excel/CSV/JSON và trình soạn câu hỏi

- **Status:** PASS.
- **Problem / root cause:** đáp án thiếu/sai có thể rơi về phương án A; clone làm mất định danh/mục tiêu; parser XLSX đọc sai ô tự đóng, rich text và entity Unicode; append quá giới hạn bị cắt âm thầm. Chưa có trần an toàn cho file nén, XML, số dòng/cột.
- **Dependency:** BA-05 PASS. Không thay đổi schema tiến độ trước BA-08.
- **Expected / PASS:** dữ liệu không hợp lệ bị từ chối kèm lỗi hàng/cột; clone bảo toàn metadata và cấp ID mới đúng chỗ; không cắt dữ liệu âm thầm; giới hạn nén/giải nén/XML/sheet được thử; nhập hợp lệ vẫn chạy được trong UI.
- **Files changed:** `src/core/excel-import.ts`, `src/screens/CreatorScreen.tsx`, `tests/excel-import.test.mjs`, `tests/visual/b0-content.spec.ts`, `package.json`, `package-lock.json`, cấu hình Playwright.
- **Fix:** đáp án chỉ nhận A–D, 1–4 hoặc nội dung khớp duy nhất; hàng lỗi bị loại và báo đúng số dòng. Câu clone giữ ID/mục tiêu riêng; câu mới có UUID ổn định, chỉ đổi mục tiêu câu clone khi người soạn bấm thao tác rõ ràng. Append vượt 30 từ chối toàn lượt. XLSX/CSV được chặn ở 1 MB nén, 8 MB tổng khai báo giải nén, 2 MB/XML, 128 entry, 1000 hàng, 32 cột và 4000 ký tự/ô; đo cả output XML thực để chống metadata ZIP giả. Sửa ô tự đóng, rich text, entity Unicode và ngoặc kép CSV. Khai báo `fflate` là dependency trực tiếp.
- **Verification:** typecheck/build đạt; `test:features` 34/34; nhóm Excel + content import + validation 25/25. Edge production 4/4 đạt: CSV/TSV giữ đáp án B/C vào IndexedDB; dữ liệu sai không đổi draft/DB; clone cả ba kind giữ nguyên item ID/objective và v1; 29+2 bị từ chối nguyên lượt rồi xuất bản đúng 29 câu.
- **Regression check:** JSON v1 round-trip và validation hiện có vẫn đạt; build sản xuất 111 module hoàn tất.
- **Remaining risk:** tìm sheet theo workbook relationship, template XLSX nhiều sheet và xử lý có hủy thuộc BA-19; parser hiện chạy đồng bộ nhưng đầu vào đã bị chặn cứng.

## BA-07 — Đồng bộ fixtures và cổng kiểm thử

- **Status:** PASS.
- **Problem / root cause:** một assertion đọc chuỗi source của focus đã lỗi thời; `test:assets` trỏ tệp đã được lưu archive; nhiều fixture browser còn DB v1/ba store/ba đảo và thao tác chơi trước khi chọn bằng DOM. Fault injection chưa tách khỏi service worker.
- **Evidence:** core 43/44; features/content/backup/renderer đạt khi chạy đúng môi trường; asset gate hiện hành đạt năm GLB. Playwright phát hiện 94 test trong 11 file nhưng fixture cũ chưa đồng bộ.
- **Dependency / PASS:** BA-06 PASS. `npm test`, asset gate, typecheck/build và toàn bộ production browser regression phải đạt; suite service worker chạy riêng.
- **Files changed:** `tests/stability27.test.mjs`, các production specs `gameplay-regression`, `game-scene`, `island-carousel`, `mobile-ui-lock`, `premium-world`, `art-world`, `performance-world`, `real3d31`, `package.json`, `playwright.v37.config.ts`, `.github/workflows/verify.yml`.
- **Fix:** fixture chọn đúng pack qua năm nút DOM; đọc DB hiện tại và kiểm tra năm store; thêm migration v1 có dữ liệu, retry/lưu/reload đủ năm game. Kiểm tra focus/trap/restore đúng host hiện tại. Giữ assertion 44 px sau animation, biên độ nổi thực của đảo, texture/UV/resource của model; chỉ sửa các giả định đã tái hiện. Chặn SW trong regression và giữ suite offline riêng. CI chạy Node 24, lockfile, typecheck/unit/assets/build/Edge trên Windows.
- **Verification:** `npm test` 191/191 đạt (44 core + 34 features + 4 content + 24 backup + 85 renderer), syntax parsing đạt; asset gate đạt đủ năm model. Toàn bộ Edge production được chạy trên cùng build: 20 gameplay/data/scene + 47 world/mobile + 40 B0/backup = 107/107 đạt. Lượt Chrome bị ngắt phần trả output nhưng đã hoàn tất: `.last-run.json` ghi passed/không failed; cấu hình liệt kê 21 test. Typecheck/build vẫn đạt.
- **Regression check:** bài lỗi/chunk và update A→B chạy SW thật đạt, 320/390 px, bàn phím/touch, hai tab và backup rollback đều đạt. Không sửa mã sản phẩm trong BA-07.
- **Remaining risk:** workflow remote chưa chạy vì chưa đẩy mã lên GitHub; cổng lệnh tương ứng đã chạy cục bộ. Thiết bị/pilot thật thuộc BA-17.

## BA-08 — Catalog, policy, result/progress và DB v4

- **Status:** PASS (15/10/2026).
- **Problem / root cause:** DB v3 chỉ có năm store và history game; chưa lưu lộ trình/đề/policy ghim phiên bản, result bất biến hay progress theo scope. Xóa hồ sơ hiện chỉ xóa profile, để lại session/event/review; connection chưa đóng khi versionchange.
- **Evidence:** `storage.ts` DB_VERSION=3; `deleteProfile` dùng transaction profiles riêng; `contracts.ts` chỉ có PlaySession/ReviewCard legacy. Backup v2 từ chối ba collection tương lai khác rỗng.
- **Files / dependency:** contracts dữ liệu học mới, curriculum/progress validator, storage, backup và fixtures; BA-03/04/07 PASS. Giữ tên DB và đọc lịch sử cũ; migration v4 nằm trong kế hoạch đã được người dùng xác nhận.
- **Expected / PASS:** thêm đúng curricula/sessionResults/lessonProgress; DAG/ref/coverage/form độc lập hợp lệ; passed thuộc đủ revision/policy, rewardGroup chỉ gộp sao. Backup/restore tám store nguyên tử; kết quả add-only; xóa hồ sơ và dữ liệu liên quan nguyên tử nhưng giữ nội dung dùng chung, chặn hồ sơ cuối/phiên sống. Migration v1/v3 và versionchange được kiểm chứng; không suy sao từ lịch sử legacy.
- **Files changed:** `learning-contracts.ts`, `curriculum.ts`, `contracts.ts`, `storage.ts`, `App.tsx` (offline đọc mọi loại phiên), backup-io/storage/UI, unit curriculum/backup, hai spec BA08 và helper, fixture backup/gameplay, package test script và Playwright config.
- **Fix:** DB v4 giữ nguyên năm store cũ và thêm đúng ba store với index unique theo session cho result. Các phiên/event học mới tách khỏi SDK v1; enrollment giữ lịch sử phiên bản ghim. Validator kiểm DAG, reference, coverage, form khác nội dung, response do host chấm, receipt chính xác, nguồn luyện/đạt và mốc ôn ≥24h/khác ngày Việt Nam ngay khi mở ôn. Snapshot câu đã biết do host ghi tại lúc tạo phiên chống replay qua revision, đồng thời giữ bằng chứng độc lập ban đầu khi gộp hai nguồn backup. Progress tái dựng và tổng sao lấy max theo rewardGroup; không chuyển passed sang revision mới.
- **Data safety:** result add-only và progress suy ra trong cùng transaction; xóa profile/session/event/review/result/progress nguyên tử, không xóa packs/curricula dùng chung. Chặn hồ sơ cuối, phiên sống và tạo phiên từ hồ sơ đã xóa. Đóng connection khi versionchange, xử lý blocked không rò connection và từ chối DB mới hơn. Đồng hồ lùi không cho tạo lượt mới trước lịch sử. Backup tám store xác minh cả phiên dở; restore learning active thành paused giữ checkpoint/deadline. Chỉ thay hồ sơ mặc định khởi tạo chưa chỉnh, chưa có lịch sử, có thông báo preview và kiểm tra lại trong transaction.
- **Verification:** typecheck/build đạt (113 module); full `npm test` 216/216 đạt (44 core + 34 features + 4 content + 17 curriculum + 32 backup + 85 renderer). Edge mới 20/20 đạt trong một lượt: 16 storage + 4 backup với dữ liệu 1/2/3 sao và lỗi quota/constraint thật. Kiểm tra host ghi đè snapshot giả, revision riêng, rollback sáu/tám store, hai tab, default seed, gộp dữ liệu và không tăng sao khi nhập lại.
- **Regression check:** đủ 26 case backup/gameplay legacy đạt qua lượt 25/26 và chạy lại case snapshot đã sửa đếm tám store; 7/7 ownership/offline/update vẫn đạt trên build cuối. Legacy v1/v3 giữ bytes/history và không cấp sao tự động.
- **Remaining risk:** writer chốt phiên học/result, runner/resume và giao diện tự học chưa có, thuộc BA-09–12. Các sao ở BA-08 được chứng minh bằng fixture dữ liệu, chưa phải luồng Bảo An học trên UI.

## BA-09 — Lượt thử và lịch ôn nguyên tử

- **Status:** PASS.
- **Problem / root cause:** App ghi event rồi đọc/ghi review riêng và nuốt lỗi review; retry cùng eventId vẫn chạy SM2 thêm lần nữa; key profile:item va chạm giữa pack/version; sameAttempt chưa kiểm hồ sơ. Quality còn dùng ngưỡng 8 giây và lịch dùng ngày UTC.
- **Evidence / files:** `App.recordAttempt`, `storage.addEvent`, `sdk.sameAttempt`, `spacedRepetition` và các unit hiện tại xác nhận các đường trên.
- **Dependency / expected PASS:** BA-08 PASS. Event và review commit/rollback cùng giao dịch; retry nhận receipt cũ không đổi lịch; hai tab không mất cập nhật; key tuple có pack/version; ngày Việt Nam, tốc độ không hạ chất lượng. Game free/Memory chỉ là luyện, không tự làm tăng bằng chứng độc lập hay sao; lỗi lưu hiển thị và có thể thử lại.
- **Files changed:** `storage.ts`, `App.tsx`, `contracts.ts`, `sdk.ts`, `spacedRepetition.ts`, `backup-io.ts`, unit SDK/review/backup, `ba09-attempt.spec.ts`, cấu hình Playwright.
- **Fix:** lưu event/review cùng transaction năm store; so hồ sơ/phiên/bộ/câu/mục tiêu và trả receipt của record đã commit. Retry không ghi lại lịch. App dùng receipt, bỏ đường ghi review riêng và catch nuốt lỗi. Review mới dùng tuple hồ sơ/bộ/version/câu; giữ record legacy. Luyện không tăng SM2, tốc độ không hạ quality, ngày theo Việt Nam, event đến trễ không làm lùi lịch. Bằng chứng độc lập được giữ qua luyện và backup kiểm đúng nguồn completed/result.
- **Verification:** typecheck/build đạt; full `npm test` 220/220 đạt. BA09 Edge 8/8 đạt, gồm hai tab, sai metadata, lịch sử thiếu review, tuple/colon, quota/constraint rollback và UI báo lỗi–retry một logical submission.
- **Regression check:** 26/26 Edge backup/năm game đạt sau thay đổi; backup unit 33/33 bao gồm marker độc lập và lỗi nguồn.
- **Remaining risk:** lịch độc lập chỉ được cập nhật khi finalizer BA10 chứng minh result; runner/UI ôn thuộc BA11–14.

## BA-10 — Chốt kết quả và sao nguyên tử

- **Status:** PASS.
- **Problem / root cause:** có validator/result store nhưng chưa có host ghi response/checkpoint/chốt result–progress–session trong một giao dịch; callback complete game legacy chỉ đổi status. Chưa có writer để nhận 1/2/3 sao thực qua luồng bài học.
- **Evidence / files:** `storage.createLearningSession` chỉ tạo phiên; `saveSessionResult` nhận result đã có evidence từ fixture; chưa có submit/finalize/resume API. Phụ thuộc BA08/09 PASS.
- **Expected / PASS:** host chấm response, receipt/event/checkpoint nguyên tử; chốt đủ coverage rồi ghi result bất biến/progress/lịch ôn và kết thúc phiên cùng commit. Retry/double click/mất receipt/hai tab/quota không tạo thưởng lặp; giữ owner khi lỗi, resume ghim form/order/seed/deadline; hint kiến thức chuyển sang luyện và không cấp độc lập.
- **Files changed:** `learning-runtime.ts`, learning-contracts/curriculum/storage, session-manager, App startup recovery, `ba10-finalizer.spec.ts`, helper và fixtures BA08.
- **Fix:** host lưu từng bước đọc theo thứ tự và tự chấm câu trả lời; các giao dịch ghi event/checkpoint/review và result/progress/session/review chỉ trả receipt sau commit. Gợi ý chuyển mode vĩnh viễn, kiểm tra độc lập chỉ nhận lần đầu, thiếu coverage không chốt. Tổng thưởng dùng mức sao cao nhất theo rewardGroup. Pause/resume giữ dữ liệu đã ghim; reload chỉ pause phiên không còn browser lock, giữ phiên sống ở tab khác.
- **Verification:** typecheck/build đạt (114 module); full `npm test` 220/220 đạt. Gate Edge 31/31 đạt: 11 finalizer + 16 storage + 4 ownership; gồm luồng thật 1→2→3 sao, ôn quá sớm bị chặn, hai tab chốt cùng lúc chỉ thưởng một lần, rollback lỗi/quota ở cả bốn điểm ghi, retry, hint, resume và orphan recovery.
- **Remaining risk:** chưa có UI cho trẻ dùng writer này; thuộc BA11/12.

## BA-11 — Trang tự học ba môn và LessonReader

- **Status:** PASS.
- **Problem / root cause:** trang học sinh chỉ có game 3D; sao đang tính `completed*3`, không dựa trên bằng chứng bài học. Chưa có DOM chọn môn/chủ đề/bài, thẻ đọc, học tiếp hay trạng thái đã vượt/đến hạn ôn riêng.
- **Evidence / files:** `App.tsx` chỉ ba page; `StudentScreen.tsx` tính sao từ lượt game. Phụ thuộc BA08/10 đã PASS.
- **Expected / PASS:** ba môn lớp 3, bước tiếp theo rõ ràng; đọc/luyện/chấm trên storage thật; 1/2/3 sao chỉ sau commit, unlock ở 2 sao; reload tiếp tục đúng bài, hồ sơ riêng, ngày ôn cập nhật khi quay lại; 320/390 px và bàn phím dùng được. Bộ nội dung kỹ thuật ban đầu không thay thế gate sáu bài/228 mục BA13.
- **Files changed:** App/StudentScreen, `LearningScreen.tsx`, `LessonScreen.tsx`, `lesson-host.ts`, `lesson-seed.ts`, storage initializer/enrollment, learning CSS, unit và spec BA11, các fixture game chuyển sang đường dẫn công khai `?view=games`, offline helper và menu mobile.
- **Fix:** trang chủ Tự học ba môn với Học tiếp/Ôn hôm nay, các bước đọc và luyện lưu thật; khóa đổi hồ sơ/điều hướng khi học, pause/resume qua browser lock. Sao từ progress theo rewardGroup thay cho `completed*3`; trạng thái đã vượt và đến hạn ôn tách riêng. Bộ kiểm tra/ôn không xuất hiện ở game luyện để giữ kín câu hỏi. Lộ trình và câu khởi đầu cài nguyên tử, ghim enrollment khi bắt đầu; không tự chuyển revision đã học. Bốn lát cắt kỹ thuật ×23 mục có trong bản này, chưa thay gate BA13.
- **Verification:** typecheck/build đạt (119 module); full unit 223/223 đạt. BA11 mới 6/6 Edge đạt gồm UI thật nhận 1→2→3, sửa sai nhưng giữ điểm lượt đầu, unlock ở 2, ôn sau 24 giờ, pause/reload/hai tab, hint và hồ sơ riêng. Gate cuối 25/25 Edge đạt trên build cuối: BA11 + 12 UI + 4 ownership + 3 offline; học ngắn và pause trong khi ngắt mạng đạt. 11/11 finalizer vẫn đạt trong lượt regression trước đó.
- **Regression:** cập nhật fixture menu từ ba nút một hàng thành bốn nút hai hàng, vẫn kiểm tâm nhận pointer, 44 px và mọi cặp không chồng; không bỏ assertion. Chờ chuyển thẻ và giả lập đồng hồ trước khi tải trang đã sửa trong script BA11 sau khi tái hiện race.
- **Remaining risk:** runner hiện dùng choice; remediation, nội dung đầy đủ, báo cáo phụ huynh và mẫu nhập thuộc BA12–19. Thiết bị/Bảo An thật chưa thử.

## BA-12 — AssessmentRunner và sửa câu sai

- **Status:** PASS.
- **Problem / root cause:** runner choice đang nằm trong reader; kết quả chưa cho con xem câu sai và luyện lại đúng bộ đã chữa. Gate chưa kiểm 79.x%, hết form, lỗi lưu/retry qua UI của ba môn. Core exposure hiện đọc kết quả/phiên bài học, chưa mang bằng chứng câu đã làm trong history game legacy vào snapshot.
- **Evidence / dependency:** BA10/11 PASS; `LessonScreen.tsx` và result panel chỉ hiện số đúng; `captureExposureSources` chỉ lấy learning sessions/results.
- **Expected / PASS:** runner chung giữ kín lời giải trong lượt độc lập, một câu chỉ có lựa chọn đầu; chốt thật rồi mới hiện sửa lỗi; luyện đã chữa không biến thành đạt độc lập. 79.x% không làm tròn đạt; gợi ý chuyển mode, hết form có đường luyện; retry/lost receipt/reload giữ evidence; game cũ đã lộ câu cũng không được dùng lại làm đề độc lập mới.
- **Files changed:** `AssessmentRunner.tsx`, LessonScreen/LearningScreen, learning-contracts/curriculum/storage/backup-io, `assessment.test.mjs`, `ba12-assessment.spec.ts`, helper tự học và Playwright.
- **Fix:** runner choice chung cho ba môn, storage giữ quyền chấm và commit; sau commit hiển thị đúng các câu sai lượt đầu và mở lượt luyện có hướng dẫn bằng form đã chữa. Result cũ bất biến, form đã chữa không dùng lại làm đề độc lập. Snapshot thêm nguồn event game legacy tùy chọn, kiểm đồ thị nguồn/hồ sơ/thời gian, backup vẫn đọc snapshot cũ. Cập nhật giờ cùng dữ liệu mỗi lần refresh để trạng thái hết form đổi ngay sau chốt.
- **Verification:** typecheck/build đạt (120 module); full unit 225/225 đạt, gồm 159/200 = 79,5% chưa đạt và 160/200 đạt, nguồn legacy/backup. Gate cuối 24/24 Edge đạt: 8 BA12 + 16 storage. Ba môn đều có 3/5 chưa đạt → luyện chữa → form mới đạt; quota ở answer/result không cấp sao trước commit, retry giữ logical key; reload sau commit giữ đúng lượt đầu; hết hai form vẫn luyện; writer thật chặn form đã lộ trong game cũ.
- **Regression:** lượt trước 28/29 Edge đạt (BA08 backup 4, finalizer 11, tự học 6, BA12 7); test hết form tìm ra mốc giờ UI cũ và đã sửa, không giảm assertion. Backup tám store/isolated exposure và các luồng 1→2→3 vẫn đạt. Remaining: audio/numeric/passage cấu trúc thuộc BA15; nghiệm thu người học thật thuộc BA17.

## BA-13 — Sáu bài và bộ câu pilot

- **Status:** PASS cho nội dung và luồng kỹ thuật; pilot cùng trẻ vẫn thuộc BA17.
- **Problem / root cause:** bản kỹ thuật mới bốn bài ×23 mục, thiếu bài đọc ngắn Tiếng Việt và câu giới thiệu Tiếng Anh; mỗi bài chỉ hai form kiểm tra/một form ôn. Chưa đủ gate sáu bài ×38 =228 mục.
- **Evidence / dependency:** seed/validator unit BA11, BA12 PASS.
- **Expected / PASS:** hai bài mỗi môn, mỗi bài 8 luyện +4×5 kiểm tra +2×5 ôn, đáp án/ngôn ngữ/coverage/form được rà; thử cả sáu, hết pool và backup. Nội dung tự biên soạn, bản nguồn catalog riêng. Phát hành snapshot mới, giữ nguyên bytes bản kỹ thuật đã xuất bản và enrollment cũ; không tự chuyển passed sang revision mới. Passage ngắn ban đầu dùng choice; cấu trúc passage/media mở rộng thuộc BA15.
- **Files changed:** source `src/content/grade3-pilot-v2.json`, nguồn biên soạn/generator `tools/build_grade3_pilot.mjs`, lesson-starter/lesson-seed, LearningScreen, unit pilot-content và spec BA13; fixture hết pool BA12 đọc số form thật thay cho hằng hai.
- **Fix:** sáu bài, 228 mục, 42 pack và ba curriculum revision 2. Giữ nguyên 16 pack/các form/bước đã xuất bản của revision 1, thêm form và hai bài đọc hiểu/giới thiệu. Hồ sơ mới dùng bản mới; enrollment cũ vẫn ghim bản cũ, không suy passed từ nhóm sao. Catalog là tệp JSON riêng để phát hành và mở rộng. Ngữ liệu tự biên soạn; mỗi form đọc hiểu phủ ai/khi nào/ở đâu/làm gì/vì sao, tắt đọc đề khi đánh giá đọc độc lập.
- **Verification:** typecheck/build đạt (122 module); learning suite 26/26 đạt, gồm mọi ref/đáp án/nhiễu, phép tính và bài toán có lời văn tính lại độc lập, thông tin đúng trong đoạn đọc, bytes bản cũ và pin. Edge cuối 18/18 đạt: bốn BA13 +6 tự học +8 assessment. Cả hai bài từng môn chạy đọc→luyện→kiểm tra và mở khóa thật; tải backup đủ sáu snapshot/four results, parser xác minh progress; cài bản mới giữ đúng checkpoint/bytes/enrollment cũ. Hết bốn form kiểm tra vẫn có đường luyện.
- **Remaining:** ngữ liệu khởi đầu chung, chưa đối chiếu bộ sách riêng của Bảo An qua pilot. Passage hiện gộp ngữ liệu ngắn vào prompt, BA15 thêm cấu trúc passage tái dùng. Chưa có xác nhận trẻ/thiết bị thật.

## BA-14 — Ôn tập và phụ huynh

- **Status:** PASS.
- **Problem / root cause:** ParentScreen chỉ đọc session/event game v1; chưa thấy result bài học, sao, kết quả độc lập, mục tiêu cần luyện hay lịch ôn. Ôn hôm nay ở trang trẻ chỉ đếm bài đủ điều kiện sao thứ ba, chưa có đường tới các câu đến hạn ôn luyện. Mở bài thủ công và bộ sách/hỗ trợ tiếp cận chưa có UI.
- **Evidence / dependency:** BA08–13 PASS; ParentScreen/calculateReport và LearningScreen hiện hành xác nhận các đường trên.
- **Expected / PASS:** dữ liệu theo đúng hồ sơ, trạng thái đạt không mất khi ôn đến hạn; phân biệt tỷ lệ lượt luyện với điểm tự làm; lịch ngày Việt Nam, câu cũ ôn có hướng dẫn không tự tăng sao độc lập; phụ huynh mở bài có lý do nhưng không cấp sao/pass, settings và enrollment giữ lịch sử qua reload/backup. Kiểm mobile/clock/two-profile và giao dịch lỗi thích hợp.
- **Files changed:** ParentLearningPanel/ParentScreen, LearningScreen/LessonScreen, App, storage configure/grant, CSS, helper snapshot tám store và spec BA14/offline.
- **Fix:** báo cáo bài học theo hồ sơ, sao/đạt/đến hạn và kết quả lượt đầu riêng với luyện game; lịch sử guided/independent có nhãn đúng. Danh sách câu đến hạn mở lại form có hướng dẫn hoặc game legacy đúng bộ. Không tự vượt prerequisite từ lịch ôn, không cấp sao vì mở bài. Mở thủ công cần lý do, ghi trong enrollment; settings lấy profile mới nhất trong giao dịch, giữ lịch sử/pin. Chữ lớn/đọc hướng dẫn/giảm chuyển động áp dụng cho hồ sơ; đọc đề vẫn theo blueprint. Phụ huynh có thể chủ động đăng ký snapshot mới, không chuyển passed tự động.
- **Verification:** typecheck/build đạt (123 module). Gate 25/25 Edge đạt: 5 BA14 +17 backup +3 offline; settings/manual unlock/reload/backup, quota rollback, hồ sơ thứ hai ở 390 px, legacy review không có sao, đúng điểm 4/5 và ngày đến hạn trong bảng phụ huynh. Lượt bổ sung 5/5 BA14 đạt, đọc trực tiếp đủ tám store và xác minh repetitions/interval/ease/nguồn độc lập giữ nguyên khi ôn có hướng dẫn đúng form đã chấm.
- **Remaining:** xác thực phụ huynh phía máy chủ không nằm trong mô hình một thiết bị; không dùng mở thủ công làm chứng nhận học/thi. Pilot với Bảo An và điện thoại thật vẫn chưa có.

## BA-15 — Dạng nhập số, điền từ, đoạn đọc và âm thanh

- **Status:** PASS.
- **Problem / root cause:** ContentPack v1 chỉ ba kind; scorer/backup chỉ biết choice/pair/sentence. Đọc hiểu pilot gộp đoạn văn vào prompt; chưa có numeric/fill/reading/audio catalog và playback được ghim/hash. TTS trợ đọc không thể làm bằng chứng bài nghe ổn định.
- **Evidence / dependency:** contracts/content-io/validation/curriculum/backup, runner; BA08–14 PASS. Máy có voice tiếng Anh Microsoft Zira Desktop, đã kiểm kê chỉ đọc.
- **Expected / PASS:** format 2 bổ sung, vẫn đọc v1 và không rewrite lịch sử/pack đã xuất bản; host chấm số/từ theo policy xác định, giữ dấu tiếng Việt; passage/audio có ref/catalog, hash/transcript/nguồn, audio thật có sẵn offline và chặn chấm nếu thiếu. Đề độc lập không tái dùng ngữ liệu/clip đã lộ. UI luyện được các dạng, retry/resume/backup và offline có kiểm chứng. Không đổi phiên bản DB; nếu cần thêm form hoặc cấu trúc cho nội dung đã xuất bản, tạo snapshot mới và giữ pin cũ.
- **Files changed:** contracts/learning-contracts, `rich-content.ts`, scorer/curriculum/runtime/storage/backup/content-io; `audio-assets.ts`, LessonAudio/AssessmentRunner/LessonScreen/LearningScreen, CSS; catalog revision 3/generator, 10 WAV và script tạo; unit rich-content và spec BA15, regression helpers.
- **Fix:** content format 2 nhận numeric/fill/reading-choice/listening-choice/listening-gap, v1 vẫn đọc và xuất nguyên dạng. Số so sánh chuỗi thập phân chính xác, nhận dấu phẩy/chấm; từ theo NFC/case policy, giữ dấu. Passage có ref/nguồn; clip có catalog/hash/transcript và playback receipt nguyên tử, không nhận claim nghe từ caller lúc tạo phiên. Tải cùng origin có giới hạn stream 2 MB, cache tối đa 16 clip, chỉ phát blob đã đúng hash; marker trước câu trả lời và giữ qua checkpoint. Ngữ liệu/utterance đã dùng không thành độc lập do đổi ID, hash, chữ hoa hay dấu câu. Nội dung mới ở revision 3 (50 pack/268 mục, gồm 40 mục mở rộng), giữ nguyên revision 1/2 và pin cũ. Cho chọn hoạt động luyện khác khi clip lỗi, vẫn giữ phiên dở.
- **Verification:** typecheck/build đạt (127 module); full unit 237/237 đạt. Gate cuối 22/22 Edge đạt: 8 BA15 +6 tự học +4 sáu bài/pin +4 backup. WAV thật phát tới ended trước khi đáp án mở; nghe chọn 4/5 nhận sao 2, nghe điền lưu năm receipt và backup đọc lại; 320 px passage; hash sai không ghi event và có thể đổi sang luyện từ; worker thật cache đủ 10 clip và nghe được khi ngắt mạng. Assertion thứ tự getAll đã sửa để tìm event theo response/sequence thay vì UUID; không giảm điều kiện giữ dấu hay điểm lượt đầu.
- **Remaining:** chất lượng nghe thực tế với Bảo An/thiết bị thật vẫn cần BA17; các clip là giọng tổng hợp tiếng Anh ổn định từ nội dung tự biên soạn. Trình soạn mẫu đầy đủ/import bổ sung thuộc BA19.

## BA-16 — Ba tuyến luyện thi và theo dõi ngoài ứng dụng

- **Status:** PASS.
- **Problem / root cause:** chưa có tuyến Violympic/IOE/Trạng Nguyên, preset ghim, lượt tổng hợp có deadline/score/skip và checklist phụ huynh. Mode contest-mock đã có trong contract nhưng writer hiện yêu cầu đủ câu để chốt, chưa ghi riêng bỏ qua/hết giờ.
- **Evidence / dependency:** BA08–15 PASS; core runtime và App chỉ học/game/parent/creator. Đã đọc lại nguồn chính thức IOE và Trạng Nguyên ngày 15/10/2026; trang Violympic hiện lỗi khi mở toàn văn.
- **Expected / PASS:** ba tuyến theo kỹ năng và prerequisite, nội dung tự biên soạn; điểm/thời gian thi thử tách sao. Deadline giữ qua reload/ẩn tab/pause, hết giờ ghi unanswered/skip riêng và chốt nguyên tử, không reset giờ. Preset có version/nguồn/năm/lớp; thông số chưa xác minh đầy đủ chỉ mang nhãn luyện tổng hợp. Checklist trên cổng là phụ huynh xác nhận có timestamp/nguồn, không giả xác minh tài khoản hay kết quả thi chính thức.
- **Files changed / fix:** catalog/runtime contest mới, contracts/curriculum/storage/backup, ContestScreen và runner/timer, App/nav, parent history/progress filter và test. Preset nội bộ ghim 10 câu/mốc giờ/điểm; hai bài nền đúng revision phải đạt trước khi mở. Writer giữ deadline, chặn câu sau hạn/gợi ý/lần trả lời thứ hai, phân biệt skip/chưa làm và chốt điểm nguyên tử với sao bằng 0. Checklist lưu từng mục có nguồn/thời gian; hiển thị đang lưu và rollback khi lỗi.
- **Verification:** typecheck/build đạt; 11/11 unit contest. Gate đầu 14/15 Edge phát hiện checkbox đổi trạng thái chậm trong lúc chờ commit; đã sửa UI pending có trạng thái lưu. Gate sau 19/19 Edge đạt, gồm đủ sáu BA16, năm parent, bốn backup và bốn ví. Ba môn đều học hai bài nền thật rồi mở lượt tổng hợp; Toán nộp sớm/skip, Tiếng Việt đủ 300, Anh nghe clip thật đủ 100; pause/reload hết giờ giữ hạn gốc và 10 câu chưa làm; rollback/hai tab/double finalize không sinh sao.
- **Remaining risk:** chưa xác minh toàn bộ định dạng thi chính thức, nên tất cả preset mang nhãn luyện tổng hợp. Dùng thử thật thuộc BA17.

## BA-17 — Thử dùng cùng Bảo An trên Windows

- **Status:** PARTIAL.
- **Problem / evidence:** chưa có kết quả quan sát Bảo An tự dùng đủ hai bài/môn. Gia đình đã chọn máy tính Windows ngày 15/10/2026; kiểm thử Edge trên máy Windows hiện tại xác minh thao tác và dữ liệu, chưa thay cho đánh giá của bé.
- **Dependency / expected PASS:** BA13–16 đã PASS. Bảo An thử sáu bài, đọc/nghe/nhập dấu, tiếp tục bài, nhận sao và cùng phụ huynh thử đổi thưởng; ghi chỗ cần người lớn giải thích, nội dung chưa vừa sức và sự cố. Đối chiếu thêm bộ sách đang học.
- **Preparation / files:** phiếu thử sáu bài trong `tools/release-files/HUONG_DAN_SU_DUNG.html`, bản pilot Windows được chuẩn bị ở BA18. Không tạo hồ sơ/kết quả học giả để đánh dấu hoàn tất.
- **Remaining:** gia đình dùng thử và gửi kết quả; chưa có xác nhận đó trong hội thoại.

## BA-18 — Gói pilot Windows, server và đường khôi phục

- **Status:** PARTIAL (phần kỹ thuật và đóng gói đã đạt; nghiệm thu cuối chờ BA17).
- **Problem / root cause:** có dist/PWA nhưng chưa có gói mở trên Windows, hướng dẫn thao tác, manifest tệp/hash và cách trở lại bản trước. Nhãn phiên bản package/backup/title trước đó chưa thống nhất.
- **Files / fix:** `tools/serve_release.mjs`, `tools/package_release.mjs`, CMD và hướng dẫn HTML, app-version/package/backup, manifest/icons. Server Node độc lập phục vụ đúng thư mục app qua localhost cố định 4173; MIME cho audio/GLB/XLSX, giới hạn điều hướng HTML và chặn traversal. ZIP snapshot dist + SHA-256, build ID, schema DB4; không ghi đè gói khác. Đồng bộ `3.8.0-pilot.1`; gói luôn ghi pilot/chưa nghiệm thu người dùng.
- **Verification:** typecheck, asset gate năm GLB và build 141 module đạt; dependency tree hợp lệ; `npm audit` cả production/dev và `npm audit --omit=dev` đều không có lỗ hổng tại thời điểm kiểm tra. `test:release` 8/8 đạt: HTTP/MIME/HEAD, tài nguyên thiếu, traversal/encoding, ZIP/hash, gói bị sửa và đích ngoài workspace. Đã tạo ZIP thật `releases/bao-an-learning-3.8.0-pilot.1.zip` (10.733.311 byte), build ID `3564b824aa2d1fdd`, 133 tài nguyên. Chạy packager lần nữa xác minh SHA-256 từng tệp và các entry ZIP, nhận `reused:true`. Mở server của chính gói phát hành bằng Edge thật, kiểm build ID worker trùng manifest; đi qua Tự học/Luyện thi/Phụ huynh/ví/Xưởng học liệu và màn hình mẫu đạt, không có pageerror. Ảnh bằng chứng `test-results/packaged-windows.png` đã được kiểm tra bố cục.
- **Rollback / remaining:** trước cập nhật phải tải backup, giữ cùng origin/trình duyệt/cổng; giữ gói trước và dùng khôi phục đã preview. Không hạ xuống bản không đọc DB4. Chưa xác nhận Bảo An dùng thử, chưa triển khai tên miền/HTTPS công khai; dùng bản pilot cục bộ trên Windows theo lựa chọn gia đình.

## BA-19 — Tải mẫu và nhập bổ sung câu hỏi

- **Status:** PASS (triển khai theo nhánh song song đã nêu ở kế hoạch).
- **Problem / root cause:** mẫu hiện tại chỉ có CSV đơn giản; XLSX đọc sheet đầu; chưa có metadata từng câu, worker có hủy, preview trùng/xung đột và thêm câu vào version mới.
- **Evidence / files:** `excel-import.ts`, `CreatorScreen.tsx`, `content-io.ts` và storage xác nhận các giới hạn trên; BA06/08/15 đã PASS. Giữ dữ liệu cũ và 2–30 câu/bộ.
- **Expected / PASS:** mẫu thật XLSX ba sheet, CSV BOM và JSON tải offline; nhập đúng sheet/header; giữ ID/objective/metadata; báo dòng lỗi/trùng/xung đột và số thực thêm. Thêm 5 vào 10 tạo bản 15, giữ bản cũ; giao dịch nguyên tử, round-trip và offline qua kiểm thử.
- **Fix / files:** `question-import`/worker/client, Excel parser theo workbook relationship/namespace, template download/preview/trial, publisher riêng, contracts/metadata validation, Creator/App import và catalog nguồn bổ sung. Có tám dạng với 16 XLSX thật +16 CSV +16 JSON, mẫu trống/minh họa; ba dạng cơ bản dùng được ở cả ba môn. Worker giới hạn dữ liệu, hủy thực bằng terminate. Preview chọn từng câu, tải lỗi và xác nhận chỉ nhận dòng hợp lệ; trùng/nội dung khác cần lựa chọn rõ, không cắt quá 30. Phiên bản xuất bản cấp trong giao dịch, giữ bản cũ; source catalog có CLI check/write nguyên tử và bắt buộc nguồn/quyền/trạng thái reviewed.
- **Verification:** 48/48 tệp tải xuống parse/round-trip đạt, render 48 trang mẫu được rà bố cục; 15 unit Excel cũ, 13 importer, 3 assets, 9 catalog đều đạt. BA19 8/8 Edge đạt, sau đó 11/11 trong lượt regression (thêm 9 tổ hợp môn/dạng XLSX, chọn riêng câu JSON/làm thử không ghi điểm, quota rollback/retry); đủ 15/15 sau bốn ca bổ sung ở dưới.
- **Regression:** rà soát phát hiện publisher chưa giữ chỗ mã thư viện khi đi thẳng từ trang game và mẫu mới kế thừa reviewed của bộ đích. Đã bổ sung kiểm tra mã mặc định ở publisher/JSON/CLI và luôn tạo mẫu mới ở draft; cả bốn ca tái hiện đạt trên build cuối. Đủ 15/15 BA19 Edge đạt: vào trực tiếp từ game vẫn giữ đúng thư viện, CSV/JSON/XLSX từ bộ reviewed tạo câu draft, không đổi bản gốc. Tệp thử lỗi kèm gói được đọc đúng 3 dòng/2 hợp lệ/1 lỗi đáp án dòng 4.
- **Remaining:** câu nhập rich chưa tự ghép vào đề tích sao; xuất JSON rà soát rồi thêm snapshot/form mới qua CLI, giữ pin/đề cũ. Catalog bổ sung nguồn hiện rỗng, không tự đưa câu ví dụ vào bài đang học.

## BA-20 — Đổi sao thành tiền hoặc quà gia đình

- **Status:** PASS (yêu cầu bổ sung trực tiếp ngày 15/10/2026).
- **Problem / root cause:** hiện chỉ có sao thành tích; chưa có tỷ lệ quy đổi, số dư khả dụng, yêu cầu đổi hay lịch sử xác nhận trao thưởng.
- **Files / dependency:** profile learningSettings, validator, storage/backup và bảng bé/phụ huynh; dựa trên kết quả bất biến BA08–10. Bổ sung dữ liệu tùy chọn trong profile, giữ DB v4 tám store, không migration mới.
- **Expected / PASS:** phụ huynh bật/chọn tỷ lệ (gợi ý 1.000đ/sao); bé nhập món đồ/mục tiêu và yêu cầu; lưu tỷ lệ tại lúc gửi; pending/approved giữ chỗ, fulfilled đã dùng, hủy/từ chối trả số dư. Giữ sao thành tích; chống đổi quá số dư/hai tab/retry; lưu nguyên tử và backup/restore đủ lịch sử. Phụ huynh xác nhận đã trao tiền/quà ngoài đời, không có cổng thanh toán tự động.
- **Fix / files changed:** `reward-wallet.ts`, learning contracts/curriculum/storage/backup, `RewardWalletPanel.tsx`, LearningScreen/ParentLearningPanel và tests. Ví mặc định tắt; phụ huynh bật/đổi tỷ lệ, duyệt và xác nhận trao qua thao tác cụ thể. Sao dùng tính từ result bất biến theo mức cao nhất của rewardGroup, không tin cache progress; giao dịch profile đọc lại trong transaction tám store. Lưu tỷ lệ tại lúc gửi, lịch chuyển trạng thái và ghi chú; profile/settings cũ không xóa ví mới nhất.
- **Verification:** typecheck/build đạt; 7/7 unit ví; nhóm curriculum/backup/ví 57/57. Đủ 5/5 Edge production đạt trong gate 28 case (26 đạt, hai lỗi riêng selector BA19 đã sửa và 8/8 BA19 chạy lại đạt). Bé học nhận sao rồi yêu cầu, phụ huynh thay tỷ lệ/duyệt/trao; hai tab tranh số dư, quota rollback/retry, sao giả trong cache, hồ sơ khác và 390 px đều kiểm chứng. Backup round-trip giữ lịch sử và không cộng thêm số dư khi nhập lại.
- **Remaining risk:** đây là sổ đổi thưởng trên thiết bị gia đình, sử dụng trang phụ huynh hiện có; không có xác thực phụ huynh phía máy chủ hoặc chuyển tiền tự động. Chất lượng sử dụng thực tế chờ BA17.

## Cổng kiểm tra và bàn giao Windows — 15/10/2026

- **PASS — Kiểm tra mã và tài nguyên:** `npm run typecheck`, build sản xuất 141 module, kiểm tra năm model GLB, dependency tree và syntax đều đạt. `npm test` đạt 288/288 (44 core +37 features +29 content +52 learning +33 backup +85 renderer +8 release). Audit toàn bộ dependency và production riêng đều báo 0 lỗ hổng.
- **PASS — Edge regression:** lượt đầy đủ ban đầu có 199 case, 190 đạt và 9 lỗi fixture. Tám case mobile còn giả định tám nút thay vì mười nút sau khi thêm Luyện thi; sửa đúng số lượng, giữ kiểm hit-test/44 px/không chồng. Case lifecycle lấy baseline trước khi panel phụ huynh lazy sẵn sàng; sửa chờ form lưu settings sẵn sàng ở baseline và mỗi lượt, vẫn giữ kiểm không tăng RAF/listener qua 20 vòng. Sau sửa, 63/63 case trên build mới đạt, gồm toàn bộ chín ca lỗi và bốn ca BA19 mới: mobile 12, world 8, import 15, tự học 6, gameplay 9, content 4, backup BA08 4, ví 5. Tổng 203 case hiện hành đã được bao phủ qua các lượt; không trình bày thành một lượt chạy sạch 203 case.
- **PASS — Chrome và ngoại tuyến trên build cuối:** Chrome 21/21 (17 backup +4 3D thật) và Edge offline 3/3 đạt. Lần build cuối bổ sung tệp CSV thử lỗi tĩnh, giữ nguyên hash JavaScript so với lượt 63 case. Worker thật tải đủ tài nguyên/lazy/media/mẫu, cập nhật A→B giữ dữ liệu. Không bỏ hoặc vô hiệu hóa assertion để qua cổng.
- **PASS — Gói thực tế:** ZIP và thư mục `releases/bao-an-learning-3.8.0-pilot.1` đã sẵn sàng; xác minh tái sử dụng không thay bytes, mở thử đúng gói với 133 tài nguyên và không có lỗi JavaScript. Chạy `MO_BAO_AN.cmd` sau giải nén; cần Node.js 22 trở lên. Hướng dẫn `HUONG_DAN_SU_DUNG.html` kèm gói mô tả sao, đổi thưởng, mẫu/import, sao lưu, khôi phục và phiếu thử sáu bài. Đổi thưởng mặc định tắt; phụ huynh bật và chọn tỷ lệ, gợi ý 1 sao =1.000đ; việc trao tiền/quà được xác nhận thủ công.
- **Còn lại để nghiệm thu:** Bảo An tự dùng hai bài mỗi môn trên Windows, gia đình đối chiếu nội dung/bộ sách, thử nghe và đổi thưởng rồi xác nhận theo phiếu. BA17 và phần nghiệm thu BA18 giữ PARTIAL. **NOT READY FOR FINAL LOCK** chỉ vì chưa có bằng chứng dùng thử thật này; phần triển khai, kiểm thử kỹ thuật và gói pilot đã hoàn tất. Không coi Edge tự động là xác nhận của Bảo An hoặc công bố đã triển khai tên miền công khai.
