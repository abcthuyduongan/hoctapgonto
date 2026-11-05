# BÁO CÁO TIẾN ĐỘ TUẦN 7: CHẾ ĐỘ THI THỬ VIOLYMPIC VÀ IOE (CỔNG C7)

**Thời gian thực hiện:** 21/12/2026 – 27/12/2026  
**Trạng thái Cổng C7:** **ĐẠT (PASS 100%)**  
**Người thực hiện:** Hệ thống tự động theo kế hoạch tuần và PROMPT 2  

---

## 1. Mục tiêu và Kết quả Tuần 7

| Hạng mục | Mô tả yêu cầu | Trạng thái | Chi tiết triển khai |
| :--- | :--- | :---: | :--- |
| **T7.1 Nối Runtime Mock Contest Online** | Đồng hồ đếm ngược cả đề, không gợi ý, không lộ đáp án từng câu, cho phép bỏ qua/quay lại | **ĐẠT** | Tích hợp runtime thi thử vào luồng trực tuyến trong `src/core/contest-matrix.ts` và `server/contest-data.mjs`. Màn hình làm bài `ContestMockScreen.tsx` có dải điều hướng câu hỏi linh hoạt (1..15), đánh dấu trực quan câu đã làm (`answered`), câu tạm bỏ qua (`skipped`) và câu hiện tại (`current`). Học sinh có thể bỏ qua và quay lại làm câu bất kỳ trước khi nộp bài. Đồng hồ đếm ngược hiển thị thời gian thực và chuyển cảnh báo đỏ nhấp nháy khi còn dưới 3 phút. |
| **T7.2 Khai Báo Ma Trận Đề Thi Chuẩn** | Khai báo ít nhất 1 ma trận Violympic Toán và 1 ma trận IOE Tiếng Anh | **ĐẠT** | Khai báo cấu trúc chuẩn mực trong `CONTEST_PRESETS`: (1) `violympic-math-g3` (Toán lớp 3, 20 phút, 15 câu, điểm tối đa 150) và (2) `ioe-english-g3` (Tiếng Anh lớp 3, 20 phút, 15 câu, điểm tối đa 150). Ngân hàng câu hỏi chuẩn `VIOLYMPIC_MATH_POOL` và `IOE_ENGLISH_POOL` bao quát đầy đủ các dạng toán đếm, hình học, tìm thành phần chưa biết, giải toán có lời văn, từ vựng và ngữ pháp tiếng Anh lớp 3. |
| **T7.3 Đồng Hồ Server & Chống Gian Lận Đổi Giờ** | Đồng hồ tính theo máy chủ, tải lại trang hay đổi giờ máy không kéo dài thời gian | **ĐẠT** | Quản lý `deadline_at` và `started_at` cố định tại máy chủ. Khi học sinh tải lại trang hoặc mở lại phiên thi, hệ thống tính toán `remainingSeconds = Math.max(0, Math.floor((deadline - now) / 1000))` dựa hoàn toàn vào đồng hồ máy chủ. Nếu quá thời hạn làm bài (kèm 3 giây gia hạn truyền gói tin mạng), lượt thi tự động chuyển trạng thái `timeout` và chấm dứt quyền sửa câu trả lời. |
| **T7.4 Bảo Vệ Bí Mật Đề Thi (Không Lộ Đáp Án)** | Đề không lộ đáp án trước khi nộp bài qua API | **ĐẠT** | Hàm `sanitizeContestItem` lọc bỏ triệt để các trường nhạy cảm (`correctAnswer`, `correctIndex`, `explanation`) trước khi trả dữ liệu về trình duyệt trong quá trình thi. Học sinh và công cụ inspect mạng không thể trích xuất đáp án trước khi hoàn thành và nộp bài. |
| **T7.5 Đề Phân Biệt Giữa Các Thí Sinh & Giữ Đúng Khi Tải Lại** | Hai học sinh nhận hai đề khác nhau; cùng một lượt thi tải lại vẫn ra đúng đề cũ | **ĐẠT** | Sử dụng thuật toán hoán vị Fisher-Yates với hạt sinh số ngẫu nhiên giả định `seed = ${studentId}:${presetId}:${sessionId}` (`selectContestQuestions`). Đảm bảo hai học sinh khác nhau sẽ nhận các tổ hợp câu hỏi và thứ tự khác nhau, trong khi cùng một học sinh khi tải lại phiên thi cũ vẫn giữ nguyên vẹn đề thi và các câu đã chọn. |
| **T7.6 Chấm Điểm, Xem Lại Lời Giải & Ôn Câu Sai** | Xem lại từng câu sai có lời giải chi tiết, nút "Ôn các câu sai" mở ngay lượt luyện | **ĐẠT** | Server đánh giá bài nộp qua `evaluateContestSubmission`, ghi nhận danh sách câu trả lời sai kèm đáp án đúng và lời giải chi tiết. Màn hình kết quả hiển thị phân tích lỗi sai và nút "📝 Ôn các câu sai ngay" (`contestReviewPack`) tạo ngay một gói học liệu ôn tập chuyên sâu chứa đúng các câu vừa làm sai. |
| **T7.7 Mốc "Sẵn Sàng Dự Thi" & Huy Hiệu "Thí Sinh"** | Không cộng sao vào ví, chỉ trao huy hiệu "Thí sinh" và mốc 3 đề liên tiếp $\ge 80\%$ | **ĐẠT** | Cơ chế kinh tế học tập độc lập: thi thử **không cộng thêm sao vào ví** nhằm tránh hiện tượng cày sao lệch mục tiêu. Tự động trao tặng huy hiệu danh dự "Thí sinh" (`contestant`) khi hoàn thành đề thi thử đầu tiên. Hàm `checkReadinessForExam` theo dõi lịch sử và kích hoạt mốc "Sẵn sàng dự thi" khi đạt từ 80% điểm trở lên trong 3 đề thi liên tiếp. |
| **T7.8 Biển Cảnh Báo Quy Định & Bản Quyền** | Banner cảnh báo rõ ràng "Đề luyện theo dạng, không phải đề chính thức" | **ĐẠT** | Thanh banner đỏ nổi bật `contest-disclaimer-banner` ghim cố định ở đầu mọi màn hình trong khu thi thử, không sử dụng logo hay vi phạm bản quyền giao diện của các cổng thi chính thức. |

