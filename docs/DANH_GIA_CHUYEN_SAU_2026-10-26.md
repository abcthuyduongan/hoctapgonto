# Đánh giá chuyên sâu Bảo An Learning — 26/10/2026

## Kết luận

**Dự án có nền tảng nghiệp vụ và kiểm thử tốt để tiếp tục thử nghiệm có kiểm soát. Chưa đủ bằng chứng để xác nhận sẵn sàng triển khai rộng cho nhiều lớp trên cloud.**

Luồng học sinh, năm trò chơi, sao theo câu và quản trị không còn ở mức bản mẫu giao diện. Hệ thống đã xử lý nhiều tình huống khó: gửi lại câu trả lời, thu hồi phiên, đổi nội dung học liệu, lưu sao, nhập tệp lỗi và phục hồi SQLite. Tuy nhiên, kiểm thử tự động thành công không chứng minh trải nghiệm học sinh đã trơn tru trên mạng và thiết bị thực tế.

Không phát hiện lỗi nghiêm trọng mới về mất sao hoặc vượt quyền trong phạm vi kiểm tra này. Có một vấn đề tích lũy dữ liệu được tái hiện, các rủi ro mở rộng được xác nhận từ mã nguồn và những khoảng trống nghiệm thu cần đóng trước phát hành rộng. Không quy các rủi ro thiết kế thành lỗi đã xảy ra trên production.

## Phạm vi và bằng chứng

- Commit đánh giá: `a6d0af19a784608ab9505c0f2d6974497410b80e`, nhánh `feature/v37-premium-world`; phiên bản khai báo `3.8.0-rc.12`.
- Rà soát cấu trúc React/TypeScript, học sinh/chơi bài, giao tiếp API, hai backend SQLite/PostgreSQL, tài khoản, sao/đổi quà, nhập tài liệu, media, backup, cấu hình build/CI/Docker/Netlify và hồ sơ nghiệm thu.
- Chạy mới toàn bộ `npm run verify:local`, `npm audit --json` và kịch bản tái hiện riêng về dữ liệu giới hạn đăng nhập.
- Không sửa logic ứng dụng; không triển khai, ghi vào dữ liệu thật hoặc đẩy thay đổi lên Git trong đợt đánh giá.
- Các thư mục có sẵn chưa được Git quản lý `outputs/` và `public/question-templates/bo-mau-day-du/` được giữ nguyên.

| Kiểm tra mới | Kết quả | Giới hạn diễn giải |
|---|---|---|
| TypeScript | Đạt | Phạm vi cấu hình không bao gồm kiểm tra kiểu toàn bộ server `.mjs` |
| Unit/integration | 335 đạt, 0 lỗi | 110 renderer/core + 10 release + 173 online + 42 cloud |
| Cổng tài nguyên 3D | Đạt | Không thay thế đánh giá máy yếu thật |
| Build production | Đạt | Không đồng nghĩa đã triển khai |
| Playwright Chrome/Edge | 142 đạt, 2 bỏ qua; khoảng 10,7 phút | Local/fixture, không phải tải cloud nhiều người dùng |
| npm audit | 0 lỗ hổng được báo, 166 dependency theo metadata | Chỉ phản ánh cơ sở dữ liệu advisory tại lần chạy; không chứng nhận an toàn toàn hệ thống |
| Tái hiện retention | 42 bản ghi, gồm 40 bản ghi hết hạn còn lưu | Fixture PGlite riêng, không chạm DB thật |

Hai ca bỏ qua là cùng bài nhập tệp thật 140 câu + 16 WAV trên hai trình duyệt; thiếu `BAO_AN_REAL_IMPORT_DIR`. Không tính chúng là đạt. Tham chiếu `tests/visual/online-importfile.spec.ts:7`.

Log: `test-results/deep-audit-2026-10-26-verify.log`; dependency: `test-results/deep-audit-2026-10-26-dependencies.json`; tái hiện: `test-results/deep-audit-2026-10-26-retention.json`. Đây là tệp local trong thư mục bị Git bỏ qua.

## Các vấn đề cần ưu tiên

### 1. P1 — Khóa toàn đơn vị làm các thao tác của học sinh xếp hàng trên PostgreSQL

