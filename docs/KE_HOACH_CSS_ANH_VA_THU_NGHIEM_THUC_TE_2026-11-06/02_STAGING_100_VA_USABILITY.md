# Mục 2 — Diễn tập staging 100 phiên học và usability với trẻ thật

## 1. Kết quả cần chứng minh

1. Hạ tầng staging chạy được **100 học sinh giả lập có phiên đăng nhập riêng**, đang học đồng thời đủ thời lượng, có media và ghi nhận kết quả đúng.
2. Có số đo browser/API/DB/Storage để phân biệt chờ mạng, cold-start, kết nối DB và render; không chỉ thời gian một handler hoặc fixture PGlite.
3. Có mẫu INP trên thiết bị thật khi được hỗ trợ, với giới hạn mẫu rõ; không lấy Event Timing max hay request duration làm INP.
4. Học sinh lớp 3 dùng được luồng học chính, phụ huynh và giáo viên hoàn thành tác vụ, lỗi được sửa rồi thử xác nhận.

**100 phiên giả lập không phải 100 trẻ tham gia.** Load test đánh giá hệ thống, usability đánh giá con người; hai nhóm bằng chứng độc lập.

## 2. G4 — Chuẩn bị staging và công cụ

### 2.1. Môi trường riêng

Chủ dự án/người vận hành chuẩn bị:

- URL staging cố định, deploy ID/commit/source ID, cấu hình cùng loại runtime/region/DB/Storage dự định dùng; ghi mọi khác biệt với production.
- DB và bucket riêng cho dữ liệu thử. Không dùng tên/tài khoản/hồ sơ học sinh thật và không chạy seed/restore/fault injection trên production.
- Snapshot/backup trước chạy, kiểm chứng có thể phục hồi; tài khoản quản trị thử và cơ chế dừng job.
- Danh sách giới hạn hiện hành của DB/pool/function/egress, ngân sách thử và người theo dõi. Chưa có giới hạn thì chưa chạy mức 100; chạy smoke và ước lượng trước.
- Máy tạo tải đủ tài nguyên, đồng hồ thời gian được đồng bộ; log có UTC để ghép sự kiện, báo cáo hiển thị Asia/Saigon.
- Bản RC đã qua hồi quy P0/P1: không lộ đáp án/private session, đúng quyền, chấm/sao/idempotency, autosave, PIN, media clock, migration và backup.

Không ký lại toàn bộ readiness của 4.0.2 chỉ từ kế hoạch này. Chặng G4 xác nhận build cụ thể đủ điều kiện đem thử; log phải khớp source ID.

### 2.2. Dataset chuẩn

| Nhóm | Dữ liệu đề xuất |
| --- | --- |
| Quy mô | 23 lớp, khoảng 1.000 hồ sơ giả lập; 100 tài khoản dùng tải; nhóm usability dùng tài khoản riêng |
| Tuần | Ít nhất 8 tuần/lớp theo fixture, đủ trạng thái hiện tại/đã đóng/chưa mở |
| Nội dung | Reference packs do người soạn chấp nhận: quiz, đọc/nghe, ghép, thứ tự và các game còn lại phù hợp |
| Media | Ảnh và audio hợp lệ, có SHA-256/size/duration; tệp nhỏ/vừa/lớn phân lớp, không WAV/PNG giả |
| Hoạt động | Ví có lịch sử/ước muốn, mục tiêu quà thử, huy hiệu, trạng thái thị trấn; tổng số rows/bytes được ghi |
| Đa đơn vị | Có tối thiểu hai workspace thử và lớp khác để smoke kiểm tra quyền chéo trước tải |

Không cần sáng tác ngân hàng câu mới. Fixture chỉ phục vụ đo kỹ thuật, không ghi “đã duyệt chuyên môn” thay giáo viên. Khi dùng câu do giáo viên cung cấp, lưu phiên bản và xác nhận đủ quyền dùng cho buổi thử.

### 2.3. Sửa runner trước khi dùng nghiệm thu

