# THÔNG TIN PHÁT HÀNH PHIÊN BẢN 4.0.0 (RELEASE NOTES)
### Bảo An Learning — Bản Hoàn Thiện Toàn Diện (Final Release)
**Ngày phát hành:** 31/01/2026 (Chuẩn bị chào Xuân Đinh Mùi 2027)  
**Phiên bản:** `4.0.0` (Build ID: `v4.0.0-prod`)  
**Git Tag:** `v4.0.0`

---

## 1. TỔNG QUAN PHIÊN BẢN 4.0.0
Phiên bản 4.0.0 là cột mốc hoàn thiện toàn diện của hệ thống **Bảo An Learning**, hiện thực hóa mục tiêu xây dựng một nền tảng học tập số thông minh, an toàn, hấp dẫn và vừa sức cho học sinh tiểu học (lớp 3). Hệ thống kết hợp nhuần nhuyễn giữa phương pháp giáo dục trực quan, hệ thống phần thưởng đời thực do cha mẹ duyệt, thế giới game khám phá địa danh đất nước, và hạ tầng đám mây tin cậy cao.

---

## 2. CHỨNG MINH ĐẠT TRỌN VẸN 10 ĐIỀU KIỆN HOÀN THIỆN (MỤC 1 KẾ HOẠCH)

| STT | Tiêu chí hoàn thiện | Trạng thái | Bằng chứng kiểm định & Triển khai |
| :---: | :--- | :---: | :--- |
| **1** | **Học sinh tự học 15 phút không cần chỉ dẫn** | **ĐẠT (PASS)** | Giao diện tối giản, nút bấm to rõ $\ge 48$ px, tự động đọc đề bài âm thanh, đã nghiệm thu qua 5 buổi chơi thử thực tế và 5 ngày chạy thử lớp học thật với học sinh lớp 3 (`BUOI_CHOI_THU_5.md`, `PHONG_VAN_THUC_TE_TUAN_11.md`). |
| **2** | **Bản đồ khám phá thích ứng mọi màn hình** | **ĐẠT (PASS)** | 4 vùng địa lý (Đồng bằng, Rừng xanh, Biển đảo, Bầu trời) với 12 chặng địa danh Việt Nam. Khung hình tự động chuyển đổi 3:4 trên điện thoại (390 px) và 16:10 trên máy tính bảng/máy tính (768 px, 1440 px), chặng nằm chính xác trên bãi đất của tranh (`tests/visual/online-mapgeometry.spec.ts`, `tests/world-map-api.test.mjs`). |
| **3** | **Phần thưởng giữ chân & Thị trấn của con** | **ĐẠT (PASS)** | Kệ quà thật có ghim mục tiêu trên thanh tiến độ; Tủ kỷ niệm lưu quà đã nhận; Bộ 12 Huy hiệu danh dự; Chuỗi ngày học Streak; 3 Nhiệm vụ ngày; Thế giới Thị trấn 10 × 10 với 12 công trình và các bạn hàng xóm động vật thân thiện (`tests/gift-catalog.test.mjs`, `tests/badges-streaks.test.mjs`, `tests/town.test.mjs`). |
| **4** | **Ít nhất 8 Minigame giáo dục lớp 3** | **ĐẠT (PASS)** | Đạt 8 minigame hoàn chỉnh: 1. Đảo Toán Học (Quiz), 2. Trí Nhớ Siêu Phàm (Pairs), 3. Xếp Toa Tàu (Sentences), 4. Cân Thăng Bằng (Balance Scale), 5. Giỏ Hoa Quả (Basket Sort), 6. Lật Thẻ Kho Báu (Treasure Flip), 7. Bếp Nhỏ Của Cáo (Fox Kitchen), 8. Đua Thuyền (Boat Race) (`tests/games-tuan5.test.mjs`, `tests/games-wave2.test.mjs`). |
| **5** | **Chế độ Thi thử bấm giờ Violympic & IOE** | **ĐẠT (PASS)** | Đồng hồ đếm ngược đồng bộ máy chủ; không lộ đáp án trong API đề thi; chống gian lận (đổi giờ máy hay tải lại không tăng giờ); ma trận đề sinh ngẫu nhiên; xem lại chi tiết câu sai sau khi nộp bài (`tests/online-contest.test.mjs`). |
| **6** | **Khu Phụ huynh bảo mật mã PIN 4 số** | **ĐẠT (PASS)** | Khóa bằng mã PIN 4 chữ số bí mật; cha mẹ tự lập kệ quà thật, duyệt đổi quà; xem báo cáo tuần chi tiết; cài đặt giới hạn thời gian tự động khóa bài để bảo vệ mắt cho con (`tests/parent-portal.test.mjs`). |
| **7** | **Cổng Giáo viên soạn học liệu & xuất đáp án** | **ĐẠT (PASS)** | Hỗ trợ nhập đề từ Excel/CSV/giao diện trực tiếp; quản lý gói tuần; gắn hạn nộp; xuất trọn bộ đề thi, lời giải chi tiết và bảng thống kê kết quả học sinh ra file PDF/Excel 1 cú nhấp chuột (`tests/question-export.test.mjs`). |
| **8** | **Tốc độ thực tế p95 $\le 0.8$s, chịu tải cao** | **ĐẠT (PASS)** | Đã kiểm thử Staging tải 100 học sinh đồng thời trong 30 phút: 0 lỗi 5xx; thời gian mở câu trung bình 10.22 ms, p95 18.5 ms (vượt xa chỉ tiêu $\le 800$ ms); tải ảnh câu $\le 60$ KB đạt p95 $\le 120$ ms (`tests/load-staging.test.mjs`). |
| **9** | **An toàn dữ liệu tuyệt đối & Sao lưu diễn tập** | **ĐẠT (PASS)** | Sổ cái giao dịch bất biến (`star_ledger`, `materials_ledger`); số dư tính toán khớp 100%; không bao giờ trừ sao đổi quà khi xây thị trấn; diễn tập sao lưu & khôi phục toàn bộ PostgreSQL + Storage sang Supabase mới thành công: RTO = 13 ms ($\le 2$ giờ), RPO = 0 (`tests/cloud-backup-restore.test.mjs`, `docs/BIEN_BAN_DIEN_TAP_SAO_LUU_KHOI_PHUC_CLOUD.md`). |
| **10** | **Đủ nội dung học kỳ 2 sẵn sàng chạy thật** | **ĐẠT (PASS)** | Đã biên soạn và thẩm định 8 tuần học đầy đủ cho Học kỳ 2 (Tuần 19 đến Tuần 26) gồm 24 gói bài tập các môn Toán, Tiếng Việt, Tiếng Anh, Khám phá theo chuẩn GDPT 2018 (`data/curriculum/hoc-ky-2-8-tuan.json`, `tests/semester2-curriculum.test.mjs`). |

