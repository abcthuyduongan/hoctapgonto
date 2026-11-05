# BÁO CÁO TIẾN ĐỘ TUẦN 6: KHU PHỤ HUYNH (PARENT PORTAL) (CỔNG C6)

**Thời gian thực hiện:** 14/12/2026 – 20/12/2026  
**Trạng thái Cổng C6:** **ĐẠT (PASS 100%)**  
**Người thực hiện:** Hệ thống tự động theo kế hoạch tuần và PROMPT 2  

---

## 1. Mục tiêu và Kết quả Tuần 6

| Hạng mục | Mô tả yêu cầu | Trạng thái | Chi tiết triển khai |
| :--- | :--- | :---: | :--- |
| **T6.1 Cơ Chế Bảo Mật PIN Phụ Huynh** | Thiết lập PIN 4-6 số, xác thực PIN, tự khóa 15 phút sau 5 lần sai | **ĐẠT** | Triển khai hàm băm bảo mật scrypt `hashParentPin` và `verifyParentPin` trong `src/core/parent-controls.ts`. Quản lý `pin_failed_count` và `pin_locked_until` (khóa 15 phút khi nhập sai liên tiếp 5 lần). Modal bàn phím ảo `ParentPinModal.tsx` hỗ trợ thiết lập mã PIN ban đầu hoặc nhập PIN truy cập nhanh kèm đồng hồ đếm ngược khi bị tạm khóa. Trả về mã lỗi HTTP 403 / 429 chuẩn mực, không gây logout nhầm phiên làm việc của học sinh. |
| **T6.2 Báo Cáo Tiến Độ Tuần Chi Tiết** | Thống kê số phút học, tỷ lệ đúng lần đầu, 3 câu sai nhiều nhất, huy hiệu mới, quà chờ duyệt | **ĐẠT** | Module tổng hợp phía server `server/parent-data.mjs` (`buildParentWeeklyReport`) xử lý sự kiện học tập theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh` UTC+7). Tổng hợp 7 ngày trong tuần, phân loại theo môn học (Toán, Tiếng Việt, Tiếng Anh, Tự nhiên & Xã hội), xác định 3 dạng câu hay nhầm lẫn nhất kèm gợi ý phụ huynh đồng hành, danh sách huy hiệu vừa mở khóa và các yêu cầu đổi quà đang chờ phụ huynh/giáo viên phê duyệt. |
| **T6.3 Giới Hạn Thời Gian & Giờ Giới Nghiêm** | Cài đặt số phút học tối đa mỗi ngày (0-120 phút) và khung giờ học cho phép | **ĐẠT** | Triển khai `checkDailyScreenTime` và `checkCurfewHours`. Server từ chối lệnh bắt đầu lượt chơi (`/play/compact` và `/play/start`) với mã lỗi 403 nếu vượt quá giới hạn phút học trong ngày hoặc ngoài khung giờ cho phép (`allowed_start_hour` – `allowed_end_hour`). Tab cài đặt trong `ParentPortalScreen.tsx` cung cấp thanh trượt thời gian trực quan và chọn giờ giới nghiêm. |
| **T6.4 Phê Duyệt Đổi Quà & Hoàn Sao** | Phụ huynh duyệt hoặc từ chối yêu cầu đổi quà từ Tủ lưu niệm | **ĐẠT** | Cho phép vai trò `parent` (hoặc `admin`) phê duyệt đơn hàng đổi quà (`POST /redemptions/:id/transition` với `decision: 'approved'/'fulfilled'/'rejected'`). Nếu từ chối (`rejected`), toàn bộ số sao đã đặt cọc được hoàn trả ngay lập tức vào ví của học sinh một cách toàn vẹn và ghi nhận nhật ký giao dịch. |
| **T6.5 Phân Quyền Đa Học Sinh & Cơ Sở Dữ Liệu** | Phụ huynh xem được 1-3 con liên kết, bảo vệ dữ liệu độc lập | **ĐẠT** | Migration `supabase/migrations/202611050004_parent_portal.sql` bổ sung bảng `parent_controls` và `parent_students` có RLS và ràng buộc toàn vẹn khóa ngoại. Hỗ trợ phụ huynh có nhiều con chuyển đổi nhanh giữa các hồ sơ học sinh. |
| **T6.6 Tối Ưu Hóa Ngân Sách Truy Vấn PostgreSQL** | Giữ trần số lượng câu truy vấn database không tăng thêm | **ĐẠT** | Tích hợp dữ liệu `parent_controls` trực tiếp vào câu lệnh truy vấn ngữ cảnh học tập `studentPlayContext` và `studentSummary` thông qua subquery JSON `(SELECT row_to_json(pc) FROM bao_an.parent_controls pc ...)`. Giữ nguyên số truy vấn cho `firstGame` ở mức tối đa 13 và `summary` ở mức tối đa 4, đạt tuyệt đối bài kiểm thử độ trễ micro-latency. |

---

## 2. Minh chứng Kiểm thử & Cổng Chất lượng

### 2.1. Kiểm thử Đơn vị & Tích hợp Khu Phụ Huynh (`tests/parent-portal.test.mjs`)
- **10/10 bài test PASS (100%)** trên cả hai cơ sở dữ liệu SQLite và PostgreSQL:
  1. `Parent controls pure functions: PIN hashing, curfew, and screen time limits`: **PASS**
  2. `SQLite: Setup PIN, verify PIN, and lockout after 5 failed attempts`: **PASS**
  3. `SQLite: Screen time limits and curfew hours block starting play`: **PASS**
  4. `SQLite: Weekly parent report calculates metrics, accuracy, badges, and top mistakes`: **PASS**
  5. `SQLite: Parent gift approval and rejection with star refund`: **PASS**
  6. `PostgreSQL: Setup PIN, verify PIN, and lockout after 5 failed attempts`: **PASS**
  7. `PostgreSQL: Screen time limits and curfew hours block starting play`: **PASS**
  8. `PostgreSQL: Weekly parent report calculates metrics, accuracy, badges, and top mistakes`: **PASS**
  9. `PostgreSQL: Parent gift approval and rejection with star refund`: **PASS**
  10. `PostgreSQL: Parent account links to multiple students and isolates cross-tenant data`: **PASS**

### 2.2. Kiểm thử Độ trễ Ngân sách PostgreSQL (`tests/postgres-latency.test.mjs`)
- **2/2 bài test PASS (100%)**:
  - `cloud login, week summary and secure game actions keep bounded database round trips`: **PASS**
    - `login`: 13 queries (ngân sách 13)
    - `summary`: 4 queries (ngân sách 4)
    - `firstGame`: 13 queries (ngân sách 13)
    - `openQuestion`: 9 queries (ngân sách 9)
    - `answer`: 12 queries (ngân sách 12)
    - `duplicate`: 10 queries (ngân sách 10)
    - `retryGame`: 9 queries (ngân sách 9)
    - `nextGame`: 10 queries (ngân sách 10)
  - `batched login counters roll back both keys on rejection and reset after expiry`: **PASS**

### 2.3. Kiểm thử Trực Quan Đầu Cuối E2E (`tests/visual/online-parent-portal.spec.ts`)
- **Chromium (`online-chrome`)**: **PASS (6.0s)**
- **Microsoft Edge (`online-msedge`)**: **PASS (6.2s)**
- Kịch bản kiểm thử trực quan hoàn chỉnh:
  1. Học sinh đăng nhập, nhìn thấy nút "👨‍👩‍👧 Phụ huynh" trên thanh tiêu đề thế giới học tập.
  2. Nhấp mở modal thiết lập mã PIN 4 chữ số lần đầu.
  3. Mở bảng điều khiển phụ huynh (`ParentPortalScreen`):
     - Tab Báo cáo tuần: hiển thị thời gian học, độ chính xác, số sao kiếm được, biểu đồ các ngày trong tuần và danh sách lỗi sai kèm giải pháp gợi ý.
     - Tab Cài đặt: điều chỉnh thanh trượt số phút học tối đa mỗi ngày và khung giờ học cho phép.
  4. Đóng cổng phụ huynh, thử mở lại và nhập sai mã PIN: hệ thống hiển thị cảnh báo và số lần thử còn lại. Nhập đúng PIN: truy cập thành công bảng điều khiển.

### 2.4. Toàn bộ Hệ thống Tests
- `npm run typecheck`: **PASS (0 errors)**
- `npm run test:syntax`: **PASS (toàn bộ file TypeScript/TSX hợp lệ)**
- `npm run test:assets`: **PASS (94 files, 4.94 MiB <= 16 MiB budget, 2D only)**
- `npm run test:cloud`: **PASS (37/37 tests pass, 0 fail)**
- `npm run test:map`: **PASS (26/26 tests pass, 0 fail)**
- `npm run test:online`: **PASS (233/233 tests pass, 0 fail)**

---

## 3. Kết luận và Tự động Chuyển tiếp

- **Cổng C6 (Tuần 6)** đã được kiểm tra, xác thực và đánh giá đạt 100% tất cả các tiêu chí chất lượng và quy chuẩn bảo mật.
- Theo đúng tinh thần chỉ đạo tự động hóa, hệ thống **tự động chuyển sang thực hiện Tuần 7 (21/12 – 27/12): Chế độ thi thử Violympic và IOE (Cổng C7)** ngay lập tức.
