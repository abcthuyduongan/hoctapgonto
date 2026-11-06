# Báo Cáo 04: Đánh Giá Hiệu Năng và Truy Xuất Dữ Liệu

**Dự án:** BẢO AN LEARNING — Nền tảng học tập cá nhân hóa & luyện thi Lớp 3  
**Phiên bản kiểm toán:** `4.0.2` (Bản dựng sau chẻ nhỏ CSS Minigames & Nâng cấp Staging Runner)  
**Thời điểm thực hiện:** 06/11/2026, Asia/Saigon  
**Quy mô gói sản phẩm:** **121 tệp, 4.86 MiB** (giảm từ 5.09 MiB, ngân sách < 8.00 MiB)

---

## 1. Phương Pháp và Môi Trường Đo Lường

### 1.1. Môi trường phần cứng và công cụ
- **Môi trường đo kiểm:** Windows 11 Pro; CPU Intel Core Ultra 5 125H (18 logic CPUs); RAM 31.4 GiB; Node.js v22.22.2.
- **Bản dựng thử nghiệm:** Toàn bộ thử nghiệm thực hiện trên **Production Build 4.0.2** (`npm run build` vào thư mục `dist`), tuyệt đối không dùng Vite Dev Server.
- **Công cụ đo lường:**
  - Node.js built-in test runner (`node --test`), Performance API (`performance.now()`).
  - Playwright E2E Browser Testing, Chrome DevTools Protocol (CDP), Resource Timing API.
  - Bộ công cụ đo độc lập: `tools/benchmark_admin_scale.mjs`, `tools/staging_load_runner.mjs`.

### 1.2. Phân định rõ ràng giữa Môi Trường Đo Kiểm (Lab/Synthetic) và Thực Địa (Field)
- **Số liệu trong báo cáo này:** Là số liệu đo lường trực tiếp, khách quan tại môi trường thử nghiệm với các điều kiện đầu vào cố định và có khả năng tái lập 100%.
- **Các điều kiện chưa có dữ liệu thực tế** (như mạng 4G chập chờn vùng sâu vùng xa, thời gian cold-start Netlify công cộng ở Singapore/Tokyo, chỉ số INP trên máy học sinh thật) được ghi nhận minh bạch là **CHƯA KIỂM CHỨNG** theo quy chuẩn kỹ thuật.

---

## 2. Đo Lường Truy Xuất Dữ Liệu Theo Quy Mô Trường Học (SQLite Scale Benchmark)

Hệ thống được kiểm thử với tập dữ liệu quy mô tương đương một khối hoặc toàn trường tiểu học:
- **Quy mô dữ liệu thử nghiệm:**
  - 23 lớp học.
  - 1.000 hồ sơ học sinh.
  - 184 tuần học.
  - 32 gói học liệu với 384 câu hỏi đầy đủ dữ liệu.
  - 32.000 bản ghi nhật ký tặng sao/phần thưởng (awards ledger).
- **Bộ đo độc lập:** `tools/benchmark_admin_scale.mjs` (chạy 3 lần độc lập, đếm số lượng câu truy vấn SQL và kích thước payload JSON trả về).

### Bảng kết quả thực nghiệm SQLite:
| Phân hệ / Tab nghiệp vụ | Lần 1 (Cold) | Lần 2 (Warm) | Lần 3 (Hot) | Số lượng SQL Query | Kích thước JSON Payload |
|---|:---:|:---:|:---:|:---:|:---:|
| **Danh sách học sinh** (Phân trang 20 dòng) | **2.524 ms** | **1.050 ms** | **0.845 ms** | 7 queries | 6,530 bytes |
| **Quản lý học liệu tuần** (Tổng quan 184 tuần) | **0.773 ms** | **0.574 ms** | **0.462 ms** | 8 queries | 8,100 bytes |
| **Sổ cái ví & Đổi quà** (Tổng hợp số dư) | **0.359 ms** | **0.245 ms** | **0.217 ms** | 5 queries | 2,522 bytes |

### Nhận xét & Đánh giá:
1. **Tốc độ truy xuất xuất sắc:** Dưới 3 ms ở lần đầu và dưới 1 ms ở các lần tiếp theo. Cơ chế lưu trữ SQLite cục bộ với `node:sqlite` đạt tốc độ xử lý trong bộ nhớ cực nhanh.
2. **Số lượng truy vấn được kiểm soát chặt:** Mỗi tác vụ chỉ từ 5 đến 8 câu query có cấu trúc chuẩn, không xuất hiện hiện tượng N+1 query lặp vô tận.
3. **Phân trang hiệu quả:** Kích thước JSON trả về từ 2.5 KB đến 8.1 KB, hoàn toàn tối ưu cho băng thông mạng di động.

