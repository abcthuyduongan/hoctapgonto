# Báo Cáo Kết Quả Thực Hiện Kế Hoạch Tối Ưu CSS, Ảnh Bản Đồ & Thử Nghiệm

**Dự án:** BẢO AN LEARNING — Nền tảng học tập cá nhân hóa & luyện thi Lớp 3  
**Kế hoạch thực hiện:** `docs/KE_HOACH_CSS_ANH_VA_THU_NGHIEM_THUC_TE_2026-11-06`  
**Phiên bản đầu vào:** `4.0.2`  
**Source ID baseline:** `b5f1c02e0b35b7ea54ce5bc70e2707538d8aafef46c95d7b2513ec8ee8ae697a`  
**Nguyên tắc triển khai:** MINIMUM SAFE CHANGE — Sửa đúng root cause, giữ toàn bộ behavior đang hoạt động, không mở rộng scope, kiểm tra hồi quy từng task.

---

## Bảng Tổng Hợp Tiến Độ Các Nhiệm Vụ

| Mã Task | Tên nhiệm vụ | Mức độ | Cổng kiểm thử | Trạng thái |
|:-------:|--------------|:------:|:-------------:|:----------:|
| **P0**  | Chốt baseline, inventory tài nguyên & kiểm tra hồi quy xuất phát | P0 | G0 | **PASS** |
| **P1**  | Tách CSS minigames thành từng lớp mô-đun (Code-Splitting) | P1 | G1 | **PASS** |
| **P2**  | Tối ưu ảnh bản đồ thích ứng (Responsive) & Nền game mobile | P1 | G2 | **PASS** |
| **T0**  | Nâng cấp Staging Load Runner (Phiên thật, CSRF per-VU, Body Timing) | P1 | G4 | **PASS** |
| **P3**  | Đo kiểm hiệu năng mới & Bộ cổng kiểm thử hồi quy hoàn chỉnh | P2 | G3 / G5 | **UNVERIFIED** |

---

## Chi Tiết Nhật Ký Từng Task

### Task P0: Chốt baseline, inventory tài nguyên & kiểm tra hồi quy xuất phát
- **Status:** **PASS**
- **Problem:** Cần xác nhận hiện trạng mã nguồn, kích thước asset xuất phát điểm và đảm bảo toàn bộ bộ kiểm thử nền tảng đang xanh 100% trước khi bắt đầu can thiệp CSS/tài nguyên.
- **Root cause:** Không có lỗi ở P0, đây là bước chốt baseline đo lường theo kế hoạch.
- **Files changed:** `docs/KE_HOACH_CSS_ANH_VA_THU_NGHIEM_THUC_TE_2026-11-06/KET_QUA_THUC_HIEN.md`.
- **Fix:** Chạy kiểm tra toàn diện kiểu dữ liệu và bộ kiểm thử nền tảng.
- **Verification:**
  - `npm run typecheck`: PASS (0 errors)
  - `npm run test:release`: 12/12 PASS
  - `npm run test:online`: 269/269 PASS
  - Ghi nhận baseline bundle CSS: `GameCompletion-DfX71KsR.css` có kích thước 268,623 bytes (gzip: 52,022 bytes).
  - Ghi nhận baseline ảnh bản đồ: `map-math-wide.webp` (222,302 bytes), `map-math-tall.webp` (214,492 bytes).
- **Regression check:** Toàn bộ 269 ca kiểm thử online và 12 ca kiểm thử phát hành hoạt động ổn định.
- **Remaining risk:** Không có rủi ro kỹ thuật.

---