**Loại:** rủi ro kiến trúc được xác nhận từ mã nguồn; chưa đo mức ảnh hưởng trên cloud thật.

`server/postgres-store.mjs:62` gọi `workspace(..., true)` trước mọi `mutate`; dòng 65 sinh `SELECT ... FOR UPDATE` trên cùng hàng workspace. Các thao tác mở câu, gợi ý, xác nhận audio, trả lời và kết thúc lượt đều đi qua đường này. Hai học sinh thuộc cùng đơn vị vì thế phải tranh cùng khóa dù đang học hai bài khác nhau.

Điều này giúp giữ nhất quán nhưng giới hạn khả năng xử lý đồng thời. Khi một giao dịch chậm, thao tác của những học sinh khác có thể chờ; `lock_timeout` hiện là 10 giây. Đây là điểm đáng ưu tiên khi người dùng cảm thấy vào bài hoặc lưu đáp án chậm. Chưa thể kết luận nó là nguyên nhân của mọi lần chậm đang gặp.

**Đề xuất:** đo tải trên staging trước; chuyển khóa thông thường sang phạm vi học sinh/lượt chơi/sổ sao, giữ khóa rộng cho thao tác thật sự thay đổi cả đơn vị. Thiết kế thứ tự khóa thống nhất và giữ nguyên kiểm tra thu hồi phiên, idempotency, số dư.

**Nghiệm thu:** 30 rồi 100 học sinh giả cùng đơn vị, cả mở bài và gửi đáp án dồn đợt; đo p50/p95, lock wait, lỗi, số dư và số attempt; không mất/nhân đôi sao. Bộ PGlite hiện dùng một backend và hàng đợi trong `tests/helpers/postgres-fixture.mjs:8`, nên không chứng minh được hành vi nhiều kết nối PostgreSQL thật.

### 2. P2 — Bộ đếm đăng nhập hết hạn không được dọn định kỳ

**Loại:** hành vi tái hiện được.

`server/postgres-store.mjs:105–119` đặt lại bộ đếm khi cùng key được dùng tiếp và xóa key username khi đăng nhập thành công. Không có đường dọn chung các key hết hạn trong luồng này. Backend local có mô hình tương tự tại `server/online-server.mjs:64–71`. Migration có index `reset_at` nhưng index không tự xóa dữ liệu.

Tái hiện với store PostgreSQL trên fixture: tạo 20 cặp IP/username, tiến thời gian hơn 15 phút rồi ghi cặp mới; kết quả 42 hàng, trong đó 40 hàng cũ đã hết hạn. Script: `test-results/deep-audit-retention.mjs`.

**Ảnh hưởng:** nhiều IP hoặc username khác nhau qua thời gian làm bảng tăng không cần thiết; tăng dung lượng và việc quản lý dữ liệu. Chưa có bằng chứng đây là lỗi vượt rate limit.

**Đề xuất:** tác vụ dọn theo lô giới hạn, có chu kỳ và quan sát số hàng; áp dụng cho cả hai backend. Kiểm thử không xóa cửa sổ giới hạn còn hiệu lực và không thay đổi hành vi khi có request đồng thời.

### 3. P2 — Phân trang phía trình duyệt chưa giới hạn hết công việc phía database

**Loại:** rủi ro tăng chi phí theo lịch sử dữ liệu, xác nhận từ truy vấn.

`server/postgres-store.mjs:312–332`: `summaryProgress` đọc các tuần/bộ của cả lớp; `studentSummary` gom toàn bộ awards và redemptions của học sinh, sau đó mới gọi `summaryPage`. Danh sách trên giao diện nhỏ không có nghĩa database chỉ đọc một trang.

`server/postgres-store.mjs:366–369, 409–423`: mỗi lần trả lời lấy toàn bộ events của lượt và lại kiểm tra lịch sử; giới hạn 5.000 events có chặn trần nhưng chi phí mỗi lần vẫn tăng theo số lần thử. Bài học ngắn thông thường có thể chưa bị ảnh hưởng đáng kể.

