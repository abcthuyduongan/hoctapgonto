# Kiểm tra chuyên sâu khả năng phát hành — 17/10/2026

**Kết luận: CHƯA PHÁT HÀNH CHÍNH THỨC.** Hai lỗi mức P1 ảnh hưởng sao/độ tin cậy tiến độ và một lỗi P2 về giao diện đã được tái hiện. Ngoài các lỗi này, chưa có đủ bằng chứng nghiệm thu cloud, thiết bị thật và sư phạm. RC9 vẫn là ứng viên dùng thử, không đổi `releaseReady:false` hay `humanPilotStatus:UNVERIFIED`.

Đợt này kiểm tra mã hiện có và bản build riêng, chạy lại kiểm thử, thêm tình huống đối kháng qua API có đăng nhập, thử đúng file Excel và 16 WAV đã gửi. Không chỉ suy luận từ số ca PASS. Không sửa sản phẩm, không triển khai, không ghi dữ liệu website thật, không sửa Excel gốc hoặc ghi đè gói RC9. Có sửa một điểm chờ DOM trong kịch bản kiểm thử để loại lỗi chờ do chính test.

## 1. Phạm vi và cách hiểu file quy hoạch

Nguồn: `C:\Users\abcth\Downloads\Quy_hoach_Kiem_thu_GAME_HOC_TAP_ONLINE_2026.xlsx`, 12 sheet. `TEST_GAME` có 157 ca; `TEST_NEN_TANG` có 123 ca, tổng 280 ca, gồm **191 P0 và 89 P1**. Đây là mẫu kế hoạch với trạng thái chưa chạy, không phải 280 kết quả kiểm thử đã đạt. P0/P1 của ca kiểm thử khác với mức nghiêm trọng P1/P2 của phát hiện bên dưới.

Đã trích xuất nguyên trạng, tạo đối chiếu đủ ID/dòng/tiêu chí và ghi bằng chứng liên quan ở `test-results/deep-release-audit/requirements-crosswalk.json`. Đối chiếu không đánh PASS một dòng chỉ vì có một test tự động gần giống. Các bước yêu cầu staging, máy thật hoặc ký duyệt vẫn chưa được nghiệm thu đầy đủ. Workbook nguồn được mở chỉ đọc, không lưu lại.

Phạm vi đã công bố của RC9 là ứng dụng tài khoản quản lý/học sinh, Web và gói máy chủ Node cục bộ, nghiệm thu mục tiêu Windows Chrome/Edge. Workbook còn có cổng phụ huynh, bản nháp/kiểm duyệt nhiều vai trò, xuất bảng điểm, thu hồi học liệu, PWA và các kênh native/installer. README hiện ghi rõ đã bỏ Góc phụ huynh/Xưởng học liệu cũ. Không coi các mục rộng hơn này đã hoàn thành, cũng không tự loại chúng thành N/A. G0 cần chốt phạm vi lần phát hành Web; không cần tự mở dự án làm mọi ứng dụng native để hoàn thành đợt rà soát này.

## 2. Các lỗi đã tái hiện

### AUDIT-01 — P1: lấy đáp án trước, mở đồng hồ sau, nhận 3 sao mà chưa tải bài nghe

Tài khoản học sinh hợp lệ gọi `/play/compact`. Phản hồi có `correctIndex`, bản chép lời và các trường phục vụ chấm/giải thích trong presentation. Sau đó có thể gọi `question-open` và gửi đáp án đúng ngay. Máy chủ không có điều kiện phát âm thanh trước khi mở đồng hồ, mặc dù phản hồi ghi `clockStartsAfterAudio:true`.

Với bài nghe thử dài 20 giây, cả hai backend chấp nhận 3 sao khi tài khoản chưa gọi GET âm thanh lần nào:

| Đường xử lý | GET âm thanh | Thời gian mở clock → nhận kết quả | Sao |
|---|---:|---:|---:|
| SQLite qua HTTP thật | 0 | 8 ms | 3 |
| API cloud Request/Response + PostgreSQL WASM | 0 | 18 ms | 3 |

