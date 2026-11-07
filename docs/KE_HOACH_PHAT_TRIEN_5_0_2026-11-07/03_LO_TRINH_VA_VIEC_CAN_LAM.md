# 03 · Lộ trình và việc cần làm

Mỗi việc có mã (`A1`, `B4`…), số ngày ước tính cho một người, và tiêu chí xong. Hệ thống thiết kế ở `02_DINH_HUONG_VA_HE_THONG_THIET_KE.md`, nghiệm thu ở `04_MA_TRAN_NGHIEM_THU.md`.

**Nguyên tắc làm**

- Làm trên nhánh, mỗi giai đoạn là một bản phát hành chạy được.
- `npm run verify:local` luôn xanh trước khi gộp.
- **Không đổi luật sao, luật đổi quà, dữ liệu học liệu** khi sửa giao diện.
- Sửa giao diện theo từng màn, chụp ảnh trước/sau.
- Không viết lại toàn bộ; mỗi màn chạm tới thì chuyển sang token và thành phần chung.

---

## 1. Lộ trình tổng thể

Giả định: **có một người làm riêng cho Bảo An** (song song với SafeTime). Nếu cùng một người làm cả hai, xem mục 4.

| Giai đoạn | Nội dung | Thời gian | Ngày dự kiến | Phiên bản |
| --- | --- | --- | --- | --- |
| A | Dọn nợ và nền móng thiết kế | 2 tuần (9,5 ngày + 0,5 dự phòng) | 09/11 – 20/11/2026 | 4.0.3 |
| B | Đồng bộ giao diện toàn bộ màn hình | 6 tuần (27 ngày + 2 dự phòng, trừ 01/01) | 23/11/2026 – 01/01/2027 | 4.1 |
| E1 | Thử nghiệm thật vòng 1 (song song C, không tốn ngày làm) | 2 tuần | 04/01 – 15/01/2027 | — |
| C | Vòng lặp Chơi – Khám phá – Học | 5 tuần (21 ngày + 4 dự phòng) | 04/01 – 05/02/2027 | 4.2 |
| — | Nghỉ Tết Nguyên đán | | 06/02 – 14/02/2027 | |
| — | Dự phòng, sửa lỗi sau thử nghiệm vòng 1 | 1 tuần | 15/02 – 19/02/2027 | 4.2.x |
| D | Kết nối SafeTime (phía Bảo An) | 3 tuần (12,5 ngày + 2,5 dự phòng) | 22/02 – 12/03/2027 | 4.3 (beta kết nối) |
| T | Nợ kỹ thuật (làm xen, khoảng 10% thời gian) | liên tục | từ GĐ B | — |
| E2 | Thử nghiệm thật vòng 2 cùng SafeTime, cloud thật | 2 tuần | 19/04 – 03/05/2027 | 5.0 RC |
| F | Phát hành | 1 tuần | 04/05 – 10/05/2027 | **5.0** (cùng SafeTime 1.0) |

Giai đoạn D trùng tuần 1–3 của GĐ3B trong kế hoạch SafeTime (`D:\Phần mềm 2026\quản lý máy tính\docs\ke-hoach-trien-khai.md`). Tên bản "Bảo An 4.1 (kết nối)" trong tài liệu SafeTime được đổi thành **4.3 (beta kết nối)** và **5.0 (phát hành chung)**.

---

## 2. Chi tiết từng giai đoạn

### A · Dọn nợ và nền móng thiết kế (2 tuần) – bản 4.0.3

**Mục tiêu**: có nền token, phông, biểu tượng, thành phần chung; dọn CSS chết; có ảnh chuẩn để so sánh.

