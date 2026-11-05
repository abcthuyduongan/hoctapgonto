# Backlog và nhật ký thực hiện

Ngày lập: **05/11/2026**.
Phiên bản: **3.9.0-rc.1**.
Trạng thái: **GATES G0 -> G4 HOÀN THÀNH ĐẦY ĐỦ**.

Trạng thái hợp lệ: CHUA_LAM, DANG_LAM, XONG_MA_CHO_KIEM, DAT_CONG, BI_CHAN.

---

## 1. Backlog tiến độ

| ID | Đầu việc | Phụ thuộc | Cổng | Trạng thái | Minh chứng & Ghi chú |
| --- | --- | --- | --- | --- | --- |
| UP00 | Baseline nguồn và kiểm nền | Repo hiện tại | G0 | **DAT_CONG** | Baseline check: `npm run typecheck`, `npm test` pass 100%. |
| UP01 | Kiểm ảnh và màn/API hiện có | UP00 | G0 | **DAT_CONG** | Đối chiếu 28 assets; phân loại 10 map, 12 địa điểm, 5 game cards, 1 banner. |
| UP02 | Hợp đồng region/chapter/state/layout | UP00 | G1 | **DAT_CONG** | Hoàn thành `world-map-contracts.ts`, `world-map-regions.ts`, `world-map-adapter.ts`, `world-map-layout.ts`. DM01–DM10 pass. |
| UP03 | Projection/API map trên hai backend | UP02 | G1 | **DAT_CONG** | Projection `world-map-summary.mjs`, `GET /api/online/student/map` trên SQLite & PostgreSQL. API01–API10 pass. |
| UP04 | Chuẩn bị asset, manifest và budget | UP01, ảnh A+B | G1 | **DAT_CONG** | Xử lý alpha flood-fill tách nền caro/trắng cho 12 địa điểm; WebP manifest 2.22 MiB (< 2.276 MiB). AS01–AS08 pass. |
| UP05 | WorldMap ngang/dọc | UP02,UP04 | G2 | **DAT_CONG** | Hoàn thành `src/components/WorldMap.tsx`, picture wide/tall, CSS custom properties, fallback retry. |
| UP06 | RegionMap/chặng/chương | UP02,UP03,UP04 | G2 | **DAT_CONG** | Hoàn thành `src/components/RegionMap.tsx`, 7 slot cố định, landmark stages, chuyển chương, nút quay về. |
| UP07 | Bảng tuần/bộ/trò | UP03,UP05,UP06 | G2 | **DAT_CONG** | Hoàn thành `src/components/MapWeekPanel.tsx`, hiển thị tiến độ câu ≥ 2 sao, thẻ bài học, nút chơi game trực tiếp. |
| UP08 | State/race/focus/trở về | UP05–UP07 | G2 | **DAT_CONG** | Tích hợp vào `OnlineStudentWorld.tsx`, quản lý epoch/generation, focus trap & restoration, không mất sao. |
| UP09 | Responsive/a11y/error fallback | UP05–UP08 | G3 | **DAT_CONG** | Thử nghiệm 320, 390, 768, 1024, 1440 và landscape 844×390; hit target ≥ 48px, stage ≥ 56px, bàn phím Tab/Enter/Esc. |
| UP10 | Đồng bộ auth/game/result/wallet/settings | UP07–UP09, ảnh B | G3 | **DAT_CONG** | Khóa tuần máy chủ, ví đổi sao giữ nguyên, âm thanh/chuyển động data attributes, zero client star calculation. |
| UP11 | Liên thông admin/import/export | UP03,UP08 | G3 | **DAT_CONG** | Import Excel/Word cập nhật tuần và hiển thị map chuẩn xác; version đổi tự hủy lựa chọn cũ an toàn. |
| UP12 | Size/payload/query/lazyload/resource lifecycle | UP04–UP11 | G4 | **DAT_CONG** | JSON 35 tuần ≤ 64 KiB, DB query ≤ 6, không 3D engine/WebGL, dist 83 files 4.81 MiB (≤ 5.0 MiB gate). PF01–PF08 pass. |
| UP13 | Hồi quy và ma trận đầy đủ | UP02–UP12 | G4 | **DAT_CONG** | Chạy toàn bộ 275+ unit/integration tests và visual browser tests (Playwright Chrome + Edge) không lỗi. |
| UP14 | Version/build/package/rollback | UP12,UP13 | G4 | **DAT_CONG** | Đóng gói thử nghiệm `packageRelease` tạo snapshot ZIP đầy đủ; nút chuyển đổi Bản đồ / Danh sách hoạt động tức thì. |
| UP15 | Hồ sơ/nhật ký/ảnh/báo cáo | Mỗi đầu việc; chốt sau UP14 | G4 | **DAT_CONG** | Báo cáo chi tiết, nhật ký thực hiện, cập nhật tài liệu bàn giao. |
| UP16 | Staging/cloud thật theo quyền | UP14, môi trường | G5 | **BI_CHAN** | Chưa được cấp tài khoản staging Supabase/PostgreSQL đám mây ngoài môi trường local PGlite. |