Đây là lỗi độ tin cậy của thành tích trong chính tài khoản học sinh; không phải bằng chứng vượt đăng nhập hay đọc dữ liệu học sinh khác. Kiểm thử UI chờ sự kiện audio ended vẫn đạt, nhưng điều kiện đó chưa được bảo vệ ở ranh giới máy chủ. Đồng hồ dùng thời gian máy chủ chưa đủ nếu client tự quyết định khi nào bắt đầu sau khi đã nhận đáp án.

Nguồn liên quan: `server/student-summary.mjs:4`, `server/online-store.mjs:250`, `server/postgres-store.mjs:350`, `src/core/question-rewards.ts:37`. Bằng chứng: `test-results/deep-release-audit/adversarial-api.json`, hai dòng `AUDIT-01`.

Đề xuất sửa: presentation của bài trắc nghiệm/nhập đáp án chỉ gửi nội dung cần làm, chưa gửi khóa đáp án, lời giải hoặc hint miễn phí có thể làm vô hiệu hóa luật phạt. Chấm/feedback và ghi nhận dùng gợi ý đi qua máy chủ. Gắn clock với giao câu và điều kiện sẵn sàng của bài nghe, có bằng chứng thời lượng tối thiểu đáng tin cậy; không nhận một lệnh mở clock tùy ý như bằng chứng đã nghe. Không tuyên bố có thể chứng minh học sinh thực sự nghe chỉ bằng sự kiện từ trình duyệt. Các game ghép cặp cần mô hình presentation riêng vì hai mặt thẻ là nội dung chơi công khai.

### AUDIT-02 — P1: đổi nghĩa câu hỏi nhưng giữ ID làm câu mới được tính sao cũ

Tái hiện qua API quản lý và học sinh, không sửa trực tiếp bảng dữ liệu:

1. Giao một tuần đủ ba môn, sáu câu; học sinh đạt 3 sao ở cả sáu câu.
2. Quản lý cập nhật phiên bản nguồn 1 → 2 trước khi học sinh đóng tuần.
3. Giữ mã `math-0`, đổi từ “2 + 3 bằng bao nhiêu?” sang “5 + 7 bằng bao nhiêu?”, thay đáp án tương ứng.
4. Mở bản mới: câu mới chưa có lượt trả lời nhưng vẫn 3 sao; cả tuần vẫn `ready:true`.

Kết quả giống nhau trên SQLite và API cloud/PostgreSQL WASM. Vì vậy điều kiện “mọi câu hiện tại đạt ít nhất 2 sao” có thể không còn phản ánh bài mà học sinh thực sự đã học.

Nguyên nhân: `src/core/online-import-identity.ts:98` giữ ID có sẵn mà không phân biệt thay đổi nghĩa; `src/core/question-rewards.ts:149` tính mastery từ pack ID + item ID. Bảo vệ tuần đã có học sinh chuyển đi chỉ xử lý tuần đã đóng, chưa xử lý thay đổi nghĩa ở tuần còn mở. Bằng chứng: `adversarial-api.json`, hai dòng `AUDIT-02`, có tier trước/sau và trạng thái tuần.

Đề xuất sửa: phân biệt chỉnh trình bày với đổi nội dung chấm. Không cho tái sử dụng một ID đã có thành tích cho câu khác nghĩa; câu mới cần mã nguồn mới hoặc quy trình chuyển đổi mastery được kiểm chứng. Giữ lịch sử/ví sao cũ, không đặt lại toàn bộ tài khoản. Preview cần chỉ rõ câu nào giữ sao, câu nào là câu mới. Bổ sung kiểm tra cả hai backend, nhập lại Excel và khôi phục sau cập nhật.

### AUDIT-03 — P2: tên file gốc dài làm trang nhập liệu tràn ngang trên điện thoại

Chọn đúng `BAO_AN_LOP3_TUAN01_MOT_FILE_140_CAU.xlsx` và 16 WAV, xem trước rồi đặt viewport 390×844. Cả Chrome và Edge có `document.scrollWidth = 400` trong viewport 390. Đo DOM cho thấy tên file trong `<strong>` và phần danh sách tư liệu bị đẩy tới x ≈ 399,6. Có ảnh và trace. Hai ca kiểm toán bổ sung thất bại đúng tại assertion không tràn ngang, không phải timeout phân tích file.