| # | Việc | Ngày | Xong khi |
| --- | --- | --- | --- |
| A1 | **[ĐÃ XONG 07/11/2026]** Gỡ `game-base.css` (295 KB) và `game-context-themes.css` (4.8 KB); gỡ thư mục `ảnh/` (187.5 MB PNG thô + tệp kế hoạch trùng); dọn tệp rác build/checkpoint cũ | 0,5 | **ĐẠT**: Build và kiểm thử xanh 100%, giao diện không đổi, gói source giảm từ 196.8 MB xuống 21.8 MB |
| A2 | Ảnh chuẩn: chụp 20 màn chính × 3 cỡ (390, 768, 1440) bằng Playwright, lưu làm mốc so sánh | 1,5 | Lệnh `npm run test:visual` so ảnh và báo khác biệt |
| A3 | `src/styles/tokens.css`: màu, chữ, khoảng cách, bo góc, bóng, lớp, chuyển động; hai chủ đề `world` và `desk` | 1,5 | Đủ token mục 3 tài liệu 02 |
| A4 | Phông Nunito tự lưu trữ (WOFF2, tập tiếng Việt), `font-display: swap` | 0,5 | Tổng ≤ 160 KB; hiển thị đúng dấu tiếng Việt |
| A5 | Bộ biểu tượng SVG (~40) + `<Icon>` | 1,5 | Đủ biểu tượng cho điều hướng và nút |
| A6 | Thành phần chung `src/ui/`: Button, IconButton, Card, Dialog, Tabs, StatChip, ProgressBar, StarMeter, SubjectBadge, EmptyState, Toast, PinPad | 2,5 | Có trang mẫu nội bộ `?ui=1` hiển thị mọi thành phần |
| A7 | Kiểm tra CSS tự động (stylelint): cấm mã màu ngoài `tokens.css`, cấm `!important` mới, chỉ cho 4 mốc màn hình, cấm cỡ chữ < 13 px; chạy trong `npm test` (chế độ cảnh báo cho tệp cũ, chế độ lỗi cho tệp mới) | 1 | Tệp mới vi phạm thì `npm test` đỏ |
| A8 | Chuẩn hóa mã môn cố định `toan`, `tieng-viet`, `tieng-anh`, `tin-hoc` (bí danh cho nhãn cũ), migration dữ liệu | 0,5 | Giao tuần với nhãn "Toán học" ra mã `toan` |

**Cổng A**: build ≤ 5,0 MiB; mọi kiểm thử cũ xanh; trang mẫu thành phần hoạt động.

### B · Đồng bộ giao diện toàn bộ màn hình (6 tuần) – bản 4.1

**Mục tiêu**: mọi màn học sinh dùng token, thành phần chung và cùng một phong cách; trang chủ còn một màn; một khung hộp thoại.

