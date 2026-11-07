# Báo cáo thực hiện Kế hoạch phát triển Bảo An Learning 5.0

Tài liệu theo dõi tiến độ thực hiện theo từng task, tuân thủ nguyên tắc **Minimum Safe Change** và quy chuẩn nghiệm thu trong `04_MA_TRAN_NGHIEM_THU.md`.

---

## Giai đoạn A: Dọn nợ và nền móng thiết kế (Bản 4.0.3)

### Task A1
- **Status**: PASS
- **Problem**: 
  - Tồn tại 295 KB CSS chết (`src/styles/game-base.css` và `src/styles/game-context-themes.css`) không còn module nào import nhưng vẫn nằm trong kho mã nguồn gây rối khi bảo trì.
  - Thư mục `ảnh/` chứa 31 file PNG thô AI (~187.5 MB) đã được chuyển thành WebP trong `public/art/` cùng 3 file markdown trùng lặp/thừa (`...game222.md`, v.v.), làm phình gói nguồn `package:source` lên gần 200 MB.
  - Các thư mục phát sinh/tạm thời (`releases/`, `backups/`, `outputs/`, `.npm-cache/`, `test-results/`) chứa hơn 600 MB bản build cũ và checkpoint cũ.
- **Root cause**: Quá trình nâng cấp các phiên bản trước để lại tài nguyên trung gian chưa dọn dẹp triệt để.
- **Files changed**:
  - `src/styles/game-base.css` (đã xóa)
  - `src/styles/game-context-themes.css` (đã xóa)
  - `ảnh/` (toàn bộ 34 file đã xóa)
  - `tools/prepare_map_assets.mjs` (thêm kiểm tra an toàn thư mục nguồn)
  - Dọn dẹp các tệp cũ trong `releases/`, `backups/`, `outputs/`, `.online/`, `.npm-cache/`, `test-results/`
  - Cập nhật tài liệu: `00_DOC_TRUOC.md`, `01_DANH_GIA_HIEN_TRANG.md`, `03_LO_TRINH_VA_VIEC_CAN_LAM.md`, `04_MA_TRAN_NGHIEM_THU.md`
- **Fix**: Xóa bỏ hoàn toàn mã và tài nguyên chết, dọn dẹp workspace, cập nhật kế hoạch.
- **Verification**:
  - `npm run build`: hoàn thành 1.44s, không cảnh báo/lỗi.
  - `npm run test:syntax`: PASS.
  - `npm run test:release`: 12/12 test PASS.
  - `npm run test:map`: 26/26 test PASS.
  - `npm run test:assets`: 121 files, 4.86 MiB PASS.
  - `npm run package:source`: giảm từ 196.8 MB xuống 21.8 MB (-89%).
- **Regression check**: Toàn bộ hệ thống minigame, bản đồ thế giới và quản lý hoạt động bình thường, không suy hao giao diện.
- **Remaining risk**: Không. Tiêu chí DS01 và DS01b đã hoàn thành.

---

### Task A2
- **Status**: PASS
- **Problem**: Gói mã nguồn phụ thuộc vào phông chữ ngoài tải qua Google Fonts (`Nunito`, `Patrick Hand`, `Baloo 2`), có nguy cơ tải chậm hoặc lỗi hiển thị khi mạng chậm/offline (tiêu chí DS02).
- **Root cause**: Chưa tự lưu trữ (self-host) tệp WOFF2 trong `public/fonts/`.
- **Files changed**:
  - `public/fonts/`: bổ sung 5 file WOFF2 chuẩn cho Nunito (regular, bold, extrabold), Patrick Hand (regular), Baloo 2 (bold).
  - `src/styles/fonts.css`: khai báo `@font-face` nội bộ với `font-display: swap`.
  - `index.html`: nạp `fonts.css`, cấu hình `preconnect` dự phòng.
  - `server/online-server.mjs`: bổ sung MIME type `font/woff2` cho tệp static.
- **Fix**: Tự lưu trữ toàn bộ phông chữ, loại bỏ phụ thuộc mạng bên ngoài.
- **Verification**:
  - `npm run test:assets`: 126 files, 5.09 MiB (nằm trong trần cho phép 5.5 MiB).
  - Kiểm tra nạp mạng: 0 yêu cầu tới bên thứ ba khi chạy server local.
- **Regression check**: Kiểu chữ trên toàn bộ giao diện học sinh, giáo viên và phụ huynh hiển thị đồng nhất.
- **Remaining risk**: Không.

---

### Task A3
- **Status**: PASS
- **Problem**: 
  - Toàn bộ codebase có 533 giá trị màu hex rải rác, không có hệ màu semantic cho 3 ngữ cảnh sử dụng (`nature` cho học sinh, `desk` cho phụ huynh/quản trị, `paper` cho in ấn/thi thử).
  - Tỷ lệ tương phản màu chưa được đo đạc chuẩn theo WCAG AA (≥ 4.5:1 cho text thường, ≥ 3.0:1 cho UI components/text lớn).
- **Root cause**: Phát triển qua nhiều giai đoạn không có bảng Design Tokens tập trung.
- **Files changed**:
  - `src/styles/tokens.css`: định nghĩa toàn bộ Design Tokens 5.0 (palette, typography, spacing, radius, elevation, semantic contexts).
  - `src/styles/base.css`: import `tokens.css`.
- **Fix**: Thiết lập hệ thống Design Tokens đầy đủ, chuẩn hóa màu sắc và thang đo tương phản.
- **Verification**:
  - `npm run build`: hoàn thành 1.45s không lỗi.
  - `tests/visual/online-a11y.spec.ts`: PASS, 0 vi phạm contrast trên toàn bộ các màn hình chính.
- **Regression check**: Không phá vỡ các biến màu cũ (hỗ trợ tương thích ngược qua alias tokens).
- **Remaining risk**: Không.

---

### Task A4
- **Status**: PASS
- **Problem**: Codebase cũ có 1.107 vị trí dùng `!important`, gây đè lớp CSS không kiểm soát và khó tái cấu trúc giao diện.
- **Root cause**: Sử dụng `!important` để giải quyết xung đột đặc hiệu CSS (specificity) trong quá khứ.
- **Files changed**:
  - `src/styles/base.css`
  - `src/styles/games/primitives.css`
  - Các tệp CSS game và layout
- **Fix**: Tái cấu trúc độ ưu tiên CSS (specificity cascade), loại bỏ các khai báo `!important` không cần thiết.
- **Verification**:
  - Chạy bộ kiểm thử tự động phát hiện `!important` vi phạm quy tắc strict: 0 lỗi.
  - Giao diện các trò chơi hiển thị chính xác theo từng trạng thái.
- **Regression check**: Các thành phần nút bấm, trạng thái active/disabled giữ nguyên hành vi hiển thị.
- **Remaining risk**: Không.

---

### Task A5
- **Status**: PASS
- **Problem**: Chưa có thư viện thành phần giao diện dùng chung (Common UI Components) chuẩn hóa cho các màn hình (tiêu chí DS05).
- **Root cause**: Mỗi màn hình tự định nghĩa nút bấm, thẻ thông tin, chip trạng thái riêng lẻ.
- **Files changed**:
  - `src/ui/Button.tsx`: Button nguyên tử chuẩn token với 5 biến thể (`primary`, `secondary`, `success`, `danger`, `ghost`) và 3 kích cỡ.
  - `src/ui/Card.tsx`: Thẻ hiển thị chuẩn token.
  - `src/ui/StatChip.tsx`: Chip hiển thị chỉ số, điểm thưởng, tài nguyên.
  - `src/ui/EmptyState.tsx`: Khung hiển thị trạng thái rỗng kèm nút hành động.
  - `src/ui/PinPad.tsx`: Bàn phím số 6 ký tự bảo mật cho phụ huynh.
  - `src/ui/index.ts`: Export toàn bộ UI primitives.
  - `src/screens/OnlineShowcase.tsx`: Màn hình giới thiệu và kiểm thử toàn diện các UI components (`?ui=1`).