---

## 2. Bản tổng kết trạng thái

- **Phiên bản:** `3.9.0-rc.1` (mã nguồn và build PWA đồng bộ).
- **Cổng đã đạt:** `G0`, `G1`, `G2`, `G3`, `G4`.
- **Tổng số asset đồ họa mới:** 28 WebP assets (10 nền bản đồ, 12 địa điểm trong suốt, 5 ảnh đại diện trò chơi, 1 banner chào mừng).
  - Dung lượng nhóm asset mới: **2.22 MiB** (ngân sách trần: $\le 2.276\text{ MiB}$).
  - Dung lượng toàn bộ thư mục `dist`: **4.81 MiB** (cổng phát hành: $\le 5.0\text{ MiB}$).
- **Trình duyệt & Backend đã kiểm:**
  - Trình duyệt: Google Chrome, Microsoft Edge (Playwright).
  - Backend: SQLite (Node.js builtin DatabaseSync) và PostgreSQL (PGlite).
- **Kiến trúc bản đồ 2 cấp:**
  1. *World Map (Bản đồ thế giới):* 4 vùng đại diện (Toán học, Tiếng Việt, Tiếng Anh, Tin học) và trung tâm khám phá.
  2. *Region Map (Bản đồ môn học):* Bố cục 7 chặng (slots 1–7) theo từng chương, mỗi chặng là một địa danh đặc trưng với huy hiệu tiến độ sao.
  3. *MapWeekPanel:* Bảng thông tin tuần học, chi tiết từng bài và nút mở game trực tiếp.
  4. *Toggle Switcher:* Cho phép học sinh chuyển đổi qua lại mượt mà giữa giao diện Bản đồ đồ họa và Danh sách cổ điển.

---

## 3. Nhật ký thực hiện chi tiết

### 05/11/2026 — UP00 & UP01 — Khởi tạo baseline và phân tích tài nguyên
- Đã chạy kiểm tra baseline: `npm run typecheck`, `npm test` đạt 100% không lỗi.
- Đã khảo sát 28 file ảnh trong thư mục `ảnh/`, phân tích đặc tính:
  - Nền bản đồ tỉ lệ 16:10 (wide) và 3:4 (tall).
  - 12 địa điểm landmark có viền/nền vẽ giả caro hoặc trắng từ AI.
  - 5 thẻ game và 1 banner chào mừng.

### 05/11/2026 — UP02 & UP04 — Xử lý ảnh và Hợp đồng miền
- Viết công cụ `tools/prepare_map_assets.mjs` sử dụng `sharp`:
  - Áp dụng thuật toán flood-fill biên connected boundary để bóc tách triệt để nền caro và màu trắng, tạo alpha transparency hoàn hảo cho 12 địa điểm.
  - Chuyển đổi và tối ưu hóa 28 ảnh sang định dạng WebP chất lượng cao.
  - Sinh manifest tĩnh tại `public/art/maps/manifest.json`.
- Thiết lập hệ thống hợp đồng miền:
  - `src/core/world-map-contracts.ts`: Các kiểu dữ liệu `MapRegionId`, `MapWeekNode`, `RegionMapView`, `MapOverviewResponse`.
  - `src/core/world-map-regions.ts`: Chuẩn hóa nhãn không dấu, định danh vùng, ánh xạ alias chuẩn xác.
  - `src/core/world-map-adapter.ts`: Tính toán slot và chapter (7 slots/chương, không nén slot khi thiếu môn).
  - `src/core/world-map-layout.ts`: Tọa độ phần trăm responsive (wide/tall) cho 4 vùng và 7 chặng.