**Đề xuất:** đo dữ liệu tích lũy tương đương một năm học và lượt có nhiều lần trả lời sai; tối ưu tổng hợp tiến độ/số dư, phân trang lịch sử đổi sao, và trạng thái kiểm chứng từng câu. Không xóa lịch sử nghiệp vụ chỉ để làm nhanh.

**Nghiệm thu:** so sánh query time, số hàng/byte đọc và p95 khi dữ liệu tăng; bảo toàn kết quả sao, tuần đóng và lịch sử quà.

### 4. P1 trước phát hành rộng — Chưa đủ bằng chứng nghiệm thu cloud và phục hồi cloud

**Loại:** khoảng trống xác minh, không phải khẳng định cloud đang hỏng.

Hồ sơ `docs/V38_qa/supabase-live/verification.json` ngày 16/10 ghi schema/bucket riêng đã kiểm tra, nhưng tại thời điểm đó `netlifyDeployed:false` và `runtimeCredentialsConfigured:false`. Đây là ảnh chụp lịch sử, không xác nhận trạng thái website ngày 26/10. Đợt này không truy cập môi trường triển khai thật.

README vẫn ghi chưa có nghiệm thu tải 30–100 học sinh; `releaseReady:false` và trạng thái nghiệm thu người dùng chưa xác minh là phù hợp. Kiểm thử restore SQLite không thay thế phục hồi đồng bộ PostgreSQL và Storage.

**Đề xuất:** staging cùng commit, smoke toàn luồng, đo tải, backup database + đối tượng media cùng hash, phục hồi sang môi trường trống, kiểm tra số dư và thu hồi phiên. Ghi thời gian phục hồi và khoảng dữ liệu có thể mất được người vận hành chấp nhận. Có sẵn checklist chi tiết trong `docs/PHAM_VI_VA_VAN_HANH_RC10.md`.

### 5. P2 — CSS và hai đường backend làm tăng chi phí bảo trì

**Loại:** nợ kỹ thuật; không phải lỗi giao diện mới được tái hiện.

`src/styles/game-base.css` vượt 4.000 dòng, gồm nhiều lớp giao diện và quy tắc overflow/ghi đè. Lỗi cuộn trước đây cho thấy CSS cấp trang có thể tác động sang màn học sinh. Bản sửa hiện có đã qua kiểm tra cuộn ở 1366×768 và 390×844, bao gồm rời trò chơi.

SQLite và PostgreSQL có các phần điều phối tương tự riêng biệt; `tsconfig.json` bật strict cho `src` nhưng không kiểm tra kiểu toàn bộ `server/*.mjs`. Điều này tăng nguy cơ hai môi trường khác hành vi khi thêm tính năng, dù bộ test hiện đã bảo vệ khá nhiều trường hợp.

**Đề xuất:** tách CSS theo chủ sở hữu màn hình, quy định rõ ai quản lý scroll; bổ sung contract test dùng chung cho hai store. Thêm JSDoc/checkJs hoặc TypeScript cho backend từng phần. Không viết lại toàn dự án trong một đợt.

## Đánh giá từng mảng

| Mảng | Đánh giá | Việc còn cần làm |
|---|---|---|
| Học sinh và chơi bài | Có bảo vệ request cũ, trạng thái đang lưu/thoát, thử lại, khôi phục focus; kiểm thử hiện đạt | Quan sát học sinh thật tự vào bài, sửa sai, dùng gợi ý và quay về; đo thời gian chờ qua mạng thật |
| Sao và hành trình | Chấm phía server, kiểm soát gửi lại, sao theo câu và khóa tuần được bảo vệ bằng test | Kiểm tra đồng thời trên PostgreSQL thật khi thu hẹp khóa |
| Quản trị/học liệu | Có preview, chỉ báo ô lỗi, kiểm tra nhận dạng câu, giới hạn ZIP/media và phân trang UI | Chạy lại tệp thật bị skip; nghiệm thu giáo viên tự nhập/giao bài không cần hỗ trợ |
| Bảo mật ứng dụng | Scrypt, session cookie HttpOnly/SameSite, CSRF/origin, phân quyền và media riêng được triển khai; dependency audit sạch | Dọn rate-limit; xác minh cấu hình trên deployment thật; đợt này không phải pentest độc lập |
| Hiệu năng frontend | Chế độ nhẹ mặc định; 3D/game tải theo nhu cầu; build tách chunk | Máy yếu, mạng chậm, tải giọng Việt lần đầu và điện thoại thật |
| Dữ liệu/backup | SQLite có đường backup/restore và kiểm thử; cloud có thiết kế lưu riêng | Diễn tập phục hồi cloud và chính sách lưu lịch sử |
| CI/chất lượng | Pipeline Windows với hai phiên bản Node, unit/integration, asset, browser, package | Bổ sung tải PostgreSQL nhiều kết nối thật và kiểm tra phụ thuộc theo lịch |
| Khả năng bảo trì | Có phân chia core/UI/store, nghiệp vụ được test | Giảm CSS toàn cục và sự lặp lại giữa backend; mở rộng kiểm tra kiểu server |

