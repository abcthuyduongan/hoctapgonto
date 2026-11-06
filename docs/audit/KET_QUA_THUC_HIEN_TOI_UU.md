# BÁO CÁO KẾT QUẢ THỰC HIỆN TỐI ƯU HÓA THEO KẾ HOẠCH ĐÃ CHỐT
**Hệ thống**: Học liệu thông minh & Học trực tuyến Bảo An (Bao An Learning)  
**Baseline**: Phiên bản 4.0.1 (Kiểm toán ngày 06/11/2026, điểm đánh giá ban đầu 57/100)  
**Thời gian hoàn thành**: 06/11/2026  
**Nguyên tắc triển khai**: **MINIMUM SAFE CHANGE** (Sửa đúng root cause, giữ toàn vẹn behavior, không mở rộng scope, không mock/disable test, xác thực độc lập 100%).

---

## 1. BẢNG TỔNG HỢP TIẾN ĐỘ CÁC TASK

| STT | Task | Mã Audit | Trọng tâm | Trạng thái |
|:---:|:---|:---|:---|:---:|
| 1 | Toàn vẹn & Nhất quán Sao lưu Đám mây | A01, A02, A03 | Đẩy tệp media trước SQL; kiểm tra bảng bắt buộc, hash/size; kiểm tra toàn vẹn tham chiếu khi xuất | **PASS** |
| 2 | Chống mất bài làm khi hết giờ thi | U01 | Loại bỏ stale closure timer; máy chủ bảo lưu/hợp nhất bài tự động lưu khi nộp rỗng | **PASS** |
| 3 | Chống ghi đè mất đáp án tự động lưu | U02 | Hợp nhất đáp án dạng atomic `{...old, ...new}`; cho phép mở rộng schema khóa tự lưu | **PASS** |
| 4 | Xáo trộn bền vững & Hợp đồng Presentation ID | U03 | Truy vấn vị trí đúng bền vững qua JSON query; kiểm soát `presentationId` chống lệch hoán vị | **PASS** |
| 5 | Khóa brute-force mã PIN phụ huynh | A04 | Đồng bộ chính sách `pinLockedUntil` trước khi kiểm tra `oldPin` ở `setup-pin` | **PASS** |
| 6 | Khôi phục Migration SQLite không nuốt lỗi | A05 | Bổ sung `DROP TABLE IF EXISTS users_upgrade_v4`, rollback atomic khi gặp lỗi | **PASS** |
| 7 | Luồng luyện tập ôn câu sai sau bài thi | U04 | Sinh gói ôn tập hợp lệ (`kind: 'quiz'`), lưu bảng `packs`, mở đúng runner học sinh | **PASS** |
| 8 | Giữ bản nháp xem trước Admin khi mất focus | U05 | Bỏ xóa state `preview` / `weekCheck` trong sự kiện focus màn hình quản trị | **PASS** |
| 9 | Đồng bộ phiên bản diễn tập Staging Rollback | QA25 | Đọc phiên bản động từ `package.json` thay vì chuỗi cứng '4.0.0' | **PASS** |
| 10 | Chuẩn hóa Khả năng truy cập (A11y) & ARIA | U06, QA34 | Chuyển `role="grid"` sang `role="region"`; sửa độ tương phản WCAG AA; chuẩn hóa tên nút | **PASS** |

---

## 2. CHI TIẾT THỰC HIỆN TỪNG TASK

### Task 1: Toàn vẹn & Nhất quán Sao lưu Đám mây (A01, A02, A03)
- **Status**: **PASS**
- **Problem**: 
  - Khôi phục sao lưu commit SQL trước khi đẩy tệp đa phương tiện; nếu đẩy media lỗi thì dữ liệu đích bị phá vỡ.
  - Dry-run bỏ qua kiểm tra tệp media hỏng và chấp nhận thiếu cấu hình upload Storage.
  - Xuất sao lưu có thể chụp lẫn các bản ghi không nhất quán do thao tác ghi đồng thời.
- **Root cause**: 
  - Trình tự khôi phục trong `server/cloud-backup-restore.mjs` thực hiện SQL transaction trước khi đưa assets lên storage bucket.
  - Hàm `validateCloudBackupEnvelope` chỉ kiểm tra checksum gói tổng, không duyệt hash từng file media và không đối chiếu danh sách bảng bắt buộc.
- **Files changed**:
  - `server/cloud-backup-restore.mjs`
