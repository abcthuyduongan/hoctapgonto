# Kế hoạch chi tiết: tốc độ ảnh, xuất đáp án, đổi thưởng và thế giới game

Nov 4, 2026 · @abc

## Tóm tắt

**Làm tốc độ ảnh trước, xuất đáp án thứ hai, rồi mới xây thế giới game và cửa hàng quà.** Game hay đến đâu cũng mất hứng nếu mỗi thẻ hình phải chờ vài giây. Website đang chạy bản 3.9.0-rc.1 (commit `bc58393`), nên đây là vấn đề của bản hiện tại chứ không phải bản cũ.

1. **Tốc độ (2 tuần).** Mỗi tấm ảnh đang đi qua 5 chặng: Function, CSDL hai lần, Storage, rồi băm kiểm tra. Trình duyệt lại không được lưu cache, và ảnh gốc có thể nặng tới 2 MB. Kế hoạch: ảnh nén sẵn khi tải lên, đường dẫn có chữ ký để lấy thẳng từ kho, cache theo mã băm, tải trước cả bàn thẻ, đưa máy chủ về gần Việt Nam.
2. **Xuất câu hỏi và đáp án (1 tuần).** Xuất ra Excel đúng mẫu nhập hiện tại, kèm sheet thống kê tỉ lệ đúng từng câu, để bạn sửa và nhập lại ngay, hoặc soạn bộ tiếp theo.
3. **Đổi thưởng và thế giới game (6–7 tuần).** Theo tinh thần Munworld: học ra sao, chơi minigame ra vật liệu, xây thị trấn, sưu tập huy hiệu. Sao dành cho cửa hàng quà thật do phụ huynh lập, vật liệu dành cho thị trấn, nên con không phải chọn giữa quà thật và xây nhà.

Tài liệu này chỉ là kế hoạch. Chưa có dòng mã nào bị sửa.

## Chẩn đoán: vì sao câu có hình chậm và giật

Riêng việc gọi một Function đã tốn khoảng 250 ms, gấp 5 lần tệp tĩnh. Mỗi ảnh lại phải qua thêm CSDL và Storage. Số đo từ máy của bạn lúc 20h53 ngày 04/11:

| Yêu cầu | Thời gian | Ý nghĩa |
| --- | --- | --- |
| Tệp tĩnh qua CDN (`/icons/bao-an.svg`) | 53–61 ms | Đường mạng tới Netlify tốt |
| `/api/online/me` chưa đăng nhập (Function, gần như không làm gì) | 305–386 ms | Function nhiều khả năng đặt xa Việt Nam (mặc định của Netlify thường là Mỹ); cần xác nhận |
| `/api/online/status`, máy chủ đang chạy | 468–513 ms | Thêm một ít việc đã lên nửa giây |
| `/api/online/status`, lần đầu | 2.073 ms | Khởi động nguội khoảng 1,5 giây |
| Tải trang đầu | TTFB 1.206 ms, xong 2.204 ms | Chấp nhận được |
| Staging 26/10 (số cũ), 29 học sinh cùng lúc | p95 mở câu 11,9 s; 21/30 lượt lỗi | Khóa CSDL làm học sinh xếp hàng |

Mình chưa đăng nhập để đo ảnh thật, vì mình không nhập mật khẩu thay bạn. Đo ảnh thật là việc đầu tiên của kế hoạch (T0).

&#91;embedded content: đường đi của một tấm ảnh câu hỏi · 6 chặng\]

Bốn chặng giữa chạy trên máy chủ cho từng tấm ảnh, từng lượt chơi; chặng Storage nặng nhất vì luôn tải nguyên tệp.

### Bảy nguyên nhân tìm thấy trong mã

