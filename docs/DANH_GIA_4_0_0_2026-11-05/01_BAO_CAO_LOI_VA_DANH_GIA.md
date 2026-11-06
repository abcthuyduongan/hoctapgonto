# Báo cáo đánh giá độc lập Bảo An Learning 4.0.0

## 1. Kết luận và đối tượng kiểm tra

**C12 chưa đạt theo bằng chứng kiểm tra ngày 05/11/2026. Chưa thể xác nhận toàn bộ 13 tuần hoàn thành 100%.** Có tiến bộ rõ ở bản đồ, trò chơi và các màn chức năng; vấn đề cần giải quyết trước tiên là quyền truy cập, bảo toàn dữ liệu, nâng cấp và độ tin cậy của nghiệm thu.

| Thuộc tính | Giá trị |
| --- | --- |
| Thư mục | `D:\Phần mềm 2026\BAO_AN_LEARNING_lam lại` |
| Phiên bản | `4.0.0` |
| Commit được kiểm tra | `f7c93337669379d768419ae1ab43cbde69f2aabe` |
| Nhánh / tag | `feature/v37-premium-world` / `v4.0.0` |
| Source ID ứng dụng | `dcbc03d1d20639cb07741c3d20800a427e29cd90b47714010b63f8dcad9d4d72` |
| Môi trường | Windows, Node 22.22.2, npm 10.9.7, Chrome và Edge |
| Tình trạng ban đầu | Git sạch; đánh giá không sửa mã ứng dụng |

PostgreSQL được kiểm tra bằng store/API thật chạy trên PGlite trong máy thử. Đây là bằng chứng logic và dữ liệu, không phải đo tải Supabase/Netlify thật. Website chỉ được đọc hai endpoint công khai; không thử tấn công hoặc thay đổi dữ liệu thật.

## 2. Những kiểm tra đã thực sự chạy

| Kiểm tra | Kết quả | Giới hạn diễn giải |
| --- | --- | --- |
| `npm run typecheck` | PASS, exit 0 | Không chứng minh đúng quyền hoặc đủ nghiệp vụ |
| `npm test` | PASS, exit 0 | Một số bài chỉ mô phỏng; không thay thế thử với người thật |
| `npm run build` | PASS, exit 0 | Lần đầu bị sandbox chặn ghi `dist`; chạy lại với quyền phù hợp thành công |
| `npm run test:assets` | PASS theo ngưỡng hiện tại; 113 tệp, 5,08 MiB | Ngưỡng đã tăng lên 8 MiB, không chứng minh đạt ngân sách cũ 5 MiB |
| Playwright, cả Chrome và Edge | **160 đạt, 12 thất bại, 2 bỏ qua, 8 chưa chạy** | Cấu hình 182 trường hợp; chủ động dừng khi đủ 12 lỗi, không được báo toàn bộ PASS |
| Tái hiện lỗi độc lập | **7/7 tái hiện thành công** | PASS ở đây nghĩa là hành vi lỗi đã xác nhận |
| Website công khai | HTTP 200, vẫn là `3.9.0-rc.1` | Chưa phải 4.0.0 tại URL đã biết |

Hai ca bỏ qua là cùng một bài nhập Excel trên hai trình duyệt, thiếu tệp học liệu cục bộ của tác giả. Tám ca còn lại chưa chạy do giới hạn dừng sớm. JSON Playwright gộp hai nhóm thành `skipped: 10`; báo cáo này giữ chúng tách riêng.

Log, trace và ảnh gốc ở `test-results/danh-gia-4.0.0-2026-11-05/` trên máy kiểm tra. Bằng chứng JSON rút gọn và chương trình tái hiện được lưu cùng bộ tài liệu để không phụ thuộc thư mục bị Git bỏ qua.

## 3. Lỗi mã nguồn đã xác nhận

Mức ưu tiên dùng cho bàn giao: **P0** sai quyền hoặc nguy cơ mất dữ liệu, phải chặn phát hành; **P1** lỗi nghiệp vụ/nâng cấp hoặc điều kiện nghiệm thu bắt buộc; **P2** cải thiện và hoàn thiện bằng chứng. Mức P1 của một bài kiểm thử hỏng không tự động có nghĩa tính năng tương ứng đã hỏng.

### L01 — P0: PIN chưa bảo vệ thao tác ở máy chủ; trả cả hash và salt

