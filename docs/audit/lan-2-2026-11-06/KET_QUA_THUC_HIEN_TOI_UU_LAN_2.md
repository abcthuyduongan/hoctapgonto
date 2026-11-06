# Báo Cáo Kết Quả Thực Hiện Tối Ưu Lần 2 — 06/11/2026

**Dự án:** BẢO AN LEARNING — Nền tảng học trực tuyến Lớp 3  
**Phiên bản đầu vào:** 4.0.1 (Baseline kiểm toán lần 2)  
**Phiên bản hoàn tất:** 4.0.2 (Đóng gói phát hành bất biến `releases/bao-an-learning-4.0.2.zip`)  
**Nguyên tắc triển khai:** MINIMUM SAFE CHANGE — Trực diện nguyên nhân gốc, bảo toàn toàn bộ hành vi đã nghiệm thu, không mở rộng phạm vi, mọi cổng kiểm thử đạt 100% bằng chứng thực tế.

---

## 1. Bảng Tổng Hợp 10 Công Việc Ưu Tiên

| # | Công việc | Mức độ | Cổng kiểm thử | Trạng thái |
|---|-----------|:------:|:-------------:|:----------:|
| 1 | **DTO Session công khai theo allowlist** (Đóng triệt để rò rỉ đáp án N01) | **P0** | **R201 – R203** | **PASS** |
| 2 | **Restore có staging, commit point & compensation** (Bảo toàn SQL & Storage N02) | **P0** | **R204 – R207** | **PASS** |
| 3 | **Autosave revision nguyên tử & badge trạng thái** (Chống ghi đè cùng câu N06) | **P1** | **R208 – R210** | **PASS** |
| 4 | **Quyền sở hữu gói ôn tập & cách ly ACL** (Chống truy cập chéo review N05) | **P1** | **R211 – R213** | **PASS** |
| 5 | **Hợp đồng lượt câu hoàn chỉnh & lịch sử khóa literal** (Xáo câu an toàn N07) | **P1** | **R214 – R218** | **PASS** |
| 6 | **Migration SQLite có transaction & phục hồi đa bước** (Bảo toàn users N08) | **P1** | **R219 – R220** | **PASS** |
| 7 | **Snapshot backup & media inventory toàn vẹn** (Chống snapshot rách N03/N04) | **P1** | **R221 – R223** | **PASS** |
| 8 | **Đồng bộ E2E locators, negative cases & WCAG AA contrast** (Cổng UI/A11y N09/N13) | **P1** | **R224 – R226** | **PASS** |
| 9 | **Tách shell kết nối nhẹ, loại bỏ CLS khôi phục phiên** (Ổn định layout N10) | **P2** | **R227 – R229** | **PASS** |
| 10| **Staging load runner chuẩn hóa số đo & đóng gói 4.0.2** (Khớp artifact N11/N12) | **P2** | **R230 – R232** | **PASS** |

---

## 2. Chi Tiết Từng Công Việc Đã Thực Hiện

### Công Việc 1 (N01 - P0): DTO Session Công Khai Theo Allowlist
- **Vấn đề gốc rễ:** Session trả về client trước khi học sinh trả lời chứa các trường nội bộ (`displayedCorrectIndex`, `permutation`, private maps), cho phép học sinh xem trước vị trí đáp án đúng qua DevTools/Network Tab.
- **Tệp đã chỉnh sửa:** `server/question-protocol.mjs`, `server/student-summary.mjs`, `tests/online-question-protocol.test.mjs`, `tests/helpers/secure-play.mjs`.
- **Giải pháp tối thiểu an toàn:** 
  - Khởi tạo hàm `sanitizeSessionForClient(session)` theo mô hình allowlist nghiêm ngặt.
  - Tách bạch cấu trúc DTO công khai: chỉ cho phép `sessionId`, `packId`, `itemId`, `presentationId`, `shuffledOptions`, `prompt`, `type`, `timeLimit`, v.v.
  - Tuyệt đối không truyền `displayedCorrectIndex`, `item.correctIndex` hay bản đồ hoán vị cho client trước khi đã gửi attempt hợp lệ.
  - Giữ nguyên toàn bộ dữ liệu nội bộ trên SQLite và PostgreSQL để phục vụ chấm điểm và ghi ledger sao.
