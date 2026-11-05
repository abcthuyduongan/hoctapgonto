# Bảo An Learning — Đề xuất phát triển game học tập lớp 3

Nov 4, 2026 · @abc

## Tóm tắt

**Bảo An Learning 3.9.0-rc.1 là một "máy chạy bài tập theo tuần" rất chắc chắn, nhưng chưa phải một game học tập có chương trình.** Nền tảng kỹ thuật tốt: 5 trò chơi, 8 dạng câu, chấm điểm phía máy chủ, sao từng câu, khóa tuần, ví đổi quà, nhập Excel/Word kèm ảnh và âm thanh, hơn 300 kiểm thử tự động. Nhưng toàn bộ nội dung do giáo viên tự nhập từng tuần; ứng dụng không biết học sinh đang ở đâu trong chương trình, yếu phần nào, nên học gì tiếp.

Đề xuất: giữ nguyên lõi kỹ thuật, bổ sung ba lớp mới theo thứ tự.

1. **Bản đồ kiến thức lớp 3** cho Toán, Tiếng Việt, Tiếng Anh, Tin học (khoảng 120–150 "kỹ năng" nhỏ), mỗi câu hỏi gắn vào một kỹ năng.
2. **Ngân hàng câu có sẵn + bộ sinh câu tự động** cho Toán và Tiếng Anh, để không phụ thuộc hoàn toàn vào việc gõ tay từng tuần.
3. **Chế độ luyện thi** (Violympic, IOE, Trạng Nguyên Tiếng Việt) và **chế độ chuyên sâu** với các dạng toán tư duy, đề bấm giờ, báo cáo điểm yếu.

Trước khi mở rộng, cần đóng lỗi tải đồng thời trên cloud (staging 26/10: chỉ 9/30 học sinh hoàn tất), nếu không mọi tính năng mới sẽ cùng bị chậm.

## Hiện trạng dự án

Dự án là web app React 19 + TypeScript (Vite), khoảng 12.600 dòng mã trong `src/` và `server/`, chạy hai cách: máy chủ cục bộ SQLite (cổng 4180) hoặc cloud Netlify Functions + Supabase PostgreSQL. Bản 3.9 đã bỏ 3D, chỉ còn giao diện 2D với linh vật Cáo.

### Những gì đã có

| Thành phần | Hiện trạng | Tệp chính |
| --- | --- | --- |
| 5 trò chơi | Math Quest (trả lời câu hỏi), Memory Match (lật thẻ), Sentence Builder (xếp từ thành câu), Nối Từ Khám Phá (nối hai cột), Bậc Thang Quy Luật (xếp thứ tự) | `src/games/*.tsx`, `core/registry.ts` |
| 8 dạng câu | Trắc nghiệm 4 đáp án, ghép cặp, sắp xếp câu, nhập số, điền từ, đọc hiểu chọn đáp án, nghe chọn, nghe điền | `core/contracts.ts` |
| Luật sao | Mỗi câu tối đa 3 sao, tính theo tốc độ (trắc nghiệm 30 s/60 s, đọc 90 s/180 s) hoặc số lần sai; sai +15 s, gợi ý +30 s; máy chủ chấm | `core/question-rewards.ts` |
| Hành trình tuần | Mỗi tuần 3–4 môn, tối đa 12 câu/môn; mọi câu ≥ 2 sao mới được sang tuần; tuần cũ khóa lại | `core/weekly-plan.ts` |
| Ví đổi quà | Quy đổi sao ra tiền/quà, người lớn duyệt | `OnlineStudentWorld.tsx`, `reward-wallet.ts` |
| Nhập học liệu | Excel/Word theo mẫu, ảnh PNG/JPEG/WebP, âm thanh MP3/WAV/OGG, xem trước và báo lỗi theo dòng | `core/excel-import.ts`, `docs/ONLINE_QUESTION_IMPORT.md` |
| Quản trị | Lớp, học sinh, giao tuần, duyệt đổi quà, sao lưu/khôi phục | `OnlineAdminDashboard.tsx`, `server/*` |
| Kiểm thử | 337 unit/integration + khoảng 142 ca Playwright Chrome/Edge | `tests/` |

