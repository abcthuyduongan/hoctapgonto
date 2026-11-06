# Kế hoạch sửa lỗi và nâng cấp sau đánh giá 4.0.0

Ngày lập: **05/11/2026**. Đích đề xuất: **4.0.1 sau khi đủ nghiệm thu**, chưa phải phiên bản đã phát hành. Căn cứ [báo cáo độc lập](01_BAO_CAO_LOI_VA_DANH_GIA.md) và yêu cầu mới về xáo đáp án của chủ dự án.

## 1. Phạm vi và nguyên tắc

- Giữ giao diện bản đồ nhẹ và tài nguyên đã làm. Không thêm engine nhân vật 2D/3D, không dựng lại sản phẩm.
- Học liệu do chủ dự án/giáo viên cung cấp. Công việc lập trình là nhận, kiểm tra, hiển thị, xáo lựa chọn và chấm đúng; không thêm danh mục kỹ năng hoặc tự xác nhận đã duyệt học liệu.
- Không đổi nội dung đáp án đúng để “đổi đáp án”. Phải đổi **vị trí hiển thị** của lựa chọn và cập nhật ánh xạ chấm điểm.
- Bảo toàn các bất biến: mỗi câu tối đa 3 sao; chỉ máy chủ cấp sao; học lại chỉ cộng phần chênh lệch; tuần đã đóng không mở lại; đồng hồ/nghe/gợi ý không được đặt lại để kiếm thêm sao.
- Dùng dữ liệu thử và bản sao dữ liệu cũ để kiểm tra nâng cấp/khôi phục. Không thử sửa schema trên cơ sở dữ liệu thật trước khi có bản sao và diễn tập thành công.
- Không nâng ngưỡng, xóa assert, bỏ bài hỏng hoặc đổi báo cáo thành PASS để vượt cổng.

## 2. Thứ tự bàn giao và cổng dừng

| Đợt | Công việc | Điều kiện sang đợt tiếp theo |
| --- | --- | --- |
| A. Khóa lỗi chặn | R01 quyền/PIN; R02 sao lưu; R04 migration | Các ca quyền, chống mất dữ liệu, cài mới/nâng cấp đạt cả hai backend; không còn P0 |
| B. Sửa nghiệp vụ học và trải nghiệm | R03 xáo đáp án; R05 E2E và cuộn | Không đoán được bằng luôn chọn A; chấm/sao/retry đúng; luồng chính dùng được ở ba khổ |
| C. Hoàn thiện bằng chứng | R06 sổ nghiệm thu; R07 tải thật; R08 dùng thử; R09 học liệu; R10 truy cập/tài nguyên | Kết quả có nguồn, không còn P1; dữ liệu thử và thực tế được phân biệt |
| D. Phát hành | R11 đóng gói, staging, website, bàn giao | Build/source ID khớp; migration và rollback đã diễn tập; nghiệm thu ký đúng người |
| E. Nâng cấp tiếp | R12, chỉ làm khi đợt D đạt | Có nhu cầu từ quan sát sử dụng thật, có tiêu chí và đo trước/sau |

R03 có thể thiết kế song song với R01, nhưng hợp nhất sau khi hợp đồng quyền/phiên đã thống nhất. R02 và R04 cần chung danh sách bảng/migration. Không thử tải thật hoặc lớp thật trên bản còn P0.

## 3. R01 — Bảo vệ phụ huynh tại máy chủ

**Đóng L01, L02; P0; dự toán 2–3 ngày công.**

Tệp trọng tâm: `server/online-server.mjs`, `server/cloud-api.mjs`, `server/online-store.mjs`, `server/postgres-store.mjs`, `server/parent-data.mjs`, `src/core/parent-controls.ts`, `src/core/online-client.ts`, màn phụ huynh và các bài `tests/parent-portal.test.mjs`, `tests/cloud-api.test.mjs`.

Thực hiện:

1. Lập bảng quyền cho admin, parent và student ở từng tuyến: xem báo cáo, đổi cài đặt, đặt/đổi PIN, quản lý quà, duyệt đổi quà. Tách thông tin học sinh được phép xem khỏi thao tác phụ huynh.
2. Viết một chính sách quyền dùng chung: đúng workspace, trẻ tồn tại, parent có liên kết `parent_students`, student chỉ đúng chính mình; không để các tuyến tự kiểm tra khác nhau.
3. Khi PIN đúng, cấp quyền tạm thời phía máy chủ, hạn đề xuất 10 phút; ràng buộc phiên đăng nhập, user, student, workspace và phạm vi thao tác. Có thể dùng bản ghi token băm hoặc cơ chế ký có xác thực và thu hồi; không nhận token tính từ dữ liệu công khai.
4. Mọi thao tác nhạy cảm phải kiểm tra quyền này. Admin được xử lý theo chính sách quản trị rõ ràng; đăng nhập parent không cho phép chạm trẻ chưa liên kết. Kiểm tra vai trò/liên kết trước khi chấp nhận PIN để tránh dò chéo.
5. Chống đoán PIN, khóa tạm sau số lần sai; logout, đổi PIN, đổi mật khẩu, ngừng tài khoản phải vô hiệu quyền liên quan. Không lưu PIN/token trong log; không phát token phụ huynh vào dữ liệu tổng quan học sinh.
6. Tạo DTO công khai theo danh sách trường được phép. Loại `pinHash`, `pinSalt`, thông tin khóa nội bộ khỏi mọi response, kể cả sau cập nhật thành công. Chỉ trả `hasPin` nếu giao diện cần.
7. Client gửi quyền theo hợp đồng đã chốt; trả lại màn nhập PIN khi hết hạn; không tự coi `unlocked=true` là quyền máy chủ.

Nghiệm thu: AU01–AU09. Cần log HTTP 403/200 và snapshot bản ghi trước/sau cho **SQLite HTTP và PostgreSQL API**. Không đóng lỗi chỉ dựa vào bài Playwright nhập PIN đúng.

## 4. R02 — Sao lưu/khôi phục đủ và báo thất bại chính xác

**Đóng L03, L04; P0; dự toán 2–3 ngày công.**

Tệp trọng tâm: `server/cloud-backup-restore.mjs`, các migration, `tests/cloud-backup-restore.test.mjs`, `tests/staging-rollback-rehearsal.test.mjs`; đối chiếu backup SQLite đang có để giữ cùng ý nghĩa dữ liệu.

Thực hiện:

1. Liệt kê mọi bảng/tệp thuộc một workspace và phân loại dữ liệu nghiệp vụ so với dữ liệu phiên đăng nhập. Bắt buộc có `parent_students`, `student_goals`, quà, huy hiệu, streak, nhiệm vụ, thi thử, thị trấn, vật liệu và bảng tin.
2. Tạo manifest backup có phiên bản schema, migration đã áp dụng, số bản ghi, dung lượng, hash từng media và thời điểm snapshot nhất quán. Đối chiếu danh sách với schema để phát hiện bảng mới chưa được khai báo.
3. Dùng snapshot/giao dịch đọc phù hợp để tránh lấy ví trước một giao dịch và lịch sử sao sau giao dịch đó. Có chính sách khi ghi dữ liệu tiếp tục trong lúc xuất.
4. Bỏ các nhánh bắt lỗi rồi thay dữ liệu bằng rỗng. Lỗi truy vấn/tải media làm toàn bộ xuất thất bại, có tên bước/tệp nhưng không lộ bí mật. Không công bố tệp dở là “bản sao hợp lệ”.
5. Kiểm tra `actualBytes === declaredSize` và SHA-256 đúng metadata nguồn, kể cả 0 byte. Với media không cho phép rỗng phải từ chối rỗng ngay.
6. Trước restore, kiểm tra phiên bản, checksum, đầy đủ bảng, khóa ngoại, trùng ID và dung lượng. Ghi theo thứ tự phụ thuộc, có xử lý rollback/cleanup khi Storage và SQL không cùng giao dịch. Không dùng bỏ qua xung đột để che dữ liệu mất.
7. Khôi phục vào đích thử sạch, đọc lại media từ Storage và đối chiếu từng nhóm dữ liệu. Phục hồi dữ liệu phiên phải có chính sách an toàn: ưu tiên vô hiệu phiên đăng nhập/quyền PIN cũ; phiên chơi và ánh xạ câu cần giữ đúng để không lệch chấm điểm.
8. Cung cấp kết quả rõ `SUCCESS` hoặc `FAILED` với số liệu, lỗi và manifest; chạy thử phục hồi là một bước riêng, không suy ra từ xuất thành công.

Nghiệm thu: BK01–BK08. Ca lỗi phải xác nhận không thay đổi đích đang hoạt động hoặc có quy trình phục hồi đã thử thành công.

## 5. R03 — Xáo lựa chọn khi gọi lại câu hỏi, chấm theo ánh xạ máy chủ