Build hiện có entry JS khoảng 226,19 kB (gzip 71,12 kB), admin chunk 113,57 kB (gzip 37,89 kB), Three.js 595,22 kB (gzip 149,92 kB). Đây là kích thước tệp build, không phải tổng tải đầu tiên; 3D được tải theo nhu cầu. Không nên quy kết Three.js luôn làm màn đăng nhập chậm.

## Trọng tâm trải nghiệm học sinh

Lỗi không cuộn trong ảnh đã có sửa và kiểm thử hồi quy. Các ca request cũ làm ghi đè sao mới, lỗi lưu/thoát gây kẹt trạng thái, và phục hồi focus sau chơi cũng đã đạt trong lần chạy này. Không cần sửa lại những phần này chỉ vì người dùng vẫn cảm thấy tổng thể chưa trơn tru.

Nên nghiệm thu một buổi ngắn với giáo viên và học sinh, dùng đúng học liệu:

1. Học sinh tự tìm bài được giao, chọn trò phù hợp và bắt đầu mà không cần người lớn chỉ nút.
2. Làm sai, xem gợi ý, làm lại; học sinh hiểu vì sao nhận mức sao hiện tại.
3. Nghe câu dài/đọc chậm; đánh giá tiêu chí thời gian có phù hợp mục tiêu học, không tự thay luật sao đã chốt.
4. Ngắt mạng khi nộp, kết nối lại, thử lại; thông báo phải giúp học sinh biết kết quả đã được lưu hay chưa.
5. Thoát, quay lại, đổi trò, đổi thiết bị; sao và hành trình phải nhất quán.
6. Dùng chạm, bàn phím, phóng chữ và cuộn; giọng tiếng Việt phải nghe rõ trên thiết bị được chọn hỗ trợ.

Ghi bước bị vướng, thời gian chờ và câu nói của người thử thay vì chỉ hỏi “có đẹp không”. Các bài tự động hiện chưa thay thế được đánh giá mức dễ hiểu, dễ học này.

## Thứ tự thực hiện đề nghị

1. Chạy nghiệm thu học sinh và staging cùng commit; thu số liệu chậm cụ thể trước khi tối ưu tiếp.
2. Sửa retention bộ đếm đăng nhập; đo và xử lý khóa workspace nếu tải mục tiêu không đạt.
3. Diễn tập backup/restore cloud, chạy tệp nhập thật và thiết bị thật; đóng từng mục bằng bằng chứng.
4. Tối ưu truy vấn theo dữ liệu tích lũy và tách CSS/backend từng bước, giữ toàn bộ kiểm thử nghiệp vụ.

Chưa nên mở rộng tính năng lớn hoặc làm lại toàn bộ giao diện trước khi hoàn tất các mục này. Giá trị lớn nhất lúc này là làm cho luồng học sinh hiện có dễ hiểu, phản hồi nhanh và được xác nhận trên môi trường sử dụng thật.

## Theo dõi thực hiện PROMPT 2 — 26/10/2026

Phần đánh giá phía trên là baseline trước sửa. Phần này là trạng thái thực hiện mới nhất; duy trì cùng một báo cáo, không tạo báo cáo/raw log phụ. Không refactor giao diện hoặc thêm tính năng khi chưa có lỗi xác nhận.

### T01 — P1: Đo tải cloud và quyết định phạm vi khóa

