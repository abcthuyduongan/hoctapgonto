# Báo Cáo 01: Tổng Quan Đánh Giá Toàn Diện Dự Án

**Dự án:** BẢO AN LEARNING — Nền tảng học tập cá nhân hóa & luyện thi Lớp 3  
**Phiên bản kiểm toán:** `4.0.2` (Bản dựng kiểm toán toàn diện sau tối ưu hóa CSS & Staging Runner)  
**Thời điểm thực hiện:** 06/11/2026, Asia/Saigon  
**Source ID hiện hành:** Kiểm toán từ mã nguồn nguyên bản, dist build sạch  
**Điểm tổng thể:** **92 / 100** — **ĐỦ ĐIỀU KIỆN SẴN SÀNG TRIỂN KHAI THÍ ĐIỂM THỰC ĐỊA (PILOT READY / PRODUCTION CANDIDATE)**

---

## 1. Đối Tượng, Phạm Vi & Công Nghệ Thực Tế

### 1.1. Bản chất sản phẩm & Xác định phạm vi nghiệp vụ
- **Bản chất hệ thống:** Bảo An Learning là hệ sinh thái học tập trực tuyến cá nhân hóa dành cho học sinh Lớp 3 (tiểu học), bám sát chương trình 4 môn học: Toán học, Tiếng Việt, Tiếng Anh, Tin học. Hệ thống phục vụ 3 nhóm người dùng thực tế:
  1. **Học sinh (`student`):** Khám phá Bản đồ Thế giới học tập (4 vùng môn học, 7 chặng, 12 địa danh), xây dựng Thị trấn học tập isometric (10×10), tham gia 10 trò chơi học tập (Minigames) và Phòng thi thử (Contest/Exam), tích lũy sao thưởng và hoàn thành nhiệm vụ mỗi ngày.
  2. **Quản trị viên / Giáo viên (`admin`):** Quản lý lớp học, quản lý danh sách học sinh, soạn thảo và phân phối học liệu tuần qua nhập tệp mẫu Excel/Word (`.xlsx`, `.docx`), quản lý kho tư liệu media (ảnh, âm thanh) và phê duyệt đổi quà.
  3. **Phụ huynh (`parent`):** Đăng nhập bảo mật qua mã PIN 6 số, giám sát thời gian học tập trong ngày, theo dõi tiến độ tuần, xem bảng vàng huân chương và đồng hành đổi quà cho con.
- **Về các chức năng TKB / Điểm danh / Sơ đồ lớp / GVCN / GVBM trong đề cương kiểm toán:**
  - **KẾT LUẬN MINH BẠCH: KHÔNG ÁP DỤNG.**
  - Dự án không phải là phần mềm quản trị trường học THCS/THPT (không có thời khóa biểu 5 tiết/ngày, không có sơ đồ chỗ ngồi phân tiết học, không có sổ điểm danh giáo viên bộ môn hay sổ liên lạc điện tử).
  - Mọi đánh giá trong bộ báo cáo này tập trung vào các luồng thao tác thực tế: Giáo viên soạn/giao đề tuần → Học sinh làm bài/chơi game/thi thử → Phụ huynh giám sát → Đối soát dữ liệu và phân phối phần thưởng.

### 1.2. Công nghệ thực sự được sử dụng
- **Frontend SPA & PWA:**
  - React 19.1.0, TypeScript ~5.9, Vite 7.3.7.
  - Kiến trúc CSS mô-đun hóa cao: `primitives.css`, `stage.css`, `feedback.css`, `completion.css`, cùng các stylesheet chuyên biệt theo từng minigame (`math-quest.css`, `memory-match.css`, v.v.), loại bỏ hoàn toàn tình trạng tải monolithic CSS.
  - PWA Service Worker (`sw.js`) chịu trách nhiệm dọn dẹp các cache phiên bản cũ và hỗ trợ phân phối tài nguyên tĩnh.
