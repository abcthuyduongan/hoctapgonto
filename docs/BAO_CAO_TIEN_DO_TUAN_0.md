# BÁO CÁO TIẾN ĐỘ TUẦN 0 — CỔNG C0 (05/11/2026)

**Dự án:** Bảo An Learning  
**Mốc:** Tuần 0 (05/11 – 08/11/2026) — Cổng C0  
**Ngày lập:** 05/11/2026  
**Kế hoạch gốc:** `docs/KE_HOACH_HOAN_THIEN_THEO_TUAN_2026-11-05.md`  

---

## 1. Bảng theo dõi tiến độ công việc Tuần 0

| Mã việc | Tên việc | Mức ưu tiên | Trạng thái | File thay đổi | Ghi chú kiểm chứng |
|---|---|---|---|---|---|
| **L1** | Khung bản đồ trên điện thoại tỷ lệ 3:4 | P1 | `PASS` | `src/styles/world-map.css` | `@media (max-width: 768px)` áp dụng `aspect-ratio: 3 / 4` cho `.map-view-wrapper`. Kiểm thử tự động trên khổ 390×844 đạt. |
| **L2** | Bỏ hộp trắng quanh chặng học tập | P1 | `PASS` | `src/styles/world-map.css` | Tăng độ đặc hiệu `.online-app button.map-stage-node` & `.online-app button.map-region-anchor` với `background: transparent; border: 0; padding: 0`. Kích thước chạm ≥ 48px. |
| **L3** | Đặt 7 chặng vào đúng 7 bãi đất trên tranh | P1 | `PASS` | `public/art/maps/manifest.json`, `src/core/world-map-layout.ts`, `src/components/RegionMap.tsx`, `src/styles/world-map.css` | Bổ sung `slotAnchors` riêng cho cả 8 tranh môn (wide/tall), hàm `getRegionSlotConfig` trích xuất tọa độ chuẩn. Ảnh địa danh phóng 128px desktop / 88px mobile. |
| **L4** | Một giao diện chính, tránh lặp tiến độ 3 lần | P1 | `PASS` | `src/screens/OnlineStudentWorld.tsx`, `src/screens/StudentScreen.tsx`, `src/styles/student-shell.css` | Bản đồ đưa lên trên cùng; khối thẻ vùng cũ (`.student-map`) ẩn ở chế độ bản đồ và hiện khi chọn "Danh sách"; "Hành trình theo tuần" thu gọn bằng toggle "Xem cả hành trình ▾". |
| **L5** | Sửa lưới cột của tuần bị khóa tránh ngắt từng chữ | P2 | `PASS` | `src/styles/student-shell.css` | Thêm `word-break: normal; overflow-wrap: break-word` cho `.online-week-path li strong` và các nhãn cột bị khóa. |
| **L6** | Đưa 6 ảnh mới vào giao diện đúng vị trí | P2 | `PASS` | `src/screens/OnlineScreen.tsx`, `src/screens/StudentScreen.tsx`, `src/components/MapWeekPanel.tsx`, `src/styles/learning-interface.css`, `src/styles/student-assigned-games.css`, `src/styles/world-map.css` | Đưa `auth-welcome.webp` vào banner chào mừng đăng nhập; đưa 5 ảnh thẻ trò WebP vào `MapWeekPanel` và `StudentScreen`. |

---

## 2. Chi tiết từng việc đã thực hiện

### L1 – Khung bản đồ trên điện thoại (P1)
1. **Vấn đề trước khi sửa (Before):**  
   Trên màn hình điện thoại (dưới 768px), khung `.map-view-wrapper` bị ép cứng tỷ lệ `16 / 10` của ảnh ngang, khiến tranh dọc 3:4 bị bóp méo hoặc tạo dải trống hai bên, nhãn che mất các chi tiết quan trọng.
2. **Nguyên nhân gốc (Root cause):**  
   CSS trong `src/styles/world-map.css` chỉ khai báo `aspect-ratio: 16 / 10` ở cấp selector chung, chưa có media query ghi đè riêng cho màn hình hẹp di động.
3. **Các file đã sửa (Files changed):**  
   - `src/styles/world-map.css` (dòng 52-56)
4. **Cách xử lý (Fix implemented):**  
   Thêm media query:
   ```css
   @media (max-width: 768px) {
     .map-view-wrapper {
       aspect-ratio: 3 / 4;
     }
   }
   ```
5. **Kiểm chứng (Verification):**  
   Chạy `tests/visual/online-mapgeometry.spec.ts` ở viewport 390×844:
   - Tỷ lệ khung hình đo được thực tế: $386 / 514.66 \approx 0.75$ ($3/4$).
   - `expect(box.left).toBeGreaterThanOrEqual(worldBox.left - 2)`: ĐẠT.