**Đóng L07, yêu cầu trực tiếp của chủ dự án; P1; dự toán 3–4 ngày công.**

Tệp trọng tâm: `server/question-protocol.mjs`, `server/question-journey.mjs`, hai store, `src/core/contracts.ts`, `src/core/online-exercises.ts`, `src/core/game-rewards.ts`, `src/core/game-presentation.ts`, `src/core/online-client.ts`, các màn `src/games/MathQuest.tsx`, `src/games/BoatRace.tsx`, màn bài tập mở rộng và `server/contest-data.mjs`/`src/core/contest-matrix.ts`.

### 5.1. Hành vi cần đạt

| Tình huống | Thứ tự lựa chọn |
| --- | --- |
| Câu xuất hiện lần đầu | Máy chủ xáo ngay, không giữ mặc định đáp án A của nguồn |
| Cùng học sinh gọi lại cùng câu trong lượt chơi/lượt ôn mới | Xáo lại; vị trí đáp án đúng phải khác lần trình bày mới trước đó của chính học sinh/câu/phiên bản |
| Sai rồi chọn “Làm lại” sau khi máy chủ đã xác nhận lần sai | Nếu tạo lượt trình bày mới thì xáo lại, có ID mới; giữ đồng hồ/gợi ý và quy tắc trừ sao theo thiết kế hiện có |
| Mất phản hồi, gửi lại cùng yêu cầu hoặc cùng `attemptKey` | Giữ nguyên thứ tự, ID, ánh xạ và kết quả; không phát lượt mới |
| Tải lại trang, tiếp tục phiên đang chơi | Khôi phục đúng thứ tự đang thấy; không xáo vì render lại |
| Sang câu khác | Ánh xạ riêng cho câu đó |
| Xuất đáp án cho giáo viên | Ghi rõ đáp án nguồn; nếu xuất theo phiên thì dùng thứ tự của phiên. Không ghi chung “A” cho mọi phiên |

Phạm vi bắt buộc: trắc nghiệm thường, đọc hiểu chọn đáp án, nghe chọn đáp án, trò dùng cùng câu trắc nghiệm và thi thử có lựa chọn. Dạng điền từ/số không tự biến thành trắc nghiệm. Trò ghép cặp/sắp xếp đã xáo phần tử cần giữ chấm đúng và được kiểm tra hồi quy, không trộn thứ tự đúng của câu văn thành đáp án nguồn sai.

### 5.2. Thiết kế và bước triển khai

1. Khảo sát mọi đường phát câu, không chỉ `MathQuest`; xác định câu nào đang gửi nguyên lựa chọn ở bài luyện, game mới, ôn sai và thi thử. Lập danh sách để không còn đường bỏ sót.
2. Định danh đáp án nguồn ổn định bằng ID hoặc chỉ số nguồn nội bộ; không dùng so khớp chuỗi vì có thể có hai lựa chọn trùng nội dung. Bộ học liệu gốc bất biến.
3. Khi tạo lượt trình bày mới, máy chủ sinh hoán vị bằng nguồn ngẫu nhiên phù hợp. Với từ hai lựa chọn trở lên, chọn vị trí đúng khác lần trình bày mới trước; xáo các lựa chọn còn lại. Không dùng chu kỳ cố định A→B→C→D. Với bốn lựa chọn, không ép đáp án vào một vị trí cố định khác A.
4. Lưu `presentationId`, phiên bản hợp đồng, hoán vị, liên kết session/student/item/contentVersion và trạng thái trả lời trong dữ liệu phía máy chủ. Lưu vị trí đúng gần nhất theo student/item/version để chống lặp giữa các session; xử lý hai yêu cầu tạo đồng thời bằng giao dịch hoặc khóa phù hợp.
5. Chỉ gửi `presentationId` và các lựa chọn hiển thị/ID mờ cho client. Không gửi `correctIndex` nguồn, dấu đúng/sai, hoán vị nguồn hoặc đáp án trước thời điểm cho phép.
6. Client gửi `presentationId` + lựa chọn hiển thị và `attemptKey`. Máy chủ ánh xạ về lựa chọn nguồn rồi dùng bộ chấm hiện tại. Không nhận cờ `correct` từ client. Lượt cũ đã bị thay thế phải bị từ chối 409, trừ yêu cầu idempotent đã được ghi và được trả đúng biên nhận cũ.
7. `feedback.correctIndex` sau khi trả lời phải theo thứ tự hiển thị đang dùng. Gợi ý, âm thanh và lời giải vẫn đúng câu. Không lộ lời giải sớm do đổi hoán vị.
8. Retry khi mất ACK phải trả cùng ánh xạ, không tạo ngẫu nhiên mới. Khi sai rồi mở lượt mới, không đặt lại đồng hồ câu để tăng sao; không xóa lịch sử gợi ý hay lần sai.
9. Lưu/khôi phục ánh xạ qua reload, restart, backup/restore. Thiết kế migration cho phiên cũ: phiên cũ đang chạy giữ hợp đồng cũ đến khi hoàn tất hoặc được chuyển đổi có kiểm chứng; mọi lượt mới từ bộ học liệu cũ phải được xáo.
10. Với lựa chọn kiểu “Tất cả A và B”, “Cả A/B/C”, hoặc chứa chữ cái vị trí: báo cho người soạn sửa thành nội dung độc lập trước khi xuất bản. Không xáo mù làm thay nghĩa và không âm thầm bỏ xáo.
11. Thêm bảng kiểm thống kê vị trí đáp án trong nguồn để cảnh báo bộ 100% A; đây là cảnh báo chất lượng soạn bài, không phải cơ chế bảo vệ. Việc chỉ chỉnh `correctIndex` hoặc đổi thứ tự một lần trong JSON không thay thế xáo từng lượt.