### Điểm mạnh nên giữ

- Chấm điểm và cộng sao ở máy chủ, chống gửi lại, chống nhân đôi sao: đây là nền bắt buộc cho mọi chế độ thi thử sau này.
- Đồng hồ chỉ chạy khi ảnh đã tải xong và khi nghe hết bài nghe: công bằng cho trẻ.
- Game SDK tách bạch (`GameHostProps`): thêm game mới không phải sửa lõi.
- Trong `curriculum.ts` (883 dòng) và `contest-runtime.ts` đã có sẵn khái niệm lộ trình, bài học, chính sách thành thạo, ôn tập ngắt quãng (`ReviewCard`) và **chế độ thi thử `contest-mock`** có bấm giờ, tính điểm, điều kiện học trước. Đây là mã từ bản offline cũ, **hiện không được luồng online sử dụng**, nhưng là điểm khởi đầu rất tốt.

### Điểm yếu và khoảng trống

- **Không có nội dung có sẵn.** Bản cài mới có kho câu rỗng (CSDL local hiện có 0 câu); bộ mẫu chỉ có 36 câu.
- **Không có chương trình.** `topic`, `competition`, `level` chỉ là nhãn chữ tự do; không có danh sách bài học theo SGK, không có thứ tự kiến thức tiên quyết.
- **Không có Tin học đúng nghĩa.** Tin học chỉ có thể là câu trắc nghiệm; không có bài gõ phím, dùng chuột hay lập trình kéo thả.
- **Không có học thích ứng.** Câu sai không tự quay lại ôn; không có báo cáo "con yếu phép chia có dư".
- **Thiếu dạng bài đặc trưng của kỳ thi:** sắp xếp chữ cái thành từ (IOE), điền nhiều ô trong một câu, đúng/sai, ghép các giá trị bằng nhau (Violympic "đập dế"), so sánh >, <, =.
- **Game còn đơn giản về động lực:** chỉ có sao và đổi tiền; không có bản đồ phiêu lưu, nhân vật lên cấp, huy hiệu, chuỗi ngày học.
- **Rủi ro kỹ thuật đang mở:** khóa toàn workspace trên PostgreSQL làm học sinh xếp hàng (21/30 luồng lỗi khi thử tải), `game-base.css` hơn 4.000 dòng, server `.mjs` chưa kiểm tra kiểu.

## Khoảng cách cần lấp

Khoảng cách lớn nhất là nội dung và chương trình, không phải kỹ thuật.

| Mục tiêu | Đã có | Còn thiếu | Mức độ |
| --- | --- | --- | --- |
| Học hết chương trình lớp 3 | Khung tuần, 8 dạng câu | Bản đồ kiến thức theo SGK, \~3.000–4.000 câu, kiểm tra đầu vào, ôn tập tự động | Rất lớn |
| Toán | Nhập số, trắc nghiệm | Bộ sinh câu ngẫu nhiên, so sánh >/\</=, hình học tương tác, đồng hồ, tiền | Lớn |
| Tiếng Việt | Đọc hiểu, điền từ, xếp câu, ghép từ | Chính tả nghe viết, từ loại, biện pháp so sánh, kiểu câu, đề Trạng Nguyên | Trung bình |
| Tiếng Anh | Nghe chọn, nghe điền, đọc | Xếp chữ cái, phát âm, từ vựng theo Unit, đề IOE bấm giờ | Trung bình |
| Tin học | Chỉ trắc nghiệm | Gõ phím 10 ngón, thao tác chuột, thư mục/tệp, lập trình kéo thả kiểu Scratch | Rất lớn |
| Luyện Violympic/IOE | Mã `contest-mock` (chưa dùng) | Đề thi thử theo vòng, bảng xếp hạng, Toán bằng tiếng Anh, phân tích lỗi | Lớn |
| Chuyên sâu | Nhãn `difficulty` | Cây dạng toán tư duy, bài giảng/lời giải từng bước, đánh giá năng lực | Lớn |
| Động lực trẻ 8 tuổi | Sao, ví, Cáo | Bản đồ thế giới, nhân vật lên cấp, huy hiệu, nhiệm vụ ngày, báo cáo cho phụ huynh | Trung bình |
| Chạy ổn nhiều học sinh | Ổn trên local | Thu hẹp khóa PostgreSQL, đo tải 30–100 người | Chặn phát hành |