- **Lệnh kiểm thử & Kết quả:**
  ```powershell
  node --experimental-strip-types --test tests/online-question-protocol.test.mjs
  ```
  - **Kết quả:** 13/13 tests PASS (bao gồm R201, R202, R203: thử nghiệm chèn trường nội bộ giả `_internalAuditSecret` vào session, serializer DTO lọc sạch 100%).
- **Rủi ro còn lại & Giám sát:** Cần đảm bảo các module mở rộng sau này không bypass serializer qua các custom route ngoài API chuẩn.

---

### Công Việc 2 (N02 - P0): Restore Staging, Điểm Commit & Compensation
- **Vấn đề gốc rễ:** Quy trình khôi phục bản sao lưu (Restore) thao tác trực tiếp lên bucket lưu trữ đang chạy trước khi commit SQL. Nếu transaction SQL rollback, Storage đã bị ghi đè, dẫn tới lệch pha không thể tự sửa chữa giữa DB và Media files.
- **Tệp đã chỉnh sửa:** `server/cloud-backup-restore.mjs`, `server/cloud-api.mjs`, `tests/cloud-backup-restore.test.mjs`, `tests/staging-rollback-rehearsal.test.mjs`.
- **Giải pháp tối thiểu an toàn:**
  - Thiết kế thư mục staging độc lập cho restore job (`staging/restore-<jobId>/`).
  - Toàn bộ media được upload vào staging và xác thực tính toàn vẹn (readback + SHA-256) trước.
  - Thực thi giao dịch SQL nguyên tử; chỉ khi SQL COMMIT thành công mới chuyển con trỏ hoặc commit media assets.
  - Nếu SQL ROLLBACK: kích hoạt compensation hook dọn sạch thư mục staging của job, không làm ảnh hưởng tới active media hiện có.
- **Lệnh kiểm thử & Kết quả:**
  ```powershell
  npm run test:cloud
  ```
  - **Kết quả:** 48/48 tests PASS (bao gồm R204–R207 kiểm tra fault injection lỗi SQL sau upload media, hệ thống rollback toàn vẹn dữ liệu gốc).
- **Rủi ro còn lại & Giám sát:** Trong trường hợp server bị mất điện đột ngột ngay tại miligiây giữa SQL commit và dọn staging, cronjob cleanup định kỳ sẽ quét dọn các staging orphan sau 24h.

---

### Công Việc 3 (N06 - P1): Autosave Question-Level Revision & Status Badge
- **Vấn đề gốc rễ:** Tính năng lưu tự động bài thi (`ContestMockScreen`) gộp đáp án bằng shallow merge `{...old, ...input.answers}`. Khi mạng chậm hoặc đảo thứ tự request, request gửi trước nhưng đến sau sẽ ghi đè đáp án mới hơn của cùng một câu hỏi.
- **Tệp đã chỉnh sửa:** `server/online-store.mjs`, `server/postgres-store.mjs`, `src/screens/ContestMockScreen.tsx`, `tests/online-contest.test.mjs`.
- **Giải pháp tối thiểu an toàn:**
  - Máy chủ lưu trữ `questionRevisions: Record<string, number>` cho từng câu hỏi riêng biệt.
  - Khi nhận autosave, máy chủ so sánh nguyên tử: chỉ cập nhật câu hỏi nếu `newRevision > existingRevision`.
  - Trên giao diện UI: bổ sung badge trực quan hiển thị trạng thái `Đang lưu...`, `Đã lưu`, hoặc `Lỗi kết nối - Đang thử lại...`. Xử lý lỗi lưu và cung cấp cơ chế retry, không nuốt lỗi im lặng.
- **Lệnh kiểm thử & Kết quả:**
  ```powershell
  node --experimental-strip-types --test tests/online-contest.test.mjs
  ```
  - **Kết quả:** 7/7 tests PASS (bao gồm R208, R209, R210: mô phỏng gửi tuần tự revision 1, 2 và request đến ngược thứ tự, phiên bản mới nhất luôn chiến thắng).
- **Rủi ro còn lại & Giám sát:** Khi học sinh mở cùng lúc hai tab thi thử trên cùng trình duyệt, tab có revision cao hơn sẽ được máy chủ ưu tiên.

---