- **Status:** FAIL — đã chạy smoke tải staging, chưa đạt; chi tiết cập nhật cuối báo cáo thay thế blocker tài khoản ban đầu.
- **Problem:** các thao tác ghi cùng workspace dùng chung khóa; chưa có phép đo nhiều kết nối thật để quyết định sửa.
- **Root cause:** `mutate` khóa workspace trước thao tác; fixture PGlite không thay thế concurrency PostgreSQL thật.
- **Files changed:** không.
- **Fix:** chưa thay khóa. Đề xuất đo 30 rồi 100 tài khoản test trên staging, sau đó mới thiết kế khóa học sinh/lượt chơi với thứ tự khóa thống nhất và kiểm thử thu hồi phiên/sao.
- **Verification:** người dùng xác nhận staging riêng tại `https://gontogontet.netlify.app/`. GET `/api/online/status` trả HTTP 200, configured=true, runtimeVersion=3.8.0-rc.12, protocol=1. Endpoint không cung cấp commit, nên chưa xác nhận deployment cùng bản sửa local.
- **Regression check:** không thay mã task này.
- **Remaining risk/dependency:** chưa có tài khoản test hoặc quyền DB/Storage staging trên máy. Chỉ thấy tệp env mẫu, không có `.env.cloud.local`. Đã yêu cầu người dùng cấu hình quyền truy cập an toàn. Không dùng URL công khai làm bằng chứng có quyền thực hiện backup/restore. Đổi cơ chế khóa ảnh hưởng nhất quán nhiều nghiệp vụ; theo mục 6 của prompt, phải trình phương án trước khi triển khai thay đổi lớn.

### T02 — P2: Dọn bộ đếm xác thực hết hạn

- **Status:** PASS — đã sửa và kiểm chứng trong phạm vi local/fixture.
- **Problem:** bộ đếm của IP/username không dùng lại tiếp tục nằm trong database sau khi hết hạn.
- **Root cause:** mã trước sửa chỉ đặt lại key hiện hành và xóa key user khi đăng nhập thành công, không dọn các key cũ khác.
- **Baseline:** hai test mới trên SQLite HTTP và PostgreSQL fixture đều FAIL đúng điều kiện: còn 205 hàng hết hạn thay vì 105 sau lượt xử lý đầu. Lần chạy HTTP trong sandbox bị hạn chế kết nối; đã chạy lại với quyền localhost và xác nhận assertion thực tế.
- **Files changed:** `server/online-server.mjs`, `server/online-store.mjs`, `server/postgres-store.mjs`, `tests/online-server.test.mjs`, `tests/postgres-store.test.mjs`.
- **Fix:** dọn tối đa 100 hàng hết hạn trong giao dịch bộ đếm; bỏ qua hai key đang xử lý để giữ logic reset cũ; thêm index expiry cho SQLite. PostgreSQL dùng `FOR UPDATE SKIP LOCKED`, gộp DELETE bằng CTE vào UPSERT hiện hữu, không tăng số lần trao đổi DB. Không đổi API, ngưỡng 12/user, 100/IP, cửa sổ 15 phút hoặc kiến trúc xác thực.
- **Verification:** hai test mới PASS: 205→105→0, key còn hiệu lực giữ nguyên và vẫn trả 429. Typecheck và build PASS. Sáu test browser đổi mật khẩu trên Chrome/Edge, desktop/mobile viewport PASS.
- **Regression check:** lần đầu full test phát hiện 2 lỗi ngân sách truy vấn cloud do cleanup thêm một round trip; đã sửa bằng CTE, giữ nguyên test và ngân sách. Bản cuối `npm test`: 337/337 PASS (110 renderer, 10 release, 174 online, 43 cloud), exit 0. Bao gồm auth, đổi mật khẩu, giới hạn sau restart, rollback, sao, dữ liệu và backup/restore. `git diff --check` PASS. Dự án không có lệnh lint riêng; không ghi lint PASS. Không tạo file log/debug phụ trong đợt sửa này; giữ các artifact tự sinh của test runner.
- **Remaining risk:** cleanup chạy khi có thao tác xác thực và chỉ commit khi giao dịch bộ đếm thành công; không có request thì dữ liệu cũ chưa được dọn. Đây là cleanup theo lưu lượng, không phải lịch xóa chính xác tại mốc hết hạn. `SKIP LOCKED` chưa được nghiệm thu nhiều kết nối PostgreSQL thật. Index SQLite tạo khi khởi động, không đổi schema version hay dữ liệu nghiệp vụ; backend bảo toàn giới hạn khi rollback.