---

## 3. Đo Lường Độ Trễ và Chi Phí Truy Vấn PostgreSQL (Cloud Multi-tenant)

Để đánh giá khả năng hoạt động trên kiến trúc Đám mây (PostgreSQL / Supabase), hệ thống được đo kiểm qua bộ giả lập mạng `tests/postgres-latency.test.mjs` với độ trễ vòng lặp nhân tạo (Simulated RTT = 5ms giữa Application Server và Database).

### Bảng kết quả thực nghiệm PostgreSQL:
| Hành động người dùng | Số lượng câu truy vấn | Tổng thời gian phản hồi (5ms RTT) | Đánh giá ngưỡng chấp nhận |
|---|:---:|:---:|:---:|
| **Đăng nhập (`login`)** | 13 queries | **316 ms** | Đạt (< 500 ms) |
| **Xem tóm tắt tiến độ (`summary`)** | 4 queries | **64 ms** | Rất tốt (< 100 ms) |
| **Mở câu hỏi bài tập (`openQuestion`)** | 9 queries | **141 ms** | Tốt (< 200 ms) |
| **Nộp câu trả lời & chấm điểm (`answer`)** | 12 queries | **184 ms** | Tốt (< 250 ms) |
| **Chơi lại câu hỏi (`retryGame`)** | 9 queries | **140 ms** | Tốt (< 200 ms) |

---

## 4. Thử Tải Đồng Thời Trên Staging Adapter (Concurrent Load Testing)

Hệ thống được thử tải thực tế qua `tests/load-staging.test.mjs` kết hợp với `tools/staging_load_runner.mjs` được nâng cấp toàn diện:
- **Xác thực phiên trung thực:** Phân tích trọn vẹn `Set-Cookie` (`baoan_online_session`).
- **Phân bổ CSRF từng VU:** Trích xuất token `x-csrf-token` riêng biệt cho từng người dùng ảo.
- **Đo thời gian phản hồi chuẩn xác:** Ghi nhận thời gian sau khi đọc toàn bộ nội dung phản hồi (`await res.text()`).

### Kịch bản thử nghiệm:
- **Giai đoạn 1 (Tải cơ bản):** 30 học sinh hoạt động đồng thời liên tục.
- **Giai đoạn 2 (Đỉnh điểm):** Mở rộng lên 100 học sinh hoạt động đồng thời liên tục.
- **Tổng số lượt tác vụ thực hiện:** 910 requests (bao gồm đăng nhập, lấy câu hỏi, nộp câu trả lời, nhận ACK, ghi nhận sao).

### Kết quả đo lường:
- **Tỷ lệ lỗi hệ thống (5xx Server Errors):** **0.00%** (0 lỗi / 910 requests).
- **Phân vị độ trễ phản hồi (Response Latency):**
  - **p50 (Trung vị):** **8.92 ms**
  - **p90:** **10.45 ms**
  - **p95:** **11.81 ms**  
    *(Chỉ tiêu yêu cầu của dự án: p95 ≤ 1,000 ms. Kết quả thực tế vượt xa yêu cầu gần 85 lần).*
- **Độ toàn vẹn sổ cái sao (Ledger Balance Invariant):**
  - Kiểm tra đối soát 100% cho toàn bộ 130 học sinh sau khi hoàn tất tải.
  - Tỷ lệ khớp số dư giữa bảng nhật ký thưởng và tài khoản học sinh: **100.00%** (Không xảy ra lệch sao, mất giao dịch hay nhân đôi sao do tranh chấp race condition).

---

## 5. Đột Phá Tối Ưu Hóa Kích Thước Gói Tài Nguyên (Bundle & Modular CSS Footprint)

### 5.1. Kết quả chẻ nhỏ CSS Minigames (CSS Code-Splitting)
Trước đây, toàn bộ kiểu dáng của 10 trò chơi bị gộp chung vào một tệp `GameCompletion-*.css` có dung lượng lên đến **268,623 bytes (262 KB)**.

Sau khi tách thành các mô-đun độc lập trong `src/styles/games/` và `src/styles/themes/`:
- **Tệp CSS dùng chung (`GameCompletion.css`):** Giảm từ **268.62 kB** xuống còn **15.94 kB** (nén Gzip: **4.51 kB**).  
  **→ Mức giảm kỷ lục: 94.1% dung lượng ban đầu!**