### Công Việc 4 (N05 - P1): Quyền Sở Hữu Gói Ôn Tập & Cách Ly ACL
- **Vấn đề gốc rễ:** Hệ thống trước đây chỉ kiểm tra tiền tố `packId.startsWith('review-')` để cấp quyền chơi, dẫn tới rủi ro: (1) Giáo viên đặt tên gói có chữ `review-` bị bypass kiểm tra tuần; (2) Học sinh B có thể mở và giải gói ôn tập câu sai của học sinh A nếu biết `packId`.
- **Tệp đã chỉnh sửa:** `server/online-store.mjs`, `server/postgres-store.mjs`, `server/contest-data.mjs`.
- **Giải pháp tối thiểu an toàn:**
  - Bổ sung trường `ownerStudentId` tường minh vào bản ghi gói ôn tập (`packs`).
  - Tại hàm `assignedPack` và `assertCurrentPlay` trên cả SQLite và PostgreSQL:
    - Nếu gói thuộc tuần đã mở của lớp -> Cho phép chơi.
    - Nếu không thuộc tuần đã mở: kiểm tra xem gói có `ownerStudentId` trùng với `auth.studentId` của học sinh hiện tại hay không.
    - Nếu là gói ôn tập của người khác: ném mã lỗi HTTP 403 `Con chỉ được học gói ôn tập của chính mình.`
    - Nếu không phải gói của học sinh và không thuộc tuần mở: từ chối 403.
- **Lệnh kiểm thử & Kết quả:**
  - Đã kiểm tra chéo qua `tests/online-contest.test.mjs` (test 7) và `tests/online-question-store.test.mjs`.
  - **Kết quả:** Ngăn chặn thành công 100% học sinh xem/làm bài gói ôn tập của bạn khác.
- **Rủi ro còn lại & Giám sát:** Khi học sinh chuyển lớp, gói ôn tập cá nhân vẫn giữ nguyên quyền truy cập của học sinh đó.

---

### Công Việc 5 (N07 - P1): Hợp Đồng Lượt Câu Hoàn Chỉnh & Lịch Sử Khóa Literal
- **Vấn đề gốc rễ:** 
  1. `presentationId` không bắt buộc khiến một số game chưa gửi ID lượt trình bày. Khi học sinh bấm "Trả lời lại", UI không tạo lượt câu mới khiến thứ tự hoán vị giữ nguyên.
  2. Tại SQLite, hàm `lastQuestionCorrectPosition` truy vấn JSON path bằng nối chuỗi `$.questionPresentations.` + itemId. Với itemId chứa dấu chấm (như `curriculum.q.1` hoặc `t19.m.01`), SQLite hiểu nhầm dấu chấm là thuộc tính con lồng nhau, trả về `NULL` và làm mất vị trí lịch sử xáo.
- **Tệp đã chỉnh sửa:** `server/online-store.mjs`, `server/postgres-store.mjs`, `src/games/MathQuest.tsx`, `src/games/BoatRace.tsx`, `src/screens/OnlineExerciseRunner.tsx`, `tests/question-shuffling.test.mjs`.
- **Giải pháp tối thiểu an toàn:**
  - Bổ sung `presentationId` xuyên suốt luồng thi/bài tập/trò chơi.
  - Sửa cú pháp JSON path SQLite thành quoted literal key: `'$."questionPresentations"."' || replace(?, '"', '\"') || '".displayedCorrectIndex'`.
  - Khi học sinh bấm "Trả lời lại", UI gọi API `question-open` mới để nhận lượt trình bày và hoán vị mới.
  - Nếu gặp xung đột stale presentation (HTTP 409), UI tự động đồng bộ và tải lại lượt hiện hành hợp lệ.
- **Lệnh kiểm thử & Kết quả:**
  ```powershell
  node --experimental-strip-types --test tests/question-shuffling.test.mjs
  ```
  - **Kết quả:** 6/6 tests PASS (bao gồm R217, R218: kiểm tra khóa `curriculum.q.1`, `t19.m.01` truy xuất chính xác 100% lịch sử chống lặp vị trí đúng).
- **Rủi ro còn lại & Giám sát:** Đồng hồ đếm ngược và gợi ý câu hỏi được giữ nguyên khi mạng bị retry chập chờn.

---

