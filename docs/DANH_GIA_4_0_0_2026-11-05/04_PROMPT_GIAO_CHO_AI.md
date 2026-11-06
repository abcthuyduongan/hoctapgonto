# Nội dung giao cho AI hoặc lập trình viên

Sao chép phần dưới vào công cụ làm việc với **mã nguồn dự án**, kèm cả thư mục tài liệu đánh giá này. Không chỉ gửi ảnh chụp hoặc một đoạn kết luận.

---

Bạn cần sửa Bảo An Learning từ baseline 4.0.0 theo đánh giá độc lập ngày 05/11/2026. Mục tiêu là sửa lỗi và đưa sản phẩm qua nghiệm thu thực tế, không báo hoàn thành dựa vào số tệp hoặc số test đơn thuần.

Đọc trước:

1. `docs/DANH_GIA_4_0_0_2026-11-05/01_BAO_CAO_LOI_VA_DANH_GIA.md`
2. `docs/DANH_GIA_4_0_0_2026-11-05/02_KE_HOACH_SUA_LOI_VA_NANG_CAP.md`
3. `docs/DANH_GIA_4_0_0_2026-11-05/03_MA_TRAN_NGHIEM_THU.md`
4. Bằng chứng JSON trong `docs/DANH_GIA_4_0_0_2026-11-05/bang_chung/`.
5. Kế hoạch tuần hiện hành, quy tắc dự án và ma trận 80 ca cũ để giữ các bất biến.

Baseline được đánh giá: commit `f7c93337669379d768419ae1ab43cbde69f2aabe`, runtime source ID `dcbc03d1d20639cb07741c3d20800a427e29cd90b47714010b63f8dcad9d4d72`. Kiểm tra trạng thái Git hiện tại trước khi sửa; không ghi đè thay đổi của người khác. Nếu mã đã khác baseline, xác minh từng lỗi còn tồn tại trước khi triển khai.

Thứ tự bắt buộc:

1. R01: kiểm tra quyền phụ huynh/PIN ở máy chủ, chặn ghi vào trẻ chưa liên kết, không trả hash/salt.
2. R02 và R04: backup đủ dữ liệu và media, không nuốt lỗi; migration đúng khi cài mới và nâng cấp cả SQLite/PostgreSQL.
3. R03: xáo lựa chọn từng lượt câu hỏi mới, đổi vị trí đúng so với lượt trình bày mới trước của cùng trẻ/câu/phiên bản. Giữ nội dung đúng, chấm bằng ánh xạ máy chủ. Retry do lỗi mạng phải giữ lượt/hoán vị cũ và không nhân đôi sao. Áp dụng cả bộ học liệu cũ toàn A, đọc/nghe chọn đáp án, các game dùng trắc nghiệm và thi thử.
4. R05: sửa bộ chọn E2E, luồng thu/mở hành trình và điều tra ca Edge sau thoát game; chạy toàn bộ Chrome/Edge. Không xóa kiểm tra nghiệp vụ để bài đạt.
5. R06–R10: hoàn thiện bằng chứng, học liệu do chủ dự án cung cấp, tải staging thật, truy cập và dùng thử thật.
6. R11: chỉ phát hành sau các cổng bắt buộc; đối chiếu website/ZIP/build/source ID và trạng thái manifest.
7. R12 là backlog sau ổn định, không tự thêm tính năng trước khi đóng lỗi chặn.

Giới hạn và yêu cầu sản phẩm:

- Tập trung giao diện và nghiệp vụ hiện có; giữ bản đồ nhẹ, nhân vật dạng biểu tượng, không thêm engine 2D/3D.
- Không tự tạo danh mục kỹ năng hoặc ngân hàng câu hỏi. Chủ dự án/giáo viên gửi và duyệt nội dung; bạn làm công cụ kiểm tra/nhập/phát câu/chấm đúng.
- Không chỉ đổi `correctIndex` trong JSON để giải quyết toàn A. Không chỉ xáo client mà quên ánh xạ phía máy chủ. Không gửi khóa đáp án hay permutation nguồn cho học sinh.
- Không làm mất lịch sử, ví sao, tuần đóng, liên kết parent, mục tiêu quà, media hoặc phiên đang chơi.
- Không thử nâng cấp/phục hồi/lỗi cưỡng bức trên dữ liệu thật. Có bản sao, môi trường thử và rollback được kiểm chứng.
- Không đổi tiêu chí tải/asset/khả năng truy cập mà không ghi quyết định. Không gọi PGlite hay Request trong cùng tiến trình là tải website thật.
- Không tự sinh biên bản phỏng vấn, thời lượng học, tên người duyệt hoặc ngày thực hiện. Phân biệt mô phỏng, chưa chạy và đã xác nhận thật.
- 7 PASS của `reproduce-audit.test.mjs` xác nhận lỗi baseline. Tạo bài hồi quy an toàn trong `tests/` và gắn vào script chuẩn; sau sửa các hành vi lỗi trong tệp bằng chứng không còn được phép xảy ra.

Với mỗi Rxx:

1. Ghi ngắn nguyên nhân, phương án, các tệp và ảnh hưởng dữ liệu trước khi sửa.
2. Thực hiện đầy đủ trên cả hai backend khi chạm server; dùng chính sách/hợp đồng chung để tránh lệch.
3. Chạy các ca tương ứng trong ma trận; ghi expected, actual, log, build và engine/browser.
4. Cập nhật nhật ký dự án: đã làm, còn lại, lỗi mới, bằng chứng. Không ghi PASS khi chưa có log hoặc biên bản thật.
5. Bàn giao thay đổi, migration/rollback, kết quả và vấn đề còn mở. Sau khi đủ các đợt, chạy bộ kiểm tra toàn bộ cho chính build đích.

Đầu ra cần có: mã sửa, test hồi quy, migration, tài liệu vận hành và kết quả ma trận. Nếu chưa có người dùng thật hoặc học liệu thật, tiếp tục hoàn tất việc kỹ thuật độc lập và ghi rõ phần còn chờ; không tự hoàn thành thay người dùng.

---

Gợi ý giao theo đợt: trước hết giao **R01 + R02 + R04**, nhận bằng chứng rồi giao **R03 + R05**. Chủ dự án chuẩn bị học liệu và lịch dùng thử song song, nhưng chỉ đưa học sinh dùng bản không còn lỗi chặn.