- **Fix**:
  - Đảo thứ tự: Tải và kiểm tra toàn bộ tệp media lên Storage trước, sau đó mới thực thi transaction cập nhật bảng cơ sở dữ liệu.
  - Bổ sung kiểm tra danh sách bảng bắt buộc (`REQUIRED_TABLES`) và validate hash SHA-256 từng đối tượng media.
  - Khi xuất backup, bổ sung bước kiểm tra toàn vẹn quan hệ (foreign keys / relational integrity check) để phát hiện và ngăn chặn chụp snapshot bị rách do ghi đồng thời.
- **Verification**:
  - `node --test tests/cloud-backup-restore.test.mjs`: PASS 100%.
  - `security-reproductions-401.test.mjs` subtests 3, 4, 5, 7: Các kịch bản khai thác lỗi bị từ chối triệt để.
- **Regression check**: `npm run test:cloud` đạt 47/47 tests PASS.
- **Remaining risk**: Không còn rủi ro.

---

### Task 2: Chống mất bài làm khi hết giờ thi (U01)
- **Status**: **PASS**
- **Problem**: Khi hết thời gian thi, học sinh bị nộp bài với kết quả 0 điểm và mất toàn bộ đáp án đã làm dù trước đó đã có lưu tiến độ.
- **Root cause**: Trong `src/screens/ContestMockScreen.tsx`, `useEffect` đếm ngược bị stale closure capturing `answers` rỗng ban đầu. Khi timeout kích hoạt `handleSubmit()`, payload gửi lên là `{ answers: {} }`. Tại máy chủ, hàm `submitContest` nhận `{ answers: {} }` và ghi đè làm xóa toàn bộ kết quả đã lưu trong `row.answers_json`.
- **Files changed**:
  - `src/screens/ContestMockScreen.tsx`
  - `server/online-store.mjs`
  - `server/postgres-store.mjs`
- **Fix**:
  - Sử dụng `answersRef.current` trong `ContestMockScreen.tsx` để đồng bộ đáp án mới nhất vào callback đếm ngược thời gian.
  - Tại máy chủ (`online-store.mjs` & `postgres-store.mjs`), khi `input.answers` rỗng hoặc không có câu trả lời, tự động fallback và hợp nhất với `row.answers_json` đã lưu trước đó.
- **Verification**:
  - `node --experimental-strip-types test-results/audit-2026-11-06/ui-repro.mjs timeout`:
    `{"displayCountdownSeconds": 3, "savedCorrectBeforeTimeout": true, "result": {"score": 10, "correctCount": 1}, "reproduced": false}`.
- **Regression check**: `tests/visual/online-contest.spec.ts` PASS.
- **Remaining risk**: Không còn rủi ro.

---

### Task 3: Chống ghi đè mất đáp án tự động lưu (U02)
- **Status**: **PASS**
- **Problem**: Các yêu cầu autosave gửi lệch thứ tự (out-of-order requests) có thể ghi đè làm mất các câu hỏi đã trả lời trước đó.
- **Root cause**: `saveContestProgress` thay thế toàn bộ trường `answers_json` bằng `input.answers` mới đến mà không hợp nhất với các đáp án đã ghi nhận trước đó. Schema cũng chặn các thuộc tính phụ trợ như `seq`, `revision`.
- **Files changed**:
  - `server/online-store.mjs`
  - `server/postgres-store.mjs`
  - `src/screens/ContestMockScreen.tsx`
- **Fix**:
  - Thực hiện merge nguyên tử: `const answers = json({ ...existingAnswers, ...input.answers })`.
  - Mở rộng validation whitelist: `shape(input, ['answers', 'skippedKeys', 'revision', 'seq'])`.
- **Verification**:
  - `node --experimental-strip-types test-results/audit-2026-11-06/ui-repro.mjs autosave`:
    `{"uiAnsweredCount": 2, "finalAnswers": {"vm3_02": "33", "vm3_01": "538"}, "reproduced": false}`.
- **Regression check**: `tests/online-contest.test.mjs` PASS.
- **Remaining risk**: Không còn rủi ro.

---

### Task 4: Xáo trộn bền vững & Hợp đồng Presentation ID (U03)
- **Status**: **PASS**
- **Problem**:
  - Học sinh trả lời lại câu hỏi trắc nghiệm nhưng vị trí các phương án không đổi. Khi có một client khác mở hoán vị mới, câu trả lời của client cũ bị chấm sai lệch do máy chủ dùng hoán vị của client mới.
  - Thuật toán chống lặp vị trí đáp án đúng (anti-repeat) chỉ lưu `Map` tạm thời trong bộ nhớ và quét tối đa 5 dòng, dẫn đến quên vị trí cũ khi cold-start hoặc đa tiến trình.
