# THÔNG TIN PHÁT HÀNH PHIÊN BẢN 4.3.0 (RELEASE NOTES)
### Bảo An Learning — Cổng Kết Nối Quản Lý Học Tập An Toàn (SafeTime Integration Gateway)
**Ngày phát hành:** 07/11/2026  
**Phiên bản:** `4.3.0` (Build ID: `v4.3.0-integration`)  
**Git Tag:** `v4.3.0`

---

## 1. TỔNG QUAN PHIÊN BẢN 4.3.0
Phiên bản 4.3.0 đánh dấu bước tiến quan trọng trong việc mở rộng hệ sinh thái học tập an toàn cho trẻ em thông qua việc ra mắt **Cổng kết nối tích hợp nội bộ với SafeTime** (Phần mềm quản trị thời gian máy tính gia đình). 

Nhờ tính năng này, học sinh có thể trực tiếp làm bài tập tuần và thi thử Violympic / IOE ngay trong chế độ Học tập của SafeTime mà không bị trừ vào thời gian giải trí, đồng thời tự động đồng bộ kết quả thi mà không cần nhập liệu thủ công.

---

## 2. CÁC TÍNH NĂNG MỚI NỔI BẬT

### 2.1 Cổng Kết Nối Bảo Mật Nội Bộ (Loopback Integration Gateway)
- **Địa chỉ phục vụ:** Lắng nghe và chỉ phục vụ duy nhất trên địa chỉ loopback `http://127.0.0.1:4180/api/integration/safetime/v1/*`.
- **Chặn truy cập ngoài:** Từ chối tuyệt đối mọi yêu cầu từ IP khác `127.0.0.1` với mã lỗi `403 Forbidden` (`BAO-05`).
- **Giới hạn tần suất (Rate Limiting):** Tối đa 120 yêu cầu/phút từ client SafeTime (`BAO-01`).

### 2.2 Quy Trình Ghép Đôi Thiết Bị An Toàn (Device Pairing)
- **Mã ghép đôi:** Sinh mã ngẫu nhiên 8 chữ số từ Khu phụ huynh, hết hạn sau 10 phút, tự hủy ngay sau khi ghép đôi thành công (`BAO-02, BAO-06`).
- **Chống dò mã (Brute-force lockout):** Tự động khóa thử mã trong 15 phút nếu nhập sai quá 5 lần (`BAO-06`).
- **Mã hóa khóa xác thực:** SafeTime lưu trữ Bearer Token bí mật 32 byte; máy chủ Bảo An lưu trữ mã băm SHA-256 an toàn trong cơ sở dữ liệu (`BAO-03, BAO-04`).

### 2.3 Phân Quyền & Đăng Nhập Học Sinh Độc Lập
- **Phân tách tài khoản:** Phụ huynh chỉ định danh sách học sinh được phép học trên từng máy tính (`allowed_student_ids`).
- **Đăng nhập cách ly:** Chặn học sinh ngoài danh sách (`student_not_allowed`), chặn chọn sai tài khoản học sinh (`wrong_student`), chống đăng nhập trái vai trò (`not_student`) (`BAO-07`).
- **Vé đăng nhập một lần (SSO Ticket):** Vé đăng nhập hiệu lực 60 giây, chỉ sử dụng được duy nhất 1 lần, miễn nhiễm hoàn toàn với tấn công phát lại (Replay Attack) (`BAO-08`).
- **Làm mới phiên xoay vòng (Refresh Token Rotation):** Cấp mã làm mới 30 ngày cho tùy chọn ghi nhớ; tự động thu hồi mã cũ và cấp mã mới khi sử dụng (`BAO-09`).

### 2.4 Điều Hướng Sâu & Đồng Bộ Dữ Liệu Học Tập
- **Điều hướng sâu (Deep-link):** Hỗ trợ chuyển hướng tức thì vào môn học (`hoc/toan`, `hoc/tieng-viet`, `hoc/tieng-anh`, `hoc/tin-hoc`) và phòng thi thử (`thi/violympic-toan-v1`, `thi/ioe-tieu-hoc-v1`) (`BAO-10`).
- **Bảo vệ đường dẫn:** Bộ lọc `sanitizeDeepLink` chặn hoàn toàn đường dẫn độc hại, giao thức lạ hoặc tấn công chuyển hướng ngoài (`BAO-08`).
- **Dữ liệu hôm nay & Luồng sự kiện:** API `GET /students/{id}/today` và `GET /events?cursor=...` cung cấp số phút học, số câu hoàn thành, các bài thi thử đã nộp, tiến độ tuần và huy hiệu mới đạt được (`BAO-11, BAO-12`).

### 2.5 Bất Biến Bảo Toàn Ví Sao & Chống Lộ Dữ Liệu Nhạy Cảm (BAO-13)
- **Bảo toàn sao:** Cổng tích hợp hoàn toàn không có quyền ghi hay trừ sao trong ví của học sinh. Sao chỉ dùng để đổi quà trên Kệ quà Bảo An dưới sự phê duyệt trực tiếp của cha mẹ.
- **Không lộ đề/đáp án:** API tích hợp tuyệt đối không trả về ngân hàng câu hỏi, nội dung đề thi, đáp án chi tiết hay mã băm mật khẩu.

### 2.6 Khu Phụ Huynh: Thẻ Quản Lý SafeTime (BAO-16)
- **Giao diện quản lý chuyên biệt:** Thẻ "🛡️ Kết nối SafeTime" trong Khu phụ huynh cho phép:
  - Tạo mã ghép đôi và chọn các bé được phép học.
  - Theo dõi danh sách máy tính đang kết nối, thời điểm ghép đôi và thời điểm hoạt động gần nhất.
  - Ngắt kết nối thiết bị tức thì với modal xác nhận an toàn.
  - Ghi nhận đầy đủ nhật ký kiểm toán quản trị (`integration.pair_code_create`, `integration.pair`, `integration.client_revoke`, `integration.login_failed`).

---

## 3. KIỂM ĐỊNH CHẤT LƯỢNG & TƯƠNG THÍCH CƠ SỞ DỮ LIỆU
- **Hỗ trợ đồng thời 2 CSDL:** Hoàn thành schema migration và hỗ trợ đầy đủ cả SQLite (máy cá nhân/LAN) và PostgreSQL/Supabase (đám mây).
- **Bộ kiểm thử tự động toàn diện:**
  - `tests/safetime-schema.test.mjs`: Kiểm thử cấu trúc bảng và di chuyển dữ liệu.
  - `tests/safetime-integration-routing.test.mjs`: Kiểm thử bảo mật mạng và định tuyến API.
  - `tests/student-deep-link.test.mjs`: Kiểm thử điều hướng sâu và an toàn liên kết.
  - `tests/safetime-integration.test.mjs`: Bộ kiểm thử 6 kịch bản khép kín đạt 100% PASS.
- **Chuẩn giao diện:** 0 lỗi CSS Lint Strict, tương thích hoàn toàn hệ thống Design Tokens.