- **Backend (Kiến trúc kép Dual-Store song song):**
  - *Chế độ Cục bộ / Offline-first:* Node.js 22 built-in `node:sqlite` (SQLite Database không phụ thuộc binary ngoài).
  - *Chế độ Đám mây / Cloud Multi-tenant:* PostgreSQL (`pg` runtime + `@electric-sql/pglite` trong test suite), Supabase Auth/Storage với signed URLs và TTL bảo mật.
- **Triển khai & Phân phối:**
  - Netlify Functions (`netlify/functions/api.ts`).
  - Server Node.js độc lập (`server/run-online.mjs`).
  - Gói triển khai Windows portable tự kiểm tra toàn vẹn (`tools/package_release.mjs`).

---

## 2. Bảng Chấm Điểm Dự Án Theo Thang 100

| Hạng mục | Điểm tối đa | Điểm đạt được | Bằng chứng thực tế & Căn cứ đánh giá |
|---|:---:|:---:|---|
| **Kiến trúc kỹ thuật và chất lượng mã** | 15 | **14 / 15** | Đạt chuẩn đối sánh SQLite/PostgreSQL; serializer DTO theo allowlist cách ly 100% dữ liệu mật; migration SQLite tự phục hồi đa bước; hợp đồng presentation ID thống nhất; mã nguồn sạch không còn monolithic CSS. |
| **UI và thiết kế đồ họa** | 15 | **14 / 15** | Đồ họa 2D nhẹ nhàng, chuẩn thẩm mỹ tiểu học; hỗ trợ thẻ `<picture>` thích ứng theo hướng màn hình (portrait/wide); WCAG 2.1 AA đạt tỷ lệ tương phản > 6.0:1; quét tự động axe-core đạt 0 lỗi serious/critical. |
| **UX và tính liền mạch thao tác** | 20 | **18 / 20** | Autosave có revision ordering chống ghi đè; badge trạng thái lưu trực quan; xử lý 409 stale presentation mượt mà; giữ preview nháp khi chuyển cửa sổ; cách ly gói ôn tập 100%; thao tác chạm di động chuẩn ≥ 44px. |
| **Hiệu năng tải trang và truy xuất** | 30 | **27 / 30** | Chẻ nhỏ CSS minigames thành công (`GameCompletion.css` giảm 94% từ 268.6 kB xuống 15.94 kB); tổng dung lượng dist giảm còn 4.86 MiB; SQLite benchmark < 3ms cho 1.000 học sinh; tải Staging 100 học sinh đạt p95 = 11.81 ms với 0% lỗi. *(Lưu ý: Mạng 4G ngoài hiện trường và INP RUM ghi nhận CHƯA KIỂM CHỨNG).* |
| **Bảo mật, ổn định và mở rộng** | 15 | **14 / 15** | Không rò rỉ đáp án; bảo vệ brute-force mã PIN phụ huynh; Restore staging có rollback compensation; snapshot backup kiểm tra toàn vẹn 1-1 với media rows; chống giả mạo CSRF và phiên đăng nhập. |
| **Khả năng bảo trì và triển khai** | 5 | **5 / 5** | 100% test suite đạt PASS: 270/270 test online, 48/48 test cloud, 26/26 test map, 12/12 test release, 20/20 test Playwright visual; đóng gói bất biến v4.0.2 khớp SHA-256; runner tải staging bắt trọn cookie và CSRF. |
| **TỔNG CỘNG** | **100** | **92 / 100** | **ĐỦ ĐIỀU KIỆN SẴN SÀNG TRIỂN KHAI THÍ ĐIỂM (PILOT READY)** |

*Nguyên tắc chấm điểm:* Bảo đảm minh bạch, không cho điểm tuyệt đối ở các mục đo lường phụ thuộc điều kiện hạ tầng công cộng chưa đo lường trên thiết bị người dùng thật.

---

## 3. Đánh Giá Mức Độ Sẵn Sàng Sử Dụng (Readiness Assessment)