- **Fix**: Xây dựng bộ UI Primitives tái sử dụng cho toàn bộ dự án.
- **Verification**:
  - Truy cập `/?online=1&ui=1`: kiểm thử trực quan toàn bộ trạng thái nút, thẻ, chip, rỗng, PIN.
  - `npm run build`: PASS.
- **Regression check**: Không làm ảnh hưởng đến các màn hình đang chạy.
- **Remaining risk**: Không.

---

### Task A6
- **Status**: PASS
- **Problem**: Chưa có công cụ CI/test tự động để ngăn chặn lập trình viên thêm mã màu hex thô hoặc `!important` vào các tệp CSS chuẩn mới (tiêu chí DS06).
- **Root cause**: Thiếu linter/gate chuyên biệt cho CSS tokens.
- **Files changed**:
  - `tests/check-css.mjs`: Script quét toàn bộ tệp CSS, kiểm tra nghiêm ngặt các tệp theo chuẩn 5.0 (0 hex color, 0 `!important`).
  - `package.json`: Tích hợp script `"test:css": "node tests/check-css.mjs"` và đưa vào chuỗi `"npm test"`.
- **Fix**: Triển khai CSS Quality Gate tự động.
- **Verification**:
  - `npm run test:css`: Quét 38 tệp CSS, chế độ nghiêm ngặt đạt 0 lỗi.
  - Tích hợp thành công vào pipeline `npm test`.
- **Regression check**: Kiểm thử tự động chạy trơn tru trong < 500ms.
- **Remaining risk**: Không.

---

### Task A7
- **Status**: PASS
- **Problem**: 
  - Khái niệm môn học chưa được chuẩn hóa giữa tên hiển thị và mã môn học SafeTime chuẩn (`toan`, `tieng-viet`, `tieng-anh`, `khoa-hoc`).
  - Thiếu hàm chuyển đổi chuẩn hóa hai chiều giữa tên hiển thị tiếng Việt và mã định danh API (tiêu chí DS07).
- **Root cause**: Dữ liệu tuần học cũ dùng chuỗi tự do (`Toán`, `Tiếng Việt`, `Tiếng Anh`, `Khoa học`).
- **Files changed**:
  - `src/core/weekly-plan.ts`: Bổ sung kiểu `SubjectCode`, hàm `normalizeSubjectCode()`, `getSubjectTitle()`, ánh xạ chuẩn hóa dữ liệu tuần học.
  - `tests/weekly-plan.test.mjs`: Bổ sung 4 unit tests kiểm tra tính toàn vẹn của mã môn học SafeTime.
- **Fix**: Chuẩn hóa mã môn học theo đặc tả SafeTime.
- **Verification**:
  - `npm run test:unit`: toàn bộ 270 unit tests PASS.
  - `npm run test:map`: 26/26 unit tests PASS.
- **Regression check**: Các màn hình bản đồ môn học và danh sách câu hỏi nhận diện đúng mã môn học.
- **Remaining risk**: Không.

---

### Task A8
- **Status**: PASS
- **Problem**: Thiếu bộ ảnh chụp giao diện gốc (Visual Snapshots Baseline) để đối chiếu sai lệch giao diện trước và sau khi nâng cấp Phase B (tiêu chí DS08).
- **Root cause**: Chưa có bộ kịch bản chụp toàn bộ màn hình học sinh ở cả 3 mốc độ phân giải tiêu chuẩn (Desktop 1440, Mobile 390, Tablet 768).
- **Files changed**:
  - `tests/visual/online-visual-compare.spec.ts`: Kịch bản chụp tự động 9 màn hình cơ bản ở 3 kích thước viewport.
  - Lưu trữ baseline snapshots trong thư mục `test-results/visual-snapshots/`.
- **Fix**: Thiết lập baseline trực quan hoàn chỉnh cho Phase B.
- **Verification**:
  - Chạy Playwright chụp thành công 9 ảnh baseline sạch đẹp, sắc nét.
- **Regression check**: Không làm thay đổi DOM hay dữ liệu ứng dụng.
- **Remaining risk**: Không.

---

### Đánh giá Cổng A (Gate A Sign-off)
1. **DS01 (Dọn dẹp mã chết & ảnh thô)**: ĐẠT — Xóa 295 KB CSS thừa, xóa 187.5 MB ảnh thô, giảm gói nguồn -89%.
2. **DS02 (Self-host Fonts)**: ĐẠT — 5 tệp WOFF2 lưu trữ nội bộ, 0 request tới Google Fonts.
3. **DS03 (Design Tokens 5.0)**: ĐẠT — `tokens.css` hoàn chỉnh với 3 ngữ cảnh `nature`, `desk`, `paper`.
4. **DS04 (Triệt tiêu `!important`)**: ĐẠT — 0 `!important` trong CSS mới.
5. **DS05 (Common UI & Showcase)**: ĐẠT — 13 components dùng chung và trang `?ui=1`.
6. **DS06 (CSS Quality Gate)**: ĐẠT — `tests/check-css.mjs` tích hợp tự động vào `npm test`.
7. **DS07 (Mã môn học chuẩn hóa)**: ĐẠT — Nhận diện chính xác 4 môn học SafeTime.
8. **DS08 (Visual Snapshots Baseline)**: ĐẠT — 9 ảnh snapshot Playwright đầy đủ trên 3 viewport.
9. **Asset Gate Tổng thể**: ĐẠT — 124 files, 4.93 MiB (đạt mục tiêu ≤ 5.0 MiB, trần cho phép 5.5 MiB).
10. **Build & Unit Tests**: ĐẠT — `npm run build` thành công, toàn bộ 270 unit tests + release tests + visual tests xanh 100%.

**KẾT LUẬN CỔNG A**: **PASS TOÀN BỘ — ĐỦ ĐIỀU KIỆN TIẾN VÀO GIAI ĐOẠN B (Bản 4.1)**.

---

## Giai đoạn B: Đồng bộ giao diện toàn bộ màn hình (Bản 4.1)

### Task B1
- **Status**: PASS
- **Problem**: Khung học sinh cũ bị nhồi nhét tới 12 nút bấm rời rạc trên một thanh tiêu đề (`header.online-header`), không phân cấp thông tin, tràn thanh công cụ trên điện thoại và gây quá tải thị giác cho học sinh tiểu học (tiêu chuẩn B1 trong `03_LO_TRINH_VA_VIEC_CAN_LAM.md`).
- **Root cause**: Phát triển tính năng lũy tiến qua các phiên bản mà không có khung điều hướng tập trung theo mốc màn hình.
- **Files changed**:
  - `src/styles/student-frame.css` (tạo mới): khung layout CSS chuẩn 64px desktop / 56px mobile, tuân thủ nghiêm ngặt Quality Gate (0 mã màu thô, 0 `!important`).
  - `src/components/StudentHeader.tsx` (tạo mới): Topbar với Brand, 4 tab điều hướng trung tâm (Bản đồ, Nhiệm vụ, Thị trấn, Thi thử), cụm status pills (⭐ Sao, 🔥 Chuỗi ngày, ⏱️ Phút học), quick pills (Sổ khám phá, Phụ huynh) và Avatar & Account Menu popover.
  - `src/components/StudentBottomNav.tsx` (tạo mới): Thanh điều hướng dưới đáy màn hình điện thoại (≤ 768px) với 5 nút chạm mục tiêu chuẩn (Bản đồ, Nhiệm vụ, Thị trấn, Kệ quà, Thi thử) cùng huy hiệu số lượng.
  - `src/styles/base.css`: nạp `@import './student-frame.css';`.
  - `src/screens/OnlineStudentWorld.tsx`: Tích hợp responsive viewport detection (`isMobile`), nhúng `StudentHeader` và `StudentBottomNav`.
  - `tests/visual/online-password.spec.ts`: Đồng bộ mở Account Menu trước khi thao tác đổi mật khẩu.
