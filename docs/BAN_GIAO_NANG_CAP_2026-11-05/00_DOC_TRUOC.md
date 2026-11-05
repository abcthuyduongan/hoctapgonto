# Bàn giao nâng cấp giao diện và bản đồ Bảo An Learning

Ngày: **05/11/2026**. Đây là **kế hoạch để người hoặc AI khác thực hiện**, chưa phải báo cáo hoàn thành bản đồ hình ảnh.

## Đọc và sử dụng

1. Đọc [kế hoạch triển khai](01_KE_HOACH_TRIEN_KHAI.md) để biết phạm vi, thứ tự và các cổng hoàn thành.
2. Đọc [hợp đồng dữ liệu và giao diện](02_HOP_DONG_DU_LIEU_VA_GIAO_DIEN.md) trước khi sửa server hoặc vẽ chặng.
3. Dùng [80 ca kiểm thử](03_MA_TRAN_KIEM_THU.md) làm tiêu chí nghiệm thu.
4. Chạy và ghi kết quả theo [hướng dẫn kiểm tra, đóng gói và báo cáo](04_LENH_CHAY_VA_BAO_CAO.md).
5. Có thể giao việc bằng [prompt cho AI](05_PROMPT_GIAO_CHO_AI.md).
6. Cập nhật [backlog và nhật ký](06_BACKLOG_VA_NHAT_KY.md) sau mỗi đầu việc.
7. Đối chiếu [dấu vết mã nguồn tại thời điểm bàn giao](07_BASELINE_MA_NGUON.json). Đây là hash tệp và metadata, không phải bản sao mã nguồn.

## Cần đưa cho người nhận

- **Checkout/mã nguồn hiện tại**, có cả thay đổi chưa commit cần giữ; không chỉ đưa một link tới commit cũ.
- Bộ kế hoạch này.
- [Bản thiết kế map và từng màn](../KE_HOACH_BAN_DO_HINH_ANH_2026-11-05.md).
- [Checklist 28 ảnh chính](../BO_ANH_BAN_DO_DANH_SACH_BAN_GIAO.md) và [prompt tạo ảnh](../BO_ANH_BAN_DO_PROMPT_TAO_ANH.md).
- Bộ ảnh người dùng tạo: đợt A có 8 ảnh, sau đó đợt B thêm 20 ảnh.
- Dữ liệu học liệu kiểm thử tự tạo hoặc bộ mẫu hiện có. Không cần dữ liệu thật của học sinh để bắt đầu.

Gói ZIP bàn giao kế hoạch chứa bản sao ba tài liệu ảnh và các thư mục hướng dẫn. ZIP này **không chứa mã nguồn, cơ sở dữ liệu, mật khẩu, khóa cloud hoặc ảnh hoàn chỉnh**.

## Phạm vi đã chốt

Nâng cấp toàn bộ trải nghiệm giao diện liên quan tới hành trình: đăng nhập, map tổng, map vùng, bảng tuần/bộ câu, chọn trò, vào/thoát trò, kết quả, hành trình tuần, ví sao, cài đặt và tính nhất quán với quản trị.

Câu hỏi do người dùng tải lên. Không triển khai danh mục kỹ năng, skillId, bộ sinh câu hoặc yêu cầu chọn SGK. Nhân vật là emoji/hình nhỏ tĩnh; map dùng ảnh tĩnh, nút và chữ thật; không phục hồi engine 3D hoặc hoạt cảnh nhân vật.

Các tính năng quà/thị trấn/huy hiệu được người dùng thông báo đã làm trong tài liệu cũ phải được đối chiếu với bản mã thực tế. Không tự tạo lại backend hoặc nút giả nếu chưa tìm được màn/API tương ứng trong checkout.

## Thế nào là hoàn thành

- Luồng map hình ảnh chạy bằng dữ liệu được giao thật và tôn trọng máy chủ.
- Ảnh bàn giao đủ cho phạm vi phát hành; không gọi placeholder là bản cuối.
- Tất cả ca áp dụng trong ma trận có kết quả và bằng chứng; không còn lỗi P0/P1.
- Các bộ kiểm tra hiện có vẫn đạt, build và gói phát hành nhất quán.
- Có báo cáo local; nếu chưa kiểm tra trên cloud thật phải ghi đúng phạm vi.
- Kế hoạch, tệp thay đổi, kết quả kiểm tra và cách quay lại giao diện cũ được lưu trong dự án.

## Những gì đã có trước khi bàn giao

Phiên bản package hiện đọc được: **3.9.0-rc.1**. Git HEAD chỉ là nền cũ; workspace có nhiều thay đổi chưa commit. Xem manifest để nhận diện bản làm việc.

Mã hiện có: React/TypeScript/Vite; hai backend SQLite và PostgreSQL; năm trò, bộ câu và trình chạy bài, chấm sao máy chủ, khóa tuần, nhập/xuất học liệu, ví sao và khôi phục. Giao diện khám phá nhẹ đã có, nhưng chưa có các nền map mới.

Lịch sử trong chat/nhật ký: 16 ca luồng trò/bản đồ nhẹ và 6 ca tài khoản trên Chrome/Edge đã đạt ở đợt trước. **Đợt lập bộ bàn giao này không chạy lại các bộ kiểm thử ứng dụng**, và không coi 22 ca đó là bằng chứng cho map hình ảnh chưa triển khai.

Các mã kiểm thử AS/DM/API/UI/RG/PF/RL dưới đây là đặc tả mới, mặc định **CHƯA CHẠY**.