Nguồn liên quan: `src/screens/OnlineScreen.tsx:153`, bố cục `.online-form` trong `src/styles/online.css:2`. Đề xuất cho tên file ngắt dòng và ràng buộc min-width của các con trong grid, không che nội dung bằng overflow hidden. Tái kiểm 320/360/390px, tên dài không dấu cách, phóng chữ và danh sách nhiều tư liệu. Đây là lỗi trang quản trị; chưa có bằng chứng nó làm sai chấm câu hỏi.

Bằng chứng: `original-import-chrome.json`, `original-import-msedge.json`, `original-browser-report.json` và ảnh/trace trong `original-browser-output/` thuộc thư mục kết quả kiểm toán.

## 3. Những phần kiểm tra đạt và giới hạn của bằng chứng

| Hạng mục | Kết quả mới trong đợt kiểm tra |
|---|---|
| TypeScript, build | Đạt; build riêng trong `test-results/deep-release-audit/dist`, 119 module |
| Node regression | 304/304 đạt: renderer 103, release 9, online 152, cloud 40; TSX syntax đạt |
| Tài nguyên 3D | `npm run test:assets` đạt; không đồng nghĩa FPS/máy thật đạt |
| Dependency audit | Cả production và toàn bộ dependency báo 0 lỗ hổng đã biết tại lúc quét; chưa thay thế SAST, review license hoặc pentest đầy đủ |
| Bộ browser hiện có | Lượt đầy đủ: 95/96 đạt; 1 lỗi chờ trong kịch bản vòng đời, phân tích và kiểm lại như bên dưới |
| Vòng đời sau sửa kịch bản | 6/6 đạt, ba lượt riêng trên mỗi Chrome/Edge, mỗi lượt 20 lần vào/thoát |
| Kiểm toán file thật | 2/2 ca thất bại tại kiểm tra tràn ngang 390px; parsing/upload nhanh và không có pageerror |
| API đối kháng | Bốn kết quả tái hiện xác nhận hai lỗi P1 trên hai backend; không tính đây là bốn ca PASS về an toàn |

Ca vòng đời cũ kiểm tra `count()` ngay sau khi mở `<details>`, trước khi React xử lý `onToggle`, rồi đợi nhầm nút “Chọn trò…” trong khi nút “Tiếp tục…” đã hiện. Ảnh/trace xác nhận trạng thái UI hoạt động. Chỉ thêm chờ `.online-question-stars-body` trong `tests/visual/online-weekplan.spec.ts` rồi chạy ba lần mỗi trình duyệt; không nới điều kiện kiểm tra heap/DOM/audio/canvas. Giữ log lượt đầy đủ thất bại và log 6 lượt kiểm lại, không đổi báo cáo lượt đầy đủ thành 96/96.

Các ca trình duyệt đã chạy gồm: mẫu Excel 36 câu/tám dạng + ảnh/âm thanh, chọn chung tệp, null/lỗi ô Excel, chỉ giao câu hợp lệ, giới hạn 3–4 môn/tối đa 12 câu/môn, bảng trò phù hợp, ghép cặp chia màn 6 cặp desktop/4 mobile, giữ màn khi resize, câu/ảnh dài, retry ảnh/lỗi API/chunk, cảnh 3D tải chậm hoặc thiếu, mật khẩu tự đổi/thu hồi phiên, giới hạn sao theo câu/qua game và xác nhận chuyển tuần. Các tình huống thông thường đạt không phủ được hai lỗi API/cập nhật mới phát hiện.

Đã xem ảnh kết quả thẻ có chữ/ảnh dài ở mobile và câu trắc nghiệm mobile. Chữ nằm trong thẻ, nội dung/cuộn đáp án có thể tiếp cận ở các viewport đã kiểm. Độ dễ đọc đối với học sinh, giọng đọc tiếng Việt thực tế và Safari/Android thật chưa được xác nhận. Kiểm thử giọng đọc hiện mô phỏng danh sách voice/sự kiện, không phải nghe đánh giá phát âm trên thiết bị.

### Đúng file 140 câu và 16 âm thanh của người dùng