Nghiệm thu bắt buộc: AN01–AN12. Kiểm thử thuật toán dùng nguồn ngẫu nhiên điều khiển được để bao phủ đủ vị trí; không dùng xác suất may rủi làm cổng CI. Thêm kiểm tra nhiều lượt thực tế để phát hiện lệch, nhưng không yêu cầu phân bố tuyệt đối 25% ở một mẫu nhỏ. Với hai lựa chọn, đổi vị trí lần kế tiếp tất yếu chỉ có một vị trí khác; không hứa tính ngẫu nhiên không thể có.

## 6. R04 — Cài mới và nâng cấp schema nhất quán

**Đóng L05, L06; P1; dự toán 2–3 ngày công.**

Tệp trọng tâm: `server/cloud-deployment.mjs`, `server/setup-cloud.mjs`, `server/postgres-store.mjs`, `server/online-store.mjs`, `supabase/migrations/`, `tests/cloud-deployment.test.mjs`, fixture và bài nâng cấp mới.

1. Tạo danh sách migration có thứ tự và lịch sử phiên bản/checksum. `cloud:setup`, `cloud:check`, test fixture và kiểm tra khởi động dùng cùng nguồn khai báo.
2. Không coi `max(schema_version)=1` là đủ cho tính năng mới. Kiểm tra migration bắt buộc, bảng/cột/index/RLS/quyền đang dùng; thông báo chính xác phần thiếu.
3. Diễn tập cloud từ schema nền hiện hành lên đích, giữ người dùng, lớp, học liệu, câu trả lời, ví sao và media. Chạy lần hai phải không tác động dữ liệu.
4. Với SQLite, dùng migration đúng cho thay đổi CHECK role: tạo bảng đích, chép dữ liệu, dựng lại chỉ mục/khóa ngoại theo giao dịch và quy trình phù hợp SQLite; chạy `foreign_key_check`, đối chiếu row/ID và khởi động lại. Không chỉ thêm `parent` vào chuỗi `CREATE IF NOT EXISTS`.
5. Chặn khởi động hoặc chuyển sang chế độ bảo trì nếu nâng cấp thất bại; không tiếp tục phục vụ với nửa schema mới. Có bản sao trước nâng cấp và cách quay lại bản ứng dụng tương thích.
6. Thêm fixture **đúng schema cũ**, thay vì chỉ kiểm thử một DB mới đã nạp mọi SQL. Rà cả dữ liệu phiên chơi trước và sau bổ sung xáo đáp án R03.

Nghiệm thu: MG01–MG06, thực hiện với SQLite và PostgreSQL theo đường chạy thực tế của từng loại.

## 7. R05 — Sửa E2E và luồng cuộn thực tế

**Đóng L08; P1; dự toán 2–3 ngày công.**