Lưu ý: số lượng câu là ước tính của mình (35 tuần × 4 môn × 12 câu ≈ 1.700 câu tối thiểu, nhân 2 để có bản thay thế khi ôn lại).

## Giai đoạn 1 — Học hết chương trình lớp 3

Mục tiêu: sau 35 tuần, học sinh đạt ít nhất 2 sao ở mọi kỹ năng của bản đồ kiến thức lớp 3 (Chương trình GDPT 2018). Cần chốt một bộ SGK để bám thứ tự bài: Kết nối tri thức, Chân trời sáng tạo hay Cánh diều, theo trường của con.

### 1.1. Bản đồ kiến thức theo môn

**Toán 3** (khoảng 45 kỹ năng)

| Mạch | Kỹ năng chính | Game phù hợp |
| --- | --- | --- |
| Số và phép tính | Số đến 1.000 rồi 10.000, 100.000; làm tròn; số La Mã; bảng nhân, chia 2–9; nhân/chia số có nhiều chữ số cho số có 1 chữ số; chia có dư; biểu thức có ngoặc; tìm thành phần chưa biết; "một phần mấy" | **Nhà vô địch bảng cửu chương** (tính nhanh 60 giây), **Cân thăng bằng** (so sánh >, <, =), Math Quest nhập số |
| Hình học và đo lường | Trung điểm, góc vuông, hình tròn (tâm, bán kính, đường kính); chu vi, diện tích hình chữ nhật, hình vuông; mm, g, ml, °C; đồng hồ, ngày tháng, tiền Việt Nam | **Xây vườn** (kéo ô vuông tính chu vi/diện tích), **Chỉnh kim đồng hồ**, **Đi chợ** (trả tiền, thối tiền) |
| Thống kê, xác suất | Đọc bảng số liệu; chắc chắn / có thể / không thể | Trắc nghiệm có hình, bốc bi ảo |
| Giải toán có lời | Hai bước tính, gấp/giảm một số lần, so sánh số lớn gấp mấy lần | **Giải toán từng bước** (điền từng dòng lời giải) |

**Tiếng Việt 3** (khoảng 35 kỹ năng)

| Mạch | Kỹ năng chính | Game phù hợp |
| --- | --- | --- |
| Đọc | Đọc hiểu truyện, thơ, văn bản thông tin; tìm ý chính | Reading-choice có sẵn, thêm giọng đọc mẫu |
| Từ và câu | Từ chỉ sự vật, hoạt động, đặc điểm; từ cùng nghĩa, trái nghĩa; câu kể, hỏi, cảm, khiến; biện pháp so sánh; dấu câu | **Phân loại vào giỏ** (kéo từ vào đúng nhóm), Sentence Builder, **Đặt dấu câu** |
| Chính tả | l/n, s/x, tr/ch, r/d/gi, dấu hỏi/ngã | **Bắt lỗi chính tả**, nghe viết từng từ (listening-gap) |
| Viết, nói | Đoạn văn ngắn kể, tả | Viết có khung gợi ý; phụ huynh/giáo viên chấm tay |

**Tiếng Anh 3** (khoảng 20 chủ đề theo Unit)