- Nơi liên quan: `server/online-server.mjs` tuyến `/parent/*`, `server/cloud-api.mjs`, `server/online-store.mjs:921,947`, `server/postgres-store.mjs:1116,1142`, `src/core/online-client.ts`.
- Tái hiện: quản lý đặt PIN và giới hạn 25 phút; học sinh đăng nhập, **không gọi xác thực PIN**, đọc dashboard được HTTP 200 rồi gửi cài đặt `maxMinutesPerDay: 0` cũng được HTTP 200.
- Kết quả trên cả hai backend: giới hạn bị tắt; phản hồi cài đặt chứa `pinHash` và `pinSalt`. Không lưu giá trị bí mật thực tế trong báo cáo.
- Nguyên nhân: xác thực PIN tạo `parentToken`, nhưng các thao tác bảo vệ không kiểm tra quyền tạm thời này. Khóa màn hình bằng PIN ở phía giao diện không đủ.
- Điều kiện đóng: học sinh chưa xác thực nhận 403 khi thay đổi cài đặt; thao tác nhạy cảm kiểm tra quyền tại máy chủ; token hết hạn/sai học sinh/sai phiên bị từ chối; không API công khai nào trả hash/salt.

### L02 — P0: phụ huynh sửa được trẻ chưa liên kết

- Nơi liên quan: `updateParentSettings` và `parentControls` trong hai store; đối chiếu `parentDashboard` đã có kiểm tra liên kết ở nhánh đọc.
- Tái hiện: tài khoản phụ huynh A chỉ liên kết trẻ A; đọc dashboard trẻ B bị 403, nhưng gửi cài đặt trẻ B lại HTTP 200 và đổi giới hạn thành 99 phút.
- Ảnh hưởng: quyền ghi không nhất quán với quyền đọc, ngay trong cùng đơn vị.
- Điều kiện đóng: mọi tuyến đọc/ghi nhạy cảm dùng chung kiểm tra phạm vi đơn vị và quan hệ phụ huynh–học sinh; yêu cầu bị từ chối phải không làm thay đổi bản ghi.

### L03 — P0: sao lưu cloud làm mất liên kết phụ huynh và mục tiêu quà

- Nơi liên quan: `server/cloud-backup-restore.mjs:3`, danh sách `BACKUP_TABLES` hiện có 25 bảng.
- Thiếu `parent_students` và `student_goals`, dù tính năng mới đã dùng các bảng này.
- Tái hiện quan hệ phụ huynh: trước sao lưu có 1 trẻ liên kết; sau xuất và khôi phục vào cơ sở dữ liệu thử sạch còn 0. Bảng liên kết không có trong payload. Mục tiêu quà bị bỏ khỏi danh sách theo kiểm tra mã, chưa cần giả định đã khôi phục thành công.
- Điều kiện đóng: sao lưu/khôi phục đủ bảng nghiệp vụ với dữ liệu thật của từng tính năng, giữ nguyên quan hệ, mục tiêu, số dư, chặng và media; có so sánh giá trị trước/sau, không chỉ số lượng bảng.

### L04 — P0: lỗi tải media bị biến thành bản sao lưu có tệp rỗng

- Nơi liên quan: `server/cloud-backup-restore.mjs:43–75`.
- Lỗi SQL khi đọc bảng bị nuốt thành mảng rỗng; lỗi Storage khi tải tệp bị đổi thành `Buffer.alloc(0)`.
- Tái hiện: tệp PNG hợp lệ 3.808 byte, Storage phát sinh lỗi; hàm vẫn trả bản sao có checksum hợp lệ, metadata ghi 3.808 byte nhưng nội dung là **0 byte**.
- Checksum chỉ chứng minh payload không đổi sau khi tạo, không chứng minh dữ liệu nguồn đã được sao chép đầy đủ.
- Điều kiện đóng: thiếu bảng/media phải báo thất bại rõ; kiểm tra kích thước và SHA-256 với metadata nguồn, đọc lại sau khôi phục; không công bố thành công khi thiếu dữ liệu.

### L05 — P1: cloud setup và kiểm tra khởi động bỏ sót migration mới

- Nơi liên quan: `server/cloud-deployment.mjs:6,53`, `server/postgres-store.mjs:47`, các tệp `supabase/migrations/20261105000*.sql`.
- `cloud:setup` mặc định chỉ đọc migration nền `202610150001_online.sql`; `cloud:check` chỉ kiểm tra danh sách 16 bảng cũ; `ready()` chỉ kiểm tra phiên bản nền bằng 1.
- Tái hiện: cơ sở dữ liệu chỉ có schema nền vẫn được chấp nhận khởi động; khi đọc tổng quan học sinh lỗi `relation "bao_an.student_goals" does not exist`.
- Fixture kiểm thử tự nạp sẵn mọi migration mới, nên đường nâng cấp thật không được kiểm tra bằng tình huống này.
- Điều kiện đóng: cài mới và nâng cấp cùng chạy một danh sách migration có lịch sử; thiếu migration phải dừng sớm và hướng dẫn xử lý; chạy lại không mất dữ liệu.