| # | Nguyên nhân | Bằng chứng trong mã | Ảnh hưởng |
| --- | --- | --- | --- |
| N1 | Mọi ảnh đi qua Function → CSDL → Storage, không lấy thẳng từ kho | `server/cloud-api.mjs` nhánh `/media/:id`: `getMedia` rồi `storage.download` | Mỗi ảnh vài trăm ms đến vài giây |
| N2 | Không cache ở đâu cả: header `no-store`, trình duyệt gọi `cache:'no-store'`, RAM bị xóa khi thoát lượt | `privateHeaders`, `question-image-loader.ts`, `QuestionMediaScope` | Chơi lại bài vẫn tải lại toàn bộ ảnh |
| N3 | Ảnh gốc không được nén hay thu nhỏ, tới 2 MB/tệp | `online-media-check.ts` chỉ kiểm tra hợp lệ | Tải lâu, giải mã nặng, giật trên điện thoại |
| N4 | Chỉ tải 2 ảnh cùng lúc | `question-image-loader.ts`: `active<2` | Bàn 12 thẻ hình = 6 đợt nối tiếp |
| N5 | Storage luôn tải nguyên tệp, kể cả khi chỉ cần một đoạn; băm 2 lần | `supabase-storage.mjs` + `cloud-api.mjs` | Tốn CPU và băng thông Function |
| N6 | Cache trên máy chủ chỉ 16 MB, 30 giây, riêng từng instance | `cacheMaxBytes`, `cacheTtlMs=30000` | Gần như không trúng cache trên serverless |
| N7 | Mọi thao tác ghi khóa cả workspace, kết nối CSDL `max:1` | `postgres-store.mjs` dòng 62–65, `cloud-config.mjs` | Mở câu, nộp đáp án xếp hàng khi nhiều em cùng học |

Cảm giác "giật" có hai nguồn: chờ mạng (N1, N2, N4, N7), và trình duyệt giải mã ảnh lớn (N3).

## Kế hoạch sửa tốc độ

Mục tiêu: ảnh câu hiện tại hiện ra trong ≤ 1 giây (p95). Bàn 12 thẻ hình sẵn sàng trong ≤ 3 giây. Chơi lại bài thì ảnh hiện ngay từ cache. Giữ nguyên luật "đồng hồ chỉ chạy khi ảnh đã hiện".

| Mã | Việc | Tệp cần sửa | Nghiệm thu | Giảm |
| --- | --- | --- | --- | --- |
| T0 | **Đo trước khi sửa**: thêm header `Server-Timing` (auth, db, storage, hash) cho mọi API; ghi thời gian tải từng ảnh ở trình duyệt; tra vùng của Netlify Functions và Supabase | `cloud-api.mjs` (đã có `measureApiSpan`), `question-image-loader.ts` | Bảng số p50/p95 cho 1 bài có hình và 1 bàn Trí Nhớ | — |
| T1 | **Nén ảnh khi tải lên**: trình duyệt của giáo viên thu ảnh về cạnh dài tối đa 1.024 px (ảnh câu) và 384 px (ảnh thẻ), WebP chất lượng 0,8. Giữ bản gốc riêng để xuất | `OnlineAdminDashboard.tsx` (bước chọn tệp), `online-media-check.ts`, bảng `media` thêm cột biến thể | Ảnh câu ≤ 150 KB, ảnh thẻ ≤ 40 KB; mã băm bản gốc không đổi | N3 |
| T2 | **Cache theo mã băm**: URL ảnh chứa SHA-256 (`/media/:id?v=<hash>`), trả `Cache-Control: private, max-age=31536000, immutable`; bỏ `cache:'no-store'` ở trình duyệt riêng cho ảnh. Âm thanh giữ nguyên cách cũ vì cần biên nhận nghe | `cloud-api.mjs`, `online-server.mjs`, `QuestionMedia.tsx`, `question-image-loader.ts` | Lần chơi thứ hai: 0 request ảnh tới Function | N2 |
| T3 | **Lấy ảnh thẳng từ Storage bằng URL có chữ ký**: khi mở lượt chơi, máy chủ kiểm quyền một lần rồi trả danh sách URL ký sẵn (hết hạn sau 30 phút) cho mọi ảnh của bộ. Trình duyệt tải thẳng từ CDN của Supabase, không qua Function | `supabase-storage.mjs` (`createSignedUrls`), `postgres-store.mjs` `startPlay`, CSP `img-src` trong `netlify.toml` | Không còn chặng 2–5 cho ảnh; vẫn kiểm quyền theo lượt | N1, N5, N6 |
| T4 | **Tải trước cả bàn**: game thẻ (Trí Nhớ, Nối Từ) hiện màn "Đang chuẩn bị thẻ…" có thanh tiến độ, tải song song 6 ảnh, giải mã bằng `img.decode()` trước khi mở bàn. Math Quest tải trước 2 câu kế (chỉ ảnh, không mở đồng hồ) | `question-image-loader.ts`, `MemoryMatch.tsx`, `WordConnect.tsx`, `MathQuest.tsx` | Bàn 12 thẻ ≤ 3 s; không còn thẻ trống khi chơi | N4, N3 |
| T5 | **Đưa máy chủ về gần**: đặt Netlify Functions và Supabase cùng vùng Singapore (ap-southeast-1); dùng Transaction pooler cổng 6543. Nếu gói Netlify không cho chọn vùng thì cân nhắc chạy API trên một VPS Singapore bằng `Dockerfile.online` đã có | Cấu hình Netlify/Supabase, `cloud-config.mjs` | `/api/online/me` ≤ 120 ms | Tất cả |
| T6 | **Thu hẹp khóa CSDL** từ workspace xuống học sinh/lượt chơi (việc D01 đã có trong kế hoạch 02/11) | `postgres-store.mjs` `mutate` | 30 em cùng lúc: 0 lỗi 5xx, mở câu p95 ≤ 0,8 s, không lệch sao | N7 |
| T7 | **Giảm khởi động nguội**: gọi `/status` ngay khi mở màn đăng nhập để "đánh thức" máy chủ; tùy chọn một Scheduled Function 5 phút/lần trong giờ học | `OnlineScreen.tsx`, `netlify/functions` | Lần vào bài đầu không chờ > 2 s | Cold start |