| Dữ liệu / thao tác | Chrome | Edge |
|---|---:|---:|
| Excel | 37.408 byte | cùng tệp |
| 16 WAV | tổng 1.002.058 byte, khoảng 0,96 MiB | cùng tệp |
| Bấm kiểm tra → preview hiện | 557 ms | 549 ms |
| POST media/batch | 1 | 1 |
| Tư liệu nhận | 16 | 16 |
| GET dashboard trong luồng | 0 | 0 |
| Câu hợp lệ / tổng | 139/140 | 139/140 |
| Lỗi JavaScript trang | 0 | 0 |

Số đo trên máy kiểm thử với API cloud adapter và DB/Storage fixture tại máy; chưa phải Supabase/Netlify thật hoặc cam kết tốc độ mọi thiết bị/mạng. Không tái hiện độ chờ năm phút trong môi trường này.

Câu bị loại có mã `BA3.W01.WK.TOAN.quiz.008`, sheet Câu hỏi, dòng 122: “Dấu thích hợp điền vào 455 ... 400 + 50 + 5 là gì?”. **Ô F122 chứa chuỗi lỗi `#NAME?` ngay trong XML gốc**, không phải ứng dụng tự tạo lỗi này; đã đối chiếu `xl/worksheets/sheet1.xml`. Cần người soạn sửa đáp án lựa chọn ở Excel rồi kiểm tra lại. Không tự đoán/thay đáp án trong file nguồn.

File có 10 môn; Tiếng Anh 50 câu, Tiếng Việt 28, Toán 27 sau khi loại lỗi. Vì vượt luật đã chốt cho tuần mới, nút giao bài khóa đúng, có giải thích. Đây không phải lỗi tải: để giao theo RC9 cần chia thành các tuần 3–4 môn, tối đa 12 câu/môn. Không tự cắt 140 câu hoặc đổi tiến độ các tuần cũ. Ca riêng với bộ ba môn hợp lệ đã kiểm việc chỉ giao các câu tốt.

### Tải dữ liệu và bộ nhớ

Luồng mới dùng trang metadata, chỉ tải nội dung một tuần/bộ khi mở, preview dựng phần thử câu khi cần, truyền tư liệu theo batch; các kiểm tra này có assertion và đã chạy. Vòng đời kiểm lại có GC/heap, DOM, audio và canvas; không phát hiện tăng vượt ngưỡng test trong 20 chu kỳ/lượt.

Chưa có phép đo xác nhận 30–60 phút trên máy RAM thấp, 30 ván hoàn chỉnh/10 lần đổi cảnh, thermal/background kill, 100 học sinh cùng nộp điểm trên PostgreSQL thật hoặc soak 60 phút. Không dùng kết quả PGlite một backend tuần tự để cam kết khả năng chịu tải PostgreSQL nhiều kết nối. Các mutation PostgreSQL hiện lấy khóa workspace; đây là điểm cần đo contention tại staging trước khi tối ưu, chưa phải một lỗi tốc độ production đã được tái hiện.

### Website đang dùng và khả năng truy vết bản phát hành

GET công khai lúc khoảng 17:05 ngày 17/10 giờ Việt Nam: website và `/api/online/status` HTTP 200, API available/configured true. Trang chủ mất 1.362 ms trong lần đo, status lần đầu 3.338 ms, lần tiếp theo 531 ms. Đây là tổng thời gian HTTP từ máy kiểm thử, không tách được cold start, DB hay mạng, không đo được vào game có đăng nhập.

Website còn build `2bb9c2c7dbb008a8`; gói RC9 bất biến là `19fa3bb921d42cad`. Vì vậy không thể coi website đang dùng đã chứa các sửa RC9 chỉ vì kiểm thử cục bộ đạt. Chưa đăng nhập website thật, chưa thực hiện smoke có tài khoản thử hoặc đo tải cloud.