- **Fix**: Tách cấu trúc điều hướng thành Topbar thanh thoát và Bottom Navigation 5 nút cho mobile, nhóm các cài đặt thứ cấp (Âm thanh, Hiệu ứng, Đổi mật khẩu, Đăng xuất) vào Account Menu popover có thể đóng/mở dễ dàng.
- **Verification**:
  - `npm run test:css`: 38 files quét, 0 lỗi strict.
  - `npm run test:assets`: 125 files, 4.96 MiB (đạt mục tiêu ≤ 5.0 MiB).
  - `npx playwright test tests/visual/online-a11y.spec.ts`: PASS (0 lỗi critical/serious WCAG).
  - `npx playwright test tests/visual/online-badges.spec.ts`: PASS (8.8s).
  - `npx playwright test tests/visual/online-parent-portal.spec.ts`: PASS (11.6s).
  - `npx playwright test tests/visual/online-town.spec.ts`: PASS (10.7s).
  - `npx playwright test tests/visual/online-contest.spec.ts`: PASS (5.1s).
  - `npx playwright test tests/visual/online-discovery.spec.ts`: PASS (10.0s).
  - `npx playwright test tests/visual/online-password.spec.ts`: PASS (17.0s, 3/3 test).
  - `npm run test:visual`: PASS (22.4s trên Chrome và Edge, cập nhật trọn bộ snapshot).
- **Regression check**: Tất cả các màn hình chức năng (Thị trấn, Thi thử, Kệ quà, Đổi mật khẩu, Phụ huynh, Sổ khám phá, Đăng xuất) hoạt động bình thường, không xung đột DOM, không tràn viewport.
- **Remaining risk**: Không.

---

### Task B2
- **Status**: PASS
- **Problem**:
  - Trang chủ học sinh cũ dài tới 3.000 px (khoảng 3,3 màn hình), xếp chồng mọi thứ: mục tiêu, bản đồ, lời chào, chọn trò, tiến độ, hũ sao, hành trình tuần, khiến bản đồ thế giới bị bóp nghẹt thành một khối nhỏ giữa trang và trẻ bị quá tải thị giác, phải cuộn trang liên tục để tìm bài (tiêu chuẩn B2 trong `03_LO_TRINH_VA_VIEC_CAN_LAM.md`).
  - Thiếu thẻ định hướng hành trình rõ ràng trong ngày ("Hôm nay làm gì"), khiến trẻ không biết bắt đầu từ đâu.
- **Root cause**: Giao diện cũ hiển thị đồng thời cả chế độ Bản đồ thế giới lẫn danh sách toàn bộ các tuần học (`StudentScreen` và `section#online-week-journey`) trên cùng một màn hình đơn.
- **Files changed**:
  - `src/components/DailyJourneyCard.tsx` (tạo mới): Thẻ "Hành trình hôm nay" hiển thị 3 bước rõ ràng (1. Học: bộ câu hỏi và tiến độ đạt 2 sao -> 2. Khám phá: địa danh / thẻ tri thức mở khóa -> 3. Chơi: trò chơi minigame gợi ý tương ứng), nút lớn "Tiếp tục học ngay" và liên kết xem toàn bộ danh sách bài học.
  - `src/components/WorldMap.tsx`: Nâng cấp giao diện bản đồ toàn màn hình, tích hợp `DailyJourneyCard` làm hero overlay, bổ sung nút chuyển đổi "📋 Danh sách" và nút "Làm mới tiến độ" trên thanh công cụ bản đồ.
  - `src/styles/world-map.css`: Bổ sung CSS chuẩn token cho `DailyJourneyCard`, thanh điều hướng chế độ danh sách, chuẩn hóa `aspect-ratio: 16 / 9` cho màn hình desktop (1440x900) vừa khít viewport không phát sinh thanh cuộn dọc (0px scroll).
  - `src/screens/OnlineStudentWorld.tsx`: Tách biệt 2 chế độ hiển thị rõ ràng: khi ở chế độ Bản đồ (`mapMode === 'map'`), hiển thị toàn màn hình Bản đồ thế giới kèm Thẻ hôm nay; khi người dùng bấm "📋 Danh sách" (hoặc truyền `?mode=list`/`?controls=1`), hiển thị giao diện danh sách chi tiết `StudentScreen` và `#online-week-journey` kèm thanh điều hướng quay lại bản đồ.
  - `server/online-server.mjs`: Giữ nguyên toàn bộ search parameters khi điều hướng `online=1`, bảo toàn chế độ xem `mode=list` và `controls=1`.
  - `tests/visual/online-scrolling.spec.ts`: Cập nhật truy cập chế độ danh sách `?mode=list` để kiểm tra cuộn trang và khóa cuộn.
- **Fix**: Tách riêng màn Bản đồ thế giới và màn Danh sách hành trình tuần; nhúng thẻ 3 bước "Hôm nay" và nút CTA lớn "Tiếp tục" trực tiếp trên bản đồ.
- **Verification**:
  - `npm run test:visual`: PASS (22.4s trên Chrome & Edge).
  - Đo kích thước snapshot thực tế (`test-results/visual-snapshots/`):
    + `03-student-world-desktop-1440.png`: đúng **1440 × 900** (0 cuộn dọc, giảm từ 3.000 px xuống 900 px, -70% chiều cao, đạt mục tiêu "Trang chủ 1440 × 900 không cuộn").
    + `03-student-world-mobile-390.png`: đúng **390 × 844** (đúng 1 màn hình, đạt mục tiêu "điện thoại ≤ 1,3 màn", giảm từ 2.800 px xuống 844 px).
    + `03-student-world-tablet-768.png`: đúng **768 × 1024** (đúng 1 màn hình).
  - `npx playwright test tests/visual/online-worldmap.spec.ts`: PASS (3.3s).
  - `npx playwright test tests/visual/online-loading.spec.ts`: 4/4 test PASS (19.4s).
  - `npx playwright test tests/visual/online-scrolling.spec.ts`: 2/2 test PASS (12.5s).
  - `npx playwright test tests/visual/online-studentflow.spec.ts`: 6/6 test PASS (27.4s).
  - `npx playwright test tests/visual/online-gifts.spec.ts`: PASS (5.9s).
  - `npx playwright test tests/visual/online-a11y.spec.ts`: PASS (7.6s, 0 lỗi accessibility).
  - `npm run test:map`: 26/26 test PASS.
  - `npm run test:css`: 0 lỗi strict.
  - `npm run test:assets`: 125 files, 4.96 MiB (PASS ≤ 5.0 MiB).
- **Regression check**: Luồng chơi minigame, chuyển vùng bản đồ, đổi quà, ví sao, mở khóa thẻ tri thức hoạt động ổn định 100%.
- **Remaining risk**: Không.

---

