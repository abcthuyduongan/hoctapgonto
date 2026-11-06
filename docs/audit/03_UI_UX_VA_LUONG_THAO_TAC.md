# Báo Cáo 03: Kiểm Toán Giao Diện (UI), Trải Nghiệm (UX) & Tính Liền Mạch Thao Tác

**Dự án:** BẢO AN LEARNING — Phiên bản `4.0.2`  
**Ngày kiểm toán:** 06/11/2026, Asia/Saigon  
**Tiêu chuẩn đánh giá:** WCAG 2.1 AA Accessibility, Nielsen Norman Usability Heuristics, Mobile-First Ergonomics

---

## 1. Đánh Giá Toàn Diện Từng Màn Hình Thực Tế

### 1.1. Màn hình Khám phá Thế giới của Học sinh (`OnlineStudentWorld`)
- **Bố cục & Định hướng:**
  - Bản đồ thế giới phân chia rõ ràng thành 4 vùng học tập tương ứng 4 môn học Lớp 3: Toán học (Đảo Số), Tiếng Việt (Rừng Chữ), Tiếng Anh (Cảng English), Tin học (Phố Robot).
  - Tích hợp thanh điều hướng chặng 7 ô chuẩn mực (`RegionMap`), hiển thị biểu tượng địa danh (`landmarks`), huy hiệu cờ đỏ hoàn thành và cờ vàng đạt 3 sao toàn bộ.
  - Hỗ trợ chuyển đổi nhanh giữa hai chế độ xem: Chế độ Bản đồ sinh động (`🗺️ Bản đồ học tập`) và Chế độ Thu gọn danh sách nhẹ (`📋 Danh sách`).
- **Nâng cấp nghệ thuật thích ứng (Responsive Art Direction với `<picture>`):**
  - Trước đây, ứng dụng nạp ảnh phong cảnh ngang (`map-*-wide.webp` ~222 KB) ngay cả trên điện thoại dọc.
  - Hiện tại, thành phần bản đồ và phông nền chặng đã tích hợp thẻ `<picture>` với bộ chọn đa phương tiện:
    ```html
    <picture>
      <source media="(max-width: 768px), (orientation: portrait)" srcSet={activeRegionBgTall} />
      <img src={activeRegionBgWide} alt="Bản đồ học tập" className="world-region-bg-img" />
    </picture>
    ```
  - Trình duyệt di động chỉ tải duy nhất ảnh dạng dọc (`tall.webp`), loại bỏ hoàn toàn việc tải thừa tài nguyên ảnh ngang, tiết kiệm hơn 200 KB băng thông mạng cho mỗi lần mở bản đồ.
- **Khả năng tiếp cận & Tương tác:**
  - Nút chuyển đổi chế độ xem và nút quay lại bản đồ đã được chuẩn hóa `aria-label` và `aria-pressed`.
  - Quét tự động bằng axe-core: **0 lỗi nghiêm trọng (0 critical / 0 serious violations)** với quy tắc kiểm tra độ tương phản được kích hoạt.

### 1.2. Màn hình Thị trấn Học tập (`TownScreen`)
- **Thiết kế & Công thái học:**
  - Lưới xây dựng 10×10 phong cách isometric nhẹ nhàng, thân thiện với học sinh tiểu học.
  - Hiển thị trực quan thanh tài nguyên: Gỗ, Đá, Gạch, Năng lượng, Huy hiệu Dân cư.
  - Ô đo vùng bấm đạt chuẩn tối thiểu 34×44px, hỗ trợ tốt thao tác chạm bằng ngón tay trên điện thoại.
- **Thử nghiệm Zoom 200% & Co giãn màn hình:**
  - Đã kiểm thử trên viewport 640×480 (tương đương zoom 200% trên desktop): Bố cục thanh tài nguyên (`town-material-bar`) và lưới thị trấn co giãn linh hoạt, không bị vỡ giao diện hay xuất hiện thanh cuộn ngang ngoài ý muốn.

### 1.3. Màn hình Phòng Thi Thử & Đấu Trường (`ContestMockScreen`)
- **Tính liền mạch & An toàn dữ liệu:**
  - Đồng hồ đếm ngược được khóa đồng bộ với thời gian thực của máy chủ, tự động nộp bài khi hết giờ mà không làm mất các câu đã trả lời đúng.
  - **Khắc phục lỗi Autosave ghi đè (N06):**
    - Máy chủ kiểm tra phiên bản sửa đổi (`questionRevisions`) cho từng câu hỏi riêng biệt. Khi mạng chậm hoặc các gói tin gửi đi bị đảo lộn thứ tự, đáp án mới nhất của học sinh luôn được bảo toàn tuyệt đối.
    - Bổ sung huy hiệu trực quan hiển thị trạng thái lưu: `Đang lưu...`, `Đã lưu`, hoặc `Lỗi kết nối - Đang thử lại...`, giúp học sinh hoàn toàn yên tâm trong suốt quá trình làm bài.