Tệp trọng tâm: `tools/staging_load_runner.mjs`, `tests/staging-load-runner.test.mjs`, client/contracts nếu cần đọc giao thức, công cụ seed/đối soát mới.

Hiện runner đã bắt HTTP lỗi, nhưng mã được đọc khi lập kế hoạch vẫn:

- Chưa thực hiện login thật; cookie jar dùng tên `session` trong khi adapter hiện dùng `baoan_online_session`.
- CSRF nhận chung từ tham số, chưa quản lý token riêng từng người.
- Gán journey request thành `openQuestion`, tải icon như media học liệu; chưa có lượt chơi/attempt/hoàn thành thật.
- Chốt `dur` trước `res.text()`, nên chưa đo toàn bộ body dù đã đọc body sau đó.

Phải thực hiện:

1. Mỗi VU có account, cookie jar, CSRF, session/play/question/presentation/attempt state riêng. Parse Set-Cookie đúng tên/domain/path/expiry hoặc dùng client context hỗ trợ cookie; không hardcode cookie giả.
2. Đăng nhập qua route thật; mutation gửi Origin/CSRF và protocol đúng build. Không tắt CSRF/quyền/rate limit để runner chạy.
3. Tạo/mở phiên đúng bài được giao; mở câu qua question-open thật; tải URL media được ứng dụng sử dụng cùng quyền play/item khi cần.
4. Gửi lựa chọn theo presentation hiện tại, attemptKey ổn định khi retry. Đối chiếu correctness/receipt/award; không tự gửi cờ correct để nhận sao.
5. Reference pack có đáp án tác giả tại fixture ngoài response học sinh để runner chọn nội dung hợp lệ; không dựa vào rò đáp án từ API. Fixture tránh lựa chọn trùng text hoặc có cách định danh rõ.
6. Thời gian đo bắt đầu trước fetch, kết thúc sau body đọc/parse/kiểm tra bắt buộc. Media đo riêng bytes transfer, browser decode/playable và thời gian nghe.
7. HTTP 4xx/5xx, timeout, body sai schema và nghiệp vụ không thành công đều có counter riêng, không có latency mẫu thành công giả. Lỗi có reason/operation nhưng không in cookie, token, PIN hoặc nội dung đáp án.
8. Tách số request, logical operation và active user. Khi VU chết/đăng nhập lỗi, không tiếp tục báo đủ 100 người khỏe.
9. Retry có giới hạn/backoff/jitter và giữ ID idempotent; retry không xóa lỗi ban đầu khỏi thống kê hoặc làm đẹp p95.
10. Có allowlist URL staging/build check, run ID, timeout từng bước, graceful stop, giới hạn request/egress/thời lượng và exit code theo gate.
11. Test runner bằng HTTP server fixture thật: login/cookie/CSRF, success, 401/403/404/429/500, body lỗi, timeout và response body chậm. Mock dùng unit test là được, nhưng kết quả mock không thay load run thật.

**G4 đạt:** runner đi hết một bài qua HTTP thật với ảnh/audio hợp lệ; cố tình lỗi thì báo FAIL/exit nonzero; 10 tài khoản không lẫn cookie/token; đối soát không lệch. Chưa đạt G4 thì chưa ghi chạy 100 đạt.

## 3. Mô hình 100 người và kịch bản học

### 3.1. Cấu hình chuẩn

- **90 VU protocol + 10 VU browser = 100 học sinh**, mỗi người một account. Protocol tạo tải nghiệp vụ; browser dùng UI thật để nhìn tải CSS/ảnh, decode và thời gian dùng được.
- Có thể chia hai máy, mỗi máy 45 protocol + 5 browser nếu một máy không đủ. Báo generator CPU/RAM/event-loop lag; máy tạo tải quá tải làm phép đo không hợp lệ.
- 100 VU là 100 workflow đăng nhập và chạy vòng học, có think-time. Số HTTP in-flight sẽ thay đổi; báo cả active VUs và in-flight, không gọi 100 tài khoản tạo sẵn là 100 đồng thời.
- Không mở 100 tab bằng một cookie chung. Tác vụ quản trị/phụ huynh nền nếu thêm phải ghi riêng tổng concurrency, không giấu ngoài con số 100.