| # | Việc | Ngày | Xong khi |
| --- | --- | --- | --- |
| B1 | **Khung học sinh**: thanh trên 64 px (4 mục + cụm trạng thái + menu tài khoản); điện thoại: thanh trên 56 px + thanh dưới 5 nút | 3 | Không còn 12 nút; thanh trên điện thoại ≤ 56 px |
| B2 | **Trang chủ = Bản đồ thế giới**: bản đồ toàn màn; thẻ "Hôm nay" (3 bước Học → Khám phá → Chơi); nút lớn "Tiếp tục"; chuyển "Hành trình tuần" thành một màn riêng (từ nút "Danh sách") | 4 | Trang chủ 1440 × 900 không cuộn; điện thoại ≤ 1,3 màn |
| B3 | **Vùng môn**: 7 chặng rõ (đang làm phát sáng, xong có cờ, chưa mở có sương); ngăn bên (máy tính) / khay dưới (điện thoại) cho tuần, bộ câu, chọn trò bằng thẻ lớn | 3 | Chọn được trò trong ≤ 2 lần bấm từ vùng môn |
| B4 | **GameFrame** cho 10 trò: HUD chung, vùng câu hỏi, Cáo cố định, vùng phản hồi, màn kết thúc chung có "Chơi lại" | 5 | 10/10 trò qua danh sách kiểm (mục 4 tài liệu 04) |
| B5 | **Một khung `Dialog`** cho Kệ quà, Nhiệm vụ, Bộ sưu tập (gộp Sổ khám phá + Huy hiệu + Tủ kỷ niệm), Chuỗi ngày, Bảng tin lớp, Đổi mật khẩu | 3 | Không còn hộp thoại nền xanh đen; mọi nút đóng giống nhau |
| B6 | **Thi thử** thành màn riêng (không chồng lên trang chủ), chủ đề sáng; dải "Đề luyện theo dạng, không phải đề chính thức" dạng thông tin xanh nước, không đỏ | 2 | Mở thi thử không còn bản đồ phía dưới |
| B7 | **Thị trấn**: kiểm tra lỗi không mở màn khi bấm (thấy trong lần chụp thử), đồng bộ khung, thanh vật liệu dùng `StatChip` | 1,5 | Mở từ thanh điều hướng ổn định ở mọi cỡ |
| B8 | **PIN phụ huynh** dùng `PinPad`, chốt 6 số; sửa `HUONG_DAN_PHU_HUYNH.md` và nhãn "4–6 số" | 1 | Một con số duy nhất ở mọi nơi |
| B9 | **Khu phụ huynh và Quản lý** chuyển sang chủ đề `desk` (đã gần đúng, chủ yếu thay mã màu bằng token) | 1,5 | 0 mã màu ngoài token trong `parent-portal.css`, `online.css` |
| B10 | **Trạng thái rỗng / tải / lỗi** chuẩn cho mọi màn (`EmptyState` có nút hành động) | 1 | Kệ quà rỗng có nút "Hỏi bố mẹ thêm quà"; Sổ khám phá rỗng có nút "Đi khám phá" |
| B11 | **Lời văn và thông tin trang**: rà soát nhãn; sửa mô tả "năm trò chơi" → 10; `theme-color` → `#4E7250`; tiêu đề trang theo màn | 0,5 | |
| B12 | Kiểm thử: so ảnh, axe-core, 320 / 390 / 768 / 1024 / 1440, zoom 200%, bàn phím | 1,5 | Đạt mục 1–3 tài liệu 04 |

**Cổng B**: đạt các chỉ số "Mục tiêu 5.0" phần giao diện (tài liệu 02 mục 4) cho mọi màn học sinh; kiểm thử cũ xanh; ảnh trước/sau lưu trong `docs/`.

### E1 · Thử nghiệm thật vòng 1 (song song đầu giai đoạn C)

| # | Việc | Ghi chú |
| --- | --- | --- |
| E1.1 | 3–5 học sinh lớp 3 dùng bản 4.1 tại nhà 2 tuần (có thể bắt đầu từ chính con của chủ dự án) | Dùng kịch bản trong `PHONG_VAN_THUC_TE_TUAN_11.md`, nhưng ghi **quan sát thật** |
| E1.2 | Quan sát 3 nhiệm vụ: "vào học hôm nay", "tìm Thị trấn", "đổi quà" – ghi thời gian, chỗ bối rối | Biểu mẫu trong `KE_HOACH_CSS_ANH_VA_THU_NGHIEM_THUC_TE_2026-11-06/04_BIEU_MAU_VA_NHAT_KY.md` |
| E1.3 | Cập nhật HP01–HP03 từ `CHO_NGUOI_DUNG_THAT` sang kết quả thật | |

### C · Vòng lặp Chơi – Khám phá – Học (5 tuần) – bản 4.2