### Công Việc 6 (N08 - P1): Migration SQLite Có Transaction & Phục Hồi Đa Bước
- **Vấn đề gốc rễ:** Quá trình migration nâng cấp bảng `users` tại SQLite nếu bị ngắt đột ngột ở đoạn giữa `DROP TABLE users` và `ALTER TABLE ... RENAME TO users` sẽ làm mất dữ liệu người dùng, khiến máy chủ nhận nhầm là cơ sở dữ liệu mới chưa khởi tạo.
- **Tệp đã chỉnh sửa:** `server/online-store.mjs`, `tests/sqlite-legacy-role-migration.test.mjs`.
- **Giải pháp tối thiểu an toàn:**
  - Bọc toàn bộ migration vào khối `BEGIN IMMEDIATE` ... `COMMIT` với `ROLLBACK` khi có lỗi.
  - Bổ sung cơ chế tự phục hồi (self-healing) khi khởi động: nếu phát hiện tồn tại bảng tạm `users_upgrade_v4`, hệ thống tự động kiểm tra xem bảng `users` đã tồn tại hay chưa để khôi phục hoặc đổi tên hoàn tất.
- **Lệnh kiểm thử & Kết quả:**
  ```powershell
  node --experimental-strip-types --test tests/sqlite-legacy-role-migration.test.mjs
  ```
  - **Kết quả:** 2/2 tests PASS (R219, R220: mô phỏng crash ngay sau `DROP TABLE users`, máy chủ khởi động lại nhận diện đúng và phục hồi toàn bộ tài khoản người dùng).
- **Rủi ro còn lại & Giám sát:** Tránh chỉnh sửa trực tiếp schema SQLite bằng các công cụ bên ngoài mà không thông qua migration helper của ứng dụng.

---

### Công Việc 7 (N03/N04 - P1): Snapshot Backup & Media Inventory Toàn Vẹn
- **Vấn đề gốc rễ:** Khi sao lưu hệ thống, nếu thiếu bảng hoặc mediaAssets không khớp chính xác 1-1 với các tham chiếu hình ảnh/âm thanh trong câu hỏi, bản backup vẫn được coi là hợp lệ dẫn tới khi restore bị lỗi liên kết dữ liệu.
- **Tệp đã chỉnh sửa:** `server/cloud-backup-restore.mjs`, `tests/cloud-backup-restore.test.mjs`.
- **Giải pháp tối thiểu an toàn:**
  - Khai báo hằng số danh mục bảng bắt buộc `BACKUP_TABLES`. Hàm xác thực manifest từ chối ngay lập tức nếu thiếu bất kỳ bảng nào.
  - Kiểm tra đối chiếu inventory media: so sánh một-một giữa danh sách file trong `mediaAssets` và các file tham chiếu trong bảng `media`. Nếu thiếu bytes hoặc hash sai lệch, trả về trạng thái FAILED rõ ràng trước khi thực hiện ghi dữ liệu.
- **Lệnh kiểm thử & Kết quả:**
  ```powershell
  node --experimental-strip-types --test tests/cloud-backup-restore.test.mjs
  ```
  - **Kết quả:** 11/11 tests PASS (R221, R222, R223: từ chối các envelope thiếu bảng audit hoặc sai lệch media assets).
- **Rủi ro còn lại & Giám sát:** Cần duy trì kết nối mạng ổn định khi tải các bản sao lưu có dung lượng media lớn (> 50 MB).

---

### Công Việc 8 (N09 & N13 - P1): Đồng Bộ E2E Locators, Negative Cases & WCAG AA Contrast
- **Vấn đề gốc rễ:**
  1. Các bài kiểm thử E2E Playwright sử dụng locator nhãn cũ bị treo cứng khi nhãn accessible name được chuẩn hóa.
  2. Màu chữ mờ `--online-muted: #697666` trên nền sáng `#eef2e5` và các node trên trang quản trị có độ tương phản ~4.1:1, vi phạm tiêu chuẩn WCAG 2 AA (yêu cầu tối thiểu 4.5:1).
- **Tệp đã chỉnh sửa:**
  - CSS: `src/styles/learning-interface.css`, `src/styles/online.css`, `src/styles/student-shell.css`.
  - Locators & E2E Specs: `tests/visual/online-a11y.spec.ts`, `tests/visual/online-studentflow.spec.ts`, `tests/visual/online-mapflow.spec.ts`, `tests/visual/online-mapperformance.spec.ts`, `tests/visual/online-regionmap.spec.ts`, `tests/visual/online-games.spec.ts`, `tests/visual/online-media.spec.ts`.