### 3.2. Vòng học của mỗi VU

1. Login hoặc khôi phục phiên; đọc journey/map và chọn bộ được phép.
2. Bắt đầu/tiếp tục game; mở câu, nhận presentation hiện hành.
3. Nếu có ảnh, tải đúng media; browser chờ decode. Nếu có audio, phát bằng thao tác người dùng, nghe đủ và chỉ mở trả lời theo protocol.
4. Nghĩ **3–12 giây** tùy loại bài; đây là giả lập nhịp học, không xóa khỏi tổng thời lượng nhưng tách khỏi network latency.
5. Nộp đúng/sai theo kịch bản; sai rồi làm lại theo policy, gợi ý có xác nhận; không reset clock hoặc cấp sao bằng số giả.
6. Đọc ACK và cập nhật tiến độ/ví; hoàn thành hoặc thoát hợp lệ; quay lại bài.
7. Thỉnh thoảng mở ví/quà thử/thị trấn/thi thử theo mix. Không tạo giao dịch tiền/quà thật.

Mix đề xuất theo thời gian hoạt động: 55% quiz/đọc/số, 15% nghe, 15% ghép/xếp/game khác, 10% map/ví/town, 5% thi thử/autosave. Đây là cấu hình thử được chốt trước chạy, không phải thống kê hành vi học sinh hiện có. Chạy thêm từng game riêng nếu mix không có đủ mẫu.

Media Node không có browser cache tự nhiên; cần báo chính sách cache của runner. Tách kịch bản lạnh và nóng, không so bytes protocol không-cache với browser có cache như cùng một điều kiện. Giữ Vary Cookie/quyền như production.

## 4. Kịch bản tải theo bậc

| Bước | Người hoạt động | Thời gian | Mục đích |
| --- | ---: | --- | --- |
| S0 | 1 rồi 3 | 5 phút | Chức năng, telemetry, dữ liệu, dừng job |
| S1 | 10 | 10 phút | Cookie/CSRF riêng, kịch bản và generator không nghẽn |
| S2 | 30 | **30 phút** | Baseline lớp học theo kế hoạch trước |
| S3 | 50 → 75 → 100 | 5 phút/mức | Thấy ngưỡng queue/pool/error tăng |
| S4 | **100 giữ liên tục** | **45 phút** | Gate tải chính, không chỉ chạm peak vài giây |
| S5 | 100 login trong khoảng 10 giây | Một đợt riêng, sau khi S4 an toàn | Lớp cùng bắt đầu; theo dõi auth/rate limit/NAT |
| S6 | Giảm về 30 rồi 0 | 10 phút | Phục hồi tài nguyên, kết nối/queue và trạng thái phiên |
| S7 tùy chọn | 30 | 2 giờ | Soak nếu có dấu hiệu tăng memory/connection theo thời gian |

Không chạy đồng thời nhóm trẻ thật với stress/load gây nhiễu. S4 đo trên cấu hình đã chốt; nếu đổi DB/pool/function/region giữa chừng thì tạo run ID mới, không nối thành một kết quả.

Kiểm tra kịch bản nhiều học sinh chung IP như trường/lớp dùng NAT. Nếu legitimate login bị 429, ghi lỗi và xử lý policy có giới hạn; không whitelist IP thử để tạo PASS không đại diện thực tế.

## 5. Telemetry: tìm đúng nguồn chậm

| Lớp | Cần ghi | Không suy diễn |
| --- | --- | --- |
| Browser | Mốc tap→ready, image decode, audio playable, LCP/CLS, request bytes, long task | Không coi chỉ response headers là nội dung dùng được |
| HTTP/API | Request ID, operation, status, total body latency, retry, bytes | Tách HTTP error và nghiệp vụ error |
| Function | Deploy/instance, thời gian handler, init/first request nếu có nguồn đáng tin, memory/duration | Không gọi mọi request chậm là cold-start |
| PostgreSQL | Query count/duration, wait/lock/connection/pool, rows, plan truy vấn chậm | SQLite/PGlite không đại diện Supabase |
| Storage/CDN | Asset/hash, size, cache state/header, download/readback | Cache miss CDN không đồng nghĩa function cold |