1. Nút thi thử dùng role/name duy nhất “Mở phòng thi thử”; sổ khám phá dùng “Mở Sổ khám phá”. Chỉ thêm test ID khi tên truy cập không đủ. Không dùng `.first()` để chọn ngẫu nhiên phần tử.
2. Màn thị trấn dùng role dialog đúng tên và kiểm tra nội dung xây dựng; không thêm một class rỗng chỉ để bài đạt mà bỏ luồng nghiệp vụ.
3. Các bài hành trình/tổng quan phải bấm mở hành trình trước khi thao tác phân trang. Vẫn xác nhận đủ tuần cũ, đủ gói, không tải toàn bộ câu/đáp án sớm, không tự mở lại tuần đã đóng.
4. Bài routing so sánh đúng danh sách trò được phép từ bộ do giáo viên giao và registry; không cố định 2 hoặc sửa thành 3 mà không chứng minh bộ nào được phép.
5. Điều tra Edge điện thoại 390×844 sau thoát game: khôi phục overflow/body, cuộn trang và container, chiều cao nội dung, sticky header và tiêu điểm. Giữ thao tác chuột/vuốt thật; cho người dùng thấy cách mở danh sách và chạm được nút chơi. Bài kiểm thử có thể cần vuốt đến đích theo điều kiện và giới hạn hợp lý, không phụ thuộc đúng ba cú vuốt khi nội dung đã dài hơn.
6. Xác minh cả 390×844, 768×1024 và 1440×900; Chrome/Edge, đóng/mở game nhiều lần, tên bài dài và dữ liệu nhiều tuần.
7. Cung cấp fixture Excel/WAV tái tạo được và không chứa dữ liệu riêng để thay ca phụ thuộc tệp cá nhân. Nếu chưa có thì giữ SKIP với lý do và không ghi toàn bộ PASS.
8. Chạy lại nhóm đã sửa trước, sau đó **toàn bộ** cấu hình Playwright không giới hạn dừng sớm, lưu JSON, trace khi lỗi, ảnh ba khổ. Không dựa vào kết quả 160 ca cũ cho build đã sửa.

Nghiệm thu: UI01–UI06; không còn lỗi chưa phân loại. Lỗi cuộn đã thất bại trong lần chạy chính và 2/2 lần chạy bổ sung, cần bằng chứng đóng riêng.

## 8. R06 — Sổ nghiệm thu và báo cáo có nguồn

**Đóng phần bằng chứng L10 và liên kết 80 ca cũ; P1; dự toán 0,5–1 ngày công.**

1. Đánh dấu báo cáo mô phỏng là mô phỏng; dữ liệu phỏng vấn chưa xảy ra không được ghi là quan sát thực tế. Sửa năm/ngày theo sự kiện có bằng chứng, giữ lịch sử thay đổi.
2. Tách trường `plannedAt`, `executedAt`, người thực hiện, môi trường và build; không dùng ngày dự kiến làm ngày đã chạy.
3. Tạo bản kết quả từ `CASE_RESULTS_TEMPLATE.json` và ma trận mới. Chỉ điền PASS khi có log/ảnh/biên nhận phù hợp; chưa chạy để `CHUA_CHAY`, bị chặn để `BLOCKED`, không tự điền hàng loạt.
4. Mỗi ca có đường dẫn bài tự động hoặc biên bản thủ công, fixture, actual/expected, engine, browser/viewport, source ID. Ca cũ không còn áp dụng phải ghi lý do và ca thay thế được chủ dự án chấp nhận.
5. Bỏ xác nhận duyệt người thật tự sinh trong generator. Metadata duyệt chỉ được nhập từ quyết định thực tế của chủ dự án/giáo viên.

Nghiệm thu: EV01–EV03. Không thay đổi lịch sử bằng chứng đã lưu trong bộ đánh giá này.

## 9. R07 — Đo tốc độ và tải trên staging thật

**Đóng L12; P1; dự toán 1–2 ngày công chuẩn bị và một buổi chạy/điều tra.**