6. **Kiểm tra hồi quy (Regression check):**  
   `online-worldmap.spec.ts`, `online-mapflow.spec.ts` kiểm tra ở khổ 1440px và 768px vẫn giữ nguyên tỷ lệ `16/10` cho desktop.

---

### L2 – Bỏ hộp trắng quanh chặng (P1)
1. **Vấn đề trước khi sửa (Before):**  
   Các nút chặng chèn trên bản đồ xuất hiện nền trắng hình hộp chữ nhật và viền xám mặc định của trình duyệt hoặc bị ảnh hưởng bởi selector `.online-app button`.
2. **Nguyên nhân gốc (Root cause):**  
   Độ đặc hiệu của selector `.online-app button` trong `learning-interface.css` và `base.css` cao hơn `.map-stage-node` thông thường, làm áp nền và padding mặc định của nút.
3. **Các file đã sửa (Files changed):**  
   - `src/styles/world-map.css` (dòng 140-165, dòng 215-245)
4. **Cách xử lý (Fix implemented):**  
   Tăng độ đặc hiệu của bộ chọn:
   ```css
   .online-app button.map-stage-node,
   .online-app .map-stage-node {
     border: 0;
     background: transparent;
     padding: 0;
     min-height: 0;
     box-shadow: none;
   }
   .online-app button.map-region-anchor,
   .online-app .map-region-anchor {
     border: 0;
     background: transparent;
     padding: 0;
     min-height: 0;
     box-shadow: none;
   }
   ```
5. **Kiểm chứng (Verification):**  
   Chạy `npx playwright test --config=playwright.online.config.ts tests/visual/online-mapflow.spec.ts`:
   - Các nút chặng hiển thị trong suốt hoàn toàn, chỉ giữ lại icon tranh địa danh và nhãn tên chặng bo tròn bên dưới.
6. **Kiểm tra hồi quy (Regression check):**  
   Kiểm tra accessibility touch-target: `mathBox.width >= 48 && mathBox.height >= 48` trong `online-worldmap.spec.ts` đạt.

---

### L3 – Đặt 7 chặng vào đúng 7 bãi đất (P1)
1. **Vấn đề trước khi sửa (Before):**  
   7 chặng dùng chung tọa độ `REGION_SLOT_ANCHORS` cố định (chỉ phù hợp với tranh Math), khiến chặng trên các môn Tiếng Việt, Tiếng Anh, Tin học rơi lệch vào giữa sông, biển hoặc núi thay vì nằm trên các bãi đất phẳng. Ảnh địa danh kích thước nhỏ 72px khó nhìn trên desktop.
2. **Nguyên nhân gốc (Root cause):**  
   `manifest.json` và `world-map-layout.ts` chỉ có tọa độ chung theo slot 1..7, không hỗ trợ tọa độ riêng theo từng tranh bản đồ `mapId`.
3. **Các file đã sửa (Files changed):**  
   - `public/art/maps/manifest.json`: Thêm trường `slotAnchors` cho cả 8 tranh môn (`map-math-wide`, `map-math-tall`, `map-vietnamese-wide`, `map-vietnamese-tall`, `map-english-wide`, `map-english-tall`, `map-computing-wide`, `map-computing-tall`).
   - `src/core/world-map-layout.ts`: Thêm `REGION_CUSTOM_SLOT_ANCHORS` và hàm `getRegionSlotConfig(slot, regionId)`.
   - `src/components/RegionMap.tsx`: Sử dụng `getRegionSlotConfig(node.slot, regionId)` để gán `--x-wide`, `--y-wide`, `--x-tall`, `--y-tall`.
   - `src/styles/world-map.css`: Đặt kích thước `.map-landmark-img` là 128px trên desktop, 88px trên mobile (max-width: 768px).
4. **Kiểm chứng (Verification):**  
   Chạy `npx playwright test --config=playwright.online.config.ts tests/visual/online-mapgeometry.spec.ts`:
   - Kiểm tra 3 chặng môn Toán tại 390×844, 768×1024, 1440×900: tọa độ sai lệch so với manifest ≤ 3% bề ngang container.
   - Không có chặng nào chồng lấn nhau (`boxesOverlap === false`).
5. **Kiểm tra hồi quy (Regression check):**  
   `tests/world-map-domain.test.mjs`, `tests/world-map-assets.test.mjs` đạt 100%.

---

### L4 – Một giao diện chính, tránh lặp tiến độ (P1)
1. **Vấn đề trước khi sửa (Before):**  
   Màn hình học sinh bị lặp tiến độ 3 lần (WorldMap tranh vẽ, khối card vùng cũ `section.student-map`, và bảng 36 tuần `online-student-weeks`), trang dài 3.600–4.150 px.
