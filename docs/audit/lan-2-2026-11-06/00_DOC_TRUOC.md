# Kiểm toán lại bộ mới — lần 2 ngày 06/11/2026

**Bản mã 4.0.1, source ID `5d9b56…`: 60/100 tạm tính, chưa đủ điều kiện FINAL LOCK/phát hành.**

Lần này đánh giá lại sau `KET_QUA_THUC_HIEN_TOI_UU.md`. Báo cáo lần 1 và gói bàn giao cũ được giữ nguyên để đối chiếu. Điểm tăng nhờ các sửa UX/truy cập; còn hai lỗi P0 về rò đáp án và phục hồi không nguyên tử cần đóng trước.

1. [Tổng quan, điểm và đối chiếu task](01_TONG_QUAN_DANH_GIA.md)
2. [Kiến trúc/bảo mật và lỗi dữ liệu](02_KIEN_TRUC_VA_BAO_MAT.md)
3. [UI/UX, autosave, xáo câu, test và truy cập](03_UI_UX_VA_LUONG_THAO_TAC.md)
4. [Hiệu năng đo mới, ba mẫu và so sánh lần 1](04_HIEU_NANG_VA_TRUY_XUAT_DU_LIEU.md)
5. [Mười ưu tiên, bốn giai đoạn và 32 ca nghiệm thu](05_KE_HOACH_TOI_UU.md)
6. [Nội dung giao thực hiện](06_NOI_DUNG_GIAO_THUC_HIEN.md)
7. [Bằng chứng và cách chạy lại](evidence/INDEX.md)
8. [Mẫu kết quả sau sửa](KET_QUA_KIEM_THU_SAU_SUA_TEMPLATE.json), hiện toàn bộ `CHUA_CHAY`.

Nhật ký đã thực hiện:

- Đọc lại prompt, báo cáo triển khai mới, chụp baseline và xác định 23 tệp thay đổi so với lần trước.
- Typecheck/build/assets và toàn bộ Node: 350 ca đạt.
- Full Chrome/Edge: 152 đạt, 24 thất bại, 2 bỏ qua, 4 không chạy vì serial bị chặn; đã phân loại điểm dừng theo trace.
- 14 ca kiểm tra server độc lập: 11 assert xác nhận hành vi lỗi, 3 control xác nhận đường đã sửa. Kiểm tra chi tiết riêng hai endpoint của lỗi DTO.
- Chạy lại UI timeout/autosave/preview/xáo/ôn sai/axe và đo 54 mẫu hiệu năng.
- Đo dữ liệu 23 lớp/1.000 học sinh, kiểm tra lại runner và identity của dist/ZIP/website.
- Lưu báo cáo, kế hoạch, JSON/log/ảnh/source chương trình và gói bàn giao.
- Đối chiếu 445 tệp tracked/nguồn có sẵn: **0 tệp thay đổi, runtime ID không đổi** trong đợt kiểm toán.

Chưa sửa mã ứng dụng, chưa deploy, chưa ghi dữ liệu production. Các mục TKB/điểm danh không thuộc sản phẩm này; Supabase/tải/INP field/thiết bị/người dùng thật chưa đo được đều ghi rõ giới hạn. Học liệu vẫn do chủ dự án/giáo viên cung cấp và duyệt.