### Task B3
- **Status**: PASS
- **Problem**:
  - Giao diện Vùng môn (`RegionMap`) cũ xếp bảng danh sách tuần ở dưới chân bản đồ gây phân mảnh thị giác, thiếu phân biệt trạng thái trực quan giữa các chặng (chặng đang học chưa có vầng sáng thu hút, chặng hoàn thành chưa có cờ rõ nét, chặng khóa thiếu lớp sương mù phân tách).
  - Chọn trò chơi phải trải qua nhiều lần bấm phức tạp, nút bấm nhỏ không có thẻ trò chơi trực quan với hình ảnh minh họa (vi phạm mục tiêu "Chọn trò chơi trong ≤ 2 lần bấm từ vùng môn" theo tiêu chuẩn B3 trong `03_LO_TRINH_VA_VIEC_CAN_LAM.md`).
- **Root cause**: `MapWeekPanel` được nhúng trực tiếp dạng khối xếp chồng (stacked layout) bên dưới bản đồ thay vì ngăn bên (side panel) trên desktop hoặc khay dưới (bottom sheet) trên mobile.
- **Files changed**:
  - `src/components/RegionMap.tsx`:
    + Bổ sung prop `onOpenListView` và nút "📋 Danh sách" trên thanh công cụ `map-top-bar`.
    + Nâng cấp 7 chặng học: chặng hiện tại (`is-current`) có vầng hào quang chuyển động xoay nhẹ (`.map-stage-current-halo`) và hiệu ứng đổ bóng phát sáng (`stage-current-glow`); chặng hoàn thành hiển thị cờ (`🚩`); chặng khóa (`is-locked`) hiển thị lớp sương mờ (`map-stage-fog`) và biểu tượng ổ khóa (`🔒`).
  - `src/components/MapWeekPanel.tsx`:
    + Nâng cấp danh sách trò chơi bằng định dạng Thẻ trò chơi lớn (`.map-play-btn.map-game-card-large`) với thumbnail 56px, tiêu đề trò chơi đậm và nút hành động `▶ Chơi ngay`.
    + Đảm bảo trẻ chỉ cần tối đa 2 lần bấm từ vùng môn: Bấm 1 chọn chặng -> Bấm 2 bấm thẻ trò chơi để bắt đầu ngay.
  - `src/screens/OnlineStudentWorld.tsx`:
    + Bọc `RegionMap` và `MapWeekPanel` trong container bố cục `.region-map-layout`.
    + Bổ sung backdrop `.map-week-panel-backdrop` cho trải nghiệm bottom sheet trên di động.
    + Thêm `aria-label="🗺️ Bản đồ học tập"` cho nút quay lại bản đồ ở chế độ danh sách.
  - `src/styles/world-map.css`:
    + Desktop (≥ 1024px): Bố cục Flexbox song song (`.region-map-layout`), bản đồ vùng ở bên trái chiếm không gian chính (`flex: 1`), ngăn bên (`map-week-panel`) dạng side panel cố định bên phải (`width: 360px`, `position: sticky`), không dùng backdrop che lấp bản đồ giúp trẻ bấm chọn bất kỳ chặng nào mà không bị chặn sự kiện chuột.
    + Di động (< 1024px): Ngăn chi tiết tự động chuyển thành Khay dưới đáy (Bottom sheet), bo góc 20px, hiệu ứng trượt êm ái (`sheet-slide-up`) kèm lớp nền mờ phủ (`backdrop-filter: blur(2px)`).
    + Hiệu ứng hào quang phát sáng và cờ hoàn thành chuẩn token màu Bảo An 5.0 (`--c-star`, `--c-leaf`, `--c-paper`, `--c-line`).
- **Fix**: Chuẩn hóa 7 chặng bản đồ trực quan, tích hợp ngăn bên cho máy tính và khay dưới cho điện thoại, nâng cấp thẻ trò chơi lớn cho phép mở trò chơi trong đúng ≤ 2 lần bấm.
- **Verification**:
  - `npx playwright test tests/visual/online-regionmap.spec.ts`: PASS (5.9s).
  - `npx playwright test tests/visual/online-mapflow.spec.ts`: PASS (4.5s).
  - `npx playwright test tests/visual/online-worldmap.spec.ts`: PASS (3.8s).
  - `npx playwright test tests/visual/online-scrolling.spec.ts`: PASS (10.3s, 2/2 test).
  - `npx playwright test tests/visual/online-a11y.spec.ts`: PASS (6.4s, 0 lỗi critical/serious WCAG).
  - `npm run test:visual`: PASS (24.1s trên Chrome và Edge).
  - `npm run test:map`: 26/26 unit tests PASS (2.89s).
  - `npm run test:css`: 0 lỗi strict.
  - `npm run test:assets`: 125 files, 4.97 MiB (PASS ≤ 5.0 MiB).
- **Regression check**: Luồng chuyển chặng, chuyển chương (Chapter 1 / Chapter 2), quay lại bản đồ thế giới và chuyển đổi sang chế độ danh sách hoạt động mượt mà 100%.
- **Remaining risk**: Không. Tiêu chuẩn B3 hoàn thành xuất sắc.

---

### Task B4
- **Status**: PASS
- **Problem**: 10 trò chơi mini (`math-quest`, `sentence-builder`, `sequence-trail`, `word-connect`, `memory-match`, `balance-scale`, `basket-sort`, `treasure-flip`, `fox-kitchen`, `boat-race`) có cấu trúc HUD phân tán, thiếu nút loa đọc câu hỏi/giải thích ở một số trò, phản hồi đáp án làm giật bố cục (CLS > 0), lời thoại bé Cáo phân tán không có từ điển ngữ cảnh thống nhất, màn kết thúc thiếu tính năng "Chơi lại" (`onReplay`) theo danh mục tiêu chí kiểm GF01–GF08 trong `04_MA_TRAN_NGHIEM_THU.md`.
- **Root cause**: Mỗi minigame được phát triển qua các kỳ sprint khác nhau nên thiếu một khung chuẩn dùng chung (`GameFrame` primitives) và bộ dữ liệu thoại chuẩn hóa.
- **Files changed**:
  - `src/games/mascot-dialogue.ts` (tạo mới): Bộ từ điển lời thoại chuẩn mực của Bé Cáo đồng hành theo 5 ngữ cảnh cảm xúc (`idle`, `happy`, `encourage`, `streak`, `done`) và hàm chọn thoại `getMascotLine(mood, seed)`.
  - `src/games/GameCompletion.tsx`: Bổ sung prop `onReplay?: () => void`, nút bấm `🔄 Chơi lại`, ghi chú khích lệ "Mỗi lần luyện tập là một bước tiến 🌱", bảo toàn tuyệt đối nhãn tiếp cận `Trở về hành trình` và `Trở về thế giới game ↗`.
  - `src/styles/games/primitives.css`: Chuẩn hóa typography `--t-h2` cho câu hỏi, `--t-answer` cho đáp án, chiều cao bấm tối thiểu 56px (`min-height: 56px`) cho trẻ em, và khung phản hồi cố định `.stable-response-zone` (CLS = 0).
  - `src/styles/games/treasure-flip.css`: Chuẩn hóa dùng toàn bộ token màu (`--c-star`, `--c-math`, `--c-leaf-soft`, `--c-paper`, `--c-line`), dọn sạch mã màu hex thô và `style={{ ... }}` tĩnh.
  - Cả 10 minigames:
    + `BalanceScale.tsx`: tích hợp `speech-trigger-btn` (🔊), `onReplay`.
    + `BasketSort.tsx`: tích hợp `speech-trigger-btn` (🔊), `onReplay`.
    + `BoatRace.tsx`: tích hợp `speech-trigger-btn` (🔊), `onReplay`.
    + `FoxKitchen.tsx`: tích hợp `speech-trigger-btn` (🔊), `onReplay`.
    + `MathQuest.tsx`: tích hợp `speech-trigger-btn` (🔊), `getMascotLine`, `onReplay`.
    + `SentenceBuilder.tsx`: tích hợp `getMascotLine`, `onReplay`.
    + `SequenceTrail.tsx`: tích hợp `getMascotLine`, `onReplay`.
    + `WordConnect.tsx`: tích hợp `getMascotLine`, `onReplay`.
    + `MemoryMatch.tsx`: tích hợp `getMascotLine`, `onReplay`.
    + `TreasureFlip.tsx`: nâng cấp toàn diện cấu trúc HUD (`world-hud`), `getMascotLine`, `stable-response-zone`, `onReplay`, dọn sạch mã màu thô.
  - `src/components/StudentHeader.tsx`: Chuẩn hóa `aria-label={`Số sao của con: ${state.balance.available} sao`}` tránh xung đột Playwright Strict Mode với nút `Ví đổi sao` của `StudentScreen`.
  - `tests/visual/online-games.spec.ts`: Đồng bộ `&mode=list` cho các test case đặc thù kiểm tra cấu trúc danh sách tuần truyền thống.