---

## 2. Minh chứng Kiểm thử & Cổng Chất lượng

### 2.1. Kiểm thử Đơn vị & Tích hợp (`tests/online-contest.test.mjs`)
- **5/5 bài test PASS (100%)**:
  1. `Contest pure functions: sanitization, evaluation, readiness, and seeded shuffle`: **PASS**
  2. `Contest presets declare at least 1 Violympic Math and 1 IOE English with mandatory disclaimer`: **PASS**
  3. `SQLite Store: Complete contest mock lifecycle, security, zero stars, and readiness milestone`: **PASS**
  4. `PostgreSQL Store: Complete contest mock lifecycle, security, zero stars, and readiness milestone`: **PASS**
  5. `HTTP Cloud API: Endpoints enforce authentication, role check, and hide answers during contest`: **PASS**

### 2.2. Kiểm thử Trực Quan Đầu Cuối E2E (`tests/visual/online-contest.spec.ts`)
- **Chromium (`online-chrome`)**: **PASS (4.0s)**
- **Microsoft Edge (`online-msedge`)**: **PASS (4.3s)**
- Kịch bản kiểm thử trực quan hoàn chỉnh:
  1. Học sinh đăng nhập, nhấp nút "🏆 Thi thử" trên thanh header của thế giới học tập.
  2. Màn hình chọn đề mở ra: hiển thị rõ banner *"⚠️ Đề luyện theo dạng, không phải đề chính thức"*, thẻ ma trận Violympic Toán, IOE Tiếng Anh và khung mục tiêu *"Sẵn sàng dự thi"*.
  3. Bắt đầu làm đề thi Violympic Toán: đồng hồ đếm ngược server hiển thị, dải số câu hỏi 1-15, thẻ câu hỏi trắc nghiệm.
  4. Thao tác chọn đáp án câu 1, chuyển câu sau, bỏ qua câu 2.
  5. Bấm nộp bài, xác nhận modal nộp bài thi.
  6. Màn hình kết quả xuất hiện: hiển thị điểm số, thời gian làm bài, huy hiệu "Thí sinh", phần xem lại lời giải chi tiết và nút "Ôn các câu sai ngay".
  7. Nhấp "Quay về Bản đồ": đóng phòng thi an toàn và trở lại giao diện thế giới học tập.

### 2.3. Toàn bộ Hệ thống Tests
- `npm run typecheck`: **PASS (0 errors)**
- `npm run test:syntax`: **PASS (toàn bộ file ts/tsx hợp lệ)**
- `npm run test:assets`: **PASS (96 files, 4.97 MiB <= 16 MiB budget, 2D only)**
- `npm run test:release`: **PASS (12/12 tests pass)**
- `npm run test:cloud`: **PASS (45/45 tests pass)**
- `npm run test:map`: **PASS (26/26 tests pass)**
- `npm run test:online`: **PASS (238/238 tests pass)**

---

## 3. Kết luận và Tự động Chuyển tiếp

- **Cổng C7 (Tuần 7)** đã được kiểm tra, đánh giá đạt 100% tất cả các tiêu chí chất lượng và quy chuẩn kỹ thuật.
- Theo đúng tinh thần chỉ đạo tự động hóa, hệ thống **tự động chuyển sang thực hiện Tuần 8 (28/12 – 03/01): Thị trấn của con, phần 1 (Cổng C8)** ngay lập tức.