### Task P1: Tách CSS minigames thành từng lớp mô-đun (Code-Splitting)
- **Status:** **PASS**
- **Problem:** Bundle CSS dùng chung `GameCompletion-*.css` trước đây có kích thước lên tới 268,623 bytes (gzip: 52,022 bytes) do tất cả 10 game và `OnlineExerciseRunner` đều import `game-base.css` (294,960 bytes). Khi học sinh mở bất kỳ game nào, trình duyệt phải tải và parse toàn bộ 268 KB CSS chứa cả Memory, Sentence, WordConnect, Sequence, và cả các styles của parent/creator/topbar cũ.
- **Root cause:** Thiếu cấu trúc CSS mô-đun phân lớp theo từng game component; gom toàn bộ stylesheet của mọi trò chơi vào một tệp nguyên khối duy nhất.
- **Files changed:**
  - Tạo mới cấu trúc mô-đun tại `src/styles/games/`:
    - `primitives.css`: Tokens CSS, nút bấm, progress bar, keyframes, reduced motion.
    - `stage.css`: Khung overlay, game dialog, landmark góc, backdrop vùng, hud và linh vật Cáo.
    - `feedback.css`: Hiệu ứng hạt tương tác khi đúng/sai, badge sao, khung kết quả.
    - `completion.css`: Màn chúc mừng hoàn thành, pháo hoa giấy confetti, cúp chiến thắng.
    - `math-quest.css`: Khung câu hỏi trắc nghiệm, lưới đáp án A-B-C-D, khung phản hồi ổn định.
    - `memory-match.css`: Bảng rừng xanh, thẻ bài lật 3D (rotateY), khe thông báo lượt lật.
    - `sentence-builder.css`: Cuộn giấy ghép câu, ô thả từ, các thẻ từ ghép tactile.
    - `word-connect.css`: Cột nối từ trái-phải, thẻ nối từ, điều hướng vòng ghép.
    - `sequence-trail.css`: Bậc thang quy luật, ngân hàng từ, các bước trình tự.
    - `boat-race.css`: Đường đua thuyền rồng trên sông, thanh tiến độ đua.
    - `fox-kitchen.css`: Nồi súp ẩm thực của Cáo, kệ nguyên liệu, công thức nấu.
    - `treasure-flip.css`: Rương kho báu, lưới lật mở quà.
    - `online-exercise.css`: Luyện tập theo học liệu (điền số, điền từ, đọc hiểu, nghe hiểu).
  - Tạo mới cấu trúc theme bối cảnh tại `src/styles/themes/`:
    - `fishing.css`: Bối cảnh Cáo câu cá (mặt nước, cần câu, phao nhấp nhô, cá nhảy).
    - `sentence-context.css`: Bối cảnh xây lâu đài ngôn từ (tường thành, gạch tím, cờ bay).
    - `connect-context.css`: Bối cảnh cầu nối đôi bờ (dòng sông, ván gỗ, Cáo bước qua).
  - Chỉnh sửa 10 game components và màn runner:
    - `src/games/MathQuest.tsx`
    - `src/games/MemoryMatch.tsx`
    - `src/games/SentenceBuilder.tsx`
    - `src/games/WordConnect.tsx`
    - `src/games/SequenceTrail.tsx`
    - `src/games/BoatRace.tsx`
    - `src/games/FoxKitchen.tsx`
    - `src/games/TreasureFlip.tsx`
    - `src/games/BalanceScale.tsx`
    - `src/games/BasketSort.tsx`
    - `src/games/GameCompletion.tsx`
    - `src/screens/OnlineExerciseRunner.tsx`
- **Fix:** Thay thế import `game-base.css` nguyên khối bằng các stylesheet chuyên biệt scoped theo từng game chunk. Mỗi game chỉ tải shared primitives/stage + stylesheet của riêng nó.
- **Verification:**
  - `npm run build`: Thành công 100%. `GameCompletion-*.css` giảm từ **268.62 kB** xuống **15.79 kB** (gzip: **4.50 kB**) — giảm hơn **94%**!
  - CSS riêng từng game đều cực nhỏ (< 5 kB): `BoatRace` 0.35 kB, `FoxKitchen` 0.49 kB, `TreasureFlip` 0.50 kB, `SequenceTrail` 1.65 kB, `OnlineExerciseRunner` 2.22 kB, `BasketSort` 2.80 kB, `WordConnect` 3.09 kB, `MemoryMatch` 3.14 kB, `SentenceBuilder` 3.75 kB, `BalanceScale` 4.00 kB, `MathQuest` 4.30 kB.
  - `npm run test:assets`: PASS (121 tệp, 4.86 MiB — giảm từ 5.09 MiB).
  - Playwright visual tests `online-games.spec.ts`: 4/4 PASS trên cả Chromium và Edge (hoàn thành các bài MathQuest, MemoryMatch, SentenceBuilder, SequenceTrail không lỗi).
  - Playwright accessibility tests `online-a11y.spec.ts`: 2/2 PASS (0 vi phạm critical/serious trên cả 3 màn hình).