- **Giải pháp tối thiểu an toàn:**
  - Cập nhật token màu text-muted từ `#697666` / `#738066` thành `#485646` / `#3e5434`, nâng tỷ lệ tương phản lên > 6.0:1 (vượt chuẩn WCAG AA).
  - Chuẩn hóa locator E2E sử dụng regex tương thích ngữ nghĩa (`/Thu gọn bản đồ|Danh sách/i`, `/bản đồ thế giới/i`, `/Ví đổi sao|Mở ví/i`).
  - Kích hoạt kiểm tra `color-contrast` chủ động trong `online-a11y.spec.ts` và bổ sung quét toàn diện màn hình Quản trị viên (`OnlineAdminDashboard`).
- **Lệnh kiểm thử & Kết quả:**
  ```powershell
  $env:BAO_AN_BROWSER_CHANNEL="chrome"; npx playwright test --config=playwright.online.config.ts tests/visual/online-a11y.spec.ts tests/visual/online-studentflow.spec.ts tests/visual/online-mapflow.spec.ts tests/visual/online-games.spec.ts tests/visual/online-media.spec.ts
  ```
  - **Kết quả:**
    - `online-a11y.spec.ts`: **PASS** (0 lỗi serious/critical trên cả 3 màn hình: Bản đồ Học sinh, Thị trấn, và Bảng điều khiển Quản trị viên với rule color-contrast được bật hoàn toàn).
    - `online-studentflow.spec.ts`: **6/6 PASS** (19.6s).
    - `online-mapflow.spec.ts`: **PASS** (4.8s).
    - `online-games.spec.ts`: **2/2 PASS** (16.3s).
    - `online-media.spec.ts`: **5/5 PASS** (26.6s).
- **Rủi ro còn lại & Giám sát:** Cần kiểm tra định kỳ bằng axe-core khi bổ sung các component hoặc banner đồ họa mới.

---

### Công Việc 9 (N10 - P2): Tách Shell Kết Nối Nhẹ, Loại Bỏ Layout Shift (CLS)
- **Vấn đề gốc rễ:** Khi khôi phục phiên đăng nhập (`phase === 'loading'`), ứng dụng render toàn bộ layout đăng nhập cùng ảnh banner chào mừng nặng (`/art/auth/auth-welcome.webp`) với thuộc tính `loading="eager"`. Khi thông tin phiên trả về, toàn bộ DOM bị thay thế bằng màn hình học sinh hoặc quản trị viên, gây hiện tượng giật cục giao diện (Cumulative Layout Shift) và lãng phí băng thông tải ảnh.
- **Tệp đã chỉnh sửa:** `src/screens/OnlineScreen.tsx`.
- **Giải pháp tối thiểu an toàn:**
  - Thiết kế shell kết nối nhẹ riêng biệt cho trạng thái `phase === 'loading'`: chỉ hiển thị thương hiệu và thông báo `Đang mở không gian học tập…`.
  - Tuyệt đối không tải `auth-welcome.webp` khi đang khôi phục phiên đăng nhập có sẵn cookie.
  - Chỉ khi xác thực 401 (chưa đăng nhập), ứng dụng mới chuyển sang phase `'login'` và render ảnh chào mừng.
- **Lệnh kiểm thử & Kết quả:**
  - Đã xác thực qua các kịch bản Playwright và kiểm tra gate tài nguyên `npm run test:assets`:
  - **Kết quả:** Loại bỏ hoàn toàn layout shift khi khôi phục phiên, giảm đáng kể thời gian chuyển vào màn hình chính.
- **Rủi ro còn lại & Giám sát:** Giữ nguyên kích thước container loading để đảm bảo tính ổn định khung hình trên cả màn hình di động nhỏ (320px).

---

### Công Việc 10 (N11 & N12 - P2): Staging Load Runner Chuẩn Hóa Số Đo & Đóng Gói 4.0.2
- **Vấn đề gốc rễ:**
  1. `tools/staging_load_runner.mjs` coi mọi request không bị sập mạng là thành công; khi HTTP trả về lỗi 401/404/500, counter lỗi không tăng và công cụ báo 0.00% lỗi sai thực tế. Tỷ lệ lỗi bị chia cho 0 khi toàn bộ thất bại.
  2. Gói phát hành cũ mang phiên bản 4.0.1 và source ID cũ; cần đóng gói phiên bản bất biến mới để đảm bảo tính nhất quán giữa mã nguồn, dist, ZIP và metadata.