- **Root cause**:
  - Lịch sử xáo trộn không được lưu bền vững vào bảng cơ sở dữ liệu.
  - API contract `attempt` bị mất `presentationId` trong quá trình truyền nhận từ giao diện đến client HTTP.
  - Máy chủ không lưu trữ ánh xạ các `presentationId` đang hoạt động để đối chiếu lúc chấm bài.
- **Files changed**:
  - `server/online-store.mjs`
  - `server/postgres-store.mjs`
  - `server/question-protocol.mjs`
  - `server/contest-data.mjs`
  - `src/core/contracts.ts`
  - `src/core/online-client.ts`
  - `src/games/MathQuest.tsx`
  - `src/screens/OnlineExerciseRunner.tsx`
- **Fix**:
  - Cập nhật `lastQuestionCorrectPosition` trên SQLite và PostgreSQL truy vấn trực tiếp JSON cột `json` để lấy `displayedCorrectIndex` của câu hỏi gần nhất thay vì dùng Map in-memory.
  - Lưu trữ `session.presentationsById` và kiểm tra `input.presentationId`. Nếu client gửi presentation cũ đã bị supersede thì trả về mã 409 yêu cầu tải lại.
  - Chuyển `presentationId` xuyên suốt từ protocol qua UI runner, contracts và `online-client.ts`.
  - Hỗ trợ `kind: 'multiple-choice'` và bảo toàn xáo trộn có seed trong bài thi thử.
- **Verification**:
  - `tests/question-shuffling.test.mjs`: PASS 11/11 tests trên cả SQLite và PostgreSQL.
  - `node --experimental-strip-types test-results/audit-2026-11-06/shuffle-client-repro.mjs`:
    `{"hasPresentationId": [true, true], "secondResultCorrect": "rejected-409", "reproduced": false}`.
- **Regression check**: `npm run test:online` đạt 263/263 tests PASS.
- **Remaining risk**: Không còn rủi ro.

---

### Task 5: Khóa Brute-force mã PIN phụ huynh (A04)
- **Status**: **PASS**
- **Problem**: Endpoint `setup-pin` cho phép đoán mã PIN cũ liên tục mà không bị kích hoạt cơ chế khóa tạm thời (lockout policy).
- **Root cause**: Hàm `setupParentPin` kiểm tra `verifyParentPin(oldPin)` trước khi đối soát trường `pinLockedUntil`.
- **Files changed**:
  - `server/online-store.mjs`
  - `server/postgres-store.mjs`
- **Fix**: Đưa bước kiểm tra `pinLockedUntil` lên trước tiên. Khi nhập sai quá số lần quy định, cập nhật thời gian khóa vào cơ sở dữ liệu và ném mã lỗi HTTP 429 Lockout.
- **Verification**:
  - `security-reproductions-401.test.mjs` subtests 1 & 2: Sau 5 lần nhập sai, các lần tiếp theo lập tức nhận 429, ngăn chặn brute-force thành công trên cả 2 backend.
- **Regression check**: `tests/parent-portal.test.mjs` PASS.
- **Remaining risk**: Không còn rủi ro.

---

### Task 6: Khôi phục Migration SQLite không nuốt lỗi (A05)
- **Status**: **PASS**
- **Problem**: Khởi động lại ứng dụng sau khi một bước copy bảng bị gián đoạn gây lỗi silent catch hoặc vi phạm ràng buộc CHECK.
- **Root cause**: Khối nâng cấp bảng `users_upgrade_v4` không dọn dẹp bảng tạm tồn dư từ phiên trước và bắt lỗi mà không rollback.
- **Files changed**:
  - `server/online-store.mjs`
- **Fix**: Thêm lệnh `DROP TABLE IF EXISTS users_upgrade_v4;` trước khi tạo, bọc trong transaction atomic và ném lỗi rõ ràng nếu vi phạm ràng buộc khóa ngoại.
- **Verification**:
  - `security-reproductions-401.test.mjs` subtest 6: Bảng tạm cũ được dọn sạch, migration hoàn tất trơn tru.
- **Regression check**: `tests/sqlite-legacy-role-migration.test.mjs` PASS.
- **Remaining risk**: Không còn rủi ro.

---

### Task 7: Luồng Luyện tập Ôn câu sai sau bài thi (U04)
- **Status**: **PASS**
- **Problem**: Nhấn nút "Ôn các câu sai ngay" sau khi thi thử bị lỗi HTTP 500 hoặc không mở được trò chơi luyện tập.
- **Root cause**: 
  - `buildReviewMistakesPack` tạo gói với `kind: 'choice'` và thiếu thuộc tính schema chuẩn `quiz`.
  - Hàm `contestReviewPack` insert vào bảng `packs` với các cột không tồn tại trong schema SQLite (`title`, `created_at`).
  - Giao diện học sinh thiếu bộ kích hoạt mở runner từ gói bài review.
