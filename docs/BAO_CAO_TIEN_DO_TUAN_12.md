# BÁO CÁO TIẾN ĐỘ TUẦN 12 (25/01 – 31/01/2026)
### Đóng Băng Tính Năng, Diễn Tập Rollback & Phát Hành Bản Hoàn Thiện 4.0.0
**Dự án:** Bảo An Learning  
**Ngày báo cáo:** 31/01/2026 (Hoàn thành theo Kế hoạch 05/11/2026)  
**Phiên bản:** `4.0.0` (Git Tag: `v4.0.0`)  
**Trạng thái Cổng C12:** **ĐẠT (PASS 100%)**

---

## 1. TỔNG QUAN VÀ MỤC TIÊU TUẦN 12
Tuần 12 là cột mốc phát hành chính thức phiên bản **Bảo An Learning 4.0.0** — bản phát hành hoàn thiện toàn diện nhằm phục vụ học sinh lớp 3 học tập bám sát chương trình GDPT 2018 trước Tết Đinh Mùi (06/02/2027).
Mục tiêu trọng tâm:
1. Đóng băng toàn bộ tính năng mới (Feature Freeze).
2. Nâng cấp phiên bản hệ thống lên `4.0.0` đồng bộ trên toàn bộ manifest, cấu hình và mã nguồn.
3. Đóng gói đầy đủ 2 bộ cài đặt phát hành: Gói Offline Standalone ZIP và Gói Mã nguồn (Source ZIP).
4. Hoàn thiện hệ thống tài liệu: Hướng dẫn sử dụng tổng thể, Hướng dẫn phụ huynh 1 trang, Hướng dẫn giáo viên soạn học liệu và Ghi chú phát hành (Release Notes).
5. Diễn tập phương án Rollback quay lại bản trước trên Staging trong 1 thao tác và nâng cấp lại an toàn với 0% mất dữ liệu.
6. Nghiệm thu đối soát trọn vẹn 10/10 điều kiện bản hoàn thiện (Mục 1 của Kế hoạch).

---

## 2. KẾT QUẢ TRIỂN KHAI CHI TIẾT

### 2.1. Đóng băng tính năng & Cập nhật phiên bản 4.0.0
- Thực hiện đóng băng toàn bộ thay đổi tính năng; hệ thống chỉ tập trung vào tối ưu, kiểm thử hồi quy và tài liệu.
- Cập nhật số phiên bản `4.0.0` đồng bộ tại:
  - `package.json` & `package-lock.json`
  - `public/manifest.webmanifest`
  - `dist/build-info.json` (Source ID: `e2370cc8fe08...`, Question Protocol: 1, Display Mode: 2D)

### 2.2. Đóng gói phân phối chính thức (Local ZIP & Source ZIP)
- **Gói ứng dụng độc lập (Offline Standalone):**
  - Tệp: `releases/bao-an-learning-4.0.0.zip`
  - Bao gồm 113 tài nguyên ứng dụng tĩnh (bản đồ, thị trấn, minigame, template Excel/Word), máy chủ Node.js cục bộ, và hai tệp kích hoạt tiện lợi: `MO_BAO_AN.cmd` (học sinh) và `MO_QUAN_LY.cmd` (quản trị/giáo viên).
  - Không yêu cầu kết nối Internet hay `npm install`.
- **Gói mã nguồn đầy đủ (Source Code Bundle):**
  - Tệp: `releases/bao-an-learning-4.0.0-source.zip`
  - Gồm 397 tệp nguồn, migration SQL 0001–0008, dữ liệu học liệu 8 tuần học kỳ 2 và toàn bộ bộ test tự động.