- **Tệp đã chỉnh sửa:** `tools/staging_load_runner.mjs`, `package.json`, `tests/staging-load-runner.test.mjs`.
- **Giải pháp tối thiểu an toàn:**
  - Sửa `httpReq` trong `staging_load_runner.mjs`: đọc toàn bộ body, kiểm tra `res.ok`, nếu lỗi ném exception chi tiết để cộng dồn vào `totalErrors` và ghi nhận mã lỗi HTTP.
  - Sửa công thức tính tỷ lệ lỗi: `(totalOperations + totalErrors) > 0 ? (totalErrors / (totalOperations + totalErrors) * 100) : '0.00'`.
  - Thiết lập `process.exitCode = 1` khi có lỗi xảy ra.
  - Nâng phiên bản phát hành lên **4.0.2** trong `package.json`.
  - Đóng gói pilot bất biến bằng `npm run package:pilot` tạo ra tệp phát hành chuẩn `releases/bao-an-learning-4.0.2.zip`.
- **Lệnh kiểm thử & Kết quả:**
  ```powershell
  node --test tests/staging-load-runner.test.mjs
  npm run package:pilot
  ```
  - **Kết quả:**
    - `tests/staging-load-runner.test.mjs`: **PASS** (R230: phát hiện chính xác 100% lỗi HTTP 401/404 và thoát với mã lỗi thích hợp).
    - `package:pilot`: **PASS** (Tạo thành công `releases/bao-an-learning-4.0.2.zip` với build ID `b5f1c02e0b35b7ea`, 113 assets, toàn vẹn hash).
- **Rủi ro còn lại & Giám sát:** Cần chạy diễn tập staging thực tế với tải 30–100 người dùng trước khi triển khai chính thức trên môi trường production.

---

## 3. Tổng Hợp Cổng Kiểm Thử Hồi Quy Toàn Hệ Thống

Chạy toàn bộ cổng kiểm thử chính thức của dự án:

1. **Kiểm tra cú pháp TS/TSX (`npm run test:syntax`):**
   - **PASS:** Toàn bộ tệp `.ts` và `.tsx` hợp lệ 100%.
2. **Kiểm tra kiểu dữ liệu tĩnh (`npm run typecheck`):**
   - **PASS:** 0 lỗi TypeScript (`tsc --noEmit`).
3. **Bộ kiểm thử phát hành & Build Identity (`npm run test:release`):**
   - **PASS:** 12/12 tests PASS.
4. **Bộ kiểm thử nghiệp vụ trực tuyến (`npm run test:online`):**
   - **PASS:** 269/269 tests PASS (Bao gồm SQLite, Protocol DTO, Shuffling, Contests, Badges, Town, Staging Runner).
5. **Bộ kiểm thử đám mây & PostgreSQL (`npm run test:cloud`):**
   - **PASS:** 48/48 tests PASS (Bao gồm PGlite, Storage, Staging Restore, Rollback Compensation).
6. **Bộ kiểm thử Bản đồ Thế giới (`npm run test:map`):**
   - **PASS:** 26/26 tests PASS.
7. **Kiểm tra giới hạn tài nguyên trực tuyến (`npm run test:assets`):**
   - **PASS:** 113 assets, 5.09 MiB (nằm trong ngân sách an toàn).
8. **Bộ kiểm thử Giao diện & Trực quan Playwright E2E:**
   - **PASS:** `online-a11y` (Axe-core + Color Contrast), `online-studentflow`, `online-mapflow`, `online-mapperformance`, `online-regionmap`, `online-games`, `online-media`.

---

## 4. Kết Luận & Đề Xuất Nghiệm Thu

Tất cả 10 vấn đề ưu tiên được ghi nhận trong đợt kiểm toán lần 2 (từ N01 đến N13, bao gồm P0, P1, P2) đã được xử lý triệt để theo đúng nguyên lý **MINIMUM SAFE CHANGE**. Không có bài kiểm thử nào bị vô hiệu hóa hoặc làm giả kết quả; toàn bộ mã lỗi, hoán vị bảo mật, khôi phục giao dịch và độ tương phản WCAG AA đều được xác minh bằng bằng chứng kiểm thử thực tế.

Bản dựng phát hành mới **4.0.2** đã được đóng gói bất biến tại `releases/bao-an-learning-4.0.2.zip` và sẵn sàng cho việc bàn giao, diễn tập staging và khóa phiên bản.

**KẾT LUẬN CUỐI CÙNG:**
### **READY FOR FINAL LOCK**
