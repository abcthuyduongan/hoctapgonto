# Kế hoạch phát triển Bảo An Learning 5.0 – Đọc trước

Lập ngày 07/11/2026 · Căn cứ: mã nguồn 4.0.2 (commit `3ff86b5`), chạy thử gói 4.0.2, tài liệu đánh giá cũ, trang `https://hoctapgonto.netlify.app/`.

## Mục tiêu

Biến Bảo An thành **một thế giới liền mạch** nơi trẻ **vừa chơi, vừa khám phá, vừa học**:

- giao diện đồng bộ trên mọi màn hình và mọi cỡ máy;
- mỗi ngày có một vòng rõ ràng **Học → Khám phá → Chơi** khoảng 20 phút;
- kết nối với SafeTime (học dạng nhiệm vụ, đăng nhập bằng tài khoản Bảo An, sao chỉ đổi vật phẩm);
- thử nghiệm với học sinh thật trước khi phát hành 5.0.

## Đọc theo thứ tự

| # | Tệp | Nội dung |
| --- | --- | --- |
| 1 | `01_DANH_GIA_HIEN_TRANG.md` | Điểm mạnh, vấn đề giao diện (số đo + ảnh), vấn đề trải nghiệm, nợ kỹ thuật |
| 2 | `02_DINH_HUONG_VA_HE_THONG_THIET_KE.md` | Vòng Học → Khám phá → Chơi, sơ đồ màn hình, điều hướng mới, hệ thống thiết kế (màu, chữ, biểu tượng, thành phần, khung trò chơi), chỉ số mục tiêu |
| 3 | `03_LO_TRINH_VA_VIEC_CAN_LAM.md` | 6 giai đoạn A–F, từng việc có mã, số ngày, tiêu chí xong; rủi ro; phương án một người làm hai dự án |
| 4 | `04_MA_TRAN_NGHIEM_THU.md` | Tiêu chí nghiệm thu đo được cho từng giai đoạn |
| — | `anh-hien-trang/` | 13 ảnh chụp bản 4.0.2 làm bằng chứng và mốc so sánh |
| — | `../KET_NOI_SAFETIME.md` | Hợp đồng kết nối với SafeTime (giai đoạn D) |

## Tóm tắt phát hiện

- **Nền tảng tốt**: máy chủ, dữ liệu, kiểm thử, tranh minh họa, 10 trò chơi, khu phụ huynh.
- **Giao diện chưa đồng bộ**:
  - CSS đang chạy có 657 mã màu, 111 cỡ chữ, hơn 40 mốc màn hình, không có tệp token chung;
  - ít nhất 4 kiểu hộp thoại khác nhau;
  - thi thử theo phong cách xanh đen và mở chồng lên trang chủ;
  - thanh trên cùng có 12 nút;
  - trang chủ học sinh dài khoảng 3.000 px.
- **Vòng chơi – khám phá – học chưa liền mạch**: các phần đã có nhưng rời rạc, có 5 hệ thống thưởng song song, khám phá chưa hiện ra như phần thưởng của việc học.
- **Chưa có người dùng thật**: biên bản "phỏng vấn tuần 11" là kịch bản giả định.
- **Dữ liệu thừa và nợ kỹ thuật (Cập nhật 07/11/2026)**:
  - **Đã xóa 295 KB CSS chết** (`game-base.css` và `game-context-themes.css` không còn được nạp).
  - **Đã xóa thư mục `ảnh/`**: gồm 187.5 MB ảnh thô PNG (đã chuyển WebP sang `public/art/`) và các tệp kế hoạch/đề xuất trùng lặp (`game222.md`, v.v.), giảm kích thước đóng gói nguồn từ 196.8 MB xuống 21.8 MB (-89%).
  - **Đã dọn dẹp các tệp build/checkpoint cũ**: trong `releases/`, `backups/`, `outputs/`, `.npm-cache/`, `test-results/`, giải phóng hơn 600 MB ổ đĩa.
  - Toàn bộ test suite và build vẫn xanh 100%.

## Lộ trình

| GĐ | Nội dung | Ngày | Bản |
| --- | --- | --- | --- |
| A | Dọn nợ, token, phông, biểu tượng, thành phần chung | 09/11 – 20/11/2026 | 4.0.3 |
| B | Đồng bộ mọi màn hình | 23/11/2026 – 01/01/2027 | 4.1 |
| E1 | Thử nghiệm thật vòng 1 | 04/01 – 15/01/2027 | — |
| C | Vòng Học → Khám phá → Chơi | 04/01 – 05/02/2027 | 4.2 |
| D | Kết nối SafeTime | 22/02 – 12/03/2027 | 4.3 |
| E2 | Thử nghiệm thật vòng 2 + cloud | 19/04 – 03/05/2027 | 5.0 RC |
| F | Phát hành cùng SafeTime 1.0 | 04/05 – 10/05/2027 | **5.0** |

Lịch giả định có một người làm riêng cho Bảo An. Nếu một người làm cả hai dự án, tổng khoảng 38 tuần, phát hành chung khoảng cuối tháng 8/2027 (`03_…` mục 4).

## Quy tắc khi thực hiện

1. Không đổi luật sao, đổi quà, khóa tuần, dữ liệu học liệu khi sửa giao diện.
2. Mỗi giai đoạn kết thúc bằng bản chạy được, `npm run verify:local` xanh.
3. Mỗi màn sửa phải có ảnh trước/sau.
4. Báo cáo ghi rõ: Đã kiểm bằng máy · Đã kiểm với người thật · Chưa kiểm.
