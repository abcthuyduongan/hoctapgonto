# Kế hoạch chi tiết cho hai mục P2

Lập ngày **06/11/2026**, Asia/Saigon. Baseline đọc khi lập: **Bảo An Learning 4.0.2**, source ID `b5f1c02e0b35b7ea54ce5bc70e2707538d8aafef46c95d7b2513ec8ee8ae697a`.

Hai kết quả cần đạt:

1. **Mở game nhanh hơn trên điện thoại mạng yếu:** tách CSS theo game, chọn ảnh phù hợp thiết bị, mục tiêu p95 từ chạm mở game đến sử dụng được **≤1.500 ms trong kịch bản tham chiếu đã định nghĩa**.
2. **Có bằng chứng dùng thật:** diễn tập 100 học sinh giả lập hoạt động đồng thời trên staging thật; đo Netlify/DB/media, cold-start và tương tác; sau đó thử tác vụ với nhóm trẻ thật, phụ huynh và giáo viên.

Đây là **kế hoạch triển khai**, chưa sửa ứng dụng, chưa tối ưu ảnh, chưa tạo tải và chưa tổ chức buổi chơi thật. Các số khoảng 3,5–3,9 giây, CSS game 268.623 byte là baseline kiểm toán trước, **không phải phép đo mới chứng nhận toàn bộ 4.0.2**. Khi triển khai phải đo lại cùng source ID chốt.

Đọc/giao việc:

- [01 — Tách CSS và tối ưu ảnh bản đồ](01_TOI_UU_CSS_VA_ANH_BAN_DO.md)
- [02 — Tải staging 100 người và usability với trẻ thật](02_STAGING_100_VA_USABILITY.md)
- [03 — 48 ca kiểm thử và điều kiện nghiệm thu](03_MA_TRAN_NGHIEM_THU.md)
- [04 — Biểu mẫu đo, tổ chức buổi thử và nhật ký](04_BIEU_MAU_VA_NHAT_KY.md)
- [05 — Nội dung giao cho người/AI thực hiện](05_NOI_DUNG_GIAO_THUC_HIEN.md)
- [Baseline mã và kích thước ảnh hiện tại](BASELINE_KE_HOACH.json)
- [Mẫu kết quả kiểm thử](KET_QUA_KIEM_THU_TEMPLATE.json): khởi tạo `CHUA_CHAY`, không phải kết quả đã nghiệm thu.
- [Kiểm tra tính đầy đủ của gói tài liệu](KIEM_TRA_BAN_GIAO.json): chỉ kiểm tra tài liệu và identity, không phải kiểm thử ứng dụng.
- [Danh sách tệp và SHA-256](HANDOFF_MANIFEST.json): kiểm tra gói bàn giao có đủ tệp và không bị đổi bytes.

## Lộ trình và người phụ trách

| Chặng | Việc chính | Người phụ trách | Dự toán | Cổng |
| --- | --- | --- | --- | --- |
| P0 | Chốt build, fixture, metric, baseline và hồi quy đang xanh | Dev + QA + chủ dự án | 0,5–1 ngày công | G0 |
| P1 | Tách CSS/game, giữ shared styles nhỏ | Frontend | 2–3 ngày công | G1 |
| P2 | Ảnh responsive, nền game mobile và ưu tiên tải | Frontend/ảnh + QA hình học | 1–2 ngày công | G2 |
| P3 | Đo lại, sửa điểm nghẽn, hồi quy và đóng gói RC | Dev + QA | 1–2 ngày công | G3 |
| T0 | Hoàn thiện load runner, staging và observability | Backend/QA + chủ dự án | 2–3 ngày công | G4 |
| T1 | Smoke → 30 → 50 → 75 → 100, cold-start và đối soát | QA hiệu năng + backend | 0,5–1 ngày chạy; sửa/thử lại riêng | G5 |
| U1 | Chuẩn bị và chơi thử vòng 1 với trẻ/cha mẹ/giáo viên | Chủ dự án + người điều phối | 1 ngày chuẩn bị + 1–2 ngày buổi thử | G6 |
| U2 | Sửa tác vụ lỗi, thử xác nhận vòng 2 và bàn giao | Dev/QA + chủ dự án | 2–4 ngày công và lịch người tham gia | G7 |

Tổng kỹ thuật dự kiến **10–16 ngày công**, thường sắp trong **2–3 tuần lịch** nếu có người và thiết bị sẵn; các nhánh chuẩn bị staging/usability có thể làm song song. Số này không gồm mua hạ tầng, chờ học liệu hoặc chờ lịch gia đình. Chỉ chốt lịch ngày cụ thể sau khi có nguồn lực.

## Quy tắc chốt kết quả

- 100 VU là 100 phiên học riêng có hoạt động, không phải 100 tài khoản được tạo hay 100 trẻ vật lý. Nhóm usability nhỏ là phép thử riêng.
- Không bỏ mẫu chậm/lỗi hoặc tính thời gian bắt đầu sau khi phần tải đã diễn ra. Phân biệt cache lạnh/nóng, runtime đầu tiên/đã nóng, reference media và media lớn.
- Mục tiêu 1,5 giây không áp dụng bằng cách bỏ ảnh câu hỏi, cắt nghe âm thanh hoặc giả báo ACK. Ảnh lớn ngoài bộ tham chiếu được công bố riêng.
- Chỉ đưa trẻ vào bản RC đã qua hồi quy quyền, chấm/sao, autosave, media và dữ liệu. Đây là cổng chuẩn bị, không phải xác nhận các lỗi cũ vẫn tồn tại hoặc đã đóng.
- Mọi báo cáo ghi build/source ID, môi trường, số mẫu, actual/expected, tệp chứng cứ và phần `CHUA_KIEM_CHUNG`.
- Giữ bản đồ và nhân vật nhẹ, học liệu do chủ dự án/giáo viên cung cấp, không thêm engine đồ họa hay phân hệ ngoài hai mục.

Nhật ký lập kế hoạch: đã đọc mã loader/import CSS, cấu hình Vite/build, map manifest và cách chọn nền game; đọc runner hiện tại; kiểm kê 10 ảnh map và tham khảo tài liệu chính thức. Chưa chạy lại full audit 4.0.2 hoặc ký nghiệm thu staging.