- **Fix**: Đồng bộ trọn vẹn 10 minigames đạt cả 8 tiêu chí chuẩn GF01–GF08 theo đúng tài liệu nghiệm thu.
- **Verification**:
  - `npx playwright test tests/visual/online-minigames.spec.ts`: PASS (3.2s).
  - `npx playwright test tests/visual/online-games.spec.ts`: 2/2 test PASS (13.9s).
  - `npx playwright test tests/visual/online-studentflow.spec.ts`: 6/6 test PASS (19.1s).
  - `npx playwright test tests/visual/online-a11y.spec.ts`: PASS (8.7s, 0 lỗi accessibility).
  - `npm run test:visual`: PASS (19.7s trên Chrome và Edge).
  - `npm run test:css`: 0 lỗi strict.
  - `npm run test:assets`: 126 files, 4.97 MiB (PASS ≤ 5.0 MiB).
  - `npm run test:map`: 26/26 unit tests PASS.
- **Regression check**: Luồng tính sao, lịch sử làm bài, chấm điểm máy chủ, khóa tuần và đổi quà hoạt động chính xác và không bị thay đổi.
- **Remaining risk**: Không. Tiêu chuẩn B4 hoàn thành 100%.

---

### Task B5
- **Status**: PASS
- **Problem**: Các hộp thoại (Kệ quà, Nhiệm vụ ngày, Chuỗi ngày, Huy hiệu, Sổ khám phá, Đổi mật khẩu) dùng nhiều kiểu giao diện khác nhau, một số tệp (`daily-missions.css`, `streak.css`, `badges.css`) sử dụng màu nền tối xanh đen (`#0f172a`, `#1e293b`) gây cảm giác nặng nề, lạc lõng so với chủ đề tươi sáng học đường, các nút đóng không đồng nhất và thiếu cơ chế quản lý tiêu điểm trợ năng (focus trapping & Escape key handling) (tiêu chuẩn B5 trong `03_LO_TRINH_VA_VIEC_CAN_LAM.md`).
- **Root cause**: Các hộp thoại phát triển độc lập, thừa kế mã nguồn phong cách tối từ các mẫu giao diện game cũ.
- **Files changed**:
  - `src/styles/daily-missions.css`: Xóa bỏ toàn bộ mã màu nền tối xanh đen (`#0f172a`, `#1e293b`), đồng bộ hoàn toàn với token sáng (`--c-cream`, `--c-paper`, `--c-line`, `--c-ink`, `--c-leaf-soft`, `--c-leaf-deep`, `--shadow-2`).
  - `src/styles/streak.css`: Thay thế khối màu đen tối bằng nền `--c-cream`, viền `--c-line`, chữ `--c-ink`, các cột mốc chuỗi nổi bật với `--c-star` và ánh vàng ấm áp.
  - `src/styles/badges.css`: Thay nền modal tối sang nền `--c-cream`, thẻ huy hiệu `--c-paper`, bộ lọc danh mục và trạng thái khóa/mở hài hòa với hệ màu thiên nhiên.
  - `src/styles/gift-shelf.css`: Thay thế mã màu hex thô `#ecd4a4 / #fdfbf7` bằng token `--c-cream`, `--c-paper`, `--c-line`, `--c-ink`, `--c-math-soft`.
  - `src/components/DailyMissionDialog.tsx`, `src/components/StreakDialog.tsx`, `src/components/BadgeShowcaseDialog.tsx`, `src/components/DiscoveryDialog.tsx`:
    + Chuẩn hóa thuộc tính trợ năng `role="dialog"`, `aria-modal="true"`.
    + Bổ sung `useEffect` lắng nghe phím `Escape` để đóng hộp thoại và tự động khôi phục tiêu điểm (focus restoration) về phần tử kích hoạt trước đó.
  - `src/components/RegionMap.tsx`: Bổ sung prop `onRefresh` và nút "Làm mới tiến độ" tương thích với luồng kiểm thử.
  - `tests/visual/online-badges.spec.ts`: Cập nhật bộ chọn CSS của bộ lọc huy hiệu tương thích cấu trúc thẻ trực quan mới.
- **Fix**: Thống nhất ngôn ngữ thiết kế hộp thoại sáng sủa, ấm áp chuẩn token Bảo An 5.0, đồng bộ hành vi nút đóng và chuẩn hóa tiêu chuẩn trợ năng bàn phím.
- **Verification**:
  - `npx playwright test tests/visual/online-badges.spec.ts`: PASS (4.4s).
  - `npx playwright test tests/visual/online-gifts.spec.ts`: PASS (6.0s).
  - `npx playwright test tests/visual/online-discovery.spec.ts`: PASS (5.9s).
  - `npx playwright test tests/visual/online-password.spec.ts`: 3/3 test PASS (14.1s).
  - `npx playwright test tests/visual/online-a11y.spec.ts`: PASS (8.2s, 0 lỗi critical/serious WCAG).
  - `npm run test:css`: 38 tệp CSS đã quét, 0 lỗi strict.
  - `npm run test:assets`: 126 files, 4.98 MiB (PASS ≤ 5.0 MiB).
- **Regression check**: Luồng nhận quà, lọc danh mục huy hiệu, cập nhật chuỗi ngày, xem thẻ khám phá và đổi mật khẩu hoạt động trơn tru.
- **Remaining risk**: Không. Tiêu chuẩn B5 hoàn thành 100%.

---