Thứ tự làm: T0 → T1 + T4 (ít rủi ro, thấy hiệu quả ngay) → T2 → T3 → T5 → T6 → T7.

Điều cần giữ khi sửa:

- Đồng hồ tính sao vẫn chỉ chạy sau khi ảnh hiện và sau khi nghe hết bài nghe.
- Ảnh thuộc workspace nào thì chỉ học sinh workspace đó mở được; URL ký sẵn có hạn ngắn.
- Tất cả 337 kiểm thử hiện có vẫn phải đạt. Thêm kiểm thử cho nén ảnh, cache theo mã băm và URL hết hạn.

## Xuất câu hỏi và đáp án

Một nút **"Xuất câu hỏi & đáp án (.xlsx)"** trong màn Học liệu tuần. Tệp xuất ra đúng 33 cột của mẫu nhập hiện tại, nên sửa xong có thể nhập lại ngay. Đáp án đã nằm sẵn trong `packs.json` trên máy chủ, không cần thêm dữ liệu.

### Phạm vi xuất

- Một tuần đã giao, toàn bộ tuần của một lớp, hoặc toàn bộ ngân hàng câu của đơn vị.
- Lọc theo môn, dạng câu, độ khó.
- Tùy chọn **kèm tệp ZIP** gồm Excel + toàn bộ ảnh và âm thanh gốc đúng tên tệp, để nhập lại sang máy khác hoặc lớp khác.

### Nội dung tệp Excel

| Sheet | Nội dung | Dùng để |
| --- | --- | --- |
| `Thông tin bộ` | Giống mẫu: `schema`, `formatVersion`, tuần, ngày xuất | Nhập lại được |
| `Câu hỏi` | 33 cột của mẫu: `subjectLabel`, `kind`, `prompt`, `A`–`D`, `answer`, `acceptedAnswers`, `words`, `left`/`right`, `hint`, `explanation`, `imageFile`, `audioFile`, `itemId`, `difficulty`… | Sửa rồi nhập lại; giữ `itemId` nên không mất sao cũ |
| `Thống kê` | Mỗi câu: số học sinh đã làm, tỉ lệ đúng ngay lần đầu, số lần sai trung bình, thời gian trung vị, phân bố 0–3 sao, đáp án sai hay chọn nhất | Biết câu nào quá dễ, quá khó, phương án nhiễu nào "bẫy" được nhiều em |
| `Gợi ý bộ sau` | Chủ đề có tỉ lệ đúng < 60%, số câu theo độ khó đã có | Biết cần soạn thêm gì |
| `Hướng dẫn` | Giữ nguyên từ mẫu | Người soạn hoặc AI đọc |