| Mạch | Nội dung | Game phù hợp |
| --- | --- | --- |
| Từ vựng | Chào hỏi, tên, bạn bè, cơ thể, sở thích, trường lớp, đồ dùng, màu sắc, gia đình, nghề, nhà, thú cưng, đồ chơi, sở thú | Memory Match tranh–từ, **Xếp chữ cái thành từ** |
| Mẫu câu | What's your name? / How old are you? / Is this…? / Can you…? | Sentence Builder, hội thoại nhập vai |
| Ngữ âm | Âm đầu, vần theo từng Unit | **Nghe chọn âm**, ghi âm giọng con để so sánh |
| Nghe, đọc | Đoạn hội thoại, đoạn văn ngắn | Listening-choice, listening-gap có sẵn |

**Tin học 3** (khoảng 15 kỹ năng)

| Chủ đề | Nội dung | Game phù hợp |
| --- | --- | --- |
| Máy tính và em | Thiết bị, tư thế ngồi, dùng chuột, bàn phím | **Luyện chuột** (bắt bóng bay, kéo thả), **Gõ phím phiêu lưu** (hàng phím cơ sở, đo từ/phút) |
| Thông tin | Thông tin và xử lý thông tin; sắp xếp để dễ tìm | Phân loại vào giỏ |
| Tổ chức lưu trữ | Thư mục, tệp, cây thư mục | **Dọn tủ đồ** (kéo tệp vào thư mục giả lập) |
| Đạo đức, an toàn | Giữ thông tin cá nhân, không mở đường lạ, nhờ người lớn | Tình huống chọn cách ứng xử |
| Ứng dụng, giải quyết vấn đề | Trình chiếu đơn giản; làm việc theo các bước | **Robot tìm đường** (xếp mũi tên, lặp lại): tiền đề lập trình |

### 1.2. Tính năng cần thêm cho giai đoạn 1

1. **Danh mục kỹ năng** (`skillId`, môn, mạch, bài SGK, kỹ năng tiên quyết). Mỗi câu bắt buộc gắn `skillId` thay cho `objectiveId` tự do.
2. **Kiểm tra đầu vào 15 phút** mỗi môn để biết con đã vững phần nào, không bắt học lại từ đầu.
3. **Tự lập tuần**: hệ thống đề xuất 12 câu/môn từ kỹ năng kế tiếp + 20–30% câu ôn lại kỹ năng cũ; giáo viên chỉ duyệt.
4. **Bộ sinh câu Toán** (phép tính, so sánh, đồng hồ, tiền, chu vi): mỗi lần chơi ra số khác, đáp án tính ở máy chủ, nên không học thuộc đáp án.
5. **Ôn tập ngắt quãng**: câu sai hoặc 1 sao quay lại sau 1, 3, 7 ngày (tái dùng `ReviewCard` đã có).
6. **Báo cáo phụ huynh hằng tuần**: kỹ năng đã vững, kỹ năng yếu, thời gian học, câu sai nhiều nhất.
7. **Ngân hàng câu ban đầu**: soạn bằng AI theo mẫu Excel hiện có (đã có `Huong_dan_AI_soan_cau_hoi_tuan.txt`), rồi giáo viên duyệt; mỗi kỹ năng tối thiểu 20 câu, đủ ba mức easy/medium/hard.

## Giai đoạn 2 — Luyện thi Violympic, IOE

Mục tiêu: học sinh đã vững lớp 3 luyện đúng dạng bài, đúng áp lực thời gian của kỳ thi. Chỉ mở chế độ này khi kỹ năng nền tương ứng đạt ≥ 2 sao (điều kiện này đã có sẵn trong `contestPrerequisiteErrors`).

### 2.1. Đặc điểm kỳ thi cần mô phỏng