Netlify có logs theo deploy và metrics tùy cấu hình/gói; thu/xuất log sớm và giữ request ID để ghép dữ liệu, không giả định mọi dự án có cùng màn observability. [Netlify Function logs](https://docs.netlify.com/build/functions/logs/).

Supabase khuyến nghị xem truy vấn và kết nối theo workflow; pooler có ích cho mô hình serverless biến động. Chỉ đổi pool/index/compute sau khi có bằng chứng và đối chiếu giới hạn thực tế của project. [Supabase Performance Tuning](https://supabase.com/docs/guides/platform/performance).

### 5.1. Cold-start đúng nghĩa

1. Tạo block đo riêng: build/source cố định, session thử hợp lệ, không prewarm endpoint đang định đo. Đọc build-info tĩnh trước block; gọi API status trước có thể đã làm function nóng.
2. Thu request đầu của instance theo provider khi có tín hiệu. Có thể dùng marker first-in-instance trong module, nhưng đó là tín hiệu ứng dụng; nếu không xác nhận được init thật thì ghi `FIRST_IN_INSTANCE`, không tự gọi là cold chắc chắn.
3. Thu mẫu sau thời gian không hoạt động và/hoặc deploy thử có kiểm soát. Chờ một số phút không bảo đảm runtime chắc chắn cold; không phân loại chỉ bằng thời gian chờ.
4. Cố gắng thu ≥10 mẫu first-in-instance qua nhiều đợt; báo từng mẫu, n và range. Với n nhỏ, p95 gần max và độ tin cậy thấp; không lấy làm SLA toàn hệ thống.
5. Tách function init, kết nối DB mới, query và mạng. Mẫu cold trong run tổng vẫn nằm trong bảng tổng; thêm phân nhóm để giải thích, không loại tail khỏi kết quả.

## 6. Ngưỡng đề xuất và điều kiện dừng

Chốt trước khi chạy. Các số dưới là **tiêu chí cần đạt**, chưa phải kết quả hiện có.

| Chỉ tiêu | Gate đề xuất |
| --- | --- |
| Healthy active VUs ở S4 | Đủ 100 sau ramp, theo dõi từng khoảng; VU chết phải hiện, không âm thầm giảm tải |
| Game ready G2, reference pack ở S4 | p95 ≤1.500 ms ở steady state; báo runtime cold/steady và cache riêng, không lấy kết quả lab G1 thay thế |
| Mở câu: HTTP đầy đủ | p95 ≤800 ms ở steady state |
| Ảnh câu reference hiển thị/decode | p95 ≤1.000 ms, ghi rõ byte và cache |
| Answer→ACK/thi autosave | p95 ≤1.000 ms; luôn đúng dữ liệu và idempotency |
| Login bình thường | p95 ≤3.000 ms; burst S5 có bảng riêng, mục tiêu tạm ≤5.000 ms |
| Lỗi ngoài kế hoạch | ≤0,5% request và ≤0,5% logical operations; mọi lỗi đều ghi phân loại |
| An toàn dữ liệu/quyền | **0** lệch sao/ví, mất đáp án, trùng thưởng, đọc/ghi chéo người |
| Browser layout | CLS ≤0,1; LCP tham chiếu ≤2,5 s; INP xem phần thiết bị thật |
| Cold-runtime | Báo raw/nguồn marker và nguyên nhân; chưa đủ mẫu hoặc chưa đạt thì còn mục mở, không suy ra đạt từ steady state |

Browser dùng profile mạng tham chiếu của mục 01 khi kiểm tra gate 1,5 giây; mạng LAN không throttle là nhóm riêng. Thu tối thiểu 30 mẫu hợp lệ cho mỗi game/profile được kết luận; nếu mix S4 thiếu mẫu thì chạy bổ sung cùng tải hoặc ghi chưa đủ bằng chứng. Percentile theo nearest-rank, công bố n và lỗi cạnh mẫu thành công. LCP áp dụng page load thật; không reset giả LCP mỗi lần đổi route SPA. Chốt riêng mức cold-runtime chấp nhận được sau baseline và trước run nghiệm thu; nếu chưa có số đó thì cổng cold vẫn mở.

Dừng và điều tra khi có sai quyền/mất hoặc lệch dữ liệu, lỗi ngoài kế hoạch >1% trong 60 giây, backlog không thoát, tài nguyên/chi phí chạm giới hạn đã chốt. Cân nhắc dừng ở DB/generator CPU >85% kéo dài 3 phút hoặc connection/pool gần giới hạn; ghi giá trị thực của môi trường thay vì tăng giới hạn tùy tiện.

Máy tạo tải CPU quá cao/event loop lag phải xử lý hoặc chia máy trước khi quy chậm cho server. Request fault injection được chạy riêng, không trộn vào tỷ lệ lỗi steady để vừa tạo lỗi vừa tuyên bố đạt.

### 6.1. Đối soát sau tải

- Mỗi student/play/pack/version: attempts, thứ tự/receipt và idempotency hợp lệ; mỗi câu tối đa theo policy sao hiện hành.
- Dùng công thức ví chuẩn của hệ thống từ ledger/award/redemption, không chỉ cộng số attempt. So available/earned/pending/redeemed và chuyển trạng thái quà thử.
- Không có câu đúng hoặc lựa chọn bị request cũ ghi đè; score/contest submit một kết quả; không vượt quyền hoặc tuần đóng.
- Media đúng byte/hash, audio receipt/clock đúng; dữ liệu private không xuất hiện trong response/log/cache sai người.
- Ghi baseline trước/sau, lỗi/rows lệch và công cụ tái lập. Không ghi “0 mất dữ liệu” từ riêng exit code load runner.

**G5 đạt:** LOAD01–LOAD16, đủ raw data và đối soát; P0/P1 không còn mở. Nếu chỉ đo được 30 thì công bố 30, không suy ra 100.

## 7. Usability với trẻ thật — chuẩn bị và tổ chức

### 7.1. Người tham gia, thiết bị, dữ liệu

- Vòng 1: **6 trẻ lớp 3**, phân bố mức quen thiết bị/đọc hiểu khác nhau; vòng 2: **6–8 trẻ**, có ít nhất một số em chưa dùng bản trước để giảm hiệu ứng học lại.
- Thêm 3–4 phụ huynh và 2 giáo viên cho nhiệm vụ của họ, không bắt trẻ kiểm tra thay quyền quản trị.
- Một người điều phối, một người ghi nhận; kỹ thuật theo dõi lỗi nhưng không hướng dẫn trong tác vụ nếu chưa cần. Một buổi nên có người lớn phụ trách phù hợp.
- Thiết bị thật: ít nhất hai loại điện thoại Android phổ thông/tầm trung, một tablet và một laptop; ghi model/OS/browser/RAM/viewport/DPR/mạng thực. Không đổi mọi máy sang máy cao cấp chỉ để tốt số.
- Mỗi em dùng account thử mã U01/U02…, nội dung vừa sức được giáo viên chọn, quà/thị trấn là dữ liệu thử. Không đưa danh sách liên hệ hoặc tên trẻ thật vào repository/log công khai.
- Có sự đồng ý của phụ huynh/người phụ trách và trẻ hiểu đây là chơi thử; trẻ được nghỉ/dừng. Ghi hình mặt/giọng không phải mặc định; nếu cần quan sát màn hình thì có sự đồng ý riêng và che thông tin.

Danh sách liên hệ/đồng ý do chủ dự án giữ ngoài gói kỹ thuật. Đề xuất log kỹ thuật đã ẩn danh giữ 14 ngày để sửa lỗi, rồi lưu tổng hợp phù hợp quy trình đơn vị; chốt thời hạn trước buổi thử. Không tự sao chép dữ liệu thật lên dịch vụ phân tích bên ngoài.

### 7.2. Kịch bản mỗi trẻ, khoảng 20–25 phút

| Mốc | Tác vụ | Quan sát |
| --- | --- | --- |
| 2–3 phút đầu | Giới thiệu ngắn, trẻ nhận thẻ tài khoản thử, tự đăng nhập | Đọc/nhập, lỗi, cần chỉ nút hay không |
| 3 phút | Từ map tìm bài đang học và mở game | Tìm CTA, hiểu vùng/chặng khóa, số tap sai và bước thừa |
| 6–8 phút | Học câu chữ/ảnh, có cơ hội sai rồi thử lại/gợi ý; một bài nghe phù hợp | Chữ/ảnh rõ, biết phản hồi đúng/sai, chờ ACK và nghe đủ |
| 3 phút | Thoát rồi quay lại, tìm tiến độ/sao | Có mất chỗ, hiểu lưu chưa, cần chọn lại không |
| 3 phút | Xem mục tiêu quà/thị trấn thử | Biết điều gì đã có/chưa đủ, không hiểu nhầm quà thật |
| 2–3 phút cuối | Trẻ chọn mặt vui/bình thường/khó và nói chỗ khó tìm | Cảm nhận, câu chữ/nút khó hiểu, không hỏi dẫn dắt |

Tác vụ học lõi cần quan sát đủ khoảng 15 phút nếu trẻ thoải mái; có thể tách phần thưởng/phỏng vấn khỏi mốc học. Không kéo dài khi trẻ mệt hoặc muốn dừng. Nội dung vừa sức giúp phân biệt lỗi kiến thức với lỗi giao diện.

Đọc nhiệm vụ trung tính, ví dụ “Con tìm bài hôm nay và bắt đầu nhé”. Không chỉ trước nút đúng. Nếu trẻ yêu cầu hoặc mắc khoảng 45 giây, điều phối có thể giúp; ghi mức trợ giúp. Tác vụ có trợ giúp không được tính là tự hoàn thành. Câu hỏi kiến thức sai có chủ ý không tự tính là tap UI sai.

### 7.3. Nhiệm vụ phụ huynh và giáo viên

- Phụ huynh: vào đúng con, mở PIN, đặt giới hạn thử, xem báo cáo tuần, duyệt/hủy một quà thử và hiểu thông báo hết hạn/quyền.
- Giáo viên: nhận Excel/media thật của đơn vị trong lớp thử, preview → chuyển tab xem nguồn → quay lại → kiểm tra → giao tuần → xuất đáp án/đọc kết quả.
- Đo hoàn thành, thời gian, số lần chọn lại, thông báo khó hiểu và lỗi; giữ thao tác trên điện thoại như nhu cầu thực tế.

Không làm thay TKB/điểm danh vì các phân hệ đó không thuộc ứng dụng này.

## 8. INP và hiệu năng thiết bị thật

1. Tích hợp thu thập pilot nhẹ, thí dụ web-vitals/attribution được bundle cùng ứng dụng, chỉ gắn cho phiên thử. Theo dõi đầy đủ vòng đời trang, lưu interim/final rõ, không chỉ một click. Giữ CSP hiện có; collector cùng origin, không tự thêm analytics bên thứ ba.
2. Kiểm tra hỗ trợ browser và callback thực tế. Thiếu Event Timing hoặc chưa nhận INP thì ghi `UNSUPPORTED/NOT_REPORTED`, không thay bằng 0 ms.
3. Bản ghi chỉ chứa run/session thử, build, thiết bị/browser/network, metric/value và loại thao tác đã lọc; không gửi đáp án, PIN, cookie, tên trẻ hoặc raw DOM/text người dùng. Collector có xác thực/chống spam và giới hạn payload; flush khi pagehide phải tương thích CSRF (ví dụ fetch keepalive), không bỏ bảo vệ chỉ để sendBeacon chạy. Nếu collector chưa đủ, xuất metric cục bộ sau phiên và ghi rõ phương pháp.
4. Ghi game-ready, LCP/CLS, image/audio readiness và ACK riêng; UI phản hồi nhanh không có nghĩa server đã lưu xong.
5. Mục tiêu tham chiếu INP ≤200 ms, nhưng 6–8 trẻ chỉ là quan sát pilot. Báo giá trị theo page/session và n; không tuyên bố đạt field p75 của toàn bộ người dùng từ mẫu nhỏ.

INP xem tương tác suốt vòng đời trang; ngưỡng tốt được đánh giá ở p75 field, tách mobile/desktop. [Tài liệu INP chính thức](https://web.dev/articles/inp).

## 9. Tiêu chí usability và vòng xác nhận

Các ngưỡng đề xuất được chốt trước buổi thử:

- Core task login/tìm bài/học/lưu/thoát phải chạy đúng trên mọi thiết bị thử; **0** mất bài/sao, sai quyền hoặc blocker nghiêm trọng.
- Mục tiêu tự thực hiện luồng học chính 15 phút ở vòng xác nhận: ít nhất **5/6**, **6/7** hoặc **7/8 trẻ** tương ứng số tham gia; chỉ tính mức trợ giúp 0. Ghi số đếm, trẻ dừng giữa chừng và trợ giúp thực tế; không loại khỏi mẫu chỉ vì thao tác chậm. Đây là mẫu nhỏ, không ngoại suy thành tỷ lệ toàn học sinh.
- Tìm bài từ map: mục tiêu ≤60 giây và khoảng ≤3 thao tác chính; đăng nhập lần đầu với thẻ account thử mục tiêu ≤90 giây. Ghi nguyên nhân vượt, không bỏ trẻ thao tác chậm khỏi mẫu.
- Trẻ nhận biết được đáp án đã ghi/chưa ghi, cách thử lại và nơi xem tiến độ; không cần hướng dẫn để tìm nút bị che.
- Phụ huynh/giáo viên hoàn thành các nhiệm vụ thiết yếu và hiểu thông báo; lỗi P0/P1 phát hiện phải sửa và thử lại đúng tác vụ.
- Màu/chữ/vùng chạm/keyboard/zoom không chặn nhiệm vụ; tín hiệu cảm nhận dùng thang 3 mặt và lời trẻ nói, không ép đánh giá tốt.

Sau vòng 1: phân biệt lỗi UI, mạng, nội dung, thiết bị và hướng dẫn; ưu tiên theo ảnh hưởng, mỗi lỗi có bước tái hiện/ảnh đã ẩn danh/build/expected/actual. Sửa rồi hồi quy kỹ thuật trước vòng 2. Nếu chưa đủ trẻ/thiết bị hoặc còn trợ giúp cao, ghi chưa đạt/chưa đủ bằng chứng thay vì tự hoàn thành.

**G6:** có dữ liệu vòng 1 và backlog theo quan sát. **G7:** vòng 2 xác nhận tác vụ đã lỗi, không còn P0/P1, báo cáo giới hạn và chủ dự án nhận bàn giao.

## 10. Hồ sơ phải lưu vào dự án

- Run config, identity/region/tier/khác biệt hạ tầng, dataset counts/bytes và fixture version.
- Raw load samples/counters, đồ thị active VUs/in-flight, request-ID liên kết browser/function/DB, error classification và đối soát.
- Cold/first-in-instance samples với nguồn phân loại; các mục chưa kiểm chứng.
- Bảng usability mã trẻ/thiết bị/tác vụ/trợ giúp/thời gian, lỗi và kết quả thử lại; không lưu liên hệ/giấy tờ cá nhân trong repo.
- Báo cáo trước/sau, ảnh/tệp đã lọc, test matrix LOAD/USER, nhật ký và giới hạn tải công bố.

Chỉ chuyển từ pilot sang phát hành diện rộng khi cả kỹ thuật và tác vụ thực tế có bằng chứng cho đúng build; test nhanh một buổi không thay thế theo dõi vận hành và các điều kiện phát hành còn lại của dự án.