Hệ thống Bảo An Learning phiên bản 4.0.2 đạt mức độ **SẴN SÀNG TRIỂN KHAI THỬ NGHIỆM THỰC ĐỊA (PILOT READY)**:
1. **Tính đúng đắn về nghiệp vụ:** Chấm điểm, cơ chế xáo trộn đáp án chống gian lận, tích lũy sao và sổ cái phần thưởng hoàn toàn nhất quán trên cả SQLite và PostgreSQL.
2. **Hiệu năng khởi động vượt trội:** Sau khi mô-đun hóa CSS trò chơi, payload CSS ban đầu của minigame giảm hơn 94%, loại bỏ độ trễ phân tích CSS trên điện thoại cấu hình yếu.
3. **Khả năng chịu lỗi và an toàn dữ liệu:** Quy trình sao lưu - phục hồi đám mây có cơ chế đền bù (compensation) và phân vùng staging, bảo đảm không làm hỏng dữ liệu đang chạy nếu sự cố xảy ra giữa chừng.
4. **Trải nghiệm di động thực thụ:** Giao diện co giãn mượt mà từ màn hình 320px đến máy tính bảng và màn hình lớn, hình nền thích ứng không gây tải ảnh kép trên thiết bị di động.

---

## 4. Mười Vấn Đề Ưu Tiên Hàng Đầu & Trạng Thái Xử Lý

| # | Mã | Mức độ | Vấn đề được phát hiện trong kiểm toán | Trạng thái hiện tại | Giải pháp đã áp dụng |
|---|:---:|:---:|---|:---:|---|
| 1 | **N01** | **P0** | Lộ chỉ số đúng (`displayedCorrectIndex`) và hoán vị câu hỏi cho học sinh trước khi trả lời. | **ĐÃ ĐÓNG (PASS)** | Triển khai DTO Serializer theo allowlist nghiêm ngặt tại `server/question-protocol.mjs`. |
| 2 | **N02** | **P0** | Khôi phục đám mây (Restore) ghi đè storage trước commit SQL, thiếu rollback compensation. | **ĐÃ ĐÓNG (PASS)** | Phân vùng `staging/restore-<jobId>/`, xác thực readback, commit SQL trước và rollback đền bù. |
| 3 | **N06** | **P1** | Autosave bài thi gộp nông `{...old, ...answers}`, request đến chậm ghi đè đáp án mới hơn. | **ĐÃ ĐÓNG (PASS)** | Kiểm tra `questionRevisions` nguyên tử tại server; client hiển thị badge trạng thái lưu. |
| 4 | **N05** | **P1** | Phân quyền gói ôn tập dựa trên tiền tố `review-`, học sinh B có thể mở gói ôn tập của học sinh A. | **ĐÃ ĐÓNG (PASS)** | Bổ sung `ownerStudentId` vào schema; từ chối HTTP 403 nếu truy cập chéo gói ôn tập. |
| 5 | **N07** | **P1** | Nút "Trả lời lại" không cấp lượt xáo mới; SQLite JSON path lỗi với itemId có dấu chấm (`curriculum.q.1`). | **ĐÃ ĐÓNG (PASS)** | Dùng quoted literal identifier cho SQLite JSON; thống nhất `presentationId` ở mọi game/runner. |
| 6 | **N08** | **P1** | Migration SQLite thiếu transaction; ngắt sau `DROP TABLE users` làm mất tài khoản người dùng. | **ĐÃ ĐÓNG (PASS)** | Bọc migration trong `BEGIN IMMEDIATE...COMMIT` và cơ chế self-healing tự nhận diện bảng tạm. |
| 7 | **N03/N04** | **P1** | Backup thiếu snapshot nhất quán; inventory media không khớp 1-1 với media rows vẫn báo hợp lệ. | **ĐÃ ĐÓNG (PASS)** | Bắt buộc bảng theo `BACKUP_TABLES`; đối soát kiểm kê kích thước và hash từng file media. |
| 8 | **N09/N13** | **P1** | Locator E2E treo ở nhãn cũ; màu text-muted (`#697666`) vi phạm độ tương phản WCAG 2 AA. | **ĐÃ ĐÓNG (PASS)** | Đồng bộ regex locators; nâng màu token lên `#485646` (>6.0:1); axe-core quét 0 lỗi vi phạm. |
| 9 | **N10/N14** | **P1** | Bundle CSS minigames monolithic (268.6 kB); tải ảnh nền kép trên điện thoại; CLS banner chào. | **ĐÃ ĐÓNG (PASS)** | Chẻ nhỏ CSS 10 minigames (`GameCompletion.css` còn 15.94 kB); dùng `<picture>` backdrop; shell kết nối nhẹ triệt tiêu CLS. |
| 10| **N11/N12** | **P2** | Staging runner bỏ sót cookie phiên & CSRF, đo sai thời gian phản hồi trước khi đọc xong body. | **ĐÃ ĐÓNG (PASS)** | Nâng cấp runner phân tích `baoan_online_session`, cấp phát CSRF từng VU, đo thời gian sau `res.text()`. |