### Cách làm

1. API mới `GET /api/online/admin/export?weekId=…|classId=…|all=1`, chỉ vai trò admin, ghi một dòng vào bảng `audit`. Trả JSON các dòng câu hỏi (từ `packs.json`), tên tệp media (bảng `media`) và số liệu tổng hợp (từ `attempts`, `awards`). Làm ở cả `online-server.mjs` (SQLite) và `cloud-api.mjs` (PostgreSQL).
2. Trình duyệt dựng tệp .xlsx bằng `fflate` đã có sẵn trong dự án, dùng chung định nghĩa cột với `excel-import.ts` để xuất và nhập không lệch nhau.
3. ZIP media: tải từng tệp qua đường media hiện có (hoặc URL ký sẵn của T3), có thanh tiến độ, giới hạn 200 MB.
4. Với câu chấm bằng bộ sinh câu sau này (số ngẫu nhiên), xuất công thức mẫu thay cho đáp án cố định.

### Kiểm thử nghiệm thu

- **Khứ hồi:** xuất → nhập lại không sửa gì → hệ thống báo "nội dung trùng, không tạo bộ mới". Cả 8 dạng câu, có ảnh và âm thanh.
- **Quyền truy cập:** học sinh gọi API xuất nhận 403. Workspace khác không thấy dữ liệu.
- **Số liệu:** sheet Thống kê khớp với dữ liệu mẫu. Không có tên học sinh trong tệp nếu chọn "ẩn danh".

## Tham khảo Munworld

