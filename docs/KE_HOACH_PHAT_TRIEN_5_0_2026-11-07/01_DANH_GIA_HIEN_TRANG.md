# 01 · Đánh giá hiện trạng Bảo An Learning 4.0.2

Ngày khảo sát: 07/11/2026 · Người khảo sát: Claude (theo yêu cầu chủ dự án)

**Cách khảo sát**

- Đọc mã nguồn trên nhánh hiện tại (commit `3ff86b5 Cap nhat Bao An Learning 4.0.2`): `src/`, `server/`, `supabase/migrations/`.
- Đo CSS bằng công cụ dòng lệnh.
- Chạy gói `releases/bao-an-learning-4.0.2.zip` trên máy thử (Node 22.23), tạo 1 lớp, 1 học sinh, 1 tuần học 4 môn.
- Chụp 13 màn hình ở cỡ máy tính 1440 × 900 và điện thoại 390 × 844. Ảnh nằm trong thư mục `anh-hien-trang/`.
- Đọc các tài liệu đánh giá cũ trong `docs/audit/`, `docs/DANH_GIA_4_0_0_2026-11-05/`, `docs/PHONG_VAN_THUC_TE_TUAN_11.md`.
- Trang cloud `https://hoctapgonto.netlify.app/`: chỉ đọc được phần đầu trang (cần tài khoản để vào trong).

**Kết luận một câu**: phần máy chủ, dữ liệu và kiểm thử chắc chắn; phần **giao diện học sinh chưa đồng bộ** (nhiều phong cách, nhiều lớp CSS chồng nhau, trang chủ quá dài, mỗi hộp thoại một kiểu) và **vòng "chơi – khám phá – học" chưa liền mạch** (các phần có nhưng rời rạc). Chưa có thử nghiệm với học sinh thật.

---

## 1. Điểm mạnh nên giữ

| Mảng | Hiện trạng |
| --- | --- |
| Máy chủ và dữ liệu | Phiên, CSRF, vai trò, giới hạn đăng nhập sai; sao, đổi quà, lượt chơi được xác nhận ở máy chủ; chạy được cả SQLite (máy) và PostgreSQL (Netlify + Supabase) |
| Kiểm thử | Theo báo cáo 4.0.2: khoảng 356 kiểm thử tự động (270 online, 48 cloud, 26 bản đồ, 12 phát hành) và khoảng 156 kịch bản trình duyệt Playwright, có quét a11y axe-core |
| Nội dung | 10 trò chơi, bản đồ thế giới 4 vùng × 7 chặng, 28 ảnh minh họa WebP, thẻ khám phá có giọng đọc, thi thử Violympic/IOE, khung 8 tuần học kỳ 2 |
| Động lực | Sao, Kệ quà vật phẩm thật có phụ huynh duyệt, huy hiệu, chuỗi ngày, nhiệm vụ ngày, Thị trấn và thú hàng xóm, bảng tin lớp an toàn (không chat) |
| Phong cách vẽ | Tranh bản đồ 2D màu ấm, vẽ tay, rất hợp lứa tuổi – đây là "linh hồn" để xây hệ thống thiết kế quanh nó |
| Màn đăng nhập, màn quản lý | Gọn, cùng một phong cách xanh lá – kem (ảnh `01`, `02`) |

---

## 2. Vấn đề giao diện – số đo trên mã nguồn

| Chỉ số | Số đo | Mức nên có | Nhận xét |
| --- | --- | --- | --- |
| CSS **không còn dùng** | **ĐÃ XÓA 07/11/2026**: Đã gỡ `src/styles/game-base.css` (295 KB) và `game-context-themes.css` (4.8 KB). Đạt 0 KB | 0 | Đã dọn dứt điểm ở bước A1; kiểm thử và build vẫn xanh 100% |
| Dữ liệu thô và rác kho lưu trữ | **ĐÃ DỌN DẸP 07/11/2026**: Xóa thư mục `ảnh/` (187.5 MB PNG thô + tệp trùng lặp `game222.md`), dọn >600 MB bản build/checkpoint cũ trong `releases/`, `backups/`, `outputs/` | 0 | Gói `package:source` giảm từ 196.8 MB xuống 21.8 MB (-89%) |
| CSS đang chạy | 198 KB trong 34 tệp | ≤ 120 KB | Mỗi màn một tệp riêng, tự đặt màu và cỡ chữ |
| Số mã màu khác nhau (CSS đang chạy) | **657** | ≤ 40 (đều là token) | Trộn bảng màu Tailwind (`#0f172a`, `#10b981`, `#0d9488`, `#f59e0b`, `#38bdf8`…) với bảng xanh lá – kem của thương hiệu |
| Số cỡ chữ khác nhau | **111** (trộn `px` và `rem`) | ≤ 9 | Nhiều chữ 10–11 px, quá nhỏ cho trẻ lớp 3 |
| Số kiểu bo góc | 45 | ≤ 5 | |
| Mốc màn hình (breakpoint) | **40+** mốc khác nhau (380, 390, 600, 620, 700, 760, 768, 800, 850, 900, 1000, 1050…) | 4 | Mỗi màn tự co giãn theo cách riêng |
| Biến thiết kế (token) | 88 biến rải rác: `--online-*`, `--region-*`, `--question-*`, `--gw-*`, `--ba-*` (không có tệp token chung) | 1 tệp token | `--gw-*` còn khai báo ở 2–3 nơi |
| `!important` (CSS đang chạy) | 130 | ≤ 10 | |
| `style={{…}}` trong TSX | 172 chỗ | chỉ cho giá trị động | |
| Phông chữ | `system-ui` (khác nhau theo máy: Segoe UI trên Windows, Roboto trên Android) | 1 phông bo tròn có tiếng Việt, tự lưu trữ | Trẻ thấy giao diện khác nhau trên mỗi máy |
| Biểu tượng | Emoji làm biểu tượng nút (🏡 🏆 🔥 📋 🎖️ 📖 👨‍👩‍👧 🔇 🎁 🗺️…) | Bộ biểu tượng SVG thống nhất | Emoji hiển thị khác nhau giữa Windows/Android/iOS, không đổi màu theo trạng thái |
| Màu chủ đạo công bố | Tài liệu `audit/03`: xanh lá `#4e7250`; trang Netlify: `theme-color #1cb099` (xanh ngọc) | 1 màu | Hai nơi nói hai màu khác nhau |
| Mô tả trang | Thẻ mô tả trang web nói "**năm** trò chơi" | 10 trò chơi | Nội dung cũ chưa cập nhật |