---

## 5. Bằng Chứng Kiểm Thử Khách Quan Sau Nâng Cấp

Toàn bộ hệ thống kiểm thử tự động đã được thực thi và nghiệm thu độc lập trên Windows (Node.js v22.22.2):
- **Cú pháp (`npm run test:syntax`):** PASS (136/136 module TS/TSX hợp lệ).
- **Kiểu dữ liệu (`npm run typecheck`):** PASS (0 lỗi compile TypeScript).
- **Bộ kiểm thử phát hành (`npm run test:release`):** 12 / 12 PASS.
- **Bộ kiểm thử trực tuyến (`npm run test:online`):** **270 / 270 PASS** (bổ sung ca kiểm thử xác thực cookie và CSRF của Staging Runner `R231`).
- **Bộ kiểm thử đám mây (`npm run test:cloud`):** 48 / 48 PASS.
- **Bộ kiểm thử bản đồ (`npm run test:map`):** 26 / 26 PASS.
- **Kiểm tra ngân sách tài nguyên (`npm run test:assets`):** PASS (121 tệp, **4.86 MiB**, giảm từ 5.09 MiB, tuân thủ nghiêm ngặt ngân sách < 8.00 MiB).
- **Kiểm thử E2E Playwright trên trình duyệt thực tế (Chrome & Edge):**
  - `online-games.spec.ts`: 4/4 PASS (Minigames chuyển cảnh mượt, ghi nhận sao chính xác).
  - `online-a11y.spec.ts`: 2/2 PASS (0 lỗi critical/serious với kiểm tra tương phản được kích hoạt).
  - `online-studentflow.spec.ts`: 12/12 PASS (Bản đồ, ví sao, lưu bài an toàn, phục hồi lỗi).
  - `online-mapflow.spec.ts`: 2/2 PASS (Chuyển vùng, bảng chặng, quay lại mượt mà).

---

## 6. Những Nội Dung Cần Kiểm Chứng Thêm Ngoài Hiện Trường (Field Unverified)

1. **Khởi động lạnh (Cold-Start) Netlify Functions trên môi trường công cộng:** Cần đo lường thực tế từ các nhà mạng di động tại Việt Nam (Viettel, VNPT, MobiFone).
2. **Độ ổn định truyền tải tệp âm thanh trên mạng 4G vùng sóng yếu:** Cần buổi chạy thử thực tế ngoài hiện trường để đánh giá khả năng buffer âm thanh bài đọc tiếng Anh.
3. **Phản hồi công thái học của học sinh tiểu học:** Khảo sát thực tế phản xạ tay của trẻ nhỏ trên các kích thước màn hình điện thoại phụ huynh khác nhau (5.5" đến 6.7").
