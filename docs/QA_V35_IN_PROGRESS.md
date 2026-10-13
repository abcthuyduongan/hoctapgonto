# Bảo An Learning V3.5 — Bản kiểm tra nội bộ (CHƯA BÀN GIAO)

## Việc đã làm
- Cho GLB guide chuyển động chờ bằng WebGL shader; biến dạng được gắn nhãn chỉ cho các đỉnh thuộc mẫu GLB.
- Phản ứng chọn vùng đất bằng một nhịp nảy nhẹ, không thay đổi layout và không tải lại mesh.
- Thêm điểm phản chiếu kiểu stylized cho nhân vật; chưa phải pipeline vật liệu PBR/texture.
- Tắt shader motion khi bật giảm chuyển động; nếu đang chọn một đảo thì vẫn giữ nguyên trạng thái chọn.
- Bổ sung kiểm thử vùng vertex animation, phản ứng chọn đảo và reduced-motion.

## Kết quả (13/10/2026)
- 44/44 kiểm thử lõi: đạt.
- 13/13 kiểm thử GLB, mô hình, animation và các tình huống lỗi: đạt.
- TypeScript engine và phân tích cú pháp TS/TSX: đạt.
- `gate:premium-art`: KHÔNG ĐẠT ĐÚNG CHỦ ĐÍCH vì thiếu 5 asset GLB chính thức.

## Giới hạn
- Không có hoạt ảnh xương/rig chính thức; chuyển động hiện là biến dạng của toàn mô hình.
- Không có texture PBR thật, glTF animation clips, mô hình chi tiết chính thức.
- Chưa thử WebGL trên GPU phần cứng, chưa chạy build React production, chưa có số đo FPS/memory.
- Không được đưa V3.5 thành bản tải về bàn giao hoặc tuyên bố ngang mức concept khi chưa vượt các bước trên.