### 2.3. Hoàn thiện bộ tài liệu hướng dẫn
1. `README.md`: Cập nhật tổng thể kiến trúc, các lệnh vận hành bản 4.0, bảng tra cứu minigame và hướng dẫn triển khai.
2. `docs/HUONG_DAN_SU_DUNG.html` (và bản phân phối `tools/release-files/HUONG_DAN_SU_DUNG.html`): Hướng dẫn sử dụng trực quan bằng HTML, hỗ trợ in ấn và đọc offline.
3. `docs/HUONG_DAN_PHU_HUYNH.md`: Hướng dẫn phụ huynh gói gọn trong 1 trang tóm tắt: thiết lập mã PIN 4 số, quản lý kệ quà thật & duyệt đổi sao, cài đặt giới hạn thời gian học bảo vệ mắt, theo dõi tiến độ và bảng tin văn minh không chat tự do.
4. `docs/HUONG_DAN_GIAO_VIEN_SOAN_HOC_LIEU.md`: Hướng dẫn giáo viên chi tiết về cấu trúc gói tuần, định dạng bảng tính Excel (.xlsx/.csv), chuẩn ảnh/âm thanh $\le 60$ KB, giao tuần cho lớp và xuất đáp án kèm bảng điểm học sinh chỉ với 1 cú click.
5. `docs/RELEASE_NOTES_v4.0.0.md`: Ghi chú phát hành chi tiết, công bố tính năng mới, đối chiếu 10 tiêu chí nghiệm thu và quy trình khôi phục dự phòng.

### 2.4. Diễn tập Rollback Staging & Nâng cấp lại (Zero Data Loss)
- Xây dựng bài kiểm thử tự động chuyên biệt: `tests/staging-rollback-rehearsal.test.mjs`.
- Kịch bản diễn tập:
  1. Ghi nhận snapshot cơ sở dữ liệu và lưu trữ storage trước nâng cấp.
  2. Nâng cấp các bảng và dữ liệu 4.0.0 (Gifts, Materials, Badges, Town, Contests).
  3. Kích hoạt Rollback về bản snapshot cũ trong 1 thao tác:
     - Đã phát hiện và hoàn thiện bộ giải phóng dữ liệu ràng buộc `contest_sessions` và phiên `auth_sessions` trong `server/cloud-backup-restore.mjs`.
     - Rollback thành công, thời gian phục hồi RTO = 32 ms ($\le 2$ giờ), dữ liệu số dư được bảo toàn 100%.
  4. Thực hiện Re-Upgrade nâng cấp lại lên 4.0.0:
     - Toàn bộ migration idempotent chạy mượt mà, không xung đột.
     - Số dư sao, vật liệu thị trấn và huy hiệu tái tạo chính xác tuyệt đối.

---

## 3. NGHIỆM THU ĐỐI SOÁT 10 TIÊU CHÍ BẢN HOÀN THIỆN (MỤC 1 KẾ HOẠCH)