| # | Việc | Ngày | Xong khi |
| --- | --- | --- | --- |
| C1 | **Hành trình hôm nay**: thẻ 3 bước trên trang chủ, máy chủ tính "việc tiếp theo" (bộ chưa đạt → chặng sắp mở → vật liệu chưa dùng) | 2 | Nút "Tiếp tục" luôn đưa đúng việc tiếp theo |
| C2 | **Bản đồ sống**: sương mù tan theo chặng, địa danh mở có hoạt ảnh, cờ hoàn thành; hiệu ứng thời tiết nhẹ theo mùa (góp ý P3 cũ), tắt được | 3 | Hoạt ảnh ≤ 800 ms, tôn trọng giảm chuyển động |
| C3 | **Hoạt cảnh mở khóa + thẻ khám phá**: sau khi đạt chặng, chuyển thẳng tới hoạt cảnh, thẻ có giọng kể, câu hỏi nhỏ "Con có biết?"; **Bộ sưu tập** dạng album | 3 | Học xong chặng → thấy khám phá ngay, không phải tự đi tìm |
| C4 | **Trò chơi theo dạng câu**: hiện rõ trò nào mở với bộ này và vì sao; ma trận dạng câu ↔ trò cho giáo viên trong màn soạn học liệu | 2 | Giáo viên thấy "Thêm câu nối cặp để mở Nối Từ" |
| C5 | **Ôn câu sai** tự vào nhiệm vụ ngày; giọng đọc lời giải thích đặt ngay cạnh phản hồi | 1,5 | |
| C6 | **Thị trấn gắn với học**: vật liệu theo môn (ví dụ Toán → gỗ), công trình mở theo địa danh đã khám phá | 2 | Mỗi công trình ghi rõ "mở nhờ học …" |
| C7 | **Cáo dẫn đường**: bộ lời thoại theo ngữ cảnh (đầu ngày, đúng, sai, chuỗi, mở khóa, kết thúc), 6 biểu cảm SVG thống nhất thay emoji 🦊 | 2 | Cáo xuất hiện cùng vị trí, cùng kiểu ở mọi màn |
| C8 | **Âm thanh** chung (bấm, đúng, sai nhẹ, mở khóa, 3 sao) | 1 | Một nút tắt; phụ huynh tắt được |
| C9 | **Học liệu**: hoàn thiện 8 tuần HK2 đủ 4 môn, mỗi tuần ≥ 3 dạng câu để mở ≥ 4 trò | 3 | Có thể giao cho giáo viên; kiểm bằng `tests/semester2-curriculum.test.mjs` |
| C10 | Kiểm thử + so ảnh | 1,5 | |

**Cổng C**: một vòng ngày đầy đủ (học → mở khóa → xây thị trấn) chạy được trong ≤ 20 phút; trẻ thử nghiệm tự làm được không cần người lớn hướng dẫn (quan sát E1/E2).

### D · Kết nối SafeTime – phía Bảo An (3 tuần) – bản 4.3

Theo `docs/KET_NOI_SAFETIME.md` mục 6 (B1–B10) và yêu cầu `BAO-01` → `BAO-16`.

| # | Việc | Ngày |
| --- | --- | --- |
| D1 | Bảng dữ liệu kết nối, migration SQLite + PostgreSQL, sao lưu/khôi phục | 1,5 |
| D2 | `server/safetime-integration.mjs`: định tuyến, chỉ nhận loopback, khóa, giới hạn tần suất, `status`, `pair`, `students` | 1,5 |
| D3 | Đăng nhập học sinh qua cổng (dùng chung hàm với `/login`) | 1 |
| D4 | Vé SSO, mã làm mới, `sso` | 1 |
| D5 | 5 loại sự kiện + `events` | 1,5 |
| D6 | Dữ liệu `today` (dùng mã môn chuẩn từ A8) | 1 |
| D7 | Liên kết sâu `#/hoc/{môn}`, `#/nhiem-vu`, `#/thi/{đề}`, `#/ban-do`, `#/qua` (dễ hơn nhờ khung điều hướng mới của B1) | 1,5 |
| D8 | Khu phụ huynh: thẻ Kết nối SafeTime (dùng thành phần chung) | 1,5 |
| D9 | `tests/safetime-integration.test.mjs` | 1,5 |
| D10 | Tài liệu, ghi chú phát hành | 0,5 |

**Cổng D**: đạt nghiệm thu mục 20.2 đặc tả SafeTime; `verify:local` xanh; sao không bị thay đổi bởi SafeTime.

### T · Nợ kỹ thuật (làm xen, khoảng 10% thời gian)