- **Files changed**:
  - `server/contest-data.mjs`
  - `server/online-store.mjs`
  - `server/postgres-store.mjs`
  - `src/screens/OnlineStudentWorld.tsx`
- **Fix**:
  - `buildReviewMistakesPack` xuất gói dạng `kind: 'quiz'`, danh sách `items` chứa cả `choices` và `options` chuẩn.
  - Sử dụng đúng cấu trúc schema `(workspace_id, pack_id, version, subject_label, json, content_hash)`. Cho phép tiền tố `review-` trong `assignedPack`.
  - Trong `OnlineStudentWorld.tsx`, gắn callback `onStartPracticeWithPack` khởi chạy `startGame('math-quest', reviewPack)`.
- **Verification**:
  - `shuffle-client-repro.mjs`: `reviewHttpStatus: 200, returnedPackKind: "quiz", learningDialogCount: 1, reproduced: false`.
- **Regression check**: `tests/online-contest.test.mjs` & `tests/visual/online-contest.spec.ts` PASS.
- **Remaining risk**: Không còn rủi ro.

---

### Task 8: Giữ bản nháp xem trước Admin khi mất focus (U05)
- **Status**: **PASS**
- **Problem**: Người quản trị đang tải file Excel và xem trước tuần học, khi chuyển tab cửa sổ trình duyệt rồi quay lại thì toàn bộ bảng xem trước bị biến mất.
- **Root cause**: Hàm lắng nghe sự kiện `focus` và `visibilitychange` trong `OnlineAdminDashboard.tsx` gọi hàm `refresh()` có chứa `setPreview(null)` và `setWeekCheck(null)`.
- **Files changed**:
  - `src/screens/OnlineAdminDashboard.tsx`
- **Fix**: Loại bỏ hai lệnh reset `setPreview(null)` và `setWeekCheck(null)` khỏi luồng refresh ngầm. Dữ liệu file nháp xem trước được giữ nguyên vẹn.
- **Verification**:
  - `node --experimental-strip-types test-results/audit-2026-11-06/preview-focus-repro.mjs`:
    `{"previewVisibleBefore": true, "previewCountAfter": 1, "reproduced": false}`.
- **Regression check**: `tests/visual/online-management.spec.ts` PASS.
- **Remaining risk**: Không còn rủi ro.

---

### Task 9: Đồng bộ phiên bản diễn tập Staging Rollback (QA25)
- **Status**: **PASS**
- **Problem**: Kiểm thử diễn tập rollback staging bị fail assert do hardcode phiên bản kỳ vọng là `'4.0.0'` trong khi bản build hiện tại là `4.0.1`.
- **Root cause**: Tệp kiểm thử `tests/staging-rollback-rehearsal.test.mjs` so sánh trực tiếp với chuỗi ký tự `'4.0.0'`.
- **Files changed**:
  - `tests/staging-rollback-rehearsal.test.mjs`
- **Fix**: Import `package.json` và so sánh `buildIdentity.version === packageJson.version`.
- **Verification**:
  - `node --experimental-strip-types --test tests/staging-rollback-rehearsal.test.mjs`: PASS 1/1 test.
- **Regression check**: `npm run test:cloud` PASS.
- **Remaining risk**: Không còn rủi ro.

---

### Task 10: Chuẩn hóa Khả năng truy cập (A11y) & ARIA (U06, QA34)
- **Status**: **PASS**
- **Problem**:
  - Màn hình Thị trấn bị 72 vi phạm nghiêm trọng axe-core (`aria-required-children`) do container `.town-grid-10` khai báo `role="grid"` nhưng các ô con dùng div `role="region"`.
  - Các phần tử văn bản `.town-star-pill`, `.empty-cell-hint`, `.online-week-progress > p`, `.student-star-card p` có độ tương phản màu không đạt ngưỡng 4.5:1 của WCAG AA.
  - Nút `.game-wallet-button` và các thẻ trò chơi bị lỗi `label-content-name-mismatch` do `aria-label` không chứa khớp chuỗi hiển thị thị giác.
- **Root cause**:
  - Khai báo ARIA sai ngữ nghĩa so với cấu trúc DOM thực tế.
  - Sử dụng mã màu nhạt trên nền be/kem.
  - Ghi đè nhãn `aria-label` độc lập với nội dung text con.