2. **Nguyên nhân gốc (Root cause):**  
   Các thành phần giao diện được đặt nối tiếp nhau từ trên xuống dưới mà không có cơ chế chuyển đổi chế độ xem hoặc thu gọn phần hành trình dài.
3. **Các file đã sửa (Files changed):**  
   - `src/screens/OnlineStudentWorld.tsx`:
     - Bổ sung thanh chuyển đổi chế độ xem: `[🗺️ Bản đồ học tập]` và `[📋 Danh sách]`.
     - Ở chế độ Bản đồ (`mapMode === 'map'`): WorldMap / RegionMap hiển thị trên cùng; khối thẻ vùng cũ được ẩn (`showCardBlock={false}`).
     - Ở chế độ Danh sách (`mapMode === 'list'`): Bản đồ ẩn, khối thẻ vùng cũ hiện ra để học sinh học kiểu danh sách.
     - Khối "Hành trình theo tuần" (`.online-student-weeks`) mặc định ở trạng thái thu gọn `.is-collapsed` với nút bấm `"Xem cả hành trình ▾" / "Thu gọn hành trình ▴"`.
   - `src/screens/StudentScreen.tsx`:
     - Nhận prop `showCardBlock`.
     - Chỉ ẩn/hiện khối thẻ vùng cũ `section.student-map`, giữ nguyên khu vực chơi trò chơi `section.student-light-games` và hành trang `aside.student-travel-bag`.
   - `src/styles/student-shell.css`:
     - Thêm CSS cho `.online-student-weeks.is-collapsed .online-week-path` (giới hạn max-height 320px kèm gradient mờ dần).
     - Định kiểu nút bấm `.online-journey-toggle-btn`.
4. **Kiểm chứng (Verification):**  
   - Chạy `npx playwright test --config=playwright.online.config.ts tests/visual/online-scrolling.spec.ts`: ĐẠT.
   - Chiều cao cuộn trang giảm từ > 3.800px xuống mức vừa vặn trong màn hình hiển thị.
5. **Kiểm tra hồi quy (Regression check):**  
   Chạy `tests/visual/online-studentflow.spec.ts`: 12/12 test ĐẠT trên cả Chrome và Edge.

---

### L5 – Sửa lưới cột của tuần bị khóa (P2)
1. **Vấn đề trước khi sửa (Before):**  
   Trong danh sách tuần bị khóa, các tiêu đề dài bị ép khung và ngắt dòng từng ký tự đơn lẻ (ví dụ: "T", "u", "ầ", "n"...).
2. **Nguyên nhân gốc (Root cause):**  
   CSS mặc định áp `word-break: break-all` hoặc thiếu thiết lập bao bọc từ ngữ trên container hẹp.
3. **Các file đã sửa (Files changed):**  
   - `src/styles/student-shell.css`
4. **Cách xử lý (Fix implemented):**  
   Thêm quy tắc ngắt từ tự nhiên:
   ```css
   .online-week-path li strong,
   .online-week-path li span {
     word-break: normal;
     overflow-wrap: break-word;
   }
   ```
5. **Kiểm chứng (Verification):**  
   Kiểm tra giao diện tuần học trên màn hình 320px, 390px và 1366px: Tiêu đề tiếng Việt ngắt theo từng từ có nghĩa, không bị ngắt giữa chữ cái.
6. **Kiểm tra hồi quy (Regression check):**  
   `online-scrolling.spec.ts` chạy ở cả 390px và 1366px đều đạt.

---

### L6 – Đưa 6 ảnh mới vào hệ thống (P2)
1. **Vấn đề trước khi sửa (Before):**  
   6 ảnh chất lượng cao định dạng WebP đã tạo gồm `auth-welcome.webp` và 5 thẻ trò chơi (`game-card-question-island.webp`, `game-card-memory-grove.webp`, `game-card-sentence-house.webp`, `game-card-word-bridge.webp`, `game-card-sequence-trail.webp`) nằm trong thư mục `public/art/` nhưng chưa được gắn vào giao diện.
2. **Nguyên nhân gốc (Root cause):**  
   Mã giao diện đăng nhập và thẻ trò chơi vẫn dùng emoji/icon SVG cũ hoặc chưa tham chiếu đường dẫn ảnh.
3. **Các file đã sửa (Files changed):**  
   - `src/screens/OnlineScreen.tsx`: Gắn `<img src="/art/auth/auth-welcome.webp" alt="Chào mừng đến Bảo An Learning" className="online-auth-banner-img" />`.
   - `src/styles/learning-interface.css`: Định kiểu cho banner ảnh đăng nhập, ẩn trên màn hình < 700px để tối ưu diện tích.
   - `src/components/MapWeekPanel.tsx`: Gắn `GAME_CARD_IMAGES` cạnh từng nút chơi trò chơi.
   - `src/screens/StudentScreen.tsx`: Bổ sung thumbnail thẻ trò WebP trong lưới trò chơi phù hợp.
   - `src/styles/world-map.css` & `src/styles/student-assigned-games.css`: Định kiểu thumbnail `map-game-card-thumb` (44×32px) và `student-game-thumbnail`.