| Kỳ thi | Đặc điểm | Chế độ luyện trong game |
| --- | --- | --- |
| Violympic Toán | Hai nhánh Toán Tiếng Việt và Toán Tiếng Anh; vòng tự luyện rồi các cấp trường, xã, tỉnh, quốc gia; trắc nghiệm, điền đáp án, ghép các giá trị bằng nhau | **Đấu trường Violympic**: đề bấm giờ theo vòng, cả hai ngôn ngữ; game ghép cặp "giá trị bằng nhau" (vd. 3 × 8 với 48 : 2) |
| IOE Tiếng Anh | Thi trực tuyến; lớp 3 có ca 30 phút (cấp tỉnh 2025–2026: 7h30–8h00 hoặc 13h30–14h00); cần ≥ 50% câu đúng ở cấp tỉnh để đăng ký cấp quốc gia | **Phòng thi IOE**: đề 30 phút, không gợi ý; dạng chọn đáp án, điền chữ còn thiếu, xếp chữ cái, nghe |
| Trạng Nguyên Tiếng Việt (nên thêm) | Thi Tiếng Việt trực tuyến cho tiểu học: từ vựng, chính tả, thành ngữ, ca dao, đọc hiểu | **Đường lên Trạng Nguyên**: giải đố chữ, điền thành ngữ, bắt lỗi chính tả |

Cấu trúc đề, số câu và giao diện thi thay đổi theo năm. Trước khi soạn đề mô phỏng cần đối chiếu thể lệ chính thức năm học 2026–2027 trên trang của ban tổ chức; ứng dụng chỉ nên ghi "luyện theo dạng", không ghi "đề chính thức".

### 2.2. Dạng toán Violympic lớp 3 cần có ngân hàng riêng

- Tính nhanh, tính hợp lý (nhóm số tròn chục, tròn trăm).
- Quy luật dãy số, dãy hình; đếm số hạng.
- Đếm hình (tam giác, tứ giác, hình vuông lồng nhau).
- Tìm x hai bước, số bị chia/số chia khi có dư.
- Bài toán tuổi, tổng–hiệu đơn giản, gấp/kém, trồng cây, ngày tháng.
- Cấu tạo số: lập số từ các chữ số, số lớn nhất/nhỏ nhất, số chữ số dùng để đánh số trang.
- **Toán bằng tiếng Anh**: từ điển thuật ngữ (sum, difference, product, quotient, remainder, perimeter, area…) học bằng Memory Match trước khi làm đề.

### 2.3. Tính năng cần thêm

1. **Chế độ Thi thử**: đồng hồ đếm ngược cho cả đề, không gợi ý, không hiện đáp án từng câu, được bỏ qua và quay lại; chấm điểm cuối đề. Đây là việc nối `contest-mock` có sẵn vào luồng online.
2. **Ma trận đề**: giáo viên khai báo "10 câu số học, 5 hình học, 5 có lời; 40% dễ", hệ thống bốc ngẫu nhiên từ ngân hàng, mỗi lần một đề khác.
3. **Sau thi**: xem lại từng câu sai có lời giải; tự tạo "bài chữa" gồm các kỹ năng vừa sai.
4. **Biểu đồ tiến bộ**: điểm và thời gian qua các lần thi thử; mốc "sẵn sàng dự thi" (vd. 3 đề liên tiếp ≥ 80%).
5. **Bảng xếp hạng trong lớp** (tùy chọn, tắt được): xếp theo mức tiến bộ của chính mình, tránh làm trẻ yếu nản chí.
6. **Giao diện thi giống thật vừa đủ**: bàn phím số trên màn hình, ô điền nhiều chỗ, nút Nộp bài, để trẻ quen thao tác. Không sao chép logo hay giao diện của các cổng thi.

## Giai đoạn 3 — Đào tạo chuyên sâu

Mục tiêu: chuyển từ "làm đúng nhanh" sang "hiểu sâu, giải được bài lạ". Mỗi môn có một nhánh nâng cao nối tiếp lên lớp 4–5.

