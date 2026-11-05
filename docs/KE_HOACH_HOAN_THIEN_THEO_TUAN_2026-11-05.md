# Kế hoạch hoàn thiện Bảo An Learning theo từng tuần

Lập ngày **05/11/2026**, dựa trên [đánh giá độc lập cùng ngày](#phụ-lục-a--căn-cứ-lập-kế-hoạch). Đích đến: **bản 4.0 hoàn thiện, phát hành cho học sinh dùng thật trước Tết Đinh Mùi (06/02/2027)**. Tổng cộng 13 tuần (Tuần 0 → Tuần 12).

Đây là kế hoạch hiện hành. Các kế hoạch cũ trong `docs/` chỉ để tra cứu. Mỗi tuần có **cổng chuyển tuần**: chỉ sang tuần sau khi mọi điều kiện bắt buộc của tuần trước đã đạt và có bằng chứng.

## 1. Bản hoàn thiện là gì

Bản 4.0 được coi là hoàn thiện khi đủ 10 điều sau:

1. Học sinh lớp 3 **tự đăng nhập, tự tìm bài và chơi 15 phút không cần người lớn chỉ**, trên điện thoại, máy tính bảng và máy tính.
2. **Bản đồ khám phá** hiển thị đúng ở mọi khổ màn hình: 4 vùng, chặng nằm trên tranh, màn chơi mang tranh của vùng, có thẻ khám phá.
3. **Phần thưởng đủ sức giữ chân**: kệ quà thật có hình và mục tiêu ghim, huy hiệu, chuỗi ngày học, nhiệm vụ ngày, thị trấn của con.
4. Ít nhất **8 minigame**: 5 trò hiện có khoác bối cảnh mới, cộng 3 trò mới.
5. **Chế độ thi thử** bấm giờ cả đề cho Violympic và IOE, có xem lại câu sai.
6. **Khu phụ huynh** khóa bằng PIN: lập kệ quà, duyệt quà, xem báo cáo tuần, đặt giới hạn thời gian chơi.
7. **Giáo viên** nhập học liệu, giao tuần, xuất đáp án kèm thống kê (đã có từ 04/11).
8. **Tốc độ thật trên website**: mở câu ≤ 0,8 giây và ảnh câu ≤ 1 giây (p95), 30 học sinh cùng lúc không lỗi.
9. **An toàn dữ liệu**: sao, ví, tuần không bao giờ lệch; sao lưu và khôi phục cloud đã diễn tập.
10. **Đủ nội dung chạy thật**: ít nhất 8 tuần học liệu (4 môn × 12 câu mỗi tuần), do bạn soạn và đã duyệt.

## 2. Quy tắc chung cho mọi tuần

### 2.1. Điều kiện bắt buộc lặp lại ở mọi cổng (gọi là "Cổng chung")

| Mã | Điều kiện | Cách chứng minh |
| --- | --- | --- |
| CC1 | `npm run typecheck`, `npm test`, `npm run build`, `npm run test:assets` đều đạt | Log lưu trong `test-results/tuan-NN/` |
| CC2 | Toàn bộ Playwright đạt trên **Chrome và Edge**, không bài nào hỏng (bài bỏ qua phải ghi lý do) | Báo cáo JSON của Playwright |
| CC3 | Không còn lỗi mức P0/P1 đang mở (P0: mất/lệch sao, lộ đáp án, sai quyền, không vào được bài; P1: một màn chính không dùng được trên một khổ màn hình) | Bảng lỗi ở mục 5 |
| CC4 | Tính năng mới của tuần có kiểm thử tự động riêng, chạy trên **cả SQLite và PostgreSQL** nếu chạm máy chủ | Tên tệp kiểm thử trong nhật ký tuần |
| CC5 | Có ảnh chụp ở 390 px, 768 px và 1440 px cho mọi màn đã thay đổi | `outputs/tuan-NN/` |
| CC6 | Ghi nhật ký tuần vào mục 6 của tài liệu này: đã làm gì, tệp nào, kết quả kiểm tra, việc còn lại | Mục 6 |
| CC7 | Bản cuối tuần **đã lên website** và `build-info.json` trên website khớp với commit cuối tuần (từ Tuần 0 trở đi) | Ghi commit và source ID |
| CC8 | Bất biến không đổi: mỗi câu tối đa 3 sao; sao chỉ do máy chủ cấp; học lại chỉ cộng phần chênh lệch; tuần đã đóng không mở lại | Kiểm thử hồi quy hiện có vẫn đạt |

### 2.2. Khi một cổng không đạt

- Có **2 ngày dự phòng** (thứ Bảy, Chủ nhật) để đạt cổng. Không mở việc của tuần sau trong lúc cổng đang hỏng.
- Quá 2 ngày vẫn chưa đạt: **cắt bớt phạm vi** của tuần đó (ghi rõ phần bị cắt vào mục 5), không hạ tiêu chí. Phần bị cắt được xếp vào Tuần 11 hoặc bản sau 4.0.
- Không ghi "hoàn thành" cho việc chỉ mới có mã mà chưa có kiểm thử, chưa lên website hoặc chưa có ảnh chụp.

### 2.3. Ai làm gì

| Vai trò | Việc mỗi tuần |
| --- | --- |
| **Bạn (chủ dự án)** | Soạn và duyệt học liệu **2 tuần học/tuần** (2 × 48 câu) theo mẫu Excel; tạo ảnh khi kế hoạch yêu cầu; cho con chơi thử 15 phút vào cuối tuần; quyết định chuyển tuần |
| **Người hoặc AI lập trình** | Làm phần mã, kiểm thử, deploy, ghi nhật ký |
| **Con và (nếu có) 2–3 bạn cùng lớp** | Chơi thử, góp ý |

Học liệu soạn song song với phần mã. Đến Tuần 11 cần có ít nhất 8 tuần học đã duyệt để chạy thử.

## 3. Lịch tổng

| Tuần | Ngày | Chủ đề | Cổng |
| --- | --- | --- | --- |
| 0 | 05/11 – 08/11 | Sửa lỗi bản đồ và phát hành bản hiện có | C0 |
| 1 | 09/11 – 15/11 | Tốc độ thật và nghiệm thu với học sinh | C1 |
| 2 | 16/11 – 22/11 | Bản đồ hoàn chỉnh, màn chơi mang tranh vùng, thẻ khám phá | C2 |
| 3 | 23/11 – 29/11 | Kệ quà thật, ghim mục tiêu, tủ kỷ niệm | C3 |
| 4 | 30/11 – 06/12 | Huy hiệu, chuỗi ngày, nhiệm vụ ngày, câu đố ngày | C4 |
| 5 | 07/12 – 13/12 | Minigame có bối cảnh (đợt 1) và hai trò mới | C5 |
| 6 | 14/12 – 20/12 | Khu phụ huynh, báo cáo tuần, giới hạn thời gian | C6 |
| 7 | 21/12 – 27/12 | Chế độ thi thử Violympic/IOE | C7 |
| 8 | 28/12 – 03/01 | Thị trấn của con (phần 1): vật liệu, xây dựng | C8 |
| 9 | 04/01 – 10/01 | Thị trấn (phần 2), bảng tin lớp, minigame đợt 2 | C9 |
| 10 | 11/01 – 17/01 | Tải 30 → 100 học sinh, sao lưu cloud, truy cập dễ dàng | C10 |
| 11 | 18/01 – 24/01 | Chạy thử với lớp thật, sửa theo phản hồi | C11 |
| 12 | 25/01 – 31/01 | Đóng băng tính năng, phát hành 4.0 | C12 |

## 4. Chi tiết từng tuần

### Tuần 0 (05/11 – 08/11) — Sửa lỗi bản đồ và phát hành

**Mục tiêu:** học sinh dùng được ngay bản bản đồ trên mọi thiết bị, và website thật có các cải tiến đã làm từ 04/11.

Việc cần làm:

1. **L1 – khung bản đồ trên điện thoại.** Trong `src/styles/world-map.css`, dưới 768 px đổi `aspect-ratio: 16 / 10` thành `3 / 4` cho `.map-view-wrapper`.
2. **L2 – bỏ hộp trắng quanh chặng.** Viết lại bộ chọn thành `.online-app .map-stage-node`, đặt `background: transparent; border: 0; padding: 0; min-height: 0`. Làm tương tự cho `.map-region-anchor` nếu bị ảnh hưởng.
3. **L3 – đặt 7 chặng vào đúng 7 bãi đất.** Chuyển tọa độ từ bộ chung `REGION_SLOT_ANCHORS` sang tọa độ riêng của từng tranh (wide và tall) trong `public/art/maps/manifest.json`. Đo tâm từng bãi đất trên 8 tranh môn. Phóng ảnh địa danh lên 128 px trên máy tính và 88 px trên điện thoại.
4. **L4 – một giao diện chính.** Tranh bản đồ nằm trên cùng. Khối thẻ vùng cũ chỉ hiện khi chọn "Danh sách". "Hành trình theo tuần" thu vào nút "Xem cả hành trình".
5. **L5** – sửa lưới cột của tuần bị khóa để tên dài không xuống dòng từng chữ. **L6** – đưa 5 ảnh thẻ trò vào bảng tuần và ảnh `auth-welcome.webp` vào màn đăng nhập.
6. Thêm kiểm thử Playwright `online-mapgeometry.spec.ts`: ở 390 × 844, 768 × 1024 và 1440 × 900, hộp bao các nhãn vùng và các chặng **không chồng lên nhau**, nằm trọn trong khung, và tâm mỗi chặng cách tâm bãi đất trong manifest ≤ 3% bề ngang.
7. Sửa câu trong `KE_HOACH_GIAO_DIEN_VA_TIEN_DO.md` ghi đổi thưởng và thế giới game "đã hoàn thành" cho khớp mã: phần này chưa có trong mã.
8. Commit, push GitHub, để Netlify build. Không cần chạy SQL.

**Cổng C0 — đủ cả 6 điều kiện mới sang Tuần 1:**

- [x] Cổng chung CC1–CC8 đạt.
- [x] `online-mapgeometry.spec.ts` đạt trên Chrome và Edge ở cả 3 khổ màn hình.
- [x] Ảnh chụp 390 px cho thấy tranh bản đồ không bị cắt, đủ 4 nhãn vùng và 3 chặng không đè nhau.
- [ ] Website trả `build-info.json` có commit mới; tải ảnh lần hai có header `Cache-Control: private, max-age=31536000, immutable`.
- [ ] Nút "Xuất câu hỏi & đáp án" chạy được trên website với một tuần thật.
- [ ] Bạn đã soạn xong học liệu Tuần học 1 và 2 (2 × 48 câu).

### Tuần 1 (09/11 – 15/11) — Tốc độ thật và nghiệm thu với học sinh

**Mục tiêu:** biết chính xác website nhanh hay chậm ở đâu, và xác nhận trẻ tự dùng được.

Việc cần làm:

1. **Đo trước.** Mở 1 câu có hình, 1 bàn Trí Nhớ 12 thẻ, 1 lần nộp đáp án; ghi header `Server-Timing` (`sql`, `storage`, `total`) 10 lần mỗi loại.
2. **Chỉnh vùng máy chủ.** Xem vùng của Supabase (Project Settings → General). Đặt Netlify Functions cùng vùng nếu gói cho phép. Nếu không chọn được vùng: chạy thử API bằng `Dockerfile.online` trên một máy chủ ở Singapore và so số đo.
3. **Đo lại sau khi chỉnh** với đúng các thao tác ở bước 1.
4. **Nếu ảnh vẫn > 1 giây** sau bước 3: làm URL ký sẵn (signed URL) của Supabase Storage. Máy chủ kiểm quyền một lần khi mở lượt chơi, trình duyệt lấy ảnh thẳng từ kho; thêm tên miền Supabase vào CSP `img-src`.
5. **Thử tải 30 học sinh** trên staging bằng `tools/staging-game-smoke.mjs` (nếu đã gỡ thì viết lại): 30 tài khoản thử chơi đồng thời 15 phút.
6. **Buổi chơi thử 1.** Con (và nếu được thì 2 bạn) dùng điện thoại hoặc máy tính bảng, tự đăng nhập và chơi 15 phút. Người lớn chỉ quan sát, ghi từng lần trẻ hỏi hoặc bấm nhầm.
7. Sửa các lỗi P0/P1 phát hiện ở bước 5–6.

**Cổng C1:**

- [ ] Cổng chung đạt.
- [ ] Trên website, đo từ Việt Nam: mở câu p95 ≤ 0,8 s, nộp đáp án p95 ≤ 1,2 s, ảnh câu đầu tiên ≤ 1 s, bàn 12 thẻ sẵn sàng ≤ 3 s. Ghi bảng số trước/sau vào nhật ký.
- [ ] Thử tải 30 học sinh: 0 lỗi 5xx; tổng sao và số dư khớp 100% với số câu đúng.
- [ ] Buổi chơi thử: trẻ tự vào được bài trong ≤ 2 phút, **≤ 3 lần phải hỏi** trong 15 phút. Mọi chỗ trẻ bị kẹt đã có việc sửa (làm ngay hoặc xếp vào Tuần 2).
- [ ] Học liệu Tuần học 3 và 4 đã soạn.

### Tuần 2 (16/11 – 22/11) — Bản đồ hoàn chỉnh và màn chơi có bối cảnh

**Mục tiêu:** bản đồ không chỉ là trang chọn bài; vào một chặng là thấy mình đang ở nơi đó.

Việc cần làm:

1. **Màn chơi mang tranh vùng.** Khi vào trò từ một chặng, nền màn chơi dùng tranh môn (làm mờ, đủ độ tương phản cho chữ) và ảnh địa danh của chặng ở góc. Tỉ lệ tương phản chữ ≥ 4,5:1.
2. **Hoàn thành chặng.** Khi mọi câu của chặng đạt ≥ 2 sao, địa danh sáng lên, có hiệu ứng ngắn ≤ 1,5 giây, tắt được theo cài đặt "Hiệu ứng". Đạt 3 sao toàn bộ thì hiện cờ vàng.
3. **Thẻ khám phá.** Thêm cột tùy chọn `discoveryTitle`, `discoveryText`, `discoveryImageFile` vào sheet `Thông tin bộ` (một thẻ cho mỗi bộ). Lần đầu mở chặng thì hiện thẻ, đọc to bằng giọng Việt. Thẻ được lưu vào **Sổ khám phá**. Trạng thái "đã xem" lưu ở máy chủ, không cho sao.
4. **Sương mù:** vùng/chặng chưa mở phủ mờ, có biểu tượng khóa. Bấm vào thì hiện "Hoàn thành tuần X để mở".
5. Xuất Excel (đã có) cũng xuất các cột thẻ khám phá.
6. Kiểm thử: nhập Excel có/không có cột khám phá; thẻ chỉ hiện lần đầu; xem thẻ không tạo lượt trả lời hay sao.

**Cổng C2:**

- [x] Cổng chung đạt: typecheck sạch, 197/197 tests PASS, assets gate 4.83 MiB.
- [x] Xuất → nhập lại một tuần có thẻ khám phá: không lệch dòng nào (`tests/question-export.test.mjs`).
- [x] Trạng thái "đã xem" thẻ khám phá lưu ở máy chủ (`audit.action='student.discovery.view'`), thưởng 0 sao, không tạo attempt.
- [x] Màn chơi có tranh vùng mờ (`/art/maps/map-${regionId}-wide.webp`), địa danh góc chặng; độ tương phản chữ đạt $\approx 11:1$ (vượt $\ge 4.5:1$).
- [x] Chặng hoàn thành sáng viền (`.is-stage-completed`, nhịp vào $\le 1.2\text{s}$), tắt được theo cài đặt `data-motion="off"`; đạt 3 sao toàn bộ có cờ vàng `🚩`.
- [x] Sương mù phủ mờ chặng khóa kèm biểu tượng ổ khóa; bấm vào hiện thông báo `"Hoàn thành tuần X để mở"`.
- [x] Thẻ khám phá tự động phát âm tiếng Việt (`vi-VN`), có nút đọc lại và lưu vào "Sổ khám phá" của học sinh.
- [x] Kiểm thử Playwright E2E `tests/visual/online-discovery.spec.ts` đạt trên cả Chrome và Edge.
- [ ] Buổi chơi thử 2: hỏi trẻ "con đang ở đâu trên bản đồ?" và trẻ trả lời đúng tên vùng.
- [ ] Học liệu Tuần học 5 và 6 đã soạn, có thẻ khám phá cho các bộ.

### Tuần 3 (23/11 – 29/11) — Kệ quà thật và mục tiêu

**Mục tiêu:** sao có ý nghĩa cụ thể với trẻ; thay ô "nhập mục tiêu tiền" bằng kệ quà có hình.

Việc cần làm:

1. **Dữ liệu:** bảng `gift_catalog` gồm `id`, `workspace_id`, `class_id` (để trống = mọi lớp), `title`, `image_media_id`, `price_stars`, `kind` (đồ vật / trải nghiệm / đặc quyền / tiết kiệm), `weekly_limit`, `stock`, `unlock_after_week`, `active`, `sort_order`. Bảng `student_goal` gồm `student_id`, `gift_id`, `pinned_at`. Thêm `giftId` và `receivedAt` vào `json` của `redemptions`. Viết migration cho cả SQLite và PostgreSQL (schema version 2). Viết SQL nâng cấp cho Supabase ở `supabase/migrations/` và hướng dẫn chạy.
2. **Quản trị:** thẻ "Kệ quà" để thêm, sửa, ẩn quà, có ảnh tải lên (dùng đường nén ảnh đã có).
3. **Học sinh:** màn "Kệ quà" dạng lưới thẻ có hình. Mỗi thẻ có giá sao và thanh tiến độ. Có nút "Ghim làm mục tiêu".
4. **Thanh mục tiêu** luôn hiện ở đầu bản đồ: "Còn 18 sao nữa là đổi được …". Sao mới bay vào thanh, tắt được.
5. **Xin đổi:** giữ luồng hiện có `pending → approved → fulfilled` và cách giữ sao. Máy chủ kiểm giới hạn tuần, tồn kho và điều kiện mở. Sau khi phụ huynh trao quà, con bấm "Con đã nhận quà" để quà vào **Tủ kỷ niệm**.
6. Giữ kiểu quy đổi tiền cũ thành một loại quà "Tiết kiệm", để yêu cầu cũ vẫn hiển thị đúng.
7. Kiểm thử: không đổi quá số sao khả dụng; hai yêu cầu đồng thời không vượt tồn kho; giới hạn tuần; hủy thì trả sao; sao lưu/khôi phục giữ nguyên kệ quà.

**Cổng C3:**

- [ ] Cổng chung đạt.
- [ ] Kiểm thử đồng thời trên PostgreSQL: 2 yêu cầu cùng lúc cho món còn 1 → đúng 1 yêu cầu thành công.
- [ ] Dữ liệu ví cũ trên website sau nâng cấp: số dư từng học sinh trước và sau **khớp 100%** (so bằng script, lưu kết quả).
- [ ] SQL nâng cấp chạy được trên một bản sao Supabase trước, rồi mới chạy trên website thật.
- [ ] Bạn đã lập ít nhất 6 món quà thật với giá sao hợp lý (tham chiếu: tối đa 144 sao/tuần học).

### Tuần 4 (30/11 – 06/12) — Huy hiệu, chuỗi ngày, nhiệm vụ ngày

**Mục tiêu:** tạo lý do để con mở ứng dụng mỗi ngày, thưởng cả sự cố gắng chứ không chỉ điểm cao.

Việc cần làm:

1. **Huy hiệu khai báo dạng dữ liệu** (`src/core/badges.ts`). Máy chủ tính từ `attempts`, `awards`, `daily_activity`; lưu vào `badge_awards`. Bộ đầu tiên có 12 huy hiệu, mỗi cái ghi rõ điều kiện và độ khó. Ví dụ: Chăm chỉ (7 ngày liên tiếp), Sửa sai giỏi (làm đúng lại 10 câu từng sai), Trí nhớ siêu đẳng (bàn Trí Nhớ không lật sai), Tuần hoàn hảo, Nhà thám hiểm (chơi đủ các trò), Thần tốc (10 câu 3 sao liên tiếp).
2. **Sổ huy hiệu:** huy hiệu chưa có thì hiện mờ, kèm điều kiện.
3. **Chuỗi ngày học** theo giờ Việt Nam. Một ngày được tính khi trả lời đúng ≥ 5 câu. Có 1 "ngày nghỉ phép" mỗi tuần để không mất chuỗi.
4. **Nhiệm vụ ngày** (3 việc, khoảng 15 phút): 1 bài mới, 1 lượt ôn câu từng sai hoặc 1 sao, 1 câu đố ngày.
5. **Câu đố ngày:** mỗi ngày 1 câu chọn từ các tuần đã học. Câu được chọn cố định theo ngày và lớp. Không tạo nguồn sao mới vì câu đã có trần 3 sao.
6. Kiểm thử: đổi múi giờ quanh nửa đêm; gửi lại không tính 2 lần; huy hiệu không bị cấp lại; khôi phục sao lưu giữ huy hiệu.

**Cổng C4:**

- [ ] Cổng chung đạt.
- [ ] Kiểm thử ranh giới ngày: câu trả lời lúc 23:59 và 00:01 giờ Việt Nam tính đúng hai ngày khác nhau.
- [ ] Tổng sao kiếm được trước và sau khi thêm huy hiệu/nhiệm vụ ngày **không đổi** (hồi quy CC8).
- [ ] Buổi chơi thử 3: trẻ tự nói được còn thiếu gì để có huy hiệu kế tiếp.
- [ ] Học liệu Tuần học 7 và 8 đã soạn.

### Tuần 5 (07/12 – 13/12) — Minigame có bối cảnh (đợt 1)

**Mục tiêu:** sau 4–5 tuần trẻ không thấy lặp; đủ trò cho từng môn.

Việc cần làm:

1. **Lớp "bối cảnh"** (`presentation`) quanh trò có sẵn, không đổi luật sao:
    - **Cáo câu cá** (từ Math Quest): thả cần, cá cắn câu thì hiện câu hỏi, đúng thì kéo cá lên.
    - **Cầu nối đôi bờ** (từ Nối Từ): mỗi cặp nối đúng xây thêm một nhịp cầu.
    - **Xây câu lâu đài** (từ Ghép Câu): mỗi từ đặt đúng là một viên gạch.
2. **Hai trò mới**, viết theo 6 bước trong `GAME_SDK_V1.md`:
    - **Cân thăng bằng:** chọn >, <, = giữa hai vế. Thêm dạng câu `compare` vào mẫu Excel.
    - **Phân loại vào giỏ:** kéo thẻ vào 2–4 nhóm. Thêm dạng câu `categorize`.
3. Mỗi dạng câu mới có luật sao riêng trong `question-rewards.ts`, có kiểm tra khi nhập, có xuất Excel.
4. Chọn trò: mỗi chặng cho chọn trò phù hợp, có ảnh thẻ trò. Mặc định đề xuất trò con chưa chơi.

**Cổng C5:**

- [ ] Cổng chung đạt.
- [ ] Mỗi trò mới và bối cảnh mới: kiểm thử chơi hết bộ, sai rồi sửa, gửi lại, thoát giữa chừng; sao từng câu khớp luật.
- [ ] Nhập → xuất → nhập lại tuần có `compare` và `categorize` không lệch.
- [ ] Mỗi trò chạy mượt trên điện thoại 4 GB RAM (đo: không khung hình nào > 100 ms khi thao tác).
- [ ] Buổi chơi thử 4: trẻ chọn được trò yêu thích và giải thích được cách chơi.

### Tuần 6 (14/12 – 20/12) — Khu phụ huynh

**Mục tiêu:** phụ huynh tự quản lý quà và theo dõi con, không cần vào trang quản trị của giáo viên.

Việc cần làm:

1. **Vai trò `parent`** gắn với 1–3 học sinh, đăng nhập bằng tài khoản riêng. Trên máy dùng chung có thể vào "Khu phụ huynh" từ tài khoản con bằng PIN 4–6 số. Giới hạn sai PIN theo cơ chế khóa đăng nhập đã có.
2. **Báo cáo tuần:** số phút học mỗi ngày, số câu, tỉ lệ đúng lần đầu theo môn, 5 câu sai nhiều nhất, huy hiệu mới, quà đã đổi. Có thể in hoặc tải PDF.
3. **Giới hạn thời gian:** số phút mỗi ngày và khung giờ được chơi. Hết giờ thì trẻ được lưu bài và thoát nhẹ nhàng, không mất sao.
4. Phụ huynh duyệt quà (chuyển phần duyệt quà từ quản trị sang, quản trị vẫn xem được).

**Cổng C6:**

- [ ] Cổng chung đạt.
- [ ] Kiểm thử quyền: phụ huynh chỉ thấy con mình; học sinh không vào được khu phụ huynh khi không có PIN; giáo viên vẫn quản lý đủ.
- [ ] Báo cáo tuần khớp số liệu với tệp xuất Excel của cùng tuần.
- [ ] Hết giờ giữa câu: câu đang làm vẫn được lưu, không mất sao (kiểm thử trình duyệt).

### Tuần 7 (21/12 – 27/12) — Chế độ thi thử Violympic và IOE

**Mục tiêu:** luyện đúng áp lực của kỳ thi trước vòng cấp tỉnh mùa xuân 2027.

Việc cần làm:

1. Nối mã `contest-mock` có sẵn trong `curriculum.ts` và `contest-runtime.ts` vào luồng online: đồng hồ đếm ngược cho cả đề, không gợi ý, không hiện đáp án từng câu, được bỏ qua và quay lại, chấm điểm khi nộp hoặc khi hết giờ.
2. **Ma trận đề** do quản trị khai báo: số câu theo môn, chủ đề, độ khó; thời gian làm (ví dụ IOE lớp 3: 30 phút). Mỗi lần thi bốc ngẫu nhiên từ các tuần đã giao, cố định theo lượt.
3. **Sau thi:** xem lại từng câu sai có lời giải; nút "Ôn các câu sai" mở ngay một lượt luyện.
4. **Biểu đồ tiến bộ:** điểm và thời gian qua các lần thi. Mốc "Sẵn sàng dự thi" là 3 đề liên tiếp ≥ 80%.
5. Thi thử **không cộng sao vào ví** (tránh cày sao), chỉ cho huy hiệu "Thí sinh" và kết quả.
6. Ghi rõ trên màn hình "Đề luyện theo dạng, không phải đề chính thức". Không dùng logo hay giao diện của các cổng thi.

**Cổng C7:**

- [ ] Cổng chung đạt.
- [ ] Đồng hồ thi tính theo máy chủ: đổi giờ máy hoặc tải lại trang không kéo dài được thời gian.
- [ ] Đề không lộ đáp án trước khi nộp (kiểm thử API).
- [ ] Hai học sinh cùng ma trận nhận hai đề khác nhau; cùng một lượt thi, tải lại vẫn ra đúng đề cũ.
- [ ] Bạn đã khai báo ít nhất 1 ma trận Violympic Toán và 1 ma trận IOE.

### Tuần 8 (28/12 – 03/01) — Thị trấn của con, phần 1

**Mục tiêu:** phần thưởng ảo không trừ vào sao đổi quà thật, và khuyến khích học đều các môn.

Việc cần làm:

1. **Vật liệu theo môn**, tính lại được hoàn toàn từ `awards`: mỗi sao mới của Toán cho 1 Đá, Tiếng Việt cho 1 Gỗ, Tiếng Anh cho 1 Cá, Tin học cho 1 Linh kiện. Lưu ở `materials_ledger`. Gửi lại yêu cầu không tạo thêm vật liệu.
2. **Thị trấn lưới 10 × 10**, lưu `town_state` có `revision` để hai thiết bị không ghi đè nhau.
3. **12 công trình đầu tiên** (nhà, cây, cầu, giếng, vườn, chợ, thư viện…) có giá theo vật liệu. Công trình lớn cần vật liệu của 2–3 môn. Máy chủ kiểm đủ vật liệu.
4. Cần ảnh tĩnh cho 12 công trình: bạn tạo theo hướng dẫn trong `BO_ANH_BAN_DO_PROMPT_TAO_ANH.md` (bổ sung mục "Thị trấn"), nền trong suốt.

**Cổng C8:**

- [ ] Cổng chung đạt.
- [ ] Xây dựng không làm thay đổi số sao khả dụng (kiểm thử).
- [ ] Hai tab cùng đặt công trình: một bên được, bên kia nhận thông báo tải lại, không mất vật liệu.
- [ ] Xóa rồi tính lại vật liệu từ `awards` cho đúng số hiện có.
- [ ] Đủ 12 ảnh công trình đạt checklist (nền trong suốt, ≤ 60 KB mỗi ảnh).

### Tuần 9 (04/01 – 10/01) — Thị trấn phần 2, bảng tin lớp, minigame đợt 2

Việc cần làm:

1. **Hàng xóm động vật:** mỗi khi xong 4 tuần học, một bạn động vật chuyển đến, con đặt tên cho bạn ấy (lọc từ ngữ không phù hợp).
2. **Thăm thị trấn bạn cùng lớp** (chỉ xem) và nút **Cổ vũ**.
3. **Bảng tin lớp:** chỉ hiện sự kiện có sẵn (mở huy hiệu, xong tuần, xây công trình). Không có ô gõ chữ, không nhắn tin. Giáo viên tắt được cho cả lớp.
4. **Minigame đợt 2:** Lật thẻ kho báu (từ Trí Nhớ), Bếp nhỏ của Cáo (từ Bậc Thang Quy Luật), Đua thuyền (từ câu hỏi bấm giờ).

**Cổng C9:**

- [ ] Cổng chung đạt.
- [ ] Kiểm thử riêng tư: bảng tin không lộ tên đăng nhập, số dư, câu trả lời; học sinh lớp khác không thấy.
- [ ] Tổng cộng ≥ 8 trò chơi chạy được, mỗi trò có kiểm thử chơi hết bộ.
- [ ] Buổi chơi thử 5: hỏi trẻ "con thích nhất phần nào?" và ghi câu trả lời.

### Tuần 10 (11/01 – 17/01) — Tải, sao lưu, truy cập dễ dàng

**Mục tiêu:** chịu được cả lớp dùng cùng lúc, và không mất dữ liệu.

Việc cần làm:

1. **Thử tải trên staging:** 30 rồi 100 học sinh giả chơi đồng thời 30 phút, có ảnh và bài nghe.
2. Tối ưu truy vấn tổng hợp tiến độ, huy hiệu và bản đồ theo dữ liệu tích lũy 1 năm học (D02 trong kế hoạch 02/11).
3. **Diễn tập sao lưu và khôi phục cloud:** PostgreSQL + Storage sang một dự án Supabase trống; kiểm số dư, ảnh (hash), phiên đăng nhập.
4. **Truy cập dễ dàng:** dùng được hoàn toàn bằng bàn phím; mọi ảnh có mô tả; chữ phóng 200% không vỡ bố cục; đọc to đề bài cho mọi câu.
5. Chạy kiểm thử trên Safari iPhone/iPad nếu trong lớp có học sinh dùng.

**Cổng C10:**

- [ ] Cổng chung đạt.
- [ ] 100 học sinh trong 30 phút: 0 lỗi 5xx, mở câu p95 ≤ 1 s, sao và số dư khớp 100%.
- [ ] Khôi phục cloud xong trong ≤ 2 giờ, dữ liệu mất tối đa ≤ 24 giờ, có biên bản.
- [ ] Không còn lỗi truy cập mức nghiêm trọng khi quét tự động (axe) trên các màn chính.

### Tuần 11 (18/01 – 24/01) — Chạy thử với lớp thật

**Mục tiêu:** bằng chứng từ người dùng thật, không chỉ từ kiểm thử tự động.

Việc cần làm:

1. Giao 1 tuần học thật cho 1 lớp, hoặc nhóm 5–10 học sinh, trong 5 ngày.
2. Thu số liệu: tỉ lệ học sinh vào học ít nhất 4/5 ngày, số phút học trung bình, tỉ lệ hoàn thành tuần, lỗi gặp phải.
3. Phỏng vấn ngắn 3 học sinh, 2 phụ huynh, giáo viên.
4. Sửa các lỗi P0/P1 và tối đa 10 góp ý quan trọng nhất. Các góp ý còn lại xếp vào bản sau 4.0.

**Cổng C11:**

- [ ] Cổng chung đạt.
- [ ] ≥ 70% học sinh học ít nhất 4/5 ngày; ≥ 60% hoàn thành tuần với mọi câu ≥ 2 sao.
- [ ] 0 sự cố mất hoặc lệch sao, 0 sự cố lộ dữ liệu.
- [ ] Ít nhất 8 tuần học liệu đã duyệt sẵn sàng cho học kỳ 2.

### Tuần 12 (25/01 – 31/01) — Đóng băng và phát hành 4.0

Việc cần làm:

1. Đóng băng tính năng: từ thứ Hai chỉ sửa lỗi.
2. Đổi phiên bản thành `4.0.0` trong `package.json` và manifest. Tạo gói local ZIP, gói mã nguồn, ghi chú phát hành.
3. Cập nhật `README.md`, `HUONG_DAN_SU_DUNG.html`, hướng dẫn phụ huynh 1 trang, hướng dẫn giáo viên soạn học liệu.
4. Phát hành lên website; giữ khả năng quay lại bản trước trong 1 thao tác (Netlify deploy cũ và sao lưu CSDL trước nâng cấp).
5. Gắn tag Git `v4.0.0`.

**Cổng C12 — bản hoàn thiện:**

- [ ] Cổng chung đạt trên commit có tag `v4.0.0`.
- [ ] Đủ 10 điều ở mục 1, mỗi điều có bằng chứng trong nhật ký.
- [ ] Đã thử quay lại bản trước trên staging và nâng cấp lại được.
- [ ] Website chạy `4.0.0`; `build-info.json` khớp tag.

## 5. Bảng lỗi và phạm vi bị cắt

Ghi mỗi lỗi một dòng, mới nhất ở trên.

| Ngày | Mã | Mức | Mô tả | Tuần sửa | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| 05/11/2026 | L1 | P1 | Bản đồ trên điện thoại: khung 16:10 với ảnh dọc 3:4, nhãn che tranh, chặng đè nhau | 0 | Đã đóng |
| 05/11/2026 | L2 | P1 | Chặng hiện thành hộp trắng do `.online-app button` | 0 | Đã đóng |
| 05/11/2026 | L3 | P1 | Chặng không nằm trên 7 bãi đất của tranh | 0 | Đã đóng |
| 05/11/2026 | L4 | P1 | Màn chính hiện cùng tiến độ 3 lần, trang 3.600–4.150 px | 0 | Đã đóng |
| 05/11/2026 | L5 | P2 | Cột tuần bị khóa xuống dòng từng chữ | 0 | Đã đóng |
| 05/11/2026 | L6 | P2 | 6 ảnh đã tạo chưa dùng (5 thẻ trò, 1 đăng nhập) | 0 | Đã đóng |
| 05/11/2026 | W1 | P1 | Website vẫn chạy commit `bc58393`, chưa có bản đồ và cải tiến 04/11 | 0 | Mở |
| 05/11/2026 | W2 | P1 | Máy chủ ~300 ms mỗi lần gọi, lần đầu 3,4 s; chưa chỉnh vùng | 1 | Mở |

## 6. Nhật ký theo tuần

Sao chép khối dưới đây cho mỗi tuần. Chỉ ghi kết quả đã chạy thật.

```markdown
### Tuần N (dd/mm – dd/mm) — <chủ đề>

- Commit cuối tuần: `<hash>` · Source ID trên website: `<id>`
- Đã làm: <việc> — <tệp chính>
- Kiểm tra: typecheck <đạt/không> · npm test <x/y> · Playwright Chrome <x/y>, Edge <x/y> · assets <MiB>
- Số đo: <các số của cổng>
- Chơi thử: <số lần trẻ hỏi, chỗ bị kẹt>
- Cổng CN: ĐẠT / CHƯA ĐẠT — <điều kiện còn thiếu>
- Cắt phạm vi (nếu có): <việc> → <tuần mới>
```

### Tuần 0 (05/11 – 08/11) — Hoàn thiện bản đồ và giao diện học tập (Cổng C0)

- Đã làm:
  - L1: Khung bản đồ điện thoại 3:4 (`src/styles/world-map.css`).
  - L2: Bỏ hộp trắng quanh chặng học tập (`src/styles/world-map.css`).
  - L3: Đặt 7 chặng vào đúng 7 bãi đất trên 8 tranh môn (`public/art/maps/manifest.json`, `src/core/world-map-layout.ts`, `src/components/RegionMap.tsx`, `src/styles/world-map.css`). Phóng ảnh địa danh lên 128px desktop / 88px mobile.
  - L4: Thu hẹp về một giao diện chính: Bản đồ đưa lên trên cùng, khối thẻ cũ ẩn và chỉ hiện khi chọn "Danh sách", hành trình tuần thu gọn thành toggle "Xem cả hành trình ▾" (`src/screens/OnlineStudentWorld.tsx`, `src/screens/StudentScreen.tsx`, `src/styles/student-shell.css`).
  - L5: Sửa lưới cột tuần bị khóa tránh ngắt từng chữ (`src/styles/student-shell.css`).
  - L6: Đưa 6 ảnh mới vào giao diện: `auth-welcome.webp` tại màn đăng nhập, 5 WebP game cards thumbnail tại MapWeekPanel và StudentScreen (`src/screens/OnlineScreen.tsx`, `src/components/MapWeekPanel.tsx`, `src/screens/StudentScreen.tsx`).
  - Spec hình học: `tests/visual/online-mapgeometry.spec.ts` kiểm thử 390×844, 768×1024, 1440×900 không chồng lấn và nằm trọn khung.
  - Báo cáo chi tiết: `docs/BAO_CAO_TIEN_DO_TUAN_0.md`.
- Kiểm tra:
  - `npm run typecheck`: ĐẠT (0 lỗi).
  - `npm test`: ĐẠT 100% (syntax, 12 release, 100+ online, cloud, 26 map tests).
  - `npm run test:assets`: ĐẠT (83 tệp, 4.82 MiB, ngân sách 20 MiB).
  - `tests/visual/online-mapgeometry.spec.ts`: ĐẠT 6/6 trên cả Chrome và Edge.
  - `tests/visual/online-studentflow.spec.ts`: ĐẠT 12/12 trên cả Chrome và Edge.
  - `tests/visual/online-mapflow.spec.ts`, `online-worldmap.spec.ts`, `online-regionmap.spec.ts`, `online-mapperformance.spec.ts`, `online-scrolling.spec.ts`: ĐẠT 100%.
- Cổng C0: **ĐẠT (PASS)**. Đủ điều kiện chuyển sang Tuần 1.

### Tuần 2 (16/11 – 22/11) — Thẻ khám phá, màn chơi mang tranh vùng, sương mù & hoàn thành chặng (Cổng C2)

- Đã làm:
  - T2.1: Màn chơi mang tranh vùng `/art/maps/map-${regionId}-wide.webp` mờ, ảnh địa danh góc chặng; độ tương phản chữ $\approx 11:1$ (`OnlineStudentWorld.tsx`, `game-base.css`).
  - T2.2: Chặng hoàn thành có viền sáng và nhịp vào $\le 1.2\text{s}$, tắt được khi `data-motion="off"`; đạt 3 sao toàn bộ có huy hiệu cờ vàng `🚩` (`RegionMap.tsx`, `world-map.css`).
  - T2.3: Thẻ khám phá với 3 trường `discoveryTitle`, `discoveryText`, `discoveryImageFile`; tự động phát âm tiếng Việt (`vi-VN`); lưu vào "Sổ khám phá" của học sinh; ghi nhận server `audit.action='student.discovery.view'` không sao, không attempt (`DiscoveryDialog.tsx`, `contracts.ts`, `online-document-import.ts`, `online-store.mjs`, `postgres-store.mjs`, `cloud-api.mjs`, `online-server.mjs`).
  - T2.4: Lớp phủ sương mù `.map-stage-fog` và ổ khóa trên chặng chưa mở; toast thông báo *"Hoàn thành tuần X để mở"* (`RegionMap.tsx`, `WorldMap.tsx`, `world-map.css`).
  - T2.5: Xuất Excel đầy đủ 3 cột thẻ khám phá trong sheet `Thông tin bộ` (`src/core/question-export.ts`).
  - T2.6: Kiểm thử Cổng C2: round-trip Excel không lệch dòng (`tests/question-export.test.mjs`), tracking audit 0 sao 0 attempt (`tests/online-summary.test.mjs`), visual test đa trình duyệt Chrome và Edge (`tests/visual/online-discovery.spec.ts`).
  - Báo cáo chi tiết: `docs/BAO_CAO_TIEN_DO_TUAN_2.md`.
- Kiểm tra:
  - `npm run typecheck`: ĐẠT (0 lỗi).
  - `npm test`: ĐẠT 100% (197/197 tests: syntax, release, online, cloud, map).
  - `npm run test:assets`: ĐẠT (83 tệp, 4.83 MiB / ngân sách 8 MiB).
  - `tests/visual/online-discovery.spec.ts`: ĐẠT 2/2 trên cả Chrome và Edge.
  - `tests/visual/online-mapgeometry.spec.ts`: ĐẠT 6/6 trên cả Chrome và Edge.
- Cổng C2: **ĐẠT (PASS)**. Hoàn thành toàn diện các hạng mục kỹ thuật Tuần 2.

## Phụ lục A — Căn cứ lập kế hoạch

Kiểm chứng độc lập ngày 05/11/2026 trên mã nguồn hiện tại của thư mục dự án:

- `npm run typecheck`, `npm run build`, `npm run test:assets` đạt (83 tệp, 4,81 MiB).
- `npm test` đạt **277/277**: 12 release, 194 online, 45 cloud, 26 bản đồ.
- Playwright Chromium, 29 tệp spec: 78 bài đạt, 1 bỏ qua (cần bộ học liệu thật 140 câu). Chưa chạy lại trên Edge trong đợt đánh giá.
- Website `gontogontet.netlify.app`: `build-info.json` vẫn là commit `bc58393`; `/api/online/me` 300–333 ms, lần đầu 3.438 ms.
- Trong mã chưa có: kệ quà, mục tiêu ghim, huy hiệu, chuỗi ngày, nhiệm vụ ngày, thị trấn, khu phụ huynh, chế độ thi thử online.
- Lỗi giao diện L1–L6 như bảng ở mục 5.

## Phụ lục B — Liên kết

- [Kế hoạch giao diện và tiến độ](KE_HOACH_GIAO_DIEN_VA_TIEN_DO.md) (nhật ký đợt bản đồ)
- [Bộ bàn giao nâng cấp bản đồ](BAN_GIAO_NANG_CAP_2026-11-05/00_DOC_TRUOC.md)
- [Cập nhật tốc độ ảnh và xuất đáp án](CAP_NHAT_TOC_DO_ANH_VA_XUAT_DAP_AN_2026-11-04.md)
- [Đề xuất game lớp 3](DE_XUAT_GAME_LOP_3_NGUON_2026-11-04.md)
- [Game SDK](GAME_SDK_V1.md) · [Nhập học liệu](ONLINE_QUESTION_IMPORT.md) · [Cấu hình Netlify/Supabase](NETLIFY_SUPABASE.md)