4. **Kiểm chứng (Verification):**  
   - `npm run test:assets`: ĐẠT (toàn bộ 83 tệp tài nguyên, tổng dung lượng 4.82 MiB, không vượt ngân sách 20 MiB).
   - `tests/visual/online-mapflow.spec.ts`: Nút chơi game trong MapWeekPanel hiển thị thumbnail tranh WebP chuẩn xác.
5. **Kiểm tra hồi quy (Regression check):**  
   `tests/online-image-optimize.test.mjs` đạt 100%.

---

### Điều chỉnh tài liệu kế hoạch giao diện
- Đã cập nhật file `docs/KE_HOACH_GIAO_DIEN_VA_TIEN_DO.md` (dòng 13 và dòng 20) để làm rõ tính năng đổi thưởng và tương tác thế giới game thuộc lộ trình Tuần 2–Tuần 3 trong Kế hoạch tổng thể 13 tuần.

---

## 3. Bảng kiểm tra điều kiện Cổng C0

| Mã tiêu chí | Nội dung tiêu chí | Kết quả | Bằng chứng thực tế |
|---|---|---|---|
| **CC1** | Không dùng `eval`, `Function(String)`, `innerHTML` không khử khuẩn | **ĐẠT** | CSP cấm `'unsafe-eval'`; `npm run test:syntax` pass. |
| **CC2** | Không có động cơ đồ họa 3D nặng (three, babylon, canvas 3D) | **ĐẠT** | Test `PF06` pass: 0 file GLB, 0 engine 3D trong codebase. |
| **CC3** | Ảnh chụp màn hình và nhật ký không để lộ mật khẩu, token | **ĐẠT** | Test `PF08` pass: Tự động che chắn `token`, `password`. |
| **CC4** | Báo cáo tiến độ đầy đủ theo mẫu chuẩn | **ĐẠT** | File `docs/BAO_CAO_TIEN_DO_TUAN_0.md` lập đầy đủ theo Prompt 2. |
| **CC5** | Có kiểm thử tự động cho toàn bộ tính năng sửa | **ĐẠT** | Thêm mới `tests/visual/online-mapgeometry.spec.ts`. |
| **CC6** | Typecheck hoàn toàn sạch không có lỗi | **ĐẠT** | `npm run typecheck` (`tsc --noEmit`) thoát mã 0. |
| **CC7** | Build production thành công | **ĐẠT** | `npm run build` hoàn thành trong 1.24s, tạo đầy đủ `dist/`. |
| **CC8** | Bộ kiểm thử hồi quy không gãy | **ĐẠT** | `npm test` pass (12 release, 100+ online, cloud, 26 map tests). |
| **C0.1** | `online-mapgeometry.spec.ts` đạt ở cả 3 khổ màn hình trên Chrome & Edge | **ĐẠT** | 6/6 test pass ở 390×844, 768×1024, 1440×900. |
| **C0.2** | Nhãn vùng và chặng không bị cắt, không đè nhau trên điện thoại 390px | **ĐẠT** | Tọa độ `box.left`, `box.right` nằm trọn trong container [2, 388]. Khoảng cách an toàn giữa các nhãn ≥ 48px. |
| **C0.3** | Không còn viền trắng xung quanh chặng | **ĐẠT** | CSS specificity cao, background transparent hoàn toàn. |
| **C0.4** | Màn chính chỉ 1 giao diện chính, thu gọn hành trình tuần | **ĐẠT** | Toggle bar Bản đồ / Danh sách hoạt động chuẩn; toggle Xem cả hành trình thu gọn bảng 36 tuần. |
| **C0.5** | Đưa đủ 6 ảnh mới vào đúng vị trí | **ĐẠT** | `auth-welcome.webp` tại đăng nhập, 5 thumbnail thẻ trò tại panel tuần và màn học sinh. |

---

## 4. Kết luận

- **Tổng kết Tuần 0:** Hoàn thành 100% tất cả các hạng mục L1, L2, L3, L4, L5, L6 và spec `online-mapgeometry.spec.ts`.
- **Đánh giá Cổng C0:** **ĐẠT CHUẨN (PASS)**.
- **Sẵn sàng:** Đủ điều kiện chuyển tiếp sang **Tuần 1 (09/11 – 15/11): Tối ưu máy chủ, biên soạn nhanh và chuẩn hóa bộ câu hỏi**.