| Môn | Nhánh chuyên sâu | Cách học trong game |
| --- | --- | --- |
| Toán | Toán tư duy: suy luận logic, đếm và tổ hợp, quy luật, bài toán điển hình (tổng–hiệu, tổng–tỉ, giả thiết tạm), sơ đồ đoạn thẳng; làm quen đề Toán quốc tế | **Vẽ sơ đồ đoạn thẳng** tương tác; câu "thử thách tuần" khó, không tính giờ; lời giải từng bước mở dần |
| Tiếng Việt | Mở rộng vốn từ, thành ngữ tục ngữ, cảm thụ thơ, viết đoạn văn hay, đọc sách theo lộ trình | Thư viện truyện ngắn có câu hỏi; viết có AI nhận xét gợi mở (người lớn duyệt) |
| Tiếng Anh | Phonics hệ thống, đọc truyện theo cấp độ, nói theo mẫu, hướng tới Cambridge Starters/Movers | Ghi âm và chấm phát âm bằng nhận dạng giọng nói; truyện tranh song ngữ |
| Tin học | Lập trình kéo thả (vòng lặp, điều kiện), tư duy thuật toán, gõ phím ≥ 15 từ/phút | **Robot tìm đường** nâng cấp (khối lặp, nếu–thì), tự làm hoạt hình nhỏ; chuẩn bị cho Scratch |

Tính năng cần thêm:

1. **Hồ sơ năng lực** theo từng mạch (điểm từ 0 đến 100, cập nhật theo độ khó câu làm đúng), thay cho chỉ đếm sao.
2. **Câu hỏi thích ứng**: đúng liên tiếp thì tăng độ khó, sai thì hạ xuống và mở bài giảng ngắn.
3. **Bài giảng vi mô** 1–2 phút trước mỗi dạng mới (hình minh họa + giọng đọc), không chỉ có câu hỏi.
4. **Gia sư AI có giới hạn**: gợi ý theo từng bước, không đưa đáp án ngay; mọi nội dung AI tạo ra phải qua duyệt của người lớn trước khi vào ngân hàng.
5. **Lộ trình liên lớp**: cùng bản đồ kỹ năng mở rộng sang lớp 4, 5; học sinh giỏi có thể học vượt từng mạch.

## Thiết kế game và động lực

Trẻ 8 tuổi cần thấy mình đang đi đâu và tiến bộ ra sao, hơn là chỉ đếm sao. Đề xuất chuyển màn chọn trò hiện tại thành một **thế giới phiêu lưu có bốn vùng**, dùng lại tranh đảo, lâu đài và Cáo đã có trong `public/art`.

- **Bốn vùng đất**: Đảo Số Học (Toán), Rừng Chữ (Tiếng Việt), Cảng English (Tiếng Anh), Thành Phố Robot (Tin học). Mỗi vùng là một con đường các trạm = kỹ năng; trạm sáng lên khi đạt 2 sao.
- **Boss cuối chương**: hết mỗi chương SGK có một trận "đấu boss" = bài kiểm tra tổng hợp 10 câu.
- **Nhân vật lớn lên**: Cáo (hoặc bạn đồng hành con chọn trong 5 avatar đã khai báo) lên cấp, mở trang phục, phụ kiện bằng sao; sao không chỉ đổi ra tiền.
- **Huy hiệu**: "Thần tốc bảng cửu chương", "7 ngày liên tiếp", "Sửa 10 lỗi sai" — thưởng cả nỗ lực, không chỉ điểm cao.
- **Nhiệm vụ ngày 15 phút**: 3 việc nhỏ mỗi ngày (1 bài mới, 1 bài ôn, 1 thử thách); có giới hạn thời gian chơi mỗi ngày do phụ huynh đặt.
- **Phản hồi khi sai**: giải thích ngắn + cho làm lại câu tương tự; không trừ sao, không âm thanh chê.
- **Giọng đọc**: đọc to đề bài cho mọi câu (đã có `speech.ts`), rất cần với trẻ đọc còn chậm.
- **Đổi quà**: giữ ví hiện có nhưng nên có trần theo tuần và ưu tiên quà phi vật chất (đi chơi, chọn truyện), để động lực không hoàn toàn là tiền.

### Game mới đề xuất (theo SDK hiện có)