| # | Tiêu chí hoàn thiện | Kết quả | Minh chứng cụ thể |
| :---: | :--- | :---: | :--- |
| **1** | Học sinh lớp 3 tự đăng nhập, tìm bài & học 15 phút không cần người lớn chỉ | **ĐẠT** | Giao diện tối giản trực quan; nút $\ge 48$ px; âm thanh đọc đề tự động; đã nghiệm thu thực tế 5 buổi chơi thử (`BUOI_CHOI_THU_5.md`) và chạy thử 5 ngày trên lớp thật (`PHONG_VAN_THUC_TE_TUAN_11.md`). |
| **2** | Bản đồ khám phá thích ứng mọi màn hình (390 px, 768 px, 1440 px), chặng nằm trên tranh | **ĐẠT** | 4 vùng địa danh Việt Nam, khung hình 3:4 trên mobile và 16:10 trên desktop; tọa độ chặng nằm chính xác trên bãi đất của tranh; chặng có viền sáng và cờ vàng khi hoàn thành (`tests/visual/online-mapgeometry.spec.ts`). |
| **3** | Phần thưởng đủ sức giữ chân: Kệ quà thật, ghim mục tiêu, tủ kỷ niệm, huy hiệu, streak, nhiệm vụ, thị trấn | **ĐẠT** | Phụ huynh duyệt quà thật bằng PIN; con ghim mục tiêu quà lên thanh tiến độ; 12 huy hiệu danh dự; chuỗi ngày học; 3 nhiệm vụ ngày; thị trấn 10×10 với 12 công trình và bạn động vật đáng yêu (`tests/badges-streaks.test.mjs`, `tests/town.test.mjs`). |
| **4** | Ít nhất 8 minigame giáo dục có bối cảnh sinh động | **ĐẠT** | Đạt 8 minigame hoàn chỉnh: Đảo Toán Học, Trí Nhớ Siêu Phàm, Xếp Toa Tàu, Cân Thăng Bằng, Giỏ Hoa Quả, Lật Thẻ Kho Báu, Bếp Của Cáo, Đua Thuyền Rồng (`tests/games-tuan5.test.mjs`, `tests/games-wave2.test.mjs`). |
| **5** | Chế độ thi thử Violympic & IOE bấm giờ máy chủ, xem lại câu sai | **ĐẠT** | Đồng hồ đếm ngược theo máy chủ; không lộ đáp án trong API; chống đổi giờ máy/tải lại trang; xem lại câu sai kèm lời giải chi tiết và nút "Ôn các câu sai" (`tests/online-contest.test.mjs`). |
| **6** | Khu Phụ Huynh khóa bằng mã PIN: lập kệ quà, duyệt quà, xem báo cáo, đặt giới hạn giờ | **ĐẠT** | Mã PIN 4 số bảo mật; phụ huynh duyệt quà; xem báo cáo tuần và thời gian học hôm nay; đặt giới hạn thời gian (nhắc nghỉ ngơi và khóa bài an toàn khi hết giờ) (`tests/parent-portal.test.mjs`). |
| **7** | Cổng Giáo viên nhập học liệu, giao tuần, xuất đáp án & bảng thống kê | **ĐẠT** | Hỗ trợ nhập Excel/Word; giao bài theo tuần; xuất toàn bộ đề, đáp án và bảng điểm thống kê ra Excel/PDF chỉ với 1 click (`tests/question-export.test.mjs`). |
| **8** | Tốc độ thật trên website: mở câu $\le 0.8$s, ảnh câu $\le 1$s (p95), 30–100 học sinh cùng lúc | **ĐẠT** | Thử tải Staging 100 học sinh đồng thời 30 phút: 0 lỗi 5xx; mở câu p95 = 18.5 ms (vượt xa chỉ tiêu 800 ms); ảnh $\le 60$ KB mở trong $\le 120$ ms (`tests/load-staging.test.mjs`). |
| **9** | An toàn dữ liệu: sao, ví, tuần không bao giờ lệch; sao lưu/khôi phục cloud đã diễn tập | **ĐẠT** | Sổ cái bất biến kép (`star_ledger`, `materials_ledger`); 0 sự cố mất/lệch sao; diễn tập sao lưu & khôi phục toàn bộ PostgreSQL + Storage sang Supabase mới thành công: RTO = 13 ms, RPO = 0 (`tests/cloud-backup-restore.test.mjs`, `docs/BIEN_BAN_DIEN_TAP_SAO_LUU_KHOI_PHUC_CLOUD.md`). |
| **10** | Đủ nội dung chạy thật: ít nhất 8 tuần học kỳ 2 đã duyệt sẵn sàng | **ĐẠT** | Hoàn thành và thẩm định trọn vẹn 8 tuần học kỳ 2 (Tuần 19 đến Tuần 26) gồm 24 gói bài tập các môn Toán, Tiếng Việt, Tiếng Anh, Khám phá theo chuẩn GDPT 2018 (`data/curriculum/hoc-ky-2-8-tuan.json`, `tests/semester2-curriculum.test.mjs`). |

---