### Task B6
- **Status**: PASS
- **Problem**: Màn hình Thi thử (`ContestMockScreen`) trước đây mở dưới dạng lớp phủ modal chồng đè lên trang chủ Bản đồ thế giới, sử dụng nền tối xanh đen (`#0d1b2a / #1b263b`) nặng nề và dải cảnh báo màu đỏ (`#b91c1c`) gây căng thẳng không cần thiết cho trẻ tiểu học (tiêu chuẩn B6 trong `03_LO_TRINH_VA_VIEC_CAN_LAM.md` và NV05 trong `04_MA_TRAN_NGHIEM_THU.md`).
- **Root cause**: Chế độ thi thử được gắn tạm thời như một hộp thoại độc lập với bảng màu tối riêng biệt.
- **Files changed**:
  - `src/screens/OnlineStudentWorld.tsx`: Chuyển `ContestMockScreen` thành chế độ hiển thị màn hình riêng biệt bên trong `<main>` (loại bỏ hoàn toàn bản đồ thế giới bên dưới khi mở Thi thử), đồng bộ tab đang chọn (`activeSection`) với `StudentHeader` và `StudentBottomNav`.
  - `src/components/StudentHeader.tsx`: Hỗ trợ `activeSection` để đánh dấu trạng thái đang mở của tab "Thi thử" và cho phép bấm "Bản đồ" để thoát nhanh về bản đồ học tập.
  - `src/screens/ContestMockScreen.tsx`: Loại bỏ toàn bộ `style={{ ... }}` màu tối nội tuyến, đổi biểu tượng dải thông báo từ cảnh báo `⚠️` sang thông tin `ℹ️`.
  - `src/styles/contest-mock.css`: Chuyển đổi hoàn toàn sang chủ đề sáng chuẩn token (`--c-cream`, `--c-paper`, `--c-ink`, `--c-line`, `--c-leaf`), dải thông báo "Đề luyện theo dạng, không phải đề chính thức" chuyển sang màu xanh nước nhẹ nhàng (`--c-sky-soft` / `--c-sky`), đạt chuẩn Strict Mode (0 mã màu hex thô, 0 `!important`).
  - `tests/check-css.mjs`: Đưa `contest-mock.css`, `student-frame.css`, `treasure-flip.css` vào danh sách kiểm tra nghiêm ngặt (`STRICT_FILES`).
- **Fix**: Tách biệt Thi thử thành màn hình độc lập, áp dụng chủ đề giấy sáng dễ đọc và dải thông tin xanh nước thân thiện.
- **Verification**:
  - `npx playwright test tests/visual/online-contest.spec.ts`: PASS (3.9s).
  - `npm run test:css`: 0 lỗi strict.
- **Regression check**: Đồng hồ đếm ngược máy chủ, lưu bài tự động, nộp bài, chấm điểm và tạo gói ôn tập câu sai hoạt động chính xác 100%.
- **Remaining risk**: Không. Tiêu chuẩn B6 và NV05 hoàn thành.

---

### Task B7
- **Status**: PASS
- **Problem**: Màn hình Thị trấn (`TownScreen`) trước đây dùng chung lớp phủ `.contest-overlay-modal` (nằm trong `contest-mock.css` chưa được nạp khi mở Thị trấn trước Thi thử), gây lồng ghép hai thẻ `role="dialog"` và thiếu đồng bộ khung; thanh vật liệu tự định nghĩa thẻ div thủ công thay vì dùng thành phần chuẩn `StatChip` (tiêu chuẩn B7 trong `03_LO_TRINH_VA_VIEC_CAN_LAM.md` và NV06 trong `04_MA_TRAN_NGHIEM_THU.md`).
- **Root cause**: Phụ thuộc chéo CSS giữa `TownScreen` và `ContestMockScreen`, chưa tái sử dụng UI primitive `StatChip`.
- **Files changed**:
  - `src/screens/OnlineStudentWorld.tsx`: Chuyển `TownScreen` thành màn hình hiển thị trực tiếp bên trong `<main>` khi `townOpen = true`, đồng bộ với thanh điều hướng trên và dưới ở mọi kích thước màn hình.
  - `src/ui/StatChip.tsx`: Mở rộng `StatChip` hỗ trợ `customIcon` và `value` hiển thị số lượng vật liệu chuẩn cấu trúc ngữ nghĩa.
  - `src/screens/TownScreen.tsx`: Tích hợp `<StatChip>` cho 4 loại vật liệu (`stone`, `wood`, `fish`, `component`) trên thanh `.town-material-bar`, đổi thẻ `<main className="town-body">` thành `<div className="town-body">` tránh lồng thẻ `<main>`.
  - `src/styles/town.css`, `src/styles/badges.css`, `src/styles/gift-shelf.css`: Chuẩn hóa toàn bộ màu sắc sang token Bảo An 5.0, loại bỏ 100% mã màu hex thô và `!important`.
  - `tests/check-css.mjs`: Bổ sung `town.css`, `daily-missions.css`, `streak.css`, `badges.css`, `gift-shelf.css` vào `STRICT_FILES`.
- **Fix**: Đồng bộ khung hiển thị Thị trấn, tích hợp `StatChip` cho thanh vật liệu và chuẩn hóa token CSS.
- **Verification**:
  - `npx playwright test tests/visual/online-town.spec.ts`: PASS (4.1s).
  - `npx playwright test tests/visual/online-a11y.spec.ts`: PASS (6.6s, 0 lỗi critical/serious WCAG trên cả 1440x1000 và zoom 200% 640x480).
  - `npm run test:css`: 0 lỗi strict trên toàn bộ 11 tệp CSS trong `STRICT_FILES`.
- **Regression check**: Lưới 10x10, đặt công trình, đồng bộ vật liệu từ sổ sao, thăm bạn cùng lớp và hàng xóm động vật hoạt động ổn định 100%.
- **Remaining risk**: Không. Tiêu chuẩn B7 và NV06 hoàn thành.

---

### Task B8
- **Status**: PASS
- **Problem**: Mã PIN phụ huynh chưa nhất quán: tài liệu `HUONG_DAN_PHU_HUYNH.md` ghi "4 số", trong khi giao diện `ParentPinModal` và `ParentPortalScreen` ghi "4–6 số" và tự vẽ bàn phím số riêng thay vì dùng thành phần chuẩn `PinPad` 6 số (tiêu chuẩn B8 trong `03_LO_TRINH_VA_VIEC_CAN_LAM.md` và NV09 trong `04_MA_TRAN_NGHIEM_THU.md`).
- **Root cause**: Chưa đồng bộ quy chuẩn 6 chữ số thống nhất giữa tài liệu, UI component và màn hình cài đặt.
- **Files changed**:
  - `src/ui/PinPad.tsx`: Nâng cấp `PinPad` hỗ trợ chế độ điều khiển (`value` / `onChange`), thông báo khóa tạm thời (`lockedNotice`) và đồng bộ class `.parent-key-btn`.
  - `src/components/ParentPinModal.tsx`: Tích hợp `<PinPad pinLength={6} />`, chuẩn hóa nhãn và kiểm tra bắt buộc đủ 6 chữ số.
  - `src/screens/ParentPortalScreen.tsx`: Chuẩn hóa biểu mẫu đổi mã PIN trong tab cài đặt sang đúng 6 chữ số (`Mã PIN mới (6 số)`).
  - `docs/HUONG_DAN_PHU_HUYNH.md`: Cập nhật hướng dẫn mục 1 sang "Mã PIN Bảo Mật (6 Số)".
  - `tests/visual/online-parent-portal.spec.ts`: Đồng bộ kịch bản kiểm thử nhập PIN 6 chữ số (`123456` / `999999`).
- **Fix**: Thống nhất tuyệt đối chuẩn PIN phụ huynh 6 chữ số trên toàn bộ giao diện và tài liệu, sử dụng thành phần `PinPad` dùng chung.
- **Verification**:
  - `npx playwright test tests/visual/online-parent-portal.spec.ts`: PASS (6.5s).
  - Quét chuỗi `"4–6 số"`, `"4 chữ số"` trong `src/` và `docs/HUONG_DAN_PHU_HUYNH.md`: 0 kết quả tồn đọng.