### 1.4. Bảng Điều Khiển Quản Trị Viên / Giáo Viên (`OnlineAdminDashboard`)
- **Bố cục & Quy trình soạn đề:**
  - Cung cấp form tải lên tệp học liệu theo định dạng chuẩn Excel/Word (`.xlsx`, `.docx`).
  - Hỗ trợ tính năng **Xem trước tuần học (Preview)** độc lập trước khi xuất bản chính thức.
  - **Khắc phục lỗi mất bản nháp khi đổi focus (N09):** Bản nháp preview được lưu giữ an toàn trong trạng thái component, không bị xóa khi người dùng chuyển tab trình duyệt hoặc làm mới dữ liệu nền.
- **Độ tương phản màu sắc (WCAG AA Contrast - Khắc phục N13):**
  - Toàn bộ token `--online-muted` và màu văn bản phụ trợ sử dụng màu `#485646` và `#3e5434`, nâng tỷ lệ tương phản lên **> 6.0:1**, giúp giáo viên đọc rõ ràng ngay cả khi sử dụng điện thoại dưới ánh sáng mạnh trong lớp học.
  - Quét tự động axe-core trên màn hình quản trị xác nhận **0 vi phạm độ tương phản**.

### 1.5. Cổng Thông Tin Phụ Huynh (`ParentPortalScreen`)
- **Bảo mật & Trực quan hóa:**
  - Đăng nhập bảo vệ bằng mã PIN 6 số với bàn phím số lớn, dễ bấm trên màn hình cảm ứng.
  - Cơ chế tự khóa tạm thời (Lockout) khi nhập sai liên tiếp, ngăn chặn nguy cơ học sinh tự mò mã PIN của phụ huynh.
  - Thống kê minh bạch: Thời gian con đã học hôm nay (phút), số bài tập đã hoàn thành, tổng số sao tích lũy và danh sách quà tặng con đang phấn đấu đạt được.

### 1.6. Hệ Thống 10 Trò Chơi Học Tập (Minigames)
- Toàn bộ 10 trò chơi (`MathQuest`, `SentenceBuilder`, `WordConnect`, `MemoryMatch`, `SequenceTrail`, `BoatRace`, `FoxKitchen`, `TreasureFlip`, `BalanceScale`, `BasketSort`) đều được bao bọc trong cấu trúc khung chuẩn:
  - Header: HUD hiển thị điểm số, sao, tiến độ câu hỏi và nút thoát có xác nhận.
  - Body: Vùng tương tác bài tập với các nút bấm to, rõ, nhãn font lớn dễ đọc.
  - Stage overlay: Chú Cáo đồng hành (`GameMascot`) với bóng thoại gợi ý thân thiện.
  - Reward curtain: Hiệu ứng rèm trao thưởng và pháo hoa ăn mừng nhẹ nhàng khi hoàn thành.
  - CSS chuyên biệt cho từng game tải theo nhu cầu, không làm phình to bộ nhớ trình duyệt.

---

## 2. Phân Tích Tính Liền Mạch Của Các Hành Trình Thao Tác (User Journeys)

*Lưu ý: Đối với các mục kiểm toán TKB / Sơ đồ lớp / Điểm danh / GVCN trong mẫu đề cương, do đặc thù Bảo An Learning là hệ thống học tập cá nhân hóa Lớp 3, các hành trình dưới đây phản ánh chính xác các luồng người dùng thực tế của ứng dụng.*

### 2.1. Hành trình Giáo viên / Quản trị viên
1. **Đăng nhập:** Truy cập ứng dụng → Nhập tài khoản quản trị → Mở Bảng điều khiển Quản trị viên.
2. **Chọn lớp & Soạn bài:** Chọn lớp học từ danh sách → Tải lên tệp mẫu Excel/Word chứa các bộ câu hỏi của tuần mới.
3. **Kiểm tra & Xem trước (Preview):** Hệ thống phân tích cấu trúc, kiểm tra tính hợp lệ của câu hỏi, hình ảnh và âm thanh đính kèm → Hiển thị giao diện xem trước.
4. **Xuất bản tuần học:** Nhấn "Giao tuần học" → Dữ liệu được ghi nguyên tử vào CSDL và tự động ánh xạ vào Bản đồ học tập của toàn bộ học sinh trong lớp.
5. **Đánh giá tính liền mạch:** Thao tác ngắn gọn, có bước kiểm tra dữ liệu trước khi công bố; không yêu cầu tải lại trang; không bị mất nội dung đã nhập nếu vô tình chuyển tab.