Bản build kiểm toán riêng có ID `6dee9f95446588a2`: các tệp ứng dụng JS/CSS khớp RC9; khác manifest worker do Vite còn sao chép thư mục mẫu rời đã có sẵn trong public. Khác biệt được liệt kê trong `artifact-verification.json`, không xóa thư mục của người dùng và không ghi đè gói RC9. 67 tệp trong manifest gói RC9 đều khớp hash; ZIP RC9 và ZIP mẫu đầy đủ cũng khớp checksum đã bàn giao. Không tạo gói phát hành mới trong đợt rà soát.

## 4. Đánh giá G0–G7

| Cổng | Đánh giá hiện tại | Điều kiện còn thiếu |
|---|---|---|
| G0 Phạm vi | Chưa ký duyệt đầy đủ | Chốt Web/Windows Chrome–Edge và phần nào của workbook áp dụng lần đầu; quyết định các yêu cầu phụ huynh/kiểm duyệt/xuất/thu hồi/PWA/native |
| G1 Mã/build | Đạt nhiều kiểm tra cục bộ, còn chặn | Sửa hai P1, review lại, CI từ commit sạch, SAST/giấy phép theo phạm vi; audit dependency 0 chưa đủ |
| G2 Game | Chưa nghiệm thu staging | Xử lý luật sao/giao thức và cập nhật nguồn; chạy đủ P0 phù hợp trên bản staging xác định |
| G3 Học liệu/quyền | Chưa đủ | Sửa độ tin cậy thành tích; giáo viên duyệt đáp án, lời giải, mốc thời gian, độ vừa sức; nghiệm thu quyền riêng tư và các vai trò đã chọn |
| G4 Giao diện/thiết bị | Có lỗi xác nhận, thiếu máy thật | Sửa AUDIT-03; Android/iPhone/Safari nếu trong phạm vi, giọng Việt, touch/keyboard/safe area, FPS và RAM thật |
| G5 Tải/phục hồi | Có bằng chứng local, thiếu cloud | Tải staging 30/100 học sinh, burst/nộp lại, dữ liệu không trùng/mất, phục hồi PostgreSQL + Storage cách ly, chốt RPO/RTO |
| G6 UAT | Chưa chạy/không có biên bản | Học sinh nhiều mức năng lực và giáo viên làm tác vụ thật; phụ huynh nếu giữ trong scope |
| G7 Phát hành/vận hành | Chưa đạt | Đóng các cổng trước, đúng commit UI/API, smoke, monitoring/cảnh báo, người chịu trách nhiệm và diễn tập rollback |

Không có đủ dữ liệu để ghi “100% P0 đạt”, “không còn lỗi”, “không rò rỉ bộ nhớ” hoặc “chịu được 100 học sinh”. Cũng chưa có bằng chứng để khẳng định có lỗi P0 rò dữ liệu: những lỗi đã tái hiện được phân loại rõ ở trên, các phần chưa chạy được giữ là chưa xác minh.

Ngoài phạm vi, còn cần hồ sơ chính sách dữ liệu trẻ em/retention/xóa dữ liệu, chứng cứ backup cloud, và theo dõi tỷ lệ lỗi/độ trễ/crash có chủ sở hữu. Chưa có chứng cứ nghiệm thu các mục này. Rà soát này không thay cho kết luận pháp lý hoặc chứng nhận bảo mật độc lập.

## 5. Thứ tự hoàn thiện và điều kiện đóng