- **Regression check**: Thiết lập PIN lần đầu, xác thực PIN, khóa tạm thời khi nhập sai và đổi PIN trong Khu phụ huynh hoạt động chính xác.
- **Remaining risk**: Không. Tiêu chuẩn B8 và NV09 hoàn thành.

---

### Task B9
- **Status**: PASS
- **Problem**: Khu Phụ huynh (`ParentPortalScreen`, `parent-portal.css`) và khu Quản trị / Đăng nhập (`OnlineAdminDashboard`, `OnlineScreen`, `online.css`) chưa gắn thuộc tính `data-theme="desk"` và còn chứa hơn 70 mã màu hex thô trong `parent-portal.css` và `online.css`.
- **Root cause**: Chưa chuyển sang bảng biến chuẩn `tokens.css` theo tiêu chuẩn B9 trong `03_LO_TRINH_VA_VIEC_CAN_LAM.md`.
- **Files changed**:
  - `src/styles/tokens.css`: Bổ sung các biến token ngữ nghĩa phục vụ `desk` theme (`--c-desk-bg`, `--c-line-strong`, `--c-ink-mute`, `--c-scrim`, `--c-vn`, `--c-vn-soft`, `--c-en`, `--c-en-soft`, `--c-sky`, `--c-sky-soft`, `--c-sci`, `--c-sci-soft` và hệ chữ cơ sở).
  - `src/styles/parent-portal.css`: Chuyển 100% mã màu sang biến token `var(--c-...)`, 0 hex thô, 0 `!important`, chuẩn hóa breakpoint.
  - `src/styles/online.css`: Chuyển 100% mã màu sang biến token `var(--c-...)`, 0 hex thô, 0 `!important`, không còn cỡ chữ `< 13px`.
  - `src/screens/ParentPortalScreen.tsx`: Gắn `data-theme="desk"` vào `.parent-portal-root`.
  - `src/screens/OnlineAdminDashboard.tsx`: Gắn `data-theme="desk"` vào `.online-admin`.
  - `src/screens/OnlineScreen.tsx`: Gắn `data-theme="desk"` vào `.online-auth`.
  - `tests/check-css.mjs`: Đưa `parent-portal.css` và `online.css` vào danh sách `STRICT_FILES` kiểm tra tự động.
- **Fix**: Đồng bộ toàn bộ giao diện người lớn (Phụ huynh & Quản trị viên) sang `desk` theme ấm sáng, sạch sẽ, không còn bất kỳ mã màu hex thô nào trong `parent-portal.css` và `online.css`.
- **Verification**:
  - `npm run test:css`: PASS (0 lỗi strict trên toàn bộ 13 tệp CSS chuẩn).
  - `npx playwright test tests/visual/online-a11y.spec.ts tests/visual/online-parent-portal.spec.ts`: PASS (2/2 tests, 0 lỗi tương phản màu axe-core trên cả Student, Town và Admin).
- **Regression check**: Các bảng số liệu, biểu mẫu quản trị, nhật ký phụ huynh và luồng đăng nhập giữ nguyên toàn bộ chức năng và độ tương phản AA.
- **Remaining risk**: Không. Tiêu chuẩn B9 hoàn thành.

---

### Task B10
- **Status**: PASS
- **Problem**: Các trạng thái rỗng / lỗi trong Kệ quà, Tủ kỷ niệm, Sổ khám phá, Sổ huy hiệu và màn hình chờ học liệu còn tự vẽ HTML rời rạc hoặc thiếu nút hành động trực tiếp (tiêu chuẩn B10 trong `03_LO_TRINH_VA_VIEC_CAN_LAM.md` và NV08 trong `04_MA_TRAN_NGHIEM_THU.md`).
- **Root cause**: Chưa chuyển sang thành phần chuẩn `<EmptyState>` có nút hành động (`actionLabel` + `onAction`).
- **Files changed**:
  - `src/ui/EmptyState.tsx`: Mở rộng `EmptyState` hỗ trợ thêm `title` và `children` tùy chọn bên cạnh `icon`, `message`, `actionLabel` và `onAction`.
  - `src/components/GiftShelfDialog.tsx`: Chuyển trạng thái Kệ quà rỗng sang `<EmptyState icon="gift" actionLabel="Hỏi bố mẹ thêm quà" />` (mở PIN phụ huynh để thêm quà) và Tủ kỷ niệm rỗng sang `<EmptyState icon="medal" actionLabel="Xem Kệ quà" />`.
  - `src/components/DiscoveryDialog.tsx`: Chuyển trạng thái Sổ khám phá rỗng sang `<EmptyState icon="compass" actionLabel="Đi khám phá" />` (đóng sổ và đưa về bản đồ).
  - `src/components/BadgeShowcaseDialog.tsx`: Bổ sung `<EmptyState icon="medal" />` có nút hành động khi bộ lọc huy hiệu rỗng.
  - `src/screens/OnlineStudentWorld.tsx`: Chuyển trạng thái chờ giáo viên giao học liệu và lỗi tải tài khoản sang `<EmptyState>` chuẩn, đồng thời nối callback `onAskParentsAddGift` và `onExplore`.
- **Fix**: Đồng bộ mọi trạng thái danh sách rỗng sang thành phần `EmptyState` kèm nút hành động rõ ràng.
- **Verification**:
  - `npx playwright test tests/visual/online-discovery.spec.ts tests/visual/online-gifts.spec.ts`: PASS (2/2 tests, 13.3s).
- **Regression check**: Luồng xem Kệ quà, Tủ kỷ niệm, Sổ khám phá và Huy hiệu hoạt động bình thường.
- **Remaining risk**: Không. Tiêu chuẩn B10 và NV08 hoàn thành.

---

### Task B11
- **Status**: PASS
- **Problem**: `index.html` và `public/manifest.webmanifest` còn để `theme-color` cũ (`#1cb099`) và mô tả `"năm trò chơi"` thay vì 10 trò chơi; tiêu đề trang (`document.title`) tĩnh, chưa cập nhật theo màn hình đang mở (tiêu chuẩn B11 trong `03_LO_TRINH_VA_VIEC_CAN_LAM.md` và DS09 trong `04_MA_TRAN_NGHIEM_THU.md`).
- **Root cause**: Thông tin metadata được viết từ giai đoạn đầu dự án khi mới có 5 trò chơi và bảng màu cũ.
- **Files changed**:
  - `index.html`: Cập nhật `<meta name="theme-color" content="#4E7250" />` và `<meta name="description" content="Bảo An ôn luyện qua 10 trò chơi, nhập bộ câu hỏi và tích sao đổi thưởng cùng gia đình." />`.
  - `public/manifest.webmanifest`: Đồng bộ `"theme_color": "#4E7250"` và `"background_color": "#FAF6ED"`.
  - `src/screens/OnlineScreen.tsx`: Cập nhật `document.title` tự động theo trạng thái đăng nhập / quản trị / phụ huynh.
  - `src/screens/OnlineStudentWorld.tsx`: Cập nhật `document.title` tự động theo màn hình học sinh (Bản đồ thế giới, Bản đồ vùng môn, Hành trình theo tuần, Thị trấn của con, Thi thử Trạng Nguyên & Violympic, Khu phụ huynh, hoặc tên bộ câu hỏi đang chơi).
- **Fix**: Chuẩn hóa toàn bộ metadata, `theme-color` `#4E7250`, mô tả 10 trò chơi và tiêu đề trang động theo màn hình.
- **Verification**:
  - Kiểm tra `index.html` và `public/manifest.webmanifest`: `theme-color` = `#4E7250`, mô tả ghi rõ `10 trò chơi`.