1. Chuẩn bị môi trường staging riêng, cùng loại runtime/DB/Storage và cấu hình deploy với bản định phát hành; ghi URL, vùng máy chủ, build, schema, loại thiết bị và mạng đo. Dùng tài khoản/học liệu/media thử.
2. Giữ bài PGlite hiện có nhưng đổi mô tả thành kiểm thử adapter tổng hợp. Viết công cụ riêng dùng HTTP thực tới staging; phiên đăng nhập/CSRF/media giống ứng dụng.
3. Kịch bản 30 người hoạt động đồng thời trong ít nhất 30 phút: đăng nhập, mở câu, tải ảnh, tải/nghe âm thanh hợp lệ, gửi sai/đúng, nhận sao, ra/vào game, đọc ví, chuyển tuần khi đủ điều kiện. Có thời gian thao tác hợp lý, đợt dồn tải và reconnect.
4. Đo phía trình duyệt từ thao tác mở câu đến sẵn sàng dùng; ảnh tới decode/hiện được, audio tới có thể nghe. Tách p50/p95/p99, lỗi HTTP, lỗi nghiệp vụ, chờ ACK, cold/warm và thời gian mạng. Chỉ đo handler máy chủ không đủ.
5. Cổng tối thiểu theo kế hoạch: p95 mở câu ≤ 800 ms; ảnh ≤ 1.000 ms trên điều kiện mạng đã thống nhất; 30 người đồng thời không lỗi dữ liệu/sao/quyền. Báo rõ mọi lỗi mạng quan sát được và tỷ lệ, không loại mẫu chậm cho đẹp số.
6. Thử 100 người như kiểm tra sức chịu tải tiếp theo; nếu chưa đạt, công bố giới hạn và kế hoạch mở rộng, không suy ra 100 đạt từ bài song song 12. Nếu vẫn giữ tiêu chí C10 100 người trong kế hoạch hiện hành thì phải đạt trước khi đóng C10.
7. Sau chạy: đối chiếu attempts/awards/wallet với mong đợi; lưu dữ liệu thô, kịch bản, thời lượng, concurrency thực và log server đã loại thông tin nhạy cảm.

Nghiệm thu: PF01–PF03. Chỉ chạy sau A/B đạt trên staging; không tạo tải vào website đang có học sinh thật.

## 10. R08 — Nghiệm thu với học sinh, phụ huynh và giáo viên

**Đóng phần người dùng thật của L10; P1; dự toán tối thiểu 3–5 ngày quan sát sau khi bản RC ổn định.**

1. Chủ dự án sắp xếp ít nhất học sinh mục tiêu và phụ huynh/giáo viên; dùng mã tham gia, không đưa tên/trích dẫn chưa được xác nhận vào báo cáo.
2. Học sinh tự đăng nhập, tìm vùng/bài, học 15 phút, sai rồi thử lại, thoát game, quay lại, tìm quà/mục tiêu. Ghi lần cần người lớn trợ giúp, nhầm nút, chữ quá nhỏ, mệt hoặc chờ lâu.
3. Thử các nhóm điện thoại, máy tính bảng, máy tính; ghi model/browser thật, không chỉ viewport giả lập. Học sinh không cần kiểm thử quyền bằng công cụ; phần đó đã có tự động.
4. Phụ huynh đặt PIN, giới hạn, duyệt quà, đọc báo cáo; giáo viên nhập bộ thật, kiểm tra preview, giao tuần và xuất đáp án. Xác minh hiểu được thông báo lỗi.
5. Theo dõi ít nhất vài ngày học: streak, nhiệm vụ, quay lại, đổi quà và dữ liệu sau đăng nhập lại. Ghi số liệu quan sát, không sinh thời lượng bằng vòng lặp.
6. Tạo danh sách lỗi/phản hồi theo ưu tiên. Sửa xong chạy hồi quy và thử lại nhiệm vụ đã lỗi. Chủ dự án xác nhận biên bản; không tự ghi “nghiệm thu đạt” thay người tham gia.

Nghiệm thu: HP01–HP03; mọi trợ giúp và hạn chế đều được ghi, không chuyển thành PASS tự động.

## 11. R09 — Kiểm tra và tiếp nhận bộ câu hỏi thật

**Đóng L11; lập trình 1–2 ngày công; thời gian biên soạn/duyệt do chủ dự án bố trí.**

1. Lập bảng 8 tuần × 4 môn; cột số câu, tệp nguồn, phiên bản, người duyệt, thời điểm duyệt, trạng thái import và lỗi. Mỗi ô cần ≥ 12 câu hợp lệ nếu giữ tiêu chí hiện hành.
2. Nhận Excel/Word và media do chủ dự án/giáo viên cung cấp; preview không tự xuất bản. Báo thiếu ảnh/âm thanh, đáp án không hợp lệ, lựa chọn trùng nghĩa, phụ thuộc chữ A/B hoặc lời giải sai.
3. Thêm kiểm tra đủ bốn môn/mỗi tuần/số câu và trùng ID; kiểm tra tham chiếu media, bản quyền/nguồn được người soạn xác nhận. Không coi `approved_ready` do generator ghi là duyệt thật.
4. Áp dụng R03 cho cả bộ cũ và bộ mới; không yêu cầu người soạn phân tán `correctIndex` bằng tay để thay cho cơ chế xáo.
5. Giáo viên kiểm tra nội dung, lời giải và âm thanh; nhập qua đường người dùng thật, giao tuần, chơi mẫu và xuất đáp án đối chiếu. Không giả định JSON dữ liệu nguồn đã tự xuất hiện trong gói chạy.
6. Nếu chủ dự án muốn phát hành ít môn/tuần hơn, ghi quyết định đổi phạm vi rõ trong kế hoạch; không tiếp tục gọi đó là đã đạt tiêu chí 384 câu cũ.

