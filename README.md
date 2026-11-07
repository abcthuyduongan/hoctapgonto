> **Cập nhật khắc phục sau đánh giá độc lập (06/11/2026):** Toàn bộ các lỗi bảo mật P0/P1 phát hiện tại đợt kiểm thử độc lập 05/11/2026 (L01–L07) đã được sửa triệt để và nghiệm thu thành công trên bản **4.0.1**. Chi tiết xem [Ma trận nghiệm thu 4.0.1](docs/DANH_GIA_4_0_0_2026-11-05/03_MA_TRAN_NGHIEM_THU.md) và [Kết quả nghiệm thu JSON](docs/DANH_GIA_4_0_0_2026-11-05/KET_QUA_NGHIEM_THU_4_0_1.json).

# Bảo An Learning · 4.3.0-rc.1 (Ứng viên đang nghiệm thu)

> **Cập nhật mới nhất:** Dự án đã bổ sung SafeTime sau đợt A–B. Xem [các lỗi kết nối đã sửa và trạng thái kiểm tra bản mới](docs/KIEM_TRA_BACKEND_AB_VA_SONG_HANH_2026-11-07/06_CAP_NHAT_SAFETIME_MOI.md). Kết quả/gói 4.1 cũ không chứng nhận bản 4.3 hiện tại. Chưa cập nhật Netlify.

> **Trạng thái hiện hành 07/11/2026:** Kiểm tra lại backend/frontend A–B, sửa lỗi tương thích và giao diện; xem [báo cáo khắc phục](docs/KIEM_TRA_BACKEND_AB_VA_SONG_HANH_2026-11-07/01_BAO_CAO_KIEM_TRA_VA_SUA_LOI.md), [kết quả nghiệm thu](docs/KIEM_TRA_BACKEND_AB_VA_SONG_HANH_2026-11-07/03_KET_QUA_NGHIEM_THU.json) và [kế hoạch song hành SafeTime](docs/KIEM_TRA_BACKEND_AB_VA_SONG_HANH_2026-11-07/02_CHOT_PHUONG_AN_SONG_HANH.md). Đây là phiên bản mã nguồn tại máy; chưa tự triển khai lên Netlify.
> **Bộ học liệu:** Khung 8 tuần học kỳ 2 lớp 3 (`data/curriculum/hoc-ky-2-8-tuan.json`) đạt chuẩn kỹ thuật; xáo đáp án tự động độc lập với vị trí nguồn.  
> **Kiểm thử:** Số ca và trạng thái cuối trong hồ sơ nghiệm thu nêu trên. Thử nghiệm với trẻ, thiết bị thật và kết nối tự động SafeTime có cổng nghiệm thu riêng, chưa được chứng nhận bằng kiểm thử mã nguồn.

> **Bộ quà của gia đình:** [20 món có ảnh, giá tiền và số sao](docs/BO_QUA_BAO_AN_20_MON/DANH_MUC_QUA.html), tạm tính **1 sao = 500 đồng**. Thêm trong **Quản trị → Kệ quà → Bộ 20 món quà dành cho Bảo An**; yêu cầu đổi thưởng đã gửi vẫn giữ tỷ lệ cũ.

> **Bàn giao sử dụng và cập nhật web:** [Cách thêm quà, kiểm tra bản mới, sao lưu và thử cùng Bảo An](docs/KIEM_TRA_BACKEND_AB_VA_SONG_HANH_2026-11-07/05_BAN_GIAO_THUC_HIEN.md).

