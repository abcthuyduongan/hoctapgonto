# Mục 1 — Tách CSS minigame và tối ưu ảnh bản đồ di động

## 1. Kết quả cần bàn giao

- Game đang chơi chỉ tải shared styles cần thiết và styles riêng của nó; không kéo toàn bộ CSS của các game khác.
- Mobile nhận ảnh đúng khổ/DPR, giữ nguyên vị trí chặng/landmark và chất lượng đọc/chạm.
- Thời gian từ chạm mở game đến dùng được đạt **p95 ≤1.500 ms ở kịch bản G1**, có dữ liệu thô trước/sau. Runtime cold, media lớn và bài nghe được báo đúng ngữ cảnh.
- Bộ mã và asset RC có hồi quy, bảng byte/waterfall, ảnh đối chiếu và phương án quay lại.

## 2. Căn cứ cụ thể từ dự án

| Vị trí | Hiện trạng đã đọc | Hướng xử lý |
| --- | --- | --- |
| `vite.config.ts` | Đã `cssCodeSplit:true`; Vite cài đặt 7.3.7 | Giữ tính năng này; sửa dependency/import graph |
| `src/games/loaders.ts` | 10 importer động, có cache promise và xóa promise khi import lỗi | Giữ API/đăng ký trò; không đổi thành import đồng loạt |
| 10 tệp game và `OnlineExerciseRunner.tsx` | Đều import `game-base.css` | Tách shared base nhỏ, CSS game/runner riêng |
| `game-base.css` | Có style dùng chung, game, legacy creator/parent và nhiều override lịch sử | Phân loại theo người sử dụng; không xóa theo tên có vẻ cũ |
| `game-context-themes.css` | Được dùng ở MathQuest/SentenceBuilder/WordConnect | Tách theme cần thiết theo trò, giữ primitive chung nhỏ |
| `OnlineStudentWorld.tsx:349–353` | Nền game luôn chọn `map-…-wide.webp` | Thêm lựa chọn responsive cho lớp nền trang trí |
| `WorldMap.tsx`, `RegionMap.tsx` | Đã có picture wide/tall theo breakpoint | Mở rộng srcset/sizes, không làm mất tall/anchors |
| `public/art/maps/manifest.json` | Có kích thước/hash/bytes và tọa độ slot | Cập nhật metadata cho biến thể, giữ contract tọa độ |
| `tools/onlineBuild.mjs` | Emit asset public vào dist, trừ một số nhóm | Biến thể mới phải tính vào tổng artifact, không chỉ byte tải đầu |