### L06 — P1: SQLite cũ không tạo được tài khoản phụ huynh sau nâng cấp

- Nơi liên quan: `server/online-store.mjs:48,92,968`.
- Schema cũ tại commit `a6d0af19a784608ab9505c0f2d6974497410b80e` chỉ cho `role IN ('admin','student')`. `CREATE TABLE IF NOT EXISTS` ở bản mới không thay ràng buộc của bảng cũ; đoạn `ALTER` hiện có chỉ thêm cột của lớp.
- Tái hiện bằng DDL cũ, dữ liệu thử: mở bằng store 4.0.0 thành công; tạo phụ huynh thất bại `CHECK constraint failed: role IN ('admin','student')`.
- Điều kiện đóng: migration SQLite nâng cấp có giao dịch và sao lưu, giữ ID/khóa ngoại/tài khoản/sao, tạo được phụ huynh; có kiểm thử mở lại sau nâng cấp và chạy migration lần hai.

### L07 — P1: đáp án trắc nghiệm giữ nguyên vị trí, bộ học kỳ 2 đều đúng ở A

- Nơi liên quan: `server/question-protocol.mjs:11,45,63`, `src/core/online-exercises.ts:36`, `src/core/game-rewards.ts`, các màn `MathQuest`, `BoatRace`, `RichExercise`, phần thi thử và nguồn học liệu.
- Trong `data/curriculum/hoc-ky-2-8-tuan.json`, **28/28 câu có các lựa chọn và `correctIndex` đều bằng 0**, tức A. Tổng 85 câu gồm cả các dạng khác, không phải 85 câu trắc nghiệm.
- Tái hiện: mở cùng một câu bằng 12 session mới, chỉ nhận 1 thứ tự lựa chọn; `questionView` sao chép nguyên `options`. Kết quả này xác nhận đường câu hỏi được kiểm tra, không suy rộng rằng mọi ngân hàng riêng của người dùng đều có đáp án A.
- Ảnh hưởng: học sinh có thể đoán theo vị trí; nội dung đúng vẫn bị biến thành bài học thiếu tin cậy.
- Điều kiện đóng: mỗi lần gọi lại trong lượt mới xáo lựa chọn và đổi vị trí đáp án đúng so với lần trước của cùng học sinh/câu/phiên bản; giữ nguyên nội dung đúng và giải thích. Máy chủ lưu ánh xạ và chấm theo ánh xạ. Retry cùng lượt vì lỗi mạng không được xáo lại hoặc cộng thêm sao. Chi tiết ở R03 và AN01–AN12.

## 4. Các điểm chặn nghiệm thu và khoảng trống bằng chứng

### L08 — P1: bộ Playwright chưa đạt; cần sửa cả kịch bản và điều tra cuộn

| Tệp | Kết quả quan sát | Phân loại đúng |
| --- | --- | --- |
| `online-contest.spec.ts:48` | `.contest-pill-btn` chọn cả nút thị trấn và thi thử, strict mode, lỗi cả hai trình duyệt | Bộ chọn kiểm thử không còn duy nhất; chưa chứng minh phòng thi hỏng |
| `online-discovery.spec.ts:131` | `.online-notebook-btn` chọn cả huy hiệu và sổ khám phá, lỗi cả hai trình duyệt | Bộ chọn kiểm thử không còn duy nhất |
| `online-journey.spec.ts:53` | Không tìm được nút tóm tắt sau khi chuyển tuần, lỗi cả hai trình duyệt | Cần đi theo luồng mở hành trình mới và xác minh vẫn truy cập được tuần cũ |
| `online-routing.spec.ts:32` | Đợi đúng 2 nút nhưng nhận 3, lỗi cả hai trình duyệt | Kỳ vọng danh sách trò cũ; phải đối chiếu trò được phép với registry, không chỉ tăng số đếm |
| `online-summary.spec.ts:9` | Không tìm được “Xem thêm tuần học”, lỗi cả hai trình duyệt | Luồng phân trang/thu gọn đã thay đổi; phải giữ kiểm tra tải đủ dữ liệu và không lộ câu trước khi chọn |
| `online-town.spec.ts:60` | Không thấy `.town-screen` trên Chrome; snapshot có dialog thị trấn | Bộ chọn không khớp; chưa kết luận tính năng thị trấn không mở |
| `online-scrolling.spec.ts:58` | Edge 390×844: sau thoát game, thao tác vuốt không đưa danh sách tuần vào viewport | Lỗi tái hiện trong kiểm thử thao tác; cần điều tra layout, cuộn, vị trí nút và cách vuốt, không thay bằng scroll lập trình để che lỗi |