Ứng dụng học tập thông minh dành cho học sinh tiểu học (Lớp 3) kết hợp gia đình và nhà trường:
- **Bản đồ thế giới học tập 2D:** 4 vùng môn học (Toán học, Tiếng Việt, Tiếng Anh, Tin học), 28 tranh cảnh quan và địa danh văn hóa Việt Nam, chặng học tập mở theo tuần, có sương mù và thẻ khám phá kể chuyện.
- **10 Trò chơi giáo dục đa dạng:** Đảo Câu Hỏi, Ghép Thẻ Ký Ức, Nối Từ Nhanh, Bậc Thang Câu Văn, Đường Mòn Số Học, Cân Thăng Bằng, Phân Loại Vào Giỏ, Lật Thẻ Kho Báu, Bếp Nhỏ Của Cáo, Đua Thuyền Rồng.
- **Hệ thống phần thưởng giữ chân tích cực:** Kệ quà đổi quà thật, ghim mục tiêu phấn đấu, sổ huy hiệu danh dự, chuỗi ngày học tập (streak), nhiệm vụ ngày và thị trấn của con (xây dựng công trình bằng vật liệu học tập, hàng xóm động vật chuyển đến, cổ vũ bạn bè, bảng tin lớp an toàn).
- **Phòng thi thử Violympic & IOE:** Bấm giờ thi chuẩn kỳ thi học sinh giỏi, không lộ đáp án trước, xem lại câu sai và ôn luyện tức thì.
- **Khu phụ huynh bảo vệ bằng PIN:** Quản lý quà tặng, duyệt đổi quà, xem báo cáo học tập tuần (PDF/in ấn), đặt giới hạn thời gian học mỗi ngày và khung giờ giới nghiêm bảo vệ mắt trẻ.

---

## 1. Hướng dẫn chạy nhanh trên máy tính

Yêu cầu môi trường: **Node.js 22.22.2 trở lên**.

```powershell
# 1. Cài đặt thư viện
npm ci

# 2. Biên dịch production
npm run build

# 3. Khởi chạy máy chủ cục bộ (Local Server)
npm run online
```

Truy cập ứng dụng tại: `http://127.0.0.1:4180/?online=1`

Đối với gói cài đặt ngoại tuyến (Offline ZIP):
- Mở `MO_BAO_AN.cmd` để vào ứng dụng học tập học sinh.
- Mở `MO_QUAN_LY.cmd` để vào trang quản trị giáo viên.

---

## 2. Gói phát hành chính thức 4.0.1

- **Gói chạy ngoại tuyến (Standalone ZIP):** `releases/bao-an-learning-4.0.1.zip`
- **Gói lưu trữ mã nguồn đầy đủ (Source ZIP):** `releases/bao-an-learning-4.0.1-source.zip`
- **Ghi chú phát hành chi tiết:** [docs/RELEASE_NOTES_v4.0.0.md](docs/RELEASE_NOTES_v4.0.0.md)
- **Hướng dẫn sử dụng toàn diện:** [docs/HUONG_DAN_SU_DUNG.html](docs/HUONG_DAN_SU_DUNG.html)
- **Cẩm nang phụ huynh 1 trang:** [docs/HUONG_DAN_PHU_HUYNH.md](docs/HUONG_DAN_PHU_HUYNH.md)
- **Hướng dẫn giáo viên soạn và giao học liệu:** [docs/HUONG_DAN_GIAO_VIEN_SOAN_HOC_LIEU.md](docs/HUONG_DAN_GIAO_VIEN_SOAN_HOC_LIEU.md)

---

## 3. Quy chuẩn kiểm thử chất lượng

```powershell
# Chạy toàn bộ bộ kiểm thử tự động
npm test

# Quét kiểm tra kiểu dữ liệu TypeScript
npm run typecheck

# Quét ngân sách tài nguyên WebP 2D
npm run test:assets

# Đóng gói và xác thực gói phát hành
npm run package:pilot
npm run package:source
```

---

## 4. Triển khai Cloud (Netlify & Supabase)

- **Netlify Build Command:** `npm run build`
- **Publish Directory:** `dist`
- **Netlify Functions:** `netlify/functions`
- **Cơ sở dữ liệu Supabase:** PostgreSQL schema `bao_an` với 26 bảng dữ liệu phân lớp an toàn RLS (xem [docs/NETLIFY_SUPABASE.md](docs/NETLIFY_SUPABASE.md)).
- **Sao lưu và Khôi phục Cloud:** Bộ công cụ `server/cloud-backup-restore.mjs` đạt chỉ số RTO 13 ms và RPO 0 giờ.