1. **Chốt phạm vi G0** dựa trên workbook và yêu cầu đã thống nhất. Giữ luật 3–4 môn, mọi câu có sao, tối đa 3 sao/câu, tuần tất cả đạt 2 sao rồi xác nhận chuyển. Nếu kênh đầu chỉ là Web thì ghi rõ, không coi native/portal chưa làm là đã có.
2. **Sửa AUDIT-01 và AUDIT-02 trước.** Thử API trực tiếp, hint giả, clock sai thứ tự, retry/multi-device; câu đổi nghĩa không được tự có mastery, sửa trình bày giữ sao đúng. Không reset ví hoặc lịch sử học sinh. Kiểm hai backend và backup/restore liên quan. Chỉ giữ dữ liệu câu hiện hành/biên nhận nhỏ, không tải thêm toàn ngân hàng để chống gian lận.
3. **Sửa AUDIT-03** và kiểm tên file dài, nhiều tư liệu ở 320–390px, cỡ chữ lớn. Giữ nguyên khả năng chỉ giao câu tốt và nêu vị trí lỗi. Kiểm lại mẫu Excel 36 câu và file gốc 140 câu sau chia tuần hợp lệ.
4. **Dựng bản staging riêng từ commit đã sửa**, có tài khoản/dữ liệu giả, UI và Function cùng commit. Đo upload/preview thật, p50/p95 vào game/nộp đáp án, rồi tăng 30 → 100 học sinh; fault injection, burst, soak và đối chiếu DB. Chốt ngân sách từ số đo, không hứa mốc 1,5 giây chỉ từ fixture.
5. **Diễn tập cloud recovery trên môi trường cách ly**, gồm PostgreSQL và toàn bộ đối tượng Storage, giữ sổ sao/khóa tuần, hash tư liệu, xác nhận RPO/RTO và rollback. Không phục hồi thử vào website đang có học sinh.
6. **Nghiệm thu máy thật và sư phạm/UAT**, ưu tiên máy yếu, giọng Việt, bài nghe/đọc dài, học sinh đọc chậm và câu chỉ hợp một game. Đánh giá mốc sao thời gian đã chọn có tạo bế tắc tuần hay không; không tự đổi chính sách tốc độ trong đợt kiểm toán.
7. **Tạo ứng viên phiên bản mới sau sửa**, không ghi đè RC9. Chạy hồi quy + các ca lỗi mới, đóng từng cổng bằng bằng chứng, phát hành giới hạn có monitoring và rollback trước khi mở rộng. Ngân hàng sao hiện theo câu nguồn pack ID/item ID; chống trùng ngữ nghĩa toàn bộ các bộ/tuần là phạm vi khác, chưa được cam kết bởi các kiểm tra chống cộng sao qua game.

Theo thứ tự `LO_TRINH_QA`, phần khảo sát/build/kiểm kỹ thuật có thể làm cục bộ đã có bằng chứng; phần staging, thiết bị thật, UAT và vận hành còn mở. Không biến lộ trình tám tuần đề xuất trong workbook thành lịch bắt buộc hoặc điền kết quả giả.

## 6. Bằng chứng và tái lập

Các tệp trong `test-results/deep-release-audit/`: `node-regression.log`, `typecheck.log`, `build.log`, `assets.log`, `npm-audit-production.json`, `npm-audit-all.json`, `browser-regression.log`, `browser-report.json`, `browser-lifecycle-recheck.log`, `browser-lifecycle-recheck.json`, `adversarial-api.json`, `original-import-chrome.json`, `original-import-msedge.json`, `original-browser-report.json`, `public-site-check.json`, `artifact-verification.json`, `source-workbook.json`, `requirements-crosswalk.json`. Các thư mục browser output chứa ảnh và trace của ca thất bại; không cần đăng nhập dữ liệu thật để xem.

Công cụ có mã nguồn tại `tools/release-audit-2026-10-17/README.md`. Chạy ở gốc repo, sau khi cài dependency:

```powershell
npm run typecheck
npx vite build --outDir test-results/deep-release-audit/dist
node --experimental-strip-types tools/release-audit-2026-10-17/adversarial-api.mjs
npx playwright test --config=tools/release-audit-2026-10-17/playwright.config.ts
node tools/release-audit-2026-10-17/verify-artifacts.mjs
```

Công cụ API hiện xác nhận tái hiện lỗi và lưu JSON; mã thoát 0 của nó không có nghĩa sản phẩm đạt bảo mật. Hai ca browser kiểm toán hiện cố ý giữ assertion đúng yêu cầu nên vẫn FAIL cho tới khi sửa lỗi tràn ngang. Khi sửa sản phẩm cần biến các trường hợp đối kháng thành regression assertion kỳ vọng hành vi an toàn. Không sử dụng công cụ chẩn đoán xác nhận lỗi làm test PASS an toàn trên CI.

Chỉ thay đổi mới của đợt này: báo cáo, công cụ kiểm toán, bằng chứng và điểm chờ DOM của test vòng đời. Các thay đổi ứng dụng RC9 đã có từ trước được giữ nguyên. Chưa commit, push hoặc deploy.