---

## 3. Vấn đề giao diện – quan sát trên màn hình

| # | Màn | Ảnh | Vấn đề |
| --- | --- | --- | --- |
| G1 | Trang chủ học sinh (máy tính) | `03` | Trang dài **3.000 px** (≈ 3,3 màn hình) xếp chồng: dải mục tiêu, bản đồ, lời chào, chọn trò, tiến độ, hũ sao, hành trình tuần. Bản đồ – phần "khám phá" – chỉ là một khối giữa trang. Cột giữa hẹp, các thẻ lệch nhau (Cáo đồng hành, Hũ sao) |
| G2 | Thanh trên cùng | `03`, `04` | **12 nút** ngang hàng (phút hôm nay, Thị trấn, Thi thử, chuỗi ngày, Nhiệm vụ, Huy hiệu, Sổ khám phá, Phụ huynh, Âm thanh, Hiệu ứng, Đổi mật khẩu, Đăng xuất), xuống 2 dòng trên máy tính, **3 dòng ≈ 170 px** trên điện thoại. Việc của trẻ, việc của phụ huynh và cài đặt lẫn với nhau |
| G3 | Trang chủ (điện thoại) | `04` | Dài 2.800 px; trẻ phải cuộn rất xa mới tới việc cần làm |
| G4 | Bản đồ môn | `05` | 7 khoảng đất trống hình bầu dục, chặng hiện tại chỉ là nhãn nhỏ "Tuần 1 00/30" ở góc; bảng tuần và nút chọn trò nằm **dưới** bản đồ, nhỏ và lệch trái |
| G5 | Trò chơi | `06`, `07` | Khung câu hỏi ổn nhưng nhiều khoảng trống, Cáo nhỏ lệch trái, dải nước dưới đáy không gắn với câu hỏi; tiêu đề chồng "Toán học: câu 1…" lặp lại tên môn |
| G6 | Thi thử | `08` | Phong cách **xanh đen đậm + dải đỏ cảnh báo**, khác hẳn phần còn lại; phòng thi hiện **chồng lên đầu trang chủ** (bên dưới vẫn là bản đồ và trang chủ), không phải một màn riêng |
| G7 | Thiết lập PIN phụ huynh | `09` | Bàn phím số 1 hàng ngang nút nhỏ, ô nhập trơn, nút "×" lạc chỗ; ghi "PIN 4–6 số" trong khi hướng dẫn phụ huynh nói **4 số** và báo cáo đánh giá nói **6 số** |
| G8 | Hộp thoại | `10`–`13` | Mỗi hộp một kiểu: Kệ quà nền **vàng kem**, Nhiệm vụ ngày và Huy hiệu nền **xanh đen**, Sổ khám phá nền **kem không có lớp phủ**, PIN nền **trắng trơn**. Nút đóng: "×", "Đóng ×", ô vuông trắng… |
| G9 | Trạng thái rỗng | `10`, `13` | Kệ quà rỗng, Sổ khám phá rỗng chỉ có một câu chữ nhỏ, không có hướng dẫn hành động |
| G10 | Thị trấn | — | Trong lần chụp thử, bấm "Thị trấn" chưa thấy màn Thị trấn mở (trang vẫn là trang chủ). **Cần kiểm tra lại** trên máy thật |
| G11 | Chữ nhỏ | nhiều màn | Nhiều nhãn 10–12 px (trạng thái huy hiệu, tiến độ, chú thích) – khó đọc với trẻ 8 tuổi |

---

## 4. Vấn đề về trải nghiệm "chơi – khám phá – học"