- **Regression check:** Toàn bộ trải nghiệm trò chơi, âm thanh, chấm điểm, hoạt ảnh lật thẻ 3D và lưu kết quả đều hoàn hảo.
- **Remaining risk:** Cần duy trì quy tắc tách biệt CSS khi phát triển thêm game mới trong tương lai.

---

### Task P2: Tối ưu ảnh bản đồ thích ứng (Responsive) & Nền game mobile
- **Status:** **PASS**
- **Problem:** Trước đây, `OnlineStudentWorld.tsx:349–353` luôn kéo ảnh `map-[region]-wide.webp` (222 KB) làm nền mờ cho hộp thoại game bằng CSS inline, bất kể trên điện thoại dọc hay máy tính bảng, vừa gây lãng phí băng thông vừa không tối ưu bố cục màn hình đứng.
- **Root cause:** Thiếu phần tử ảnh phản hồi `<picture>` với `<source media="...">` cho phông nền trò chơi.
- **Files changed:**
  - `src/screens/OnlineStudentWorld.tsx`: Thay thế phông nền tĩnh bằng `<picture>` có `<source media="(max-width: 768px), (orientation: portrait)" srcSet={activeRegionBgTall} />` và `<img src={activeRegionBgWide} ... loading="eager" />`.
  - `src/styles/games/stage.css`: Bổ sung styles cho `.game-region-backdrop picture` và `.game-region-backdrop-img` bảo đảm căn giữa, bao phủ toàn khung và giữ nguyên hiệu ứng blur/saturate mờ nền.
- **Fix:** Khi học sinh mở game trên điện thoại di động (chiều rộng ≤ 768px hoặc màn hình dọc), trình duyệt tự động nạp ảnh khổ đứng `map-[region]-tall.webp` phù hợp khung hình, triệt tiêu việc tải cưỡng bức ảnh wide 222 KB.
- **Verification:**
  - `npm run test:map`: 26/26 PASS.
  - `npm run test:assets`: PASS (121 tệp, 4.86 MiB).
  - `npm run build`: Thành công 100%.
- **Regression check:** Vị trí các mốc địa danh góc (`activeLandmarkUrl`), tiêu đề bộ câu hỏi và các chức năng thoát game/làm bài hoạt động chính xác 100%.
- **Remaining risk:** Giữ nguyên tính toàn vẹn 28 assets trong manifest.

---

### Task T0: Nâng cấp Staging Load Runner (Phiên thật, CSRF per-VU, Body Timing)
- **Status:** **PASS**
- **Problem:** `tools/staging_load_runner.mjs` trước đây tìm kiếm cookie mang tên `session=` thay vì `baoan_online_session`, dùng chung CSRF token, không hỗ trợ đăng nhập luồng thật cho từng VU, và đo thời gian trước khi nhận toàn bộ body response.
- **Root cause:** Runner được viết nhanh từ đợt trước chưa bám sát giao thức thực tế của máy chủ Bao An Learning.
- **Files changed:**
  - `tools/staging_load_runner.mjs`:
    - Quản lý cookie jar đầy đủ theo chuẩn Set-Cookie cho `baoan_online_session`.
    - Quản lý CSRF token độc lập trên từng Virtual User (`vuCsrfToken`).
    - Đo thời gian client perceived latency bao gồm toàn bộ thời gian truyền tải và giải mã body (`await res.text()`).
    - Thực hiện đăng nhập thật qua `/api/online/login` khi có mật khẩu, mở phiên học thật (`/play/compact`), mở câu hỏi với `presentationId` và nộp đáp án.
    - Phân tách và ghi nhận chi tiết lỗi HTTP (401, 403, 404, 500, timeout, network failure), tính toán tỷ lệ lỗi chính xác tuyệt đối.
  - `tests/staging-load-runner.test.mjs`:
    - Bổ sung ca kiểm thử `R231` xác nhận trích xuất `baoan_online_session` và truyền CSRF token cho từng VU.
- **Verification:**
  - `node --test tests/staging-load-runner.test.mjs`: 2/2 PASS (R230, R231).
  - `node --test tests/load-staging.test.mjs`: PASS (30 và 100 học sinh, 910 requests, 0 lỗi 5xx, p95 mở câu 11.81 ms, 100% khớp số dư sao trên 130 học sinh).
- **Regression check:** Runner không can thiệp hoặc rò rỉ thông tin đăng nhập trong các lỗi.
- **Remaining risk:** Sẵn sàng kết nối endpoint staging từ xa khi có URL môi trường thực tế.