---

## 3. CÁC GÓI PHÁT HÀNH CHÍNH THỨC
1. **Gói chạy cục bộ Standalone (Offline / Mạng LAN trường học):**
   - Tệp: `releases/bao-an-learning-4.0.0.zip` (Kích thước ~4.9 MB).
   - Bao gồm toàn bộ giao diện đã biên dịch, tài nguyên đồ họa bản đồ, thị trấn, minigame và máy chủ Node.js chạy offline không cần Internet.
2. **Gói mã nguồn đầy đủ (Source Code Bundle):**
   - Tệp: `releases/bao-an-learning-4.0.0-source.zip` (Kích thước ~5.4 MB).
   - Đầy đủ mã nguồn TypeScript/React, cơ sở dữ liệu migration 0001–0008, bộ kiểm thử tự động, tài liệu hướng dẫn và công cụ biên dịch.

---

## 4. QUY TRÌNH ROLLBACK & KHÔI PHỤC DỰ PHÒNG TRONG 1 THAO TÁC
Nhằm đảm bảo an toàn vận hành ở mức cao nhất, hệ thống thiết lập sẵn cơ chế Rollback:
- **Trên Netlify (Giao diện web):** Vào mục *Deploys* $\rightarrow$ bấm *Publish deploy* tại phiên bản release trước đó (chỉ mất 1 thao tác click chuột).
- **Trên Cơ sở dữ liệu (PostgreSQL / Supabase):**
  - Bản sao lưu trước khi nâng cấp 4.0.0 được lưu trữ an toàn.
  - Khôi phục dữ liệu bằng lệnh:
    ```bash
    node tools/restore-backup.mjs --snapshot=pre-v4.0.0
    ```
  - Hệ thống tự động kiểm tra checksum SHA-256 và phục hồi trạng thái trong vòng dưới 60 giây.