Nghiệm thu: CT01–CT03. Không tự biên soạn thêm ngân hàng câu hỏi hoặc danh mục kỹ năng ngoài yêu cầu.

## 12. R10 — Truy cập và ngân sách giao diện

**Đóng L13, L14; P2 nhưng phải làm trước khi tuyên bố các mục tương ứng PASS; dự toán 1–2 ngày công.**

1. Bật lại `color-contrast` ở các màn chính; xử lý màu chữ/nền, nút disabled và focus trên tranh; quét cả dialog, trạng thái lỗi và vùng khóa.
2. Thử zoom trình duyệt thực 200% và tăng cỡ chữ trên thiết bị; kiểm tra chạm, đọc, cuộn và không che nút/đáp án. Giữ bài viewport hẹp nhưng đổi mô tả đúng nghĩa.
3. Đi bàn phím hết luồng, focus vào/ra dialog, phím Escape, tên nút và thông báo khi đáp án sai/đang lưu; ảnh trang trí không đọc thừa, ảnh câu hỏi có mô tả phù hợp.
4. Kiểm kê artifact 5,08 MiB: nén/tối ưu ảnh, bỏ trùng, chia tải màn phụ huynh/thị trấn/thi thử, giữ độ rõ trên 390/768/1440. Đích ưu tiên trở về ≤ 5 MiB; nếu đổi ngân sách, cần quyết định rõ và số đo tải thật R07.
5. Không giảm chất lượng học liệu âm thanh/ảnh để lấy điểm số build; đo cold/warm và đọc câu trên thiết bị thật sau tối ưu.

Nghiệm thu: AC01–AC03.

## 13. R11 — Đóng gói và phát hành có kiểm chứng

**Đóng L09, tổng hợp mọi lỗi còn lại; P1; dự toán 1 ngày công sau khi các cổng trước đạt.**

1. Đóng băng tính năng, chốt commit/source ID. Chạy toàn bộ lệnh ở ma trận; lưu log và kết quả đầy đủ cho chính build định phát hành.
2. Đóng gói RC với trạng thái thật. Giữ `UNVERIFIED/releaseReady:false` đến khi chủ dự án nghiệm thu; nếu muốn gói chính thức, bổ sung quy trình xuất manifest đọc được bằng chứng nghiệm thu thay vì hardcode hoặc sửa bằng tay.
3. Kiểm tra ZIP chạy trên máy/thư mục sạch; file khởi chạy, thiếu Node hoặc cổng bận có hướng dẫn; không kèm DB riêng, secret, log hay tài khoản thật. Gói source có thể tách ảnh nguồn dung lượng lớn thành gói tư liệu riêng nếu vẫn giữ đủ khả năng dựng bản phát hành.
4. Trên staging, sao lưu trước nâng cấp, áp migration, chạy smoke và phục hồi thử. Chốt rollback: bản ứng dụng nào đọc được schema nào; không rollback mù phiên bản cũ sau migration không tương thích.
5. Triển khai website theo quyền chủ dự án giao. Đối chiếu `build-info.json`, API status, artifact và commit; kiểm tra ảnh/media, đăng nhập, trả lời, ví, phụ huynh và quà bằng tài khoản thử.
6. Lập biên bản kết thúc: lỗi đã đóng, lỗi chấp nhận được nếu có, giới hạn tải, người duyệt, hướng dẫn vận hành và lịch sao lưu. C12 chỉ PASS khi mọi tiêu chí bắt buộc có bằng chứng.

Nghiệm thu: RL01–RL04. Không gán ngày tương lai thành ngày thực hiện.

## 14. R12 — Các nâng cấp sau khi sửa ổn định

Đây là backlog lựa chọn cho bản tiếp theo, **không dùng để trì hoãn sửa P0/P1**. Dự toán từng mục phải chốt lại sau R08.