- **Kích thước các tệp CSS độc lập của từng trò chơi:**
  - `BoatRace-*.css`: 0.35 kB (gzip: 0.26 kB)
  - `FoxKitchen-*.css`: 0.49 kB (gzip: 0.31 kB)
  - `TreasureFlip-*.css`: 0.50 kB (gzip: 0.33 kB)
  - `SequenceTrail-*.css`: 1.65 kB (gzip: 0.70 kB)
  - `OnlineExerciseRunner-*.css`: 2.22 kB (gzip: 0.81 kB)
  - `BasketSort-*.css`: 2.80 kB (gzip: 1.07 kB)
  - `WordConnect-*.css`: 3.09 kB (gzip: 1.22 kB)
  - `MemoryMatch-*.css`: 3.14 kB (gzip: 1.27 kB)
  - `SentenceBuilder-*.css`: 3.75 kB (gzip: 1.49 kB)
  - `BalanceScale-*.css`: 4.00 kB (gzip: 1.32 kB)
  - `MathQuest-*.css`: 4.30 kB (gzip: 1.67 kB)

### 5.2. Bảng xếp hạng các tài nguyên chính sau khi build hoàn chỉnh
| Tên tệp | Dung lượng chưa nén | Dung lượng Gzip | Vai trò |
|---|:---:|:---:|---|
| `dist/assets/index-*.js` | 226.35 kB | 71.24 kB | Core JavaScript Runtime |
| `dist/assets/OnlineAdminDashboard-*.js` | 141.95 kB | 46.91 kB | Chunk Quản trị viên (Lazy load) |
| `dist/assets/OnlineStudentWorld-*.js` | 79.74 kB | 24.08 kB | Màn hình Bản đồ Học sinh |
| `dist/assets/TownScreen-*.js` | 28.73 kB | 8.81 kB | Màn hình Thị trấn Học tập |
| `dist/assets/OnlineStudentWorld-*.css` | 50.94 kB | 10.58 kB | CSS Bản đồ Học sinh |
| `dist/assets/OnlineScreen-*.css` | 29.50 kB | 6.66 kB | CSS Khung điều hướng chính |
| `dist/assets/GameCompletion-*.css` | **15.94 kB** | **4.51 kB** | CSS Trao thưởng trò chơi |
| `dist/assets/ContestMockScreen-*.css` | 11.43 kB | 2.74 kB | CSS Phòng thi thử |
| `dist/assets/ParentPortalScreen-*.css` | 13.30 kB | 3.06 kB | CSS Khu vực Phụ huynh |

- **Tổng dung lượng dist:** **4.86 MiB** (121 tệp, giảm từ 5.09 MiB ban đầu).

---

## 6. Đánh Giá Độ Ổn Định Bố Cục & Layout Shift (CLS)

- **Triệt tiêu Layout Shift khi khôi phục phiên:**
  - Nhờ `ConnectingShell` tại [OnlineScreen.tsx](file:///d:/Phần%20mềm%202026/BAO_AN_LEARNING_lam%20lại/src/screens/OnlineScreen.tsx), khi cookie tồn tại, ứng dụng không tải banner chào mừng lớn `auth-welcome.webp` (69 KB).
  - Vùng chứa được khóa kích thước cố định (`min-height`), giúp CLS đo bằng Playwright CDP đạt **0.00** tuyệt đối.
- **Triệt tiêu tải ảnh kép trên thiết bị di động:**
  - Thẻ `<picture>` tại `OnlineStudentWorld.tsx` sử dụng truy vấn truyền thông `(max-width: 768px), (orientation: portrait)` để nạp đúng ảnh nền dọc, ngăn trình duyệt tải cùng lúc 2 hình nền ngang và dọc.

---

## 7. Các Nội Dung CHƯA KIỂM CHỨNG & Giới Hạn Môi Trường

Để đảm bảo tính trung thực khoa học, các chỉ số sau đây được xác định rõ là **CHƯA KIỂM CHỨNG**:
1. **Thời gian khởi động lạnh (Cold-Start) trên Netlify Functions:** Phụ thuộc vào hạ tầng đám mây công cộng và vị trí địa lý của người dùng.
2. **Độ trễ Supabase Storage qua mạng di động thực tế:** Tốc độ tải các tệp âm thanh/hình ảnh khi học sinh dùng mạng 4G/3G chập chờn tại các vùng sóng yếu.
3. **Chỉ số INP (Interaction to Next Paint) trên thiết bị học sinh thật:** Cần thu thập dữ liệu RUM (Real User Monitoring) thực địa từ phụ huynh và học sinh.
4. **Các tính năng TKB / Điểm danh / Sơ đồ lớp:** **KHÔNG ÁP DỤNG** (Hệ thống không thuộc nghiệp vụ quản lý nhà trường THCS).