Cái hay nhất của [Munworld / Personal Learning Ground](https://munworld-explorer.vercel.app/) là **vòng lặp**: chơi minigame → trả lời đúng ra vật liệu → xây thị trấn riêng → mở huy hiệu → bạn bè thấy và cổ vũ. Câu hỏi nằm trong trò chơi, không phải trò chơi nằm quanh câu hỏi.

| Munworld có | Bảo An đã có | Nên làm |
| --- | --- | --- |
| Bản đồ khám phá địa điểm, động vật, món ăn | Danh sách trò chơi | Bản đồ 4 vùng theo môn; mỗi tuần mở một vùng mới |
| 8 minigame có bối cảnh (câu cá, đua thú, đập số, đuổi UFO, khoan mỏ, nấu ăn, ô số, câu hỏi ngày) | 5 cơ chế chơi, giao diện đơn giản | "Khoác áo" bối cảnh cho 5 cơ chế có sẵn, thêm 3 minigame mới |
| Vật liệu → nhà, cầu, hàng xóm động vật | Sao → tiền/quà | Thị trấn trả bằng vật liệu; sao giữ cho quà thật |
| Huy hiệu ghi rõ cách mở và độ khó | Không có | Bộ huy hiệu tính phía máy chủ, xem được điều kiện |
| Câu hỏi mỗi ngày, giữ chuỗi | Không có | Nhiệm vụ ngày + chuỗi ngày học |
| Bạn bè chỉ thấy hoạt động, không nhắn tin | Không có | Bảng tin lớp + nút "Cổ vũ", không có ô gõ chữ |
| Khu phụ huynh có mật khẩu, báo cáo tiến bộ, tự tạo bài | Admin quản lý lớp, nhập Excel | Vai trò phụ huynh, báo cáo tuần, giới hạn thời gian |
| Tiếng Việt và tiếng Anh | Tiếng Việt | Tùy chọn sau |

**Không được chép:** nhân vật Capy và Ducky, tên trò (Waddle Wall, Shoo Shoo UFO, InfiniDrill, Miniku), hình vẽ, bố cục và câu chữ của họ. Lấy ý tưởng vòng lặp, còn linh vật, tên trò và tranh phải là của Bảo An (Cáo và bốn bạn đồng hành có sẵn: cú, gấu, thỏ, mèo).

## Thiết kế đổi thưởng và thế giới game

Mỗi sao mới nhận được cũng sinh ra 1 vật liệu, nên xây thị trấn không bao giờ làm con mất sao dành cho quà thật. Luật sao hiện tại (tối đa 3 sao mỗi câu, lấy kết quả tốt nhất, máy chủ chấm) giữ nguyên.

&#91;embedded content: vòng thưởng · sao và vật liệu tách riêng\]

Cả sao và vật liệu đều tính trên máy chủ từ bảng `awards`, nên không sửa được từ trình duyệt.

### 1. Cửa hàng quà thật (ưu tiên số 1)

Thay ô "nhập mục tiêu tiền" hiện tại bằng một **kệ quà có hình** do phụ huynh/giáo viên lập.

| Phụ huynh khai báo | Ví dụ |
| --- | --- |
| Tên, hình hoặc biểu tượng | "Bộ lego nhỏ", "30 phút xem phim" |
| Giá (sao) | 120 sao |
| Loại | Đồ vật / Trải nghiệm / Đặc quyền / Tiền tiết kiệm (giữ kiểu quy đổi VNĐ cũ) |
| Giới hạn | Tối đa 1 lần/tuần, còn 3 món |
| Mở khóa | Sau khi hoàn thành tuần 4, hoặc đạt cấp 5 |

Luồng của con:

1. Xem kệ quà, **ghim một món làm mục tiêu**. Thanh tiến độ luôn hiện ngoài màn chính: "Còn 18 sao nữa là đổi được Bộ lego nhỏ".
2. Mỗi lần nhận sao trong game, sao bay vào thanh mục tiêu (hiệu ứng ngắn, tắt được).
3. Đủ sao thì nút **"Xin đổi quà"** sáng lên, kèm pháo giấy. Sao được giữ trong lúc chờ duyệt, như luồng `pending → approved → fulfilled` hiện có.
4. Phụ huynh duyệt và trao quà. Con bấm **"Con đã nhận quà"**, quà vào **Tủ kỷ niệm** với ngày nhận.

Thêm **Rương tuần**: hoàn thành tuần (mọi câu ≥ 2 sao) thì mở một rương chứa vật phẩm trang trí cho thị trấn. Rương ghi rõ bên trong có gì và không mua được bằng sao, để không thành kiểu "quay thưởng".

### 2. Thị trấn của con

- **Vật liệu theo môn:** Toán ra Đá, Tiếng Việt ra Gỗ, Tiếng Anh ra Cá, Tin học ra Linh kiện. Muốn xây thư viện cần cả Gỗ và Đá, nên con tự muốn học đều các môn.
- **Lưới 10 × 10 ô**, kéo thả nhà, cây, cầu, giếng, vườn, chợ, trường học. Công trình lớn mở theo cấp.
- **Hàng xóm động vật:** mỗi khi xong một chương SGK, một bạn động vật chuyển đến ở. Con đặt tên cho bạn ấy.
- **Tham quan thị trấn bạn cùng lớp** (chỉ xem, bấm "Cổ vũ").

### 3. Cấp độ, nhân vật, huy hiệu, nhiệm vụ ngày

- **Cấp độ** tính từ tổng sao đã kiếm (không giảm khi đổi quà). Mỗi cấp mở một trang phục cho Cáo hoặc bạn đồng hành con chọn.
- **Huy hiệu** ghi rõ cách mở và độ khó:

| Huy hiệu | Cách mở | Độ khó |
| --- | --- | --- |
| Thần tốc cửu chương | 20 phép nhân đúng trong 60 giây | Khó |
| Chăm chỉ | Học 7 ngày liên tiếp | Trung bình |
| Sửa sai giỏi | Làm lại đúng 10 câu từng sai | Dễ |
| Trí nhớ siêu đẳng | Hoàn thành bàn Trí Nhớ không lật sai lần nào | Khó |
| Tuần hoàn hảo | Mọi câu trong tuần đạt 3 sao | Khó |
| Nhà thám hiểm | Chơi đủ 5 loại minigame | Dễ |

- **Nhiệm vụ ngày khoảng 15 phút:** 1 bài mới, 1 bài ôn câu từng sai, 1 câu đố ngày. Hoàn thành thì giữ được chuỗi ngày. Phụ huynh đặt giới hạn thời gian chơi mỗi ngày.

### 4. Minigame: khoác bối cảnh cho cơ chế có sẵn

Mỗi minigame dùng đúng bộ câu đã giao và đúng luật sao. Chỉ đổi phần trình bày, nên không phát sinh nguồn sao mới.

| Minigame (tên tạm) | Dựa trên cơ chế | Cách chơi | Môn hợp |
| --- | --- | --- | --- |
| Cáo câu cá | Math Quest | Thả cần, cá cắn câu thì hiện câu hỏi; đúng thì kéo cá lên, ra vật liệu | Mọi môn |
| Đua thuyền trên sông | Math Quest (câu bấm giờ) | Trả lời nhanh để thuyền vượt lên; 3 sao = về nhất | Toán, Anh |
| Giải cứu ong | Một game mới | Chạm đúng các bông hoa mang số/từ thỏa điều kiện ("số chia hết cho 3") | Toán, TV |
| Lật thẻ kho báu | Memory Match | Mỗi cặp đúng mở một ô trên bản đồ kho báu | Mọi môn |
| Cầu nối đôi bờ | Nối Từ | Nối đúng thì xây được một nhịp cầu | TV, Anh |
| Bếp nhỏ của Cáo | Bậc Thang Quy Luật | Xếp các bước nấu ăn / các từ theo đúng thứ tự | TV, Tin |
| Xây câu lâu đài | Sentence Builder | Mỗi từ đặt đúng là một viên gạch | TV, Anh |
| Câu đố mỗi ngày | Math Quest, 1 câu | Một câu mới mỗi ngày, giữ chuỗi | Mọi môn |

Cảm giác "hay": pháo giấy khi 3 sao, âm thanh ngắn (đã có `sound.ts`), Cáo nói câu khen khác nhau, hiệu ứng sao bay về thanh mục tiêu. Mọi hiệu ứng đều tắt được, theo cài đặt giảm chuyển động đã có.

### 5. Bảng tin lớp và khu phụ huynh

- **Bảng tin lớp** chỉ hiện sự kiện có sẵn ("Mai vừa mở huy hiệu Chăm chỉ") và nút Cổ vũ. Không có ô gõ chữ, không nhắn tin.
- **Khu phụ huynh** khóa bằng mã PIN: lập kệ quà, duyệt đổi quà, xem báo cáo tuần (môn nào yếu, thời gian học, câu sai nhiều), đặt giới hạn thời gian.

## Thay đổi dữ liệu và mã nguồn

Mọi thay đổi đều cộng thêm, không viết lại. Schema tăng từ 1 lên 2 cho cả SQLite và PostgreSQL, bằng một migration chỉ thêm bảng và cột, không xóa dữ liệu cũ.

### Bảng và cột mới

| Bảng | Cột chính | Dùng cho |
| --- | --- | --- |
| `media` (thêm cột) | `variant_of`, `variant` (`card`/`question`), `width`, `height` | Ảnh nén sẵn (T1) |
| `gift_catalog` | `id`, `workspace_id`, `class_id?`, `title`, `image_media_id?`, `price_stars`, `kind`, `weekly_limit`, `stock?`, `unlock_rule?`, `active` | Kệ quà thật |
| `redemptions` (thêm trường trong `json`) | `giftId`, `receivedAt` | Liên kết quà, tủ kỷ niệm |
| `student_goal` | `student_id`, `gift_id`, `pinned_at` | Mục tiêu đã ghim |
| `materials_ledger` | `student_id`, `source_award_id`, `material`, `amount` | Vật liệu, tính lại được từ `awards` |
| `town_state` | `student_id`, `revision`, `json` (ô, công trình, hàng xóm) | Thị trấn; chống ghi đè bằng `revision` |
| `world_progress` | `student_id`, `region_id`, `place_id`, `discovered_at` | Bản đồ khám phá |
| `badge_awards` | `student_id`, `badge_id`, `awarded_at`, `evidence` | Huy hiệu |
| `daily_activity` | `student_id`, `day`, `minutes`, `quests_done` | Chuỗi ngày, nhiệm vụ ngày, giới hạn thời gian |
| `feed_events` | `class_id`, `student_id`, `type`, `ref`, `cheers` | Bảng tin lớp (không có nội dung gõ tay) |
| `users` (thêm vai trò) | `role='parent'`, `pin_hash`, liên kết `student_id` | Khu phụ huynh |

### API mới

| API | Vai trò | Ghi chú |
| --- | --- | --- |
| `GET /admin/export` | admin | Xuất câu và đáp án |
| `GET/POST/PATCH /gifts` | admin, parent | Lập kệ quà |
| `POST /redemptions` (mở rộng) | student | Nhận `giftId`; kiểm giới hạn tuần, tồn kho, điều kiện mở |
| `POST /goal` | student | Ghim mục tiêu |
| `GET /world`, `POST /world/discover` | student | Bản đồ, khám phá địa điểm |
| `GET /town`, `PUT /town` | student | Đặt công trình; máy chủ kiểm đủ vật liệu |
| `GET /badges`, `GET /feed`, `POST /feed/:id/cheer` | student | Huy hiệu, bảng tin |
| `GET /parent/report` | parent | Báo cáo tuần |

### Tệp mã chính

- `src/core/`: thêm `world.ts` (định nghĩa vùng, địa điểm), `economy.ts` (quy đổi sao sang vật liệu, giá công trình, cấp độ), `badges.ts` (luật huy hiệu dạng dữ liệu), `gift-catalog.ts` (kiểm tra hợp lệ, giống `reward-wallet.ts`). Các hàm thuần, dùng chung cho cả hai backend.
- `src/screens/`: `WorldMap.tsx` (màn chính mới, thay `StudentScreen.tsx`), `TownBuilder.tsx`, `GiftShop.tsx` (thay `OnlineWallet`), `BadgeBook.tsx`, `ParentSpace.tsx`.
- `src/games/`: thêm lớp "skin" quanh 5 game có sẵn (thuộc tính `presentation` trong `GameHostProps`), và game mới "Giải cứu ong" theo 6 bước trong `GAME_SDK_V1.md`.
- `server/`: `online-store.mjs` và `postgres-store.mjs` thêm các hàm tương ứng. Viết **bộ kiểm thử hợp đồng chung** chạy trên cả hai kho, để SQLite và PostgreSQL không lệch hành vi.
- `src/styles/`: CSS mới tách theo từng màn, không thêm vào `game-base.css` (đã hơn 4.000 dòng).
- Ảnh minh họa: vẽ mới hoặc tạo bằng AI theo phong cách tranh hiện có trong `public/art`, ghi giấy phép vào `ASSET_LICENSES`. Mỗi ảnh WebP ≤ 120 KB.

### Bất biến phải giữ (kiểm thử bắt buộc)

- Tổng sao kiếm được không đổi khi đổi giao diện hay minigame. Mỗi câu vẫn tối đa 3 sao.
- Sao khả dụng = sao kiếm − sao đang giữ/đã đổi. Xây thị trấn không trừ sao.
- Vật liệu tính lại được toàn bộ từ `awards`. Gửi lại một yêu cầu không tạo thêm vật liệu.
- Sao lưu và khôi phục giữ nguyên thị trấn, huy hiệu và kệ quà.

## Lộ trình và việc cần bạn cung cấp

Bạn đã chốt hướng **thế giới khám phá** kiểu Munworld, nên bản đồ trở thành màn chính của học sinh từ sprint 3. Hai sprint đầu làm nền cho nó: ảnh nhanh và công cụ soạn câu.

**Tiến độ (04/11):** đã làm xong phần mã của S1 và S2: cache ảnh, trả 304, nén ảnh khi tải lên, tải trước cả bàn thẻ, khóa CSDL chia sẻ cho học sinh, header Server-Timing, xuất câu hỏi và đáp án kèm thống kê. 251 kiểm thử và toàn bộ kiểm thử giao diện trên Chromium đều đạt. Còn lại: chọn vùng máy chủ trên Netlify/Supabase (bạn làm), đo lại trên website, thử tải 30 học sinh trên staging, và URL ký sẵn (chờ số đo). Chi tiết trong `docs/CAP_NHAT_TOC_DO_ANH_VA_XUAT_DAP_AN_2026-11-04.md`.

&#91;embedded content: 4 sprint · 3 cổng nghiệm thu (ước tính cho 1 người phát triển có AI hỗ trợ)\]

Mỗi sprint chỉ bắt đầu khi qua cổng phía trước. Cổng cuối đo bằng chính con bạn chơi thử, không chỉ bằng kiểm thử tự động.

### Thế giới khám phá (màn chính mới)

- **Bốn vùng trên một hòn đảo:** Đảo Số (Toán), Rừng Chữ (Tiếng Việt), Cảng English (Tiếng Anh), Phố Robot (Tin học), quanh Thị trấn của con ở giữa.
- **Mỗi tuần học = một địa điểm mới** trong mỗi vùng (bến cá, hang đá, chợ, thư viện…). Vào địa điểm là chơi minigame gắn bộ câu của tuần đó. Luật "mọi câu ≥ 2 sao mới sang tuần" hiện có trở thành "mở đường sang địa điểm kế".
- **Thẻ khám phá:** lần đầu đến mỗi địa điểm, Cáo kể một điều thú vị (con vật, món ăn, nơi chốn Việt Nam), có giọng đọc. Thẻ vào **Sổ khám phá** để sưu tập. Nội dung thẻ do bạn soạn trong Excel (thêm sheet `Địa điểm`).
- **Sương mù:** vùng chưa tới bị che, để con tò mò đi tiếp. Địa điểm đã qua thì sáng và có số sao.
- **Ôn tập lồng trong khám phá:** thỉnh thoảng có "khách ghé thăm" ở địa điểm cũ, mang theo câu con từng sai. Giúp khách thì được thêm vật liệu. Sao thì vẫn theo trần 3 sao mỗi câu.

### Việc cần bạn cung cấp trước sprint 1

- [x] Gói Netlify đang dùng và vùng của Functions; vùng của dự án Supabase (trong Supabase: Project Settings → General).
- [ ] Quyền xem log Netlify Functions, hoặc tự chạy bản đo T0 rồi gửi kết quả.
- [x] Một tuần học liệu có nhiều ảnh thật, để đo trước và sau khi sửa.
- [x] Chấp nhận để ảnh học liệu được lưu cache riêng trong trình duyệt của học sinh (T2). Đây là nội dung bài học, không phải dữ liệu cá nhân.
- [x] Danh sách 5–10 món quà thật và giá sao bạn muốn dùng (để cân chỉnh: một tuần 4 môn × 12 câu tối đa 144 sao).
- [ ] Đổi mật khẩu tài khoản `gonto`, vì mật khẩu đã hiện trong ảnh chụp gửi lên.

### Nguồn

- [Personal Learning Ground (Munworld)](https://munworld-explorer.vercel.app/): trang giới thiệu, xem ngày 04/11/2026.
- Số đo website: đo trực tiếp từ trình duyệt trên máy của bạn tới `gontogontet.netlify.app`, 20h53 ngày 04/11/2026, chưa đăng nhập.
- Mã nguồn trong thư mục dự án: `server/cloud-api.mjs`, `server/supabase-storage.mjs`, `server/postgres-store.mjs`, `server/cloud-config.mjs`, `src/core/question-image-loader.ts`, `src/components/QuestionMedia.tsx`, `src/core/reward-wallet.ts`, `docs/KE_HOACH_TOI_UU_VA_PHAT_HANH_2026-11-02.md`.