### T03 — P2: Tối ưu truy vấn theo dữ liệu tích lũy

- **Status:** BLOCKED.
- **Problem/root cause:** summary và kiểm chứng attempt đọc lịch sử trước khi tổng hợp/phân trang.
- **Files changed/Fix:** không; chưa có benchmark chứng minh điểm cần sửa trên tải mục tiêu. Không sửa theo suy đoán.
- **Verification/Regression check:** baseline mã nguồn đã ghi ở mục 3; kiểm thử nghiệp vụ vẫn là cổng bắt buộc khi sửa.
- **Remaining risk:** chờ dữ liệu staging đại diện và kết quả T01 để chọn thay đổi nhỏ nhất.

### T04 — P1: Nghiệm thu phục hồi cloud và cấu hình triển khai

- **Status:** BLOCKED.
- **Problem/root cause:** chưa có bằng chứng phục hồi PostgreSQL + Storage trên môi trường trống.
- **Files changed/Fix:** không.
- **Verification:** chỉ xác nhận public status staging; chưa có quyền DB/Storage và đích phục hồi cách ly. Không reset staging hoặc dữ liệu người dùng.
- **Regression check:** bộ kiểm thử local có kiểm tra backup/restore SQLite, không thay thế nghiệm thu cloud.
- **Remaining risk:** cần nguồn backup staging, quyền truy cập và project trống đích phục hồi; xác minh hash media, số dư, phiên đăng nhập và thời gian phục hồi.

### T05 — P2: Nghiệm thu trải nghiệm và học liệu thật

- **Status:** PARTIAL.
- **Problem/root cause:** kiểm thử local không xác nhận được độ dễ hiểu đối với học sinh, giọng đọc và máy yếu thật.
- **Files changed/Fix:** không sửa lại UI đã PASS. Giữ hồi quy cuộn/lưu sao/thoát bài hiện có.
- **Verification:** baseline 142 browser PASS, 2 skip; đợt sửa này 6 browser auth PASS. Hai ca học liệu thật vẫn cần đường dẫn workbook 140 câu + 16 WAV. Chưa quan sát buổi học thật.
- **Regression check:** test UI/auth phù hợp phạm vi thay đổi đã chạy; không tuyên bố toàn bộ browser được chạy lại sau task này.
- **Remaining risk:** nghiệm thu giáo viên/học sinh, thiết bị mục tiêu, mạng chậm và tệp thật còn thiếu. Tách CSS/backend là cải thiện bảo trì, không tự tiến hành refactor lớn trong task sửa retention.

### Kết luận phát hành hiện tại

Cập nhật quyền quản trị: đã đăng nhập staging thành công với role `admin`. Baseline trước tạo fixture: 1 lớp, 1 học sinh, 140 câu hỏi, 0 yêu cầu đổi quà chờ xử lý. Bổ sung công cụ `tools/staging-game-smoke.mjs`, nhận thông tin xác thực qua biến môi trường, chỉ cho phép host staging đã xác nhận; tạo lớp riêng, chạy một học sinh trước rồi tối đa 29 luồng song song, kiểm tra sai→đúng→gửi lại, hoàn tất và số dư; cuối cùng khóa các tài khoản test và đăng xuất. Không lưu mật khẩu vào tệp. Smoke ngắn này không thay thế tải 30/100 người trong 60 phút hay phục hồi DB/Storage. Kết quả đợt chạy được cập nhật bên dưới khi hoàn tất.

Cập nhật truy cập staging 26/10: tài khoản người dùng cung cấp đăng nhập HTTP 200 nhưng có role `student`. GET `/student/summary?cursor=0` trả 200, một trang có một tuần và bài hiện hành; 15.825 byte UTF-8, khoảng 1.094 ms cho một request từ máy kiểm tra. Đây chỉ là smoke đọc dữ liệu, không phải benchmark/p95. Đã đăng xuất các phiên thử; không nộp bài, thay sao hoặc ghi thông tin xác thực vào báo cáo/mã nguồn. T01 vẫn BLOCKED do thiếu quyền quản trị để tạo tập tài khoản tải; T04 vẫn BLOCKED do thiếu quyền DB/Storage và đích phục hồi riêng.

