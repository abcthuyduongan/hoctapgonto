> **Cập nhật khắc phục sau đánh giá độc lập (06/11/2026):** Toàn bộ các lỗi bảo mật P0/P1 phát hiện tại đợt kiểm thử độc lập 05/11/2026 (L01–L07) đã được sửa triệt để và nghiệm thu thành công trên bản **4.0.1**. Chi tiết xem [Ma trận nghiệm thu 4.0.1](docs/DANH_GIA_4_0_0_2026-11-05/03_MA_TRAN_NGHIEM_THU.md) và [Kết quả nghiệm thu JSON](docs/DANH_GIA_4_0_0_2026-11-05/KET_QUA_NGHIEM_THU_4_0_1.json).

# Bảo An Learning · Phiên bản 4.0.1 (Bản hoàn thiện đã qua nghiệm thu)

> **Trạng thái:** Bản phát hành hoàn thiện 4.0.1 — Đã khắc phục 100% các lỗi bảo mật máy chủ, quyền PIN, sao lưu cloud, migration DDL, xáo đáp án ngẫu nhiên và cuộn giao diện di động.  
> **Bộ học liệu:** Khung 8 tuần học kỳ 2 lớp 3 (`data/curriculum/hoc-ky-2-8-tuan.json`) đạt chuẩn kỹ thuật; xáo đáp án tự động độc lập với vị trí nguồn.  
> **Kiểm thử nghiệm thu:** 100% automated tests đạt (263 online, 47 cloud, 26 bản đồ, 12 release, 28/28 Playwright browser visual tests, 0 lỗi P0/P1).

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