| Mục nâng cấp | Lý do và việc cụ thể | Cách kiểm tra lợi ích |
| --- | --- | --- |
| N01. Giao diện học sinh gọn hơn | Theo quan sát R08, gom hành động phụ trong một menu; nút “Học tiếp” và điểm đến hiện tại rõ; giữ tranh bản đồ, nhân vật biểu tượng nhẹ | Học sinh tự tìm bài; giảm lần cần chỉ; cuộn tới bài ở ba nhóm thiết bị |
| N02. Công cụ chất lượng câu hỏi | Preview vị trí lựa chọn ngẫu nhiên; cảnh báo đáp án nguồn 100% A, lựa chọn trùng, nhắc chữ cái; cho giáo viên thử một phiên trước giao | Nhập bộ 100% A vẫn học đúng; cảnh báo đúng, không tự sửa nội dung người soạn |
| N03. Giảm trùng chính sách backend | Tách chính sách quyền, ánh xạ lựa chọn và invariant sao thành hàm dùng chung; storage riêng cho SQLite/PG | Cùng một bộ hợp đồng chạy hai backend cho kết quả tương đương |
| N04. Màn sức khỏe vận hành | Hiện build/schema, lần sao lưu thành công, lần diễn tập khôi phục và lỗi gần nhất cho quản trị | Không lộ secret; phát hiện thiếu migration/media trước khi người học gặp lỗi |
| N05. Pipeline phát hành có bằng chứng | CI xuất log, ma trận, artifact hash; chặn phát hành khi P0/P1 hoặc thiếu bài bắt buộc | Cố tình làm hỏng quyền/xáo đáp án/backup và chứng minh pipeline chặn |
| N06. Tối ưu màn tải theo nhu cầu | Lazy load các màn lớn và media ở vùng chưa dùng; thông báo tải/lỗi có nút thử lại rõ | Đo p95 và byte tải trước/sau, không làm thiếu nội dung hoặc đổi đáp án khi retry |

Không cần thêm map lớn hoặc bộ ảnh mới để đóng các lỗi đã tìm thấy. Chỉ yêu cầu chủ dự án tạo ảnh bổ sung khi thử người dùng cho thấy cần, kèm danh sách kích thước/tên tệp cụ thể.

## 15. Dự toán và gói bàn giao cho từng việc

Tổng sửa kỹ thuật/nghiệm thu chuẩn bị khoảng **15–24 ngày công**, phụ thuộc mức sửa schema và giao thức câu hỏi; không phải cam kết tự động hoàn thành trong từng ấy ngày lịch. Một số việc có thể làm song song bởi các người thực hiện độc lập. Thử người dùng cần ít nhất 3–5 ngày quan sát sau khi bản ổn định; học liệu và duyệt chuyên môn là nhánh riêng của chủ dự án. Chỉ lập lịch ngày cụ thể khi biết số người thực hiện và thời gian nhận học liệu.

Mỗi Rxx phải bàn giao:

1. Tóm tắt hành vi trước/sau và các tệp thay đổi.
2. Migration/quy trình rollback nếu có; phân tích tác động dữ liệu cũ và phiên đang chơi.
3. Ca hồi quy gắn mã ở ma trận; expected/actual, lệnh chạy, engine/browser, build ID.
4. Log/JSON/ảnh cần thiết, không chứa tài khoản hay dữ liệu trẻ thật.
5. Danh sách lỗi còn mở và cập nhật nhật ký dự án. Không ghi chung “xong 100%”.

## 16. Checklist đóng C12 sau sửa

- [ ] L01–L07 đã đóng bằng kiểm thử hồi quy đúng cả hai backend khi phù hợp.
- [ ] Không còn P0/P1 chưa xử lý hoặc thiếu bằng chứng bắt buộc.
- [ ] Toàn bộ Playwright đã chạy; bài bỏ qua có lý do và cách nghiệm thu thay thế được chấp nhận.
- [ ] Edge điện thoại sau thoát game cuộn và bấm bài tiếp bình thường.
- [ ] Xáo đáp án đạt AN01–AN12, kể cả bộ nguồn toàn A và lỗi mạng.
- [ ] Cài mới/nâng cấp/backup/restore đã thử trên bản sao đủ dữ liệu.
- [ ] Tốc độ/tải thật, truy cập, học liệu và dùng thử đạt phạm vi đã thống nhất.
- [ ] Website và ZIP khớp source ID; manifest và báo cáo phản ánh đúng trạng thái.
- [ ] Chủ dự án nghiệm thu; kế hoạch và nhật ký thực hiện đã lưu vào dự án.