| Game | Môn | Kiểu tương tác | Độ khó làm |
| --- | --- | --- | --- |
| Nhà vô địch bảng cửu chương | Toán | Tính nhanh 60 giây, câu sinh tự động | Thấp |
| Cân thăng bằng | Toán | Chọn >, <, = giữa hai biểu thức | Thấp |
| Phân loại vào giỏ | TV, Tin, Anh | Kéo thẻ vào 2–4 nhóm | Thấp |
| Xếp chữ cái thành từ | Anh, TV | Chạm chữ cái theo thứ tự (tái dùng Sequence Trail) | Thấp |
| Chỉnh kim đồng hồ | Toán | Kéo kim giờ, kim phút | Trung bình |
| Đi chợ | Toán | Kéo tờ tiền để trả, tính tiền thối | Trung bình |
| Xây vườn | Toán | Tô ô lưới, tính chu vi/diện tích | Trung bình |
| Gõ phím phiêu lưu | Tin | Gõ đúng chữ rơi xuống, đo từ/phút | Trung bình |
| Robot tìm đường | Tin, Toán | Xếp khối lệnh trên lưới, lặp lại | Cao |
| Giải toán từng bước | Toán | Điền từng dòng lời giải, chấm từng bước | Cao |

## Thay đổi kỹ thuật trong mã nguồn

Các thay đổi đều cộng thêm, không phải viết lại; giữ nguyên luật sao, idempotency và chấm ở máy chủ.

| # | Việc | Tệp/chỗ sửa | Ghi chú |
| --- | --- | --- | --- |
| K0 | Thu hẹp khóa PostgreSQL từ workspace xuống học sinh/lượt chơi | `server/postgres-store.mjs` (`mutate`, dòng 62–65) | Việc chặn; đã có phương án D01 trong kế hoạch 02/11 |
| K1 | Thêm môn `informatics` (Tin học) và bỏ chặn 3–4 môn/tuần thành cấu hình | `contracts.ts` (`Subject`), `weekly-plan.ts` (`aliases`, `weeklyPlanErrors`) | Bốn môn mỗi tuần vẫn hợp lệ với luật hiện tại |
| K2 | Bảng `skills` (mã, môn, mạch, bài SGK, tiên quyết) + cột `skillId` trong mẫu Excel | migration SQL mới, `excel-import.ts`, `online-document-import.ts` | Cần tăng schema lên 2 cho cả SQLite và PostgreSQL |
| K3 | Tiến độ theo kỹ năng (tổng hợp từ `awards` hiện có) | `server/student-summary.mjs`, `question-journey.mjs` | Dùng cho bản đồ thế giới và báo cáo phụ huynh |
| K4 | Bộ sinh câu (generator) có hạt giống, chạy ở máy chủ | `src/core/generators/*.ts` mới, `question-protocol.mjs` | Đáp án không gửi xuống trình duyệt, giống câu hiện tại |
| K5 | Dạng câu mới: `compare`, `true-false`, `multi-blank`, `categorize`, `letter-order`, `clock`, `money` | `contracts.ts` (`ItemKind`), `validation.ts`, `game-compatibility.ts` | Mỗi dạng cần luật sao riêng trong `question-rewards.ts` |
| K6 | Game mới theo quy trình 6 bước của `GAME_SDK_V1.md` | `src/games/`, `registry.ts`, `loaders.ts` | Bắt đầu từ các game "độ khó làm thấp" |
| K7 | Nối `contest-mock` vào online: phiên thi có hạn giờ toàn đề, ma trận đề | `contest-runtime.ts`, API mới `/play/contest` | Thi thử nên tính điểm riêng, không cộng sao vào ví để tránh "cày" sao |
| K8 | Ôn tập ngắt quãng dùng `ReviewCard` | `curriculum.ts` (đã có kiểu dữ liệu), bảng `reviews` mới | Chỉ là lịch ôn, không cấp thêm sao cho câu đã 3 sao |
| K9 | Vai trò **phụ huynh** chỉ xem báo cáo, đặt giới hạn thời gian | `server/admin-data.mjs`, màn mới | Hiện chỉ có admin và student |
| K10 | Tách `game-base.css` theo màn, bật `checkJs` cho server | `src/styles/`, `tsconfig.json` | Nợ kỹ thuật, làm dần theo từng game mới |
| K11 | Thư viện học liệu dùng chung giữa các lớp (ngân hàng câu có duyệt) | `packs`, `week_sets` | Hiện mỗi workspace tự nhập riêng |