| # | Việc | Khi nào |
| --- | --- | --- |
| T1 | Tách dần lớp nghiệp vụ dùng chung khỏi `online-store.mjs` / `postgres-store.mjs`; mỗi tính năng mới viết một lần | Mỗi khi sửa một tính năng ở máy chủ |
| T2 | `online-local.mjs` tự tìm thư mục `app` khi thiếu biến môi trường | B (0,25 ngày) |
| T3 | Giảm `style={{…}}` tĩnh trong TSX (172 chỗ) sang lớp CSS dùng token | Khi chạm tới màn |
| T4 | Mẫu báo cáo mới: Đã kiểm bằng máy · Đã kiểm với người thật · Chưa kiểm | Từ cuối A |

### E2 · Thử nghiệm thật vòng 2 và cloud (2 tuần) – 5.0 RC

| # | Việc |
| --- | --- |
| E2.1 | Dùng thật cùng SafeTime 0.9 trên 2 máy (khớp GĐ5 của SafeTime) |
| E2.2 | Đo thật trên `https://hoctapgonto.netlify.app/`: thời gian mở lần đầu, mạng 4G yếu, độ trễ thao tác (INP); cập nhật các mục "CHƯA KIỂM CHỨNG" |
| E2.3 | Sửa lỗi; chốt danh sách việc dời sang 5.1 |

### F · Phát hành 5.0 (1 tuần)

| # | Việc |
| --- | --- |
| F1 | `npm run verify:release`, đóng gói ZIP và mã nguồn |
| F2 | Triển khai Netlify (bản cloud) – kết nối SafeTime bản cloud để sang phiên bản 2 của SafeTime |
| F3 | Hướng dẫn: cập nhật `HUONG_DAN_SU_DUNG.html`, `HUONG_DAN_PHU_HUYNH.md` (ảnh mới, PIN 6 số, kết nối SafeTime) |
| F4 | Ghi chú phát hành 5.0, ảnh trước/sau |

---

## 3. Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| Đổi giao diện làm hỏng luồng sao/đổi quà | Không đụng máy chủ ở A–C trừ A8 và C1; kiểm thử sao hiện có phải xanh ở mọi bước |
| Làm lại 10 trò tốn hơn dự kiến | `GameFrame` chỉ bọc HUD/phản hồi/kết thúc, giữ nguyên phần chơi; làm 2 trò mẫu trước, rút kinh nghiệm rồi làm 8 trò còn lại |
| Phông chữ tải chậm trên mạng yếu | `font-display: swap`, chỉ 4 độ đậm, tự lưu trữ |
| Trẻ quen giao diện cũ | Giữ nguyên tranh bản đồ, Cáo, tên vùng; chỉ sắp xếp lại |
| Một người làm hai dự án | Xem mục 4 |
| Học liệu C9 phụ thuộc giáo viên | Tách khỏi đường găng; trò chơi vẫn chạy với học liệu hiện có |

---

## 4. Nếu một người làm cả Bảo An và SafeTime

Tổng khối lượng: Bảo An A + B + C + E1 ≈ 13 tuần làm, cộng SafeTime 25 tuần (đã gồm phần kết nối D). Khoảng **38 tuần làm việc**: bắt đầu 09/11/2026 thì phát hành chung khoảng **cuối tháng 8/2027**.

Thứ tự đề xuất:

1. **Bảo An A + B** (8 tuần, 09/11/2026 – 01/01/2027): Bảo An đang được dùng, sửa giao diện trước để trẻ hưởng lợi ngay.
2. **SafeTime GĐ0 – GĐ3** (lùi 8 tuần so với kế hoạch SafeTime hiện tại).
3. **SafeTime GĐ3B** (gồm Bảo An D).
4. **Bảo An C** (vòng chơi – khám phá – học).
5. **SafeTime GĐ4 – GĐ6** cùng **Bảo An E2, F**.

Muốn giữ ngày phát hành SafeTime 10/05/2027 thì cần người thứ hai làm Bảo An, hoặc dời Bảo An C sang sau 5.0 (thành 5.1).