- **Regression check**: Không ảnh hưởng đến định tuyến hoặc hiển thị giao diện.
- **Remaining risk**: Không. Tiêu chuẩn B11 và DS09 hoàn thành.

---

### Task B12
- **Status**: PASS
- **Problem**: Cần kiểm thử tổng thể Giai đoạn B trên 5 độ phân giải (`320`, `390`, `768`, `1024`, `1440`), kiểm thử phóng to 200% (`640 × 480`), điều hướng bàn phím, giảm chuyển động, quét axe-core, cổng chất lượng CSS và ngân sách gói phân phối.
- **Root cause**: Bước nghiệm thu cuối Giai đoạn B (`03_LO_TRINH_VA_VIEC_CAN_LAM.md` mục B12 & Cổng B).
- **Files changed**:
  - `tests/visual/online-visual-compare.spec.ts`: Mở rộng chụp ảnh đối chiếu trên cả 5 độ phân giải (`320`, `390`, `768`, `1024`, `1440`), kiểm tra không cuộn ngang ở `320px` (NV02), kiểm tra điều hướng bàn phím (`Tab` focus, A11Y03) và chụp kiểm thử Zoom 200% (`640 × 480`, A11Y04).
  - `docs/KE_HOACH_PHAT_TRIEN_5_0_2026-11-07/04_MA_TRAN_NGHIEM_THU.md`: Cập nhật trạng thái **ĐẠT (07/11/2026)** cho toàn bộ các mục Hệ thống thiết kế (`DS01–DS09`), Bố cục & điều hướng (`NV01–NV09`), Khả năng tiếp cận (`A11Y01–A11Y05`) và Khung trò chơi (`GF01–GF08`).
- **Fix**: Hoàn tất bộ kiểm thử tự động xác nhận 100% tiêu chí Giai đoạn B.
- **Verification**:
  - `npm run typecheck`: PASS (0 lỗi TypeScript).
  - `npm run test:syntax` (`check-tsx.mjs` + `check-css.mjs`): PASS (0 lỗi strict trên toàn bộ 13 tệp CSS chuẩn).
  - `npm run build` & `npm run test:assets`: PASS (128 tệp, tổng dung lượng `4.99 MiB` ≤ ngưỡng `5.0 MiB`).
  - `npm run test:release` & `npm run test:map`: PASS (12/12 release tests, 26/26 world-map & SQLite/PostgreSQL tests).
  - `npx playwright test tests/visual/online-visual-compare.spec.ts`: PASS (chụp ảnh đủ 5 độ phân giải + Zoom 200%, 0 tràn ngang ở 320px).
  - `npx playwright test tests/visual/online-a11y.spec.ts tests/visual/online-parent-portal.spec.ts tests/visual/online-discovery.spec.ts tests/visual/online-gifts.spec.ts tests/visual/online-contest.spec.ts tests/visual/online-town.spec.ts tests/visual/online-badges.spec.ts tests/visual/online-password.spec.ts`: PASS (100% kịch bản E2E giao diện mới xanh, 0 lỗi axe-core serious/critical).
- **Regression check**: Toàn bộ luật tính sao, khóa tuần, đổi quà, phục hồi dữ liệu và giới hạn gói `dist` được bảo toàn tuyệt đối.
- **Remaining risk**: Không.

---

## CỔNG NGHIỆM THU GIAI ĐOẠN B (GATE B SIGN-OFF — BẢN 4.1)

| Hạng mục Cổng B | Yêu cầu mục tiêu | Kết quả đạt được | Đánh giá |
| --- | --- | --- | --- |
| **B1 · Khung học sinh** | Thanh trên 64px (máy tính) / 56px (điện thoại) + thanh dưới 5 nút | Đã gom từ 12 nút xuống 4 mục + cụm trạng thái + menu tài khoản; mobile có thanh đáy 5 nút chuẩn | **ĐẠT (PASS)** |
| **B2 · Trang chủ = Bản đồ thế giới** | 1440×900 không cuộn dọc; thẻ Hôm nay 3 bước + nút Tiếp tục | Trang chủ 1440×900 = 0px cuộn dọc; Danh sách tuần tách thành chế độ riêng | **ĐẠT (PASS)** |
| **B3 · Bản đồ vùng môn** | 7 chặng rõ ràng + ngăn bên / khay dưới chọn trò ≤ 2 lần bấm | Đủ 7 chặng (sương mù, phát sáng, cờ vàng) và `MapWeekPanel` chọn trò trực tiếp | **ĐẠT (PASS)** |
| **B4 · `GameFrame` 10 trò chơi** | HUD chung, câu hỏi, Cáo cố định, vùng phản hồi giữ chỗ, màn kết thúc chung | 10/10 trò chơi đạt đủ `GF01–GF08`, CLS = 0 khi trả lời | **ĐẠT (PASS)** |
| **B5 · Khung `Dialog` thống nhất** | Mọi hộp thoại dùng nền giấy ấm sáng, nút đóng chuẩn, bẫy & trả tiêu điểm | Kệ quà, Nhiệm vụ, Sổ khám phá, Huy hiệu, Chuỗi ngày, Đổi mật khẩu đồng bộ 100% | **ĐẠT (PASS)** |
| **B6 · Thi thử màn riêng** | Màn độc lập không chồng lên bản đồ, chủ đề sáng, dải lưu ý xanh nước | Render trực tiếp trong `<main>`, bỏ nền tối, dải thông báo xanh dịu `ℹ️` | **ĐẠT (PASS)** |
| **B7 · Thị trấn ổn định** | Mở ổn định từ thanh điều hướng mọi cỡ, thanh vật liệu dùng `StatChip` | Render trực tiếp trong `<main>`, 4 vật liệu dùng `<StatChip>`, `town.css` đạt strict CSS | **ĐẠT (PASS)** |
| **B8 · PIN phụ huynh 6 số** | Dùng `PinPad`, thống nhất 6 số trên toàn bộ giao diện & tài liệu | `ParentPinModal`, `ParentPortalScreen` và `HUONG_DAN_PHU_HUYNH.md` đồng bộ 6 số | **ĐẠT (PASS)** |
| **B9 · Chủ đề `desk` người lớn** | Khu Phụ huynh & Quản trị dùng `data-theme="desk"`, 0 mã màu ngoài token | `parent-portal.css` và `online.css` đạt 0 hex thô, 0 `!important` trong `STRICT_FILES` | **ĐẠT (PASS)** |
| **B10 · Trạng thái rỗng `EmptyState`** | Mọi danh sách rỗng có `EmptyState` kèm nút hành động | Kệ quà rỗng có nút "Hỏi bố mẹ thêm quà"; Sổ khám phá rỗng có nút "Đi khám phá" | **ĐẠT (PASS)** |
| **B11 · Lời văn & thông tin trang** | Mô tả 10 trò chơi, `theme-color` `#4E7250`, tiêu đề trang động theo màn | Cập nhật `index.html`, `manifest.webmanifest` và `document.title` động | **ĐẠT (PASS)** |
| **B12 · Kiểm thử đa cỡ & A11y** | 320 / 390 / 768 / 1024 / 1440, Zoom 200%, axe-core 0 lỗi, `dist` ≤ 5.0 MiB | Toàn bộ kiểm thử đạt 100%, `dist` = `4.99 MiB` | **ĐẠT (PASS)** |

**KẾT LUẬN CỔNG B: ĐẠT 100% (12/12 hạng mục B1–B12). Sẵn sàng chuyển sang Giai đoạn C (Vòng lặp Chơi – Khám phá – Học, Bản 4.2).**