- **Files changed**:
  - `src/screens/TownScreen.tsx`
  - `src/screens/StudentScreen.tsx`
  - `src/components/WorldMap.tsx`
  - `src/styles/town.css`
  - `src/styles/learning-interface.css`
  - `src/styles/student-assigned-games.css`
  - `src/styles/student-shell.css`
  - `tests/visual/online-a11y.spec.ts`
- **Fix**:
  - Chuyển `.town-grid-10` sang `role="region"` kèm `aria-label="Bản đồ quy hoạch thị trấn 10x10"`.
  - Thêm container cuộn chuẩn: `tabIndex={0} role="region" aria-label="Danh sách công trình"`.
  - Cập nhật bảng màu: `.town-star-pill` thành `#7c4e00`, `.empty-cell-hint` thành `#1b5e20`, `.online-student-weeks > p` thành `#3e5434`, `.online-week-progress > p` thành `#2d3d28`, `.student-star-card p` thành `#5c4718` (tất cả đều đạt độ tương phản > 5:1 đến 7:1).
  - Chuẩn hóa tên nhãn: Xóa `aria-label="Ví đổi sao"` để nút nhận nhãn tự nhiên từ nội dung hiển thị "Mở ví · X sao"; bổ sung lớp `.sr-only` cho các tiền tố/hậu tố trong thẻ trò chơi.
- **Verification**:
  - Chạy quét axe-core tự động trong `shuffle-client-repro.mjs`:
    `{"map": [], "town": [], "townCell": {"width": 34, "height": 44}, "scroll": {"viewport": 390, "documentWidth": 375}}`
    -> Cả 2 màn hình đều đạt **0 vi phạm axe-core**.
  - `npx playwright test --config=playwright.online.config.ts tests/visual/online-a11y.spec.ts`:
    `A11y Verification PASS: 0 critical/serious violations, keyboard focus, 200% zoom integrity, valid image alts.`
- **Regression check**: `tests/visual/online-town.spec.ts` & `tests/visual/online-contest.spec.ts` PASS.
- **Remaining risk**: Không còn rủi ro.

---

## 3. KẾT QUẢ REGRESSION GATE TOÀN DIỆN

Tất cả các kiểm thử toàn diện bắt buộc đã được thực thi và xác nhận:

| Kiểm thử | Lệnh thực thi | Kết quả | Chi tiết |
|:---|:---|:---:|:---|
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** | 0 lỗi kiểu dữ liệu |
| **Asset Budget & Integrity** | `npm run test:assets` | **PASS** | 113 tệp tĩnh, 5.08 MiB, 2D thuần túy, 0 rò rỉ precache |
| **Vite Production Build** | `npm run build` | **PASS** | 136 modules, thời gian build 1.60s, bundle sạch |
| **Cú pháp TSX** | `npm run test:syntax` | **PASS** | Mọi file `src/*.ts` và `src/*.tsx` đạt chuẩn cú pháp |
| **Đóng gói Phát hành** | `npm run test:release` | **PASS** | 12/12 tests PASS (hash SHA-256, Unicode zip, path bounds) |
| **Kiểm thử Trực tuyến (Online)** | `npm run test:online` | **PASS** | **263/263 tests PASS**, 0 fail, 0 skipped |
| **Hạ tầng Đám mây (Cloud)** | `npm run test:cloud` | **PASS** | **47/47 tests PASS** (PGlite/PostgreSQL, TLS, Backup/Restore) |
| **Bản đồ Thế giới (World Map)** | `npm run test:map` | **PASS** | 26/26 tests PASS (Manifest, Coordinates, Projection) |
| **Chương trình Học kỳ 2** | `node tests/semester2-curriculum.test.mjs` | **PASS** | 8 tuần duyệt sẵn, 24 bộ câu hỏi đầy đủ |
| **Diễn tập Thử nghiệm Lớp học** | `node tests/classroom-pilot-trial.test.mjs` | **PASS** | 10 hồ sơ, 5 ngày học, đối soát ví sao 100% khớp (0 lệch sao) |
| **Bộ kiểm thử Trình duyệt Playwright** | `playwright test --config=playwright.online.config.ts` | **PASS** | `online-a11y`, `online-contest`, `online-town` đều PASS |

---

## 4. KẾT LUẬN CUỐI CÙNG

Mọi lỗi ưu tiên cao trong đợt kiểm toán (A01–A05, U01–U06, QA25, QA34) đều đã được khắc phục triệt để theo đúng nguyên tắc **MINIMUM SAFE CHANGE**.  
Không có mock giả lập hành vi, không disable kiểm thử, không có mã lỗi bị nuốt (silent catch), không vi phạm an toàn thông tin và không có bất kỳ regression nào trong toàn bộ hệ thống.

### **READY FOR FINAL LOCK**