Vite 7 tự tách CSS của async chunk và chờ CSS trước khi đánh giá chunk; một stylesheet lớn dùng chung vẫn là dependency phải tải. Vì vậy bật thêm cùng cờ không giải quyết import chung hiện tại. [Tài liệu Vite 7](https://v7.vite.dev/guide/features#css-code-splitting).

Kích thước ảnh nguồn hiện tại:

| Map | Wide 1600×1000 | Tall 1024×1365 |
| --- | ---: | ---: |
| World | 144.438 B | 131.644 B |
| Math | 222.302 B | 214.492 B |
| Vietnamese | 197.638 B | 214.324 B |
| English | 95.018 B | 105.422 B |
| Computing | 152.296 B | 142.840 B |

Ảnh thẻ game 720×480 đang khoảng 54–64 KB/tệp. Đây là dữ liệu kiểm kê khi lập kế hoạch, không phải kích thước đã tối ưu.

## 3. Định nghĩa đúng mục tiêu 1,5 giây

### 3.1. Mốc đo

`game_open_ready_ms = t_ready - t_user_intent`.

- `t_user_intent`: lần tap/click thật khởi chạy bài, trước gọi API/import. Với mobile ưu tiên thao tác touch; giữ nguyên mốc ở bản trước/sau.
- Quiz/số/điền: câu đọc được, ảnh câu hỏi nếu có đã decode, input dùng được sau biên nhận mở câu từ server.
- Ghép thẻ/nối từ: bảng chơi và media cần để chọn đã có, thao tác hợp lệ được nhận.
- Xếp câu/thứ tự/bếp/giỏ/cân/thuyền: nội dung lượt đầu và control tương ứng dùng được, không chỉ dialog hoặc skeleton đã hiện.
- Nghe: tách **ready-to-listen** gồm control và audio có thể phát; thời gian nghe bắt buộc đến mở trả lời là chỉ số riêng. Không yêu cầu cả bài nghe 10 giây phải hoàn thành trong 1,5 giây, cũng không bỏ thời gian tải audio.
- Trang trí có thể hoàn thiện sau first usable nhưng phải có nền thay thế ổn định, không che câu và không gây CLS. Báo thêm `skin_complete_ms`; không tính ảnh câu hỏi là trang trí.

### 3.2. Kịch bản và cách công bố

| Mã | Điều kiện | Cổng |
| --- | --- | --- |
| G1 — game cold trong app đã sẵn sàng | Context/cache mới; login và map đã dùng được; game CSS/JS/skin chưa hoàn tất tải trước thao tác; API lab ổn định; reference pack | p95 game-ready ≤1.500 ms |
| G1W — mở lại game | Cùng context, có cache từ lượt trước; session/sao vẫn do server xác nhận | Đo riêng; mục tiêu đề xuất p95 ≤800 ms |
| G2 — staging | Cùng reference pack, đo browser thật qua Netlify/DB/Storage; phân loại runtime đầu tiên/đã nóng | p95 ≤1.500 ms ở steady state, kể cả khi giữ tải S4; báo đầy đủ cold tail và lỗi, chưa đạt phải xử lý tiếp |
| G3 — media lớn/ngoài reference | Học liệu ảnh/âm thanh lớn hợp lệ mà người soạn cung cấp | Công bố bytes/ready riêng, không gán SLA 1,5 giây cho mọi tệp 2 MB |

Reference pack phải được chốt và giữ nguyên trước/sau: 10 game, câu chữ/nghe/ảnh/ghép/thứ tự phù hợp, lựa chọn đủ, media hợp lệ, ảnh câu tối đa 60–80 KiB cho phép đo chuẩn. Không sửa nội dung hoặc đáp án để đạt tốc độ. Ảnh bản đồ có thể nén/resize; media học liệu dùng ID/hash bất biến và nằm ngoài tác vụ sửa này.

**Profile lab chính được đề xuất:** Chromium production build, viewport 390×844 CSS px, DPR 2, CPU slowdown ×4; độ trễ mạng cấu hình 150 ms, download 1,6 Mibit/s (209.715 B/s), upload 750 Kibit/s (96.000 B/s), không packet loss nhân tạo. Công cụ phải lưu cả giá trị cấu hình và throughput/RTT quan sát được, vì cách giả lập latency tùy API. Đây là profile tham chiếu mạng yếu, không đại diện mọi kết nối 4G. G1/G1W dùng cùng máy và backend lab cố định, ghi backend là gì; chỉ G2 mới chứng minh Netlify/DB/Storage thật. Không dùng số mock/PGlite để ký cổng G2.

Thiết bị thật chạy thêm trên mạng thực, không gọi CPU ×4 là một model điện thoại cụ thể. Báo browser/OS/version, cache HTTP/service worker/module và trạng thái Save-Data/prefetch. Tablet/desktop dùng các viewport đã nêu ở A0, ghi DPR thật. Cách tính percentile thống nhất: nearest-rank trên mẫu thành công; n, lỗi, timeout và mẫu thô báo cạnh nhau. Với n=30, p99 gần max nên chỉ mô tả mẫu, không chứng nhận tail ổn định.

Ghi request/prefetch trước tap. Nếu game đã tải xong trước tap thì đánh dấu WARM/PREFETCHED, không đưa vào nhóm cold. Không dùng một context đã import module rồi chỉ clear HTTP cache để giả làm JS cold. Nếu prefetch không cho thu được nhóm cold, bổ sung phép đo chẩn đoán có prefetch tắt riêng và ghi rõ; nghiệm thu vẫn có dữ liệu luồng production bình thường.

## 4. Ngân sách tạm để thiết kế

Chốt lại sau spike đo baseline; thay ngân sách phải ghi quyết định trước khi chạy nghiệm thu, không sửa sau để hợp thức hóa số đo.

| Khoản trên đường mở game | Ngân sách đề xuất | Cách kiểm tra |
| --- | --- | --- |
| Shared CSS game | ≤5 KiB gzip | Bundle report; chỉ primitives thật sự dùng chung |
| CSS riêng game đang mở | ≤7 KiB gzip | Không có stylesheet game khác trong request graph |
| CSS mới tới game | Tổng ≤12 KiB gzip | Gộp mọi dependency CSS thực tải |
| JS game/shared mới tải | ≤40 KiB gzip ban đầu | Mục tiêu thiết kế; đo parse/long task cùng bytes |
| Nền mobile được chọn | ≤70 KiB/tệp ưu tiên; tối đa 90 KiB nếu cần rõ | WebP body thực, QA hình ảnh; không coi chất lượng là phụ |
| Tổng body mới G1, kể cả reference image | Hướng tới ≤180 KiB | Waterfall, không bỏ resource của cùng thao tác |
| Layout/interaction | CLS ≤0,1; không flash unstyled; phản hồi “đang mở” trong khoảng 100 ms | PerformanceObserver + ảnh/filmstrip |
| Artifact toàn bộ | Không vượt baseline được chốt khi nhận việc | Hiện có nhiều ngưỡng lịch sử; không tự nâng giới hạn test |

Với 1,6 Mib/s, 180 KiB đã tiêu tốn phần đáng kể trong 1,5 giây; RTT, API, parse/decode còn phải đo. Ngân sách byte là công cụ thiết kế, không bảo đảm tự động đạt thời gian. Cần bật nén HTTP/CDN phù hợp và đo encoded/transfer thực tế, không dùng gzip cục bộ thay số truyền qua mạng.

## 5. A0 — Inventory và baseline, 0,5–1 ngày công

1. Chốt source ID/RC và fixture; chạy nhóm hồi quy quyền/chấm/PIN/backup hiện hành để bảo đảm bản dùng làm nền ổn định.
2. Dựng production build; xuất graph chunk/CSS, bảng asset bytes/raw/gzip, mọi import của base/theme.
3. Coverage cho cả 10 game: idle, chọn/sai/đúng, hint, media lỗi, pending ACK, kết quả, exit; 390×844/768×1024/1440×900.
4. Đo ít nhất 3 lần cold/warm mỗi game để chẩn đoán; G1 nhóm chính MathQuest/Memory/WordConnect và mọi game có critical CSS lớn được đo sâu.
5. Lưu ảnh trước ở ba viewport, loading/error/feedback/completion. Baseline không có số thực thì ghi chưa chạy.

Giữ máy/browser/profile và trạng thái fixture tương đương trước/sau; dùng snapshot test hoặc account tương đương để lượt đầu không đổi thành câu/media khác vì lịch sử học. Không reset dữ liệu production hoặc sửa server clock để chuẩn hóa mẫu.

**Bàn giao:** inventory selector→consumer, request waterfall, raw metrics và ảnh. **G0 đạt:** có baseline rõ và người nhận thống nhất metric/budget trước khi tách.

## 6. A1 — Tách CSS thành từng lớp, 2–3 ngày công

Cấu trúc đề xuất, tên có thể điều chỉnh theo code thực tế:

```text
src/styles/games/
  primitives.css       token/base control tối thiểu
  stage.css            khung DOM, responsive, scroll/focus chung
  feedback.css         đúng/sai/pending/error
  completion.css       màn hoàn thành
  math-quest.css
  memory-match.css
  word-connect.css
  sentence-builder.css
  sequence-trail.css
  boat-race.css
  fox-kitchen.css
  treasure-flip.css
  balance-scale.css
  basket-sort.css
src/styles/themes/
  fishing.css
  sentence-context.css
  connect-context.css
```

Thực hiện từng bước:

1. Lập owner cho selector; tách phần shared nhỏ trước, giữ thứ tự cascade và breakpoint. Không quét-xóa class legacy chỉ vì coverage một game không dùng.
2. Game chỉ import file của nó và shared primitives thực cần. `OnlineExerciseRunner` dùng bộ rich exercise riêng. Đưa styles hoàn thành vào đúng component/dependency nhỏ.
3. Tách theme trang trí theo consumer; shared theme không được kéo tất cả cảnh vào mọi trò.
4. Kiểm tra component chung như FeedbackEffects/GameMascot/useQuestionLayout để tránh một import trung gian kéo lại nguyên base.
5. Khi đã hết consumer của CSS cũ ở runtime mới, giữ bản đối chiếu và xác nhận mọi consumer archive/legacy nếu còn; loại khỏi đường online khi có bằng chứng. Không tái xuất cả 10 CSS qua một index import eagerly.
6. Giữ `GAME_COMPONENTS` và promise retry logic. Không thêm manualChunks hoặc gộp vendor khi chưa thấy graph cần; không đổi scoring/clock/session cùng PR tối ưu style.
7. Sau mỗi 2–3 game chạy ảnh/các ca gameplay tương ứng; cuối cùng chạy toàn bộ 10 game. Chỉ giữ chia tách làm giảm dependency critical thực tế.

**G1 đạt:** quiz không tải memory/boat/basket CSS chỉ vì dùng shared completion; không FOUC, feedback/input/scroll/focus đều đúng; budget CSS được đo.

## 7. A2 — Ảnh responsive và nền game, 1–2 ngày công

1. Lưu nguồn chất lượng cao và hash, giữ riêng ngoài đường phát hành nếu không cần runtime. Không ghi đè ảnh nguồn duy nhất.
2. Tạo spike trên World/Math: ảnh portrait chiều rộng 480 và 768, ảnh desktop wide tối đa cần theo khung thật/DPR; giữ tỷ lệ từng bản. Kiểm tra DPR 1/2, không chỉ width CSS.
3. So ít nhất hai cấu hình chất lượng WebP bằng mắt ở bản đồ nhiều chi tiết. Đề xuất bắt đầu quality 72–82; chọn theo độ rõ và dung lượng thực, không coi đây là cấu hình chắc chắn đạt mọi map.
4. Sau QA, áp dụng 5 map. Không tạo mọi biến thể cho cả hai tỷ lệ nếu browser không dùng; tính tổng dist để tránh thêm quá nhiều bản.
5. Mở rộng manifest/schema theo cách tương thích: canonical ID, wide/tall variants, width/height/bytes/hash và source set. Không thay ý nghĩa slotAnchors hoặc crop khác tỷ lệ.
6. WorldMap/RegionMap dùng picture/source/srcset/sizes theo khung thật; có width/height/aspect-ratio ổn định. Tải ưu tiên map đang nhìn, vùng khác khi thật sự cần.
7. Nền game trong OnlineStudentWorld chọn khổ portrait/landscape phù hợp thay wide cố định. Có thể dùng picture trang trí hoặc CSS media/image-set dựa trên resolver chung; quyết định theo request graph, không để hai nền cùng tải.
8. Chỉ lấy một nguồn dữ liệu resolver cho map/game để không lệch đường dẫn; cập nhật tests và manifest bytes/hash.
9. Ảnh lỗi có nền thay thế và retry; câu hỏi/input vẫn đọc/chạm được. Không để retry nền reset đồng hồ câu hoặc mở phiên học mới.
10. Công cụ build emit public sẽ mang cả ảnh variants vào dist: kiểm kê tổng, chuyển nguồn không-runtime ra khỏi public có kiểm chứng, giữ đường cũ cho callers còn dùng hoặc đổi tất cả tham chiếu cùng đợt. Không tự nới gate assets.

Tests đang kiểm kê bộ ảnh canonical phải phân biệt 28 asset nội dung với các biến thể kỹ thuật mới, kiểm tra đủ variant/hash/tỷ lệ; không chỉ tăng con số mong đợi. Không phóng ảnh 1600 px lên lớn hơn để gắn nhãn DPR 2 mà không có thêm chi tiết nguồn.

**G2 đạt:** chọn đúng variant trên mobile, không tải wide+tall thừa, chặng/landmark không lệch, ảnh không mờ đáng kể và tổng artifact trong ngân sách.

## 8. A3 — Ưu tiên tải và nghiệm thu, 1–2 ngày công

- Chạy import game song song API mở session như hiện có; không tạo chuỗi tuần tự thừa. Nền trang trí không được chặn câu/ACK nếu không cần.
- Prefetch có giới hạn: game được chọn hoặc ý định tap/focus; không tải mười game/ba map trên 4G yếu. Ghi bytes phát sinh trước click và chi phí khi người dùng không chơi.
- Cache public art bằng tên/hash/version đúng; thay bytes thì đổi identity/URL phù hợp. Không cache chung dữ liệu riêng, audio receipt hoặc trả lời để giảm độ trễ.
- Giữ media clock và server acknowledgement; loading UI phản hồi ngay nhưng “đã lưu” chỉ sau ACK.
- Đo final: ít nhất 30 lần G1 và 30 lần G1W cho từng game trên profile chính, chia thành 3 batch 10 để thấy biến động. Mọi lỗi tính failure, không bỏ mẫu; báo p50/p95/p99, n, max và cache state.
- Mỗi game thêm tối thiểu 3 lần ở tablet/desktop để kiểm tra viewport; staging và thiết bị thật thực hiện ở mục 2. N nhỏ không được gọi là field p75 hoặc SLA toàn dân.
- Nếu p95 >1.500 ms, xem waterfall: network/bytes, API, parse/layout/decode. Mở việc riêng đúng nguồn; không tiếp tục cắt phần bắt buộc của câu để đạt chỉ tiêu.

**G3 đạt:** PERF01–PERF20 theo ma trận, full regression đúng build, có bảng trước/sau và RC có thể đưa sang staging. Nếu còn quá ngưỡng, trạng thái là cần tối ưu tiếp, không ghi hoàn thành dựa vào số CSS file đã tách.

## 9. PR, hồi quy và quay lại

Chia PR: (A) đo/budget/fixture, (B) shared CSS và 3 game, (C) 7 game còn lại, (D) responsive assets/resolver, (E) xác nhận performance. Mỗi PR có before/after, tệp thay, ảnh, metric và giới hạn.

Các check chuẩn: typecheck, Node, build, assets; visual/game/media-clock/retry/scroll/geometry/a11y và full Chrome/Edge ở build chốt. Không viết test chỉ kiểm tra “import đã đổi tên”; test phải đo resource và hành vi người dùng.

Rollback bằng artifact/commit trước và manifest tương ứng; giữ assets version cũ trong khoảng triển khai cần thiết để tab cũ không 404. Diễn tập ít nhất một tab cũ đang học khi cập nhật. Không xóa ảnh cũ ngay nếu phiên/client còn tham chiếu.
