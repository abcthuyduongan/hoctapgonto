# Đánh giá độc lập và kế hoạch sửa Bảo An Learning 4.0.0

Ngày kiểm tra: **05/11/2026**, múi giờ Việt Nam. Phạm vi: mã nguồn hiện tại, gói phát hành, kiểm thử cục bộ và đọc trạng thái website. Không sửa mã ứng dụng, không đổi dữ liệu thật, không triển khai website trong đợt đánh giá này.

**Kết luận: chưa đủ điều kiện xác nhận C12 PASS hoặc phát hành chính thức 100%.** Nhiều tính năng đã có mã và nhiều kiểm thử đạt, nhưng còn lỗi quyền phụ huynh, thiếu dữ liệu sao lưu, lỗi nâng cấp dữ liệu và đáp án trắc nghiệm không đổi vị trí.

Đọc theo thứ tự:

1. [Báo cáo lỗi và kết quả kiểm tra](01_BAO_CAO_LOI_VA_DANH_GIA.md): điều gì đã xác nhận, điều gì chưa được chứng minh.
2. [Kế hoạch sửa và nâng cấp](02_KE_HOACH_SUA_LOI_VA_NANG_CAP.md): công việc, tệp liên quan, thứ tự, nghiệm thu và dự toán.
3. [Ma trận nghiệm thu](03_MA_TRAN_NGHIEM_THU.md): các ca kiểm thử bắt buộc, kết quả mong đợi và mẫu ghi bằng chứng.
4. [Nội dung giao cho AI hoặc lập trình viên](04_PROMPT_GIAO_CHO_AI.md).
5. [Bằng chứng máy đọc được](bang_chung/summary.json), [các lỗi đã tái hiện](bang_chung/security-reproductions.json), [website công khai](bang_chung/public-website.json), [kết quả trình duyệt rút gọn](bang_chung/browser-summary.json).
6. [Mẫu kết quả 60 ca nghiệm thu](KET_QUA_NGHIEM_THU_TEMPLATE.json): sao chép thành kết quả chạy, không điền PASS hàng loạt; một ca cần nhiều bản ghi nếu thử nhiều môi trường.

Yêu cầu mới của chủ dự án đã được đưa vào **L07 / R03 / AN01–AN12**: xáo vị trí các lựa chọn khi câu hỏi được gọi lại trong lượt mới; không đổi nội dung đáp án đúng; không làm sai chấm điểm hoặc nhân đôi sao khi gửi lại do lỗi mạng.

Các ca trong [reproduce-audit.test.mjs](reproduce-audit.test.mjs) cố tình xác nhận hành vi lỗi. **7 ca PASS của tệp này có nghĩa là tái hiện được lỗi, không phải sản phẩm đạt nghiệm thu.** Sau khi sửa, cần chuyển các kỳ vọng lỗi thành kiểm thử hồi quy an toàn trong `tests/`; không sửa tệp bằng chứng để xóa lịch sử.

Nhật ký bàn giao đợt này:

- Đã kiểm tra kiểu dữ liệu, bộ `npm test`, build, ngân sách tài nguyên và Playwright Chrome/Edge.
- Đã viết và chạy 7 ca tái hiện trong dữ liệu thử tách biệt; đã kiểm tra lại riêng cuộn trên Edge điện thoại.
- Đã đối chiếu số câu, vị trí đáp án, migration, sao lưu, manifest phát hành và build website.
- Đã lưu báo cáo, kế hoạch, ma trận nghiệm thu, nội dung giao việc và bằng chứng vào dự án.
- **Chưa triển khai bất kỳ hạng mục sửa R01–R12 nào.** Đây là tài liệu để chủ dự án giao thực hiện theo yêu cầu.

Không cần dựng lại bản đồ, thêm danh mục kỹ năng câu hỏi hoặc chuyển sang engine nhân vật 2D/3D. Giữ giao diện bản đồ nhẹ hiện có; học liệu thật do chủ dự án và giáo viên cung cấp, duyệt.