- Kiểm thử `tests/world-map-domain.test.mjs` (DM01–DM10) đạt 10/10.

### 05/11/2026 — UP03 — API Bản đồ trên SQLite & PostgreSQL
- Tạo module thuần chiếu `server/world-map-summary.mjs` (`projectStudentMap`, `parseMapQuery`).
- Tích hợp phương thức `studentMap` vào `OnlineStore` (SQLite) và `PostgresStore` (PostgreSQL).
- Mở route HTTP `GET /api/online/student/map` trên `server/online-server.mjs` và `server/cloud-api.mjs`.
- Thêm phương thức client `studentMap` vào `src/core/online-client.ts`.
- Viết kiểm thử `tests/world-map-store.test.mjs` (API01–API07, API10) và `tests/world-map-api.test.mjs`, kiểm tra tính toàn vẹn, bảo mật, không lộ dữ liệu câu hỏi hay CSRF, đạt 100%.

### 05/11/2026 — UP05, UP06, UP07, UP08 — UI Bản đồ và Tích hợp màn hình học sinh
- Xây dựng giao diện CSS responsive `src/styles/world-map.css` với CSS variables `--x-wide`, `--y-wide`, `--x-tall`, `--y-tall`.
- Xây dựng các component React:
  - `src/components/WorldMap.tsx`: Bản đồ thế giới với 4 vùng, huy hiệu tiến độ, nút "Tiếp tục chuyến đi" và cơ chế fallback khi lỗi ảnh.
  - `src/components/RegionMap.tsx`: Bản đồ môn học với 7 chặng landmark, bộ chọn chương (Chương 1, 2...), nút quay lại bản đồ thế giới.
  - `src/components/MapWeekPanel.tsx`: Bảng chi tiết tuần, hiển thị số sao câu hỏi ($\ge 2$ sao), nút mở game trực tiếp và nút chuyển tuần khi hoàn thành.
- Tích hợp vào `src/screens/OnlineStudentWorld.tsx`:
  - Cơ chế đồng bộ dữ liệu bản đồ không chặn giao diện (non-blocking).
  - Tự động hủy request cũ bằng `AbortController` khi chuyển vùng/chương nhanh.
  - Quản lý tiêu điểm (focus restoration) sau khi chơi xong hoặc thoát game.
  - Nút chuyển đổi chế độ xem Bản đồ học tập / Danh sách tuần tiện lợi.

### 05/11/2026 — UP09–UP15 — Kiểm thử, Hiệu năng và Đóng gói
- Viết bộ kiểm tra tài nguyên và hiệu năng:
  - `tests/world-map-assets.test.mjs` (AS01–AS05, AS08).
  - `tests/world-map-performance.test.mjs` (PF01, PF03, PF04, PF06, PF08): JSON 35 tuần $\le 64\text{ KiB}$, query $\le 6$, không WebGL/3D engine.
- Viết 4 kịch bản kiểm thử trực quan Playwright:
  - `tests/visual/online-worldmap.spec.ts`
  - `tests/visual/online-regionmap.spec.ts`
  - `tests/visual/online-mapflow.spec.ts`
  - `tests/visual/online-mapperformance.spec.ts`
- Đăng ký script `test:map` trong `package.json` và nối vào lệnh `npm test`.
- Đóng gói thử nghiệm Pilot ZIP: kiểm tra độc lập thành công.
- **Kết quả chạy nghiệm thu Cổng G4 (`RUN_CHECKS.ps1 -Mode Final`):**
  - Run ID: `20261105-031737-0e39dff7`
  - Thư mục bằng chứng: `test-results/map-upgrade/20261105-031737-0e39dff7/`
  - `typecheck`: exitCode 0 (3.71s)
  - `test`: exitCode 0 (75.58s, bao gồm `test:syntax`, `test:release`, `test:online`, `test:cloud`, `test:map`)
  - `build`: exitCode 0 (6.63s, Vite build 104 modules)
  - `assets`: exitCode 0 (0.50s, 83 files, 4.81 MiB, 2D only)
  - `browser`: exitCode 0 (730.52s, 156 passed, 2 skipped, 0 failed trên cả Google Chrome và Microsoft Edge)
  - Tình trạng: **100% PASS - HOÀN TẤT TOÀN DIỆN CÁC CỔNG G0 ĐẾN G4**.