Chạy lại riêng Edge điện thoại thất bại **2/2 lần**, cùng điểm kiểm tra sau thoát game. Ảnh chụp cho thấy “Hành trình theo tuần” đang thu lại, có nút “Xem cả hành trình”; vì vậy chưa thể kết luận trang bị khóa cuộn hoặc người dùng không thể tiếp tục. Cần kiểm tra phục hồi trạng thái mở và sửa kịch bản mở hành trình trước khi khẳng định nguyên nhân. Chi tiết ở `bang_chung/scrolling-edge-recheck-summary.json` và `bang_chung/edge-mobile-after-exit.png`. Việc đạt 160 bài khác không xóa các lỗi này và không chứng minh 8 bài chưa chạy đã đạt.

### L09 — P1: trạng thái phát hành chưa khớp website và gói ZIP

- [Website build-info](https://gontogontet.netlify.app/build-info.json) và [API status](https://gontogontet.netlify.app/api/online/status) tại thời điểm kiểm tra đều trả `3.9.0-rc.1`, commit `bc58393fa14a7490e49ced7c1249cc8c7360d4f2`, source ID `caed213678ee6d8da896e5f87b0e2730c5babe46763bc4094ef29bfdbe2b595b`.
- `releases/bao-an-learning-4.0.0/release.json` ghi `pilot: true`, `releaseReady: false`, `humanPilotStatus: "UNVERIFIED"`; `tools/package_release.mjs:100` tạo các cờ này.
- Đây là mâu thuẫn với README và báo cáo “phát hành chính thức”. Không sửa bằng cách chỉ đổi cờ; phải đóng lỗi, nghiệm thu, đóng gói và đối chiếu bản thực tế.
- Chưa kiểm tra các URL triển khai khác chưa được chỉ ra; kết luận website chỉ áp dụng URL nêu trên.

### L10 — P1: báo cáo người dùng thật và niên đại chưa đủ tin cậy để nghiệm thu

- Ngày đánh giá là 05/11/2026. Tệp `PHONG_VAN_THUC_TE_TUAN_11.md` ghi phỏng vấn ngày 23–24/01/2027; generator học liệu tự ghi ngày duyệt 15/01/2027 và tên hội đồng.
- Báo cáo Tuần 12 và release notes lại ghi 31/01/2026, trong khi mô tả hoàn thành kế hoạch ngày 05/11/2026. Các mốc không nhất quán.
- `tests/classroom-pilot-trial.test.mjs` tạo người dùng, ngày học và thời lượng bằng chương trình trong SQLite; đó là mô phỏng logic, không xác nhận học sinh/phụ huynh thực sự đã dùng.
- Cần phân loại lại tài liệu mô phỏng, sửa thời gian theo sự kiện thực tế và gắn bằng chứng của người tham gia thật; không suy đoán ý định của người viết.
- Ma trận 80 ca cũ vẫn là template `CHUA_CHAY`. Điều này không chứng minh không có ca nào được chạy, nhưng chưa có ánh xạ kết quả đủ để nghiệm thu 80 ca.

### L11 — P1 theo tiêu chí học liệu: chưa đủ 8 tuần × 4 môn × 12 câu

- Tệp học kỳ 2 có 8 tuần, mỗi tuần 3 gói Toán/Tiếng Việt/Tiếng Anh; **85 câu**, chưa có gói Tin học trong bộ này.
- Tiêu chí hiện hành yêu cầu tối thiểu **384 câu**: 8 × 4 × 12. Thiếu ít nhất 299 câu theo phép đếm tổng; còn phải đủ đúng từng môn/tuần, không được bù bằng dồn câu vào một môn.
- Kiểm thử học kỳ 2 chỉ kiểm tra ba môn và tính hợp lệ schema, chưa kiểm tra đủ bốn môn/mỗi môn 12 câu hay duyệt chuyên môn thực tế.
- Theo yêu cầu chủ dự án, đây là đầu việc nhập/duyệt học liệu do chủ dự án và giáo viên cung cấp. AI không tự tạo danh mục kỹ năng, tự điền tên người duyệt hay xác nhận học liệu đã duyệt.

### L12 — P1: chưa có bằng chứng tốc độ và tải trên hạ tầng thật

- `tests/load-staging.test.mjs` dùng tên miền giả `staging-load.example.test`, PGlite, Storage bằng Map và gọi adapter bằng `Request` trong cùng tiến trình.
- Giai đoạn 30 tài khoản chạy với mức song song 8; giai đoạn 100 tài khoản chạy với mức song song 12. Đây không phải 30/100 học sinh hoạt động đồng thời trên website thật.
- Chưa chứng minh p95 mở câu ≤ 0,8 giây, ảnh ≤ 1 giây trên mạng/hạ tầng thực tế; dữ liệu audio/image giả và phép gọi API không thay thế tải và phát media trong trình duyệt.
- Giữ bài này làm kiểm thử logic tải tổng hợp, bổ sung phép đo trên staging riêng bằng dữ liệu thử.

### L13 — P2: kiểm thử truy cập chưa chứng minh tương phản và zoom thật

- `tests/visual/online-a11y.spec.ts:45,64` tắt quy tắc `color-contrast`.
- Dòng 74 đổi viewport thành 640×480 nhưng thông báo là zoom 200%; đổi viewport không tương đương tăng zoom/font của trình duyệt.
- Chưa kết luận mọi màn có lỗi truy cập; kết luận là tuyên bố đã kiểm tra các điều này đang vượt quá bằng chứng.

### L14 — P2: ngân sách tài nguyên bị đổi tiêu chí

- `tests/release-online-assets.mjs:9` cho phép 8 MiB, trong khi baseline bàn giao trước đặt 5 MiB; bản build hiện tại 5,08 MiB.
- Cần giảm tài nguyên hoặc ghi quyết định thay đổi ngân sách có số đo thực tế. Không dùng kết quả PASS theo ngưỡng mới để xác nhận ngưỡng cũ.

## 5. Đối chiếu 10 điều kiện của kế hoạch hiện hành

| Điều kiện | Đánh giá lần này |
| --- | --- |
| 1. Học sinh tự dùng 15 phút trên ba nhóm thiết bị | Chưa có bằng chứng quan sát người thật hợp lệ; có lỗi cuộn cần xử lý |
| 2. Bản đồ 4 vùng, chặng, thẻ khám phá | Mã đã có; kiểm thử hình học đã đạt ở ba khổ; kiểm thử khám phá cần sửa selector và chạy tiếp |
| 3. Quà, mục tiêu, huy hiệu, nhiệm vụ, thị trấn | Có mã và nhiều happy path đạt; chưa đóng lỗi quyền và sao lưu mục tiêu |
| 4. Ít nhất 8 minigame | Registry/mã có nhiều trò; chưa suy ra tất cả đã được nghiệm thu người thật |
| 5. Thi thử bấm giờ và xem câu sai | Có mã/test logic; E2E bị dừng tại selector, cần chạy trọn nghiệp vụ |
| 6. Phụ huynh được bảo vệ PIN | **Không đạt: L01, L02, L06** |
| 7. Giáo viên nhập/giao/xuất đáp án | Các kiểm thử tự động liên quan đã đạt nhiều luồng; ca dùng tệp riêng của tác giả còn bỏ qua |
| 8. Tốc độ và 30 học sinh thật đồng thời | **Chưa được chứng minh: L12** |
| 9. Dữ liệu an toàn và phục hồi cloud | **Không đạt: L03, L04, L05** |
| 10. 8 tuần học liệu đủ 4 môn đã duyệt | **Chưa đạt theo bộ tệp kiểm tra: L10, L11** |

Không quy đổi bảng này thành phần trăm hoàn thành: lỗi sai quyền/mất dữ liệu là điều kiện chặn, không thể lấy số tính năng đã có để bù.

## 6. Điểm tích cực và giới hạn

Build chạy được, không đưa model/engine 3D vào artifact hiện tại. Kiểm thử bản đồ ở điện thoại/máy tính bảng/máy tính đạt; nhiều luồng nhập học liệu, chấm câu phía máy chủ, nghe âm thanh, xử lý lỗi mạng, ví sao và trò chơi đã có kiểm thử đạt. Vì vậy nên sửa theo lớp trên nền hiện có, không làm lại toàn bộ sản phẩm.

Đánh giá không phải kiểm toán bảo mật toàn diện, không chứng nhận đúng toàn bộ nội dung môn học và không xác minh độc lập danh tính người được ghi trong báo cáo. Các lỗi L01–L07 dựa trên mã và ca tái hiện tách biệt; các điểm còn lại phân biệt rõ thất bại kiểm thử, trạng thái phát hành và thiếu bằng chứng. Thực hiện tiếp theo [kế hoạch sửa](02_KE_HOACH_SUA_LOI_VA_NANG_CAP.md).