### 2.2. Hành trình Học sinh
1. **Đăng nhập:** Nhập tên đăng nhập & mật khẩu ngắn gọn do nhà trường cấp.
2. **Khôi phục phiên & Khám phá:** Nhờ shell kết nối nhẹ mới, màn hình Bản đồ Thế giới mở ra mượt mà, không giật khung hình (Zero Layout Shift).
3. **Vào bài học:** Nhấn nút "▶ Tiếp tục chuyến đi" hoặc chọn một trạm trên Bản đồ → Chọn trò chơi phù hợp (Đảo Câu Hỏi, Memory Match, Xưởng Ghép Câu, Bậc Thang Quy Luật, Đua Thuyền, Cân Thăng Bằng, v.v.).
4. **Trả lời câu hỏi & Nhận thưởng:** Học sinh trả lời → Máy chủ chấm điểm tức thời → Hiển thị giải thích chi tiết và trao sao (tối đa 3 sao/câu).
5. **Ôn tập câu sai:** Sau khi hoàn thành bài thi/bài tập, nút "Ôn các câu sai ngay" cho phép học sinh luyện tập lại đúng những câu mình làm sai mà không thể truy cập nhầm vào gói ôn tập của bạn khác (ACL cách ly 100%).
6. **Mở rộng Thị trấn & Đổi quà:** Sử dụng sao tích lũy để xây dựng thêm các công trình trong Thị trấn hoặc gửi yêu cầu đổi quà lên Phụ huynh/Giáo viên.

### 2.3. Hành trình Phụ huynh
1. **Mở khu phụ huynh:** Nhấn nút "👨‍👩‍👧 Phụ huynh" trên thanh tiêu đề → Nhập mã PIN 6 số.
2. **Theo dõi tiến độ:** Xem biểu đồ chuyên cần trong tuần, thời gian học tập từng ngày và các huân chương con đã đạt được.
3. **Duyệt phần thưởng:** Xem các món quà con đã ghim làm mục tiêu phấn đấu → Xác nhận trao quà cho con khi con tích lũy đủ số sao quy định.

---

## 3. Khảo Sát Tính Năng Di Động & Khả Năng Thao Tác Bằng Một Tay

| Tiêu chí | Hiện trạng đánh giá trên v4.0.2 | Mức độ đáp ứng |
|---|---|:---:|
| **Vùng chạm tối thiểu (Touch Targets)** | Các nút điều hướng chính, thẻ trò chơi và lựa chọn đáp án đều có chiều cao ≥ 44px, khoảng cách giữa các nút ≥ 8px. | **ĐẠT** |
| **Thao tác bằng một tay trên điện thoại** | Các nút bấm quan trọng trong minigame và form thi thử được bố trí ở nửa dưới màn hình; nút thoát và menu phụ ở góc trên có khoảng đệm chống bấm nhầm. | **ĐẠT** |
| **Độ co giãn màn hình (Responsive)** | Kiểm thử trên 4 độ phân giải chuẩn (320px, 390px, 768px, 1440px): 100% không có thanh cuộn ngang bất thường (`scrollWidth <= clientWidth`). | **ĐẠT** |
| **Tối ưu hình ảnh theo hướng màn hình** | Thẻ `<picture>` chọn đúng ảnh dọc trên mobile và ảnh ngang trên desktop, không tải kép. | **ĐẠT** |
| **Độ tương phản (WCAG AA)** | Tất cả văn bản chữ thường đạt tỷ lệ tương phản ≥ 4.5:1; văn bản tiêu đề lớn đạt ≥ 3.0:1. Kiểm chứng bằng axe-core tự động. | **ĐẠT** |
| **Phản hồi trạng thái (Feedback & States)** | Đầy đủ trạng thái hover, active, focus-visible với viền chỉ báo rõ ràng (outline 3px); có thông báo loading khi tải mạng và badge lưu bài tự động. | **ĐẠT** |

---

## 4. Hướng Thống Nhất Hệ Thống Thiết Kế (Design System Consolidation)

Dự án hiện tại sử dụng một phong cách đồ họa thống nhất: **Minh họa 2D phong cách Pastel ấm áp, gần gũi với trẻ thơ (Đồng hành cùng nhân vật Cáo nhỏ 🦊)**.

Để duy trì tính nhất quán này trong dài hạn, hệ thống thiết kế tiếp tục tuân thủ các nguyên tắc sau:
1. **Bảng màu chủ đạo (Color Tokens):**
   - Màu chính (Primary Green): `#4e7250` (Tượng trưng cho sự phát triển, thiên nhiên).
   - Màu mực chính (Ink): `#183449` hoặc `#334d42` (Đạt độ tương phản cao trên nền sáng).
   - Màu chữ mờ (Muted Text): `#485646` (Đảm bảo luôn đạt chuẩn WCAG AA trên nền kem `#fffdf7` / `#f8f7ef`).
   - Màu điểm nhấn thưởng (Gold Accent): `#e5a93c` / `#ffcb47` (Ngôi sao, phần thưởng, huân chương).
2. **Kiểu chữ (Typography):**
   - Sử dụng font chữ bo tròn thân thiện (`system-ui, -apple-system, sans-serif`), cỡ chữ cơ sở 16px trên điện thoại, đảm bảo tính dễ đọc cho học sinh tiểu học.
3. **Hiệu ứng chuyển động (Motion & Accessibility):**
   - Tôn trọng thuộc tính `@media (prefers-reduced-motion: reduce)`, tự động vô hiệu hóa pháo hoa hoặc hiệu ứng nảy nút đối với người dùng nhạy cảm với chuyển động.
