# HƯỚNG DẪN GIÁO VIÊN SOẠN HỌC LIỆU & QUẢN LÝ LỚP HỌC
### Bảo An Learning — Phiên bản 4.0 Hoàn Thiện

---

Tài liệu này hướng dẫn các Thầy Cô giáo chủ nhiệm và giáo viên bộ môn lớp 3 cách soạn thảo học liệu số, tải tranh ảnh/âm thanh minh họa, giao bài theo tuần, và xuất kết quả học tập của học sinh trên hệ thống **Bảo An Learning 4.0**.

---

### 1. Cấu Trúc Bộ Học Liệu Theo Tuần
Mỗi tuần học trên Bảo An Learning được đóng gói thành một **Gói tuần (Week Pack)** gồm 4 môn học:
- **Toán học:** 12 – 15 câu (Ôn tập bảng nhân/chia, cộng trừ có nhớ trong phạm vi 10.000 / 100.000, hình học, đơn vị đo độ dài/khối lượng/thời gian).
- **Tiếng Việt:** 10 – 12 câu (Mở rộng vốn từ, chính tả phân biệt l/n, s/x, ch/tr, luyện từ và câu, biện pháp so sánh/nhân hóa, sắp xếp câu văn).
- **Tiếng Anh:** 8 – 10 câu (Từ vựng theo chủ đề gia đình, trường học, con vật, màu sắc, ghép câu giao tiếp đơn giản).
- **Khám Phá / Tin Học:** 6 – 8 câu (Kỹ năng an toàn số, máy tính cơ bản, tự nhiên xã hội địa danh Việt Nam).

Mỗi câu hỏi có thể nhận tối đa **3 sao**:
- Trả lời đúng ngay lần 1: Nhận 3 sao.
- Trả lời đúng ở lần 2: Nhận 2 sao.
- Trả lời đúng sau khi xem gợi ý/thử lại: Nhận 1 sao.

---

### 2. Soạn Thảo Bằng File Bảng Tính Excel (.xlsx / .csv)
Thầy Cô có thể soạn thảo offline trên Microsoft Excel hoặc Google Sheets theo mẫu bảng sau, sau đó tải lên hệ thống qua nút **"Nhập file Excel"**:

| Cột (Tên trường) | Bắt buộc | Ví dụ minh họa | Giải thích quy cách |
| --- | :---: | --- | --- |
| `id` | Có | `t20-m-q01` | Mã định danh duy nhất của câu hỏi (không dấu, cách bằng dấu gạch ngang). |
| `subject` | Có | `math` | Môn học: `math` (Toán), `vietnamese` (Tiếng Việt), `english` (Tiếng Anh), `discovery` (Khám phá). |
| `kind` | Có | `multiple-choice` | Dạng bài: `multiple-choice`, `memory-match`, `sentence-builder`, `balance-scale`, `basket-sort`. |
| `prompt` | Có | `Tính: 2.345 + 1.250 = ?` | Đề bài câu hỏi (có thể kèm công thức toán hoặc câu văn). |
| `options` | Có | `3.595 \| 3.585 \| 3.495 \| 4.595` | Các lựa chọn đáp án, phân tách nhau bằng dấu gạch đứng `\|`. |
| `correctIndex` | Có | `0` | Vị trí đáp án đúng (tính từ 0: 0 là đáp án thứ nhất, 1 là đáp án thứ hai...). |
| `explanation` | Có | `Ta đặt tính: 5+0=5, 4+5=9, 3+2=5, 2+1=3. Kết quả là 3.595.` | Lời giải thích chi tiết hiện ra khi học sinh hoàn thành câu hoặc cần hỗ trợ. |
| `image` | Không | `art/questions/t20_phep_cong.webp` | Tên tệp ảnh minh họa (nếu có). |
| `audio` | Không | `audio/questions/t20_m_q01.mp3` | Tên tệp âm thanh đọc đề (dành cho chế độ trợ năng). |

---

### 3. Tương Ứng Giữa Dạng Bài Và Minigame Trực Quan
Hệ thống tự động liên kết các dạng bài Thầy Cô soạn thảo với các trò chơi tương tác giáo dục tương ứng:

1. **Trắc nghiệm (`multiple-choice`):** Giao diện *Giải cứu Đảo Toán Học* hoặc *Vòng tròn Tri thức*. Thích hợp kiểm tra nhanh phép tính, ngữ pháp, nghĩa của từ.
2. **Ghép cặp (`memory-match`):** Giao diện *Trí Nhớ Siêu Phàm* hoặc *Lật Thẻ Kho Báu*. Thích hợp ghép từ tiếng Anh với nghĩa tiếng Việt, phép tính với kết quả tương ứng.
3. **Kéo ghép câu (`sentence-builder`):** Giao diện *Xếp Toa Tàu* hoặc *Đua Thuyền Tốc Độ*. Học sinh sắp xếp các từ rời thành câu văn hoàn chỉnh đúng ngữ pháp.
4. **Cân thăng bằng (`balance-scale`):** Học sinh tìm số hoặc quả cân phù hợp để hai bên cân bằng nhau (rèn luyện tư duy tìm thành phần chưa biết của phép tính $x + a = b$).
5. **Phân loại giỏ (`basket-sort`):** Kéo thả từ ngữ hoặc số vào đúng 2–3 giỏ phân loại (ví dụ: Giỏ từ chỉ hoạt động / Giỏ từ chỉ đặc điểm; Giỏ số chẵn / Giỏ số lẻ).

---

### 4. Quy Chuẩn Đa Phương Tiện (Ảnh & Âm Thanh)
Để đảm bảo tốc độ tải trang cực nhanh trên điện thoại của học sinh (ngay cả khi mạng 3G/4G yếu):
- **Hình ảnh minh họa:**
  - Định dạng tối ưu: `.webp` hoặc `.png`.
  - Kích thước: Khung hình 16:9 hoặc vuông 1:1, độ phân giải tối đa $800 \times 600$ px.
  - Dung lượng tệp: **Dưới 60 KB** mỗi ảnh.
- **Âm thanh giọng đọc:**
  - Định dạng: `.mp3`.
  - Tần số: 44.1 kHz, bitrate 64–96 kbps.
  - Giọng đọc: Tiếng Việt chuẩn phổ thông, phát âm rõ ràng, tốc độ vừa phải cho học sinh lớp 3.

---

### 5. Giao Tuần Học & Quản Lý Lớp Học
1. **Tạo tuần học mới:** Vào mục **Quản lý học liệu** $\rightarrow$ bấm **"Tạo tuần mới"** $\rightarrow$ chọn khối lớp và đặt tên tuần (ví dụ: *Tuần 20: Phép cộng trừ trong phạm vi 10.000*).
2. **Gắn gói học liệu:** Kéo thả hoặc chọn các gói Toán, Tiếng Việt, Tiếng Anh đã duyệt vào tuần học.
3. **Giao cho lớp:** Bấm **"Giao cho lớp"**, chọn lớp học (ví dụ: *Lớp 3A1*) và đặt ngày bắt đầu / ngày hết hạn.
4. **Khóa/Mở tuần:** Khi hết thời gian tuần, giáo viên có thể khóa tuần học để học sinh chuyển sang tuần mới mà vẫn bảo lưu nguyên vẹn số sao đã đạt được.

---

### 6. Xuất Đáp Án & Bảng Điểm Thống Kê
Sau khi học sinh hoàn thành tuần học, Thầy Cô có thể:
- **Xem bảng điều khiển trực tiếp:** Thống kê tỉ lệ hoàn thành của cả lớp, danh sách các bạn đã hoàn thành sớm, số câu làm đúng ngay lần đầu.
- **Xuất đáp án & giải thích:** Bấm nút **"Xuất toàn bộ đề & đáp án"** để tải file PDF / Word in phát cho học sinh ôn tập hoặc gửi cho phụ huynh.
- **Xuất bảng điểm Excel:** Bấm **"Xuất báo cáo kết quả"** để tải file Excel gồm họ tên học sinh, số sao tích luỹ, tỉ lệ đúng từng môn, thời gian làm bài trung bình phục vụ đánh giá định kỳ theo Thông tư 27/2020/TT-BGDĐT.