| # | Vấn đề | Hậu quả |
| --- | --- | --- |
| T1 | Không có "đường đi" rõ ràng mỗi ngày: trang chủ đưa ra cùng lúc bản đồ, nút Tiếp tục, chọn trò, nhiệm vụ, kệ quà, thị trấn, thi thử | Trẻ không biết nên làm gì trước; dễ bấm lung tung |
| T2 | Khám phá (thẻ khám phá, sương mù, địa danh) có nhưng **không hiện ra như phần thưởng sau khi học** | Mất cảm giác "học xong thì mở ra điều mới" |
| T3 | Thị trấn, sao, huy hiệu, chuỗi ngày, nhiệm vụ ngày là 5 hệ thống thưởng **song song**, mỗi cái một màn | Quá nhiều chỉ số cho trẻ lớp 3; khó hiểu cái nào quan trọng |
| T4 | Một bộ câu hỏi chỉ mở được một số trò (bộ trắc nghiệm thử: 2/10 trò) mà không giải thích | Trẻ thấy ít trò; giáo viên không biết soạn dạng câu nào để mở thêm trò |
| T5 | Linh vật Cáo xuất hiện rời rạc (ảnh emoji 🦊, câu thoại nhỏ) | Chưa thành "người bạn đồng hành" xuyên suốt |
| T6 | Kịch bản "phỏng vấn tuần 11" là **giả định**; nghiệm thu với học sinh/phụ huynh thật (HP01–HP03) còn ở trạng thái `CHO_NGUOI_DUNG_THAT` | Chưa có bằng chứng thật về việc trẻ hiểu và thích giao diện |

---

## 5. Vấn đề kỹ thuật ảnh hưởng tới phát triển

| # | Vấn đề | Đề xuất |
| --- | --- | --- |
| K1 | Logic nghiệp vụ viết **hai lần**: `server/online-store.mjs` (148 KB, SQLite) và `server/postgres-store.mjs` (164 KB, PostgreSQL) | Mỗi tính năng mới phải viết hai lần, dễ lệch. Tách dần lớp nghiệp vụ dùng chung + hai bộ lưu trữ mỏng (làm khi chạm tới tính năng, không viết lại một lần) |
| K2 | Mã môn học không ổn định: khi giao tuần với nhãn "Toán học", "Tin học" máy chủ sinh mã băm (`subject-3694…`) trong khi "Tiếng Việt", "Tiếng Anh" có mã cố định (`vietnamese`, `english`) | Chuẩn hóa 4 mã môn cố định `toan`, `tieng-viet`, `tieng-anh`, `tin-hoc` (bản đồ, báo cáo, và cổng kết nối SafeTime cần) |
| K3 | Chạy `node online-local.mjs` trực tiếp (không qua `MO_QUAN_LY.cmd`) thì trang chủ trả lỗi 500 vì thiếu `BAO_AN_STATIC_DIR` | Đặt mặc định thư mục `app` cạnh tệp khi biến môi trường trống |
| K4 | Tài liệu báo cáo dùng nhiều chữ "100% / tuyệt đối / dứt điểm" trong khi còn mục **chưa kiểm chứng** (Netlify cold-start, 4G, INP) và người dùng thật chưa thử | Báo cáo tách rõ: Đã kiểm bằng máy · Đã kiểm với người thật · Chưa kiểm |
| K5 | Không có kiểm thử so sánh ảnh giao diện (chỉ kiểm có/không phần tử và a11y) | Thêm ảnh chuẩn cho các màn chính để phát hiện vỡ giao diện |

---

## 6. Ảnh hiện trạng

| Ảnh | Màn |
| --- | --- |
| `anh-hien-trang/01-dang-nhap.jpg` | Đăng nhập (máy tính) |
| `anh-hien-trang/02-quan-ly.jpg` | Quản lý lớp |
| `anh-hien-trang/03-trang-chu-hoc-sinh-may-tinh.jpg` | Trang chủ học sinh, máy tính (toàn trang) |
| `anh-hien-trang/04-trang-chu-hoc-sinh-dien-thoai.jpg` | Trang chủ học sinh, điện thoại (toàn trang) |
| `anh-hien-trang/05-ban-do-mon.jpg` | Bản đồ môn Toán + bảng tuần |
| `anh-hien-trang/06-tro-choi.jpg` | Trò Đảo Câu Hỏi |
| `anh-hien-trang/07-tro-choi-tra-loi.jpg` | Sau khi trả lời đúng |
| `anh-hien-trang/08-thi-thu-chen-tren-trang-chu.jpg` | Phòng thi thử (toàn trang) |
| `anh-hien-trang/09-thiet-lap-pin-phu-huynh.jpg` | Thiết lập PIN phụ huynh |
| `anh-hien-trang/10-ke-qua.jpg` | Kệ quà |
| `anh-hien-trang/11-nhiem-vu-ngay.jpg` | Nhiệm vụ ngày |
| `anh-hien-trang/12-huy-hieu.jpg` | Sổ huy hiệu |
| `anh-hien-trang/13-so-kham-pha.jpg` | Sổ khám phá |

Dữ liệu trên ảnh là dữ liệu thử (1 tuần, 3 câu mỗi môn).