### Kết quả smoke tải staging bằng tài khoản quản trị

- Run: `qa-1793018858108`; lớp riêng: `709fc696-20b6-4827-bf2f-a02f295cd081`.
- Tạo 30 học sinh tổng hợp và 1 tuần gồm 3 môn, mỗi môn 2 câu. Không giao bài test cho lớp có sẵn.
- Một học sinh chạy riêng PASS, sau đó 29 luồng chơi bắt đầu đồng thời. Đây không phải 30 luồng đồng thời liên tục, không phải 60 phút và chưa kiểm tra audio/media.
- **9/30 hoàn tất**, gồm học sinh thử riêng; **21 luồng thất bại**. Lỗi đầu tiên được báo là HTTP 500 tại POST `/play/compact`. Chưa có server log để phân loại hết nguyên nhân từng lỗi.
- Chỉ các luồng hoàn tất mới được xác nhận sai→đúng→duplicate không cộng sao→complete→số dư đúng. Không suy rằng 21 luồng lỗi không mất dữ liệu hoặc chắc chắn mất dữ liệu.

| API | Số request | Lỗi HTTP | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| student/journey | 30 | 14 | 13964 | 24658 |
| student/summary | 25 | 0 | 1738 | 11301 |
| play/compact | 16 | 2 | 12787 | 18049 |
| question-open | 25 | 0 | 10440 | 11967 |
| attempt | 71 | 3 | 11729 | 13144 |
| complete-compact | 11 | 2 | 11724 | 14093 |

Độ trễ là thời gian đầu-cuối từ máy chạy, gồm cả request lỗi và mẫu thử riêng; không phải thời gian SQL. Không tăng lên 100 vì mức này đã lỗi. Lỗi phù hợp với nguy cơ chờ khóa/độ trễ backend nhưng chưa đủ bằng chứng kết luận tất cả HTTP 500 do workspace lock; cần log Netlify và PostgreSQL, pool/lock wait, cùng xác nhận commit triển khai. Không chữa bằng tăng timeout hoặc bỏ kiểm chứng dữ liệu.

**Dọn dữ liệu thử:** API xác nhận khóa đủ 30/30 tài khoản; lớp, tuần, câu hỏi và lịch sử tổng hợp được giữ để truy vết. Sau khóa, 30 request logout học sinh nhận lỗi vì tài khoản đã vô hiệu; tách chúng khỏi 21 lỗi luồng chơi. Đăng xuất admin thành công. Công cụ đã điều chỉnh chấp nhận 401 khi logout sau khóa và bổ sung mã hỗ trợ lỗi nếu server cung cấp; điều chỉnh công cụ được kiểm tra cú pháp, chưa chạy lại tải live. Không có mật khẩu trong công cụ/báo cáo.

**Phương án sửa T01 trước triển khai:** lấy log để phân biệt lock timeout, pool timeout và lỗi khác; tái hiện bằng PostgreSQL nhiều kết nối; nếu xác nhận tranh khóa, chuyển thao tác học sinh sang khóa học sinh/lượt chơi theo thứ tự thống nhất, giữ khóa workspace cho thay đổi toàn đơn vị, kiểm tra reset/logout/đổi lớp/khóa tuần đồng thời. Đây là thay đổi cơ chế đồng bộ nhiều nghiệp vụ; theo mục 6 PROMPT 2, dừng sửa kiến trúc tại đây để trình phương án, không tự thay khi chưa xác minh.

**NOT READY FOR FINAL LOCK.** Blocker hiện tại: T01 đã tái hiện lỗi tải nhưng chưa có log/quyền DB để xác định và sửa nguyên nhân; T04 thiếu diễn tập phục hồi cloud; T05 thiếu học liệu/thiết bị/người nghiệm thu thật. Mã sửa retention chưa được đẩy hoặc triển khai. Không coi các test local đã đạt là nghiệm thu production.