## Lộ trình, ưu tiên và rủi ro

Con đang học lớp 3 từ tháng 9/2026, nên lộ trình để giai đoạn 1 và 2 chạy song song từ 01/2027, kịp các vòng thi mùa xuân. Các mốc là ước tính cho một người phát triển kèm AI hỗ trợ soạn nội dung.

&#91;embedded content: lộ trình 4 giai đoạn · 3 cổng chuyển (mốc thời gian dự kiến)\]

Mỗi giai đoạn chỉ mở khi qua cổng phía trước; cổng đầu tiên là kỹ thuật, hai cổng sau là kết quả học của chính học sinh.

### Việc nên làm trong 4 tuần tới

1. Sửa khóa PostgreSQL (K0) và chạy lại thử tải 30 học sinh; nếu chỉ dùng bản local cho một gia đình/một lớp nhỏ thì việc này có thể lùi lại.
2. Chốt bộ SGK và viết danh mục kỹ năng Toán 3 trước (môn dễ sinh câu nhất), để làm mẫu cho ba môn còn lại.
3. Thêm môn Tin học và cột `skillId` vào mẫu Excel (K1, K2).
4. Làm hai game nhanh nhất: **Nhà vô địch bảng cửu chương** và **Cân thăng bằng**, kèm bộ sinh câu Toán.
5. Soạn 4 tuần học liệu đầu tiên bằng AI theo mẫu, duyệt tay, cho con chơi thử và ghi lại chỗ con vướng.

### Rủi ro và cách giảm

- **Nội dung sai kiến thức** khi soạn bằng AI: bắt buộc trạng thái `reviewed` trước khi giao; trường `reviewStatus` đã có.
- **Bản quyền**: không chép nguyên đề thi Violympic/IOE, bài đọc SGK hay tranh SGK; tự soạn theo dạng và ghi `source`/`rights`.
- **Trẻ "cày sao" ở game dễ**: đã có trần 3 sao/câu; thêm yêu cầu mỗi kỹ năng phải qua ít nhất một dạng bấm giờ.
- **Quá tải thời gian màn hình**: nhiệm vụ ngày 15–20 phút, giới hạn do phụ huynh đặt.
- **Phạm vi quá rộng**: làm trọn Toán trước rồi nhân rộng; không làm cùng lúc 4 môn × 10 game.

### Câu hỏi cần bạn chốt

- Con học bộ SGK nào: Kết nối tri thức, Chân trời sáng tạo hay Cánh diều? Tiếng Anh dùng Global Success hay bộ khác?
- Ứng dụng dùng cho một gia đình, một lớp hay nhiều trường? Việc này quyết định có cần làm K0 và vai trò phụ huynh ngay không.
- Con sẽ thi Violympic nhánh Toán Tiếng Việt, Toán Tiếng Anh hay cả hai?

### Nguồn

- [Hướng dẫn tổ chức kỳ thi IOE cấp tỉnh 2025–2026 (Thư viện Pháp luật)](https://thuvienphapluat.vn/hoi-dap-phap-luat/huong-dan-to-chuc-ky-thi-ioe-cap-tinh-20252026-chi-tiet-the-nao-138081605.html): khung giờ thi khối 3, điều kiện 50% câu đúng.
- Mã nguồn và tài liệu trong thư mục dự án: `docs/DANH_GIA_CHUYEN_SAU_2026-10-26.md`, `docs/KE_HOACH_TOI_UU_VA_PHAT_HANH_2026-11-02.md`, `docs/ONLINE_QUESTION_IMPORT.md`, `src/core/*`.