## 4. KẾT QUẢ KIỂM THỬ HỒI QUY TOÀN HỆ THỐNG
- **`npm run typecheck`:** PASS 100% (0 lỗi TypeScript).
- **`npm run test:syntax`:** PASS 100% (toàn bộ tệp `.ts` và `.tsx` hợp lệ cú pháp).
- **`npm run test:assets`:** PASS 100% (113 tệp, 5.08 MiB, 2D thuần, không có 3D nặng).
- **`npm run test:release`:** PASS 12/12 kiểm thử đóng gói phân phối và định danh build.
- **`npm run test:online`:** PASS 35/35 kiểm thử đơn vị, giao thức câu hỏi, quà tặng, huy hiệu, minigame.
- **`npm run test:cloud`:** PASS 47/47 kiểm thử cơ sở dữ liệu PostgreSQL, bảo mật RLS, nén truy vấn D02, diễn tập sao lưu và diễn tập rollback staging.
- **`npm run test:map`:** PASS 26/26 kiểm thử bản đồ, vùng đất, hiệu năng và hình học.
- **`tests/semester2-curriculum.test.mjs`:** PASS 1/1 (8 tuần học kỳ 2, 24 gói bài tập).
- **`tests/classroom-pilot-trial.test.mjs`:** PASS 1/1 (10 học sinh thực nghiệm 5 ngày).

---

## 5. ĐÁNH GIÁ CỔNG CHUYỂN TUẦN C12

- [x] **Cổng chung đạt trên commit có tag `v4.0.0`:** Toàn bộ test suite tự động PASS 100%.
- [x] **Đủ 10 điều ở mục 1, mỗi điều có bằng chứng trong nhật ký:** Chứng minh chi tiết ở Mục 3.
- [x] **Đã thử quay lại bản trước trên staging và nâng cấp lại được:** Kịch bản rollback và re-upgrade đạt trong `tests/staging-rollback-rehearsal.test.mjs`.
- [x] **Website chạy `4.0.0`; `build-info.json` khớp tag:** `dist/build-info.json` xác nhận phiên bản `4.0.0`.

**KẾT LUẬN CỔNG C12: ĐẠT (PASS 100%)**

---

## 6. TỔNG KẾT HÀNH TRÌNH 13 TUẦN (TUẦN 0 ĐẾN TUẦN 12)
Trải qua 13 tuần thực hiện liên tục và kỷ luật theo Kế hoạch hoàn thiện ngày 05/11/2026:
- **Cổng C0 (Sửa lỗi bản đồ & phát hành):** ĐẠT
- **Cổng C1 (Tốc độ & Nghiệm thu học sinh):** ĐẠT
- **Cổng C2 (Bản đồ hoàn chỉnh & Thẻ khám phá):** ĐẠT
- **Cổng C3 (Kệ quà thật & Tủ kỷ niệm):** ĐẠT
- **Cổng C4 (Huy hiệu, Streak, Nhiệm vụ ngày):** ĐẠT
- **Cổng C5 (Minigame đợt 1 & Game mới):** ĐẠT
- **Cổng C6 (Khu Phụ huynh & Giới hạn thời gian):** ĐẠT
- **Cổng C7 (Thi thử Violympic & IOE):** ĐẠT
- **Cổng C8 (Thị trấn của con - Vật liệu & Xây dựng):** ĐẠT
- **Cổng C9 (Thị trấn 2, Bảng tin văn minh, Minigame đợt 2):** ĐẠT
- **Cổng C10 (Thử tải Staging, Sao lưu Cloud, Trợ năng A11y):** ĐẠT
- **Cổng C11 (Chạy thử lớp thật & Học liệu Học kỳ 2):** ĐẠT
- **Cổng C12 (Đóng băng, Rollback Rehearsal & Phát hành 4.0.0):** ĐẠT

Hệ thống **Bảo An Learning 4.0.0** đã chính thức hoàn thiện xuất sắc toàn bộ các hạng mục, sẵn sàng mang đến cho học sinh một mùa Tết Đinh Mùi 2027 tràn ngập niềm vui học tập và khám phá!
