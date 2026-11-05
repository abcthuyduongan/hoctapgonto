# Kế hoạch triển khai đầy đủ

Ngày: **05/11/2026**. Phạm vi: nâng cấp giao diện và bản đồ hình ảnh trên nền ứng dụng hiện có. Chi tiết hình ảnh ở [bản thiết kế](../KE_HOACH_BAN_DO_HINH_ANH_2026-11-05.md).

## 1. Kết quả cần đạt

Học sinh đăng nhập → thấy map tổng → chọn vùng → chọn tuần hợp lệ → chọn bộ câu và trò tương thích → chơi → lưu kết quả → trở về đúng vùng/chặng/bộ → thấy sao và tiến độ đã được máy chủ xác nhận.

Năm map chính có bản ngang/dọc: thế giới, Toán, Tiếng Việt, Tiếng Anh, Tin học. Mỗi map vùng tối đa 7 chặng; 35 tuần có thể dùng 5 trang nền tái sử dụng. Nội dung học không được sinh từ tranh hoặc tên vùng.

## 2. Bất biến của toàn dự án

- Máy chủ quyết định bài được phép, câu đúng, sao, khóa tuần, phiên bản và số dư.
- Mỗi câu nguồn tối đa 3 sao; học lại chỉ cộng phần tăng thêm theo nghiệp vụ hiện có.
- Tuần đã qua không được map mở lại; đủ yêu cầu vẫn cần xác nhận chuyển tuần.
- Vào map/chọn địa điểm không tạo attempts, awards, redemptions hoặc lịch sử chuyển tuần.
- Câu có ảnh/nghe giữ quy tắc đồng hồ và biên nhận media hiện tại.
- Tên/mã bộ, itemId và phiên bản của người dùng được giữ.
- SQLite và PostgreSQL phải trả cùng trạng thái nghiệp vụ.
- Ảnh trang trí không che câu hỏi, đọc hiểu, audio hoặc điểm nối/kéo thẻ.
- Luồng lỗi mạng, gửi lại, chống nhấp lặp, đăng xuất và đổi mật khẩu tiếp tục hoạt động.
- Thay đổi chỉ dành cho phạm vi đã giao; không ghi đè/xóa thay đổi có sẵn của người dùng.

## 3. Rà soát đầu vào — UP00 và UP01

### UP00 — Chốt baseline

Đọc README, các hướng dẫn áp dụng trong repo, package.json và manifest bàn giao. Ghi phiên bản Node, nhánh, commit và tình trạng working tree.

Checkout hiện có nhiều thay đổi/xóa chưa commit. Không reset/clean/stash/drop hoặc checkout về HEAD để làm “sạch”. Commit cũ không thể thay thế snapshot hiện tại.

Lập danh sách tệp sẽ chạm; giữ bản đối chiếu các tệp đó. Nếu tạo nhánh mới, dùng nhánh phù hợp với quy ước dự án và giữ nguyên working tree; không tạo worktree từ commit cũ rồi làm mất thay đổi nền.

Chạy baseline theo tài liệu lệnh, lưu lỗi ứng dụng riêng với lỗi môi trường. Không sửa một lỗi có sẵn mà không ghi phạm vi.

**Xong khi:** có danh sách tệp, hash/version, báo cáo baseline thật và quyết định rõ về những lỗi có sẵn.

### UP01 — Đối chiếu màn và bộ ảnh

Đọc OnlineStudentWorld, StudentScreen, OnlineQuestionStars, OnlineScreen, OnlineAdminDashboard, loaders và các game. Liệt kê màn/API thực sự có.

Nhận 8 ảnh đợt A, kiểm kích thước/alpha/bố cục/nguồn. Chưa có ảnh thì triển khai logic và fixture bằng nền đơn giản, đánh dấu ảnh chờ; không tuyên bố hoàn thành hình ảnh.

Đối với phần quà/thị trấn/huy hiệu được báo đã làm: nếu không có trong checkout, ghi thiếu bản mã tương ứng, vẫn tiếp tục các đầu việc độc lập của map. Không tự mở rộng nhiệm vụ sang viết lại các tính năng đó.

**Xong khi:** checklist ảnh và bảng nối màn/API có đường dẫn cụ thể.

## 4. Thiết kế dữ liệu — UP02 và UP03

### UP02 — Hợp đồng dùng chung

Tạo kiểu MapRegionId, MapOverview, RegionMapView, MapWeekNode và khóa lựa chọn. Chốt quy tắc nhóm tuần/điểm neo theo tài liệu hợp đồng.

Ánh xạ môn bằng danh sách alias rõ ràng, có vùng discovery cho môn tự đặt. Không suy đoán từ nội dung câu hoặc độ khó.

**Tệp dự kiến:** src/core/world-map-contracts.ts, world-map-regions.ts, world-map-adapter.ts, world-map-layout.ts.

**Xong khi:** DM01–DM10 đạt; ví dụ 35 tuần, tuần thiếu môn và nhiều bộ có cùng kết quả xác định.

### UP03 — Đường đọc dữ liệu map

Triển khai projection chỉ đọc cho local và cloud; ưu tiên endpoint đề xuất GET /api/online/student/map. Không gọi studentState đầy đủ hoặc chuyển nguyên packs.json ra client.

Tận dụng server/student-summary.mjs và server/question-journey.mjs để giữ cùng cách tính tiến độ. Quyền dựa vào phiên đăng nhập, không nhận studentId/classId/workspaceId từ query.

Không thêm migration cho map nếu dữ liệu hiển thị chỉ suy ra từ weeks, week_sets, packs và awards hiện có.

**Tệp liên quan:** server/online-store.mjs, postgres-store.mjs, online-server.mjs, cloud-api.mjs, student-summary.mjs; src/core/online-client.ts. Có thể thêm server/world-map-summary.mjs để dùng chung.

**Xong khi:** API01–API12 đạt trên hai backend; JSON không có câu hỏi/đáp án, GET không ghi dữ liệu, không có truy vấn theo từng node.

## 5. Chuẩn bị ảnh — UP04

Tạo manifest ảnh có phiên bản, đường dẫn, kích thước, loại, hash và tọa độ rộng/dọc. Tên week/pack hoặc dữ liệu tài khoản không nằm trong manifest.

Giữ PNG gốc ngoài public/dist. Chỉ đưa biến thể đã tối ưu vào public/art/maps, places, game-cards và auth. Công cụ build hiện đi qua toàn bộ public, nên đặt ảnh gốc vào đó sẽ làm bản phát hành nặng.

Quy trình chuyển ảnh chạy lúc phát triển/build, không thêm thư viện đồ họa runtime. Chọn công cụ phù hợp môi trường, ghi phiên bản/câu lệnh để tái tạo kết quả; nếu thêm dependency, giới hạn vào công cụ chuẩn bị ảnh và ghi lý do.

Dùng tên biến thể có hash để cache tĩnh không nhầm ảnh cũ. Cùng một nguồn/thiết lập phải tạo đầu ra ổn định hoặc có hash nội dung chính xác.

Không nén lại ảnh học liệu riêng của người dùng trong đợt này.

**Xong khi:** AS01–AS08 đạt; manifest và bộ A ghép được; chuẩn bị ngân sách 5 MiB cho cả bộ B.

## 6. Một lát cắt chạy thật — UP05 đến UP08

### UP05 — Map tổng

Tạo WorldMap, hiển thị nền đúng tỉ lệ bằng picture/source hoặc cách tương đương chỉ tải biến thể cần dùng. Overlay nút vùng, tên vùng, trạng thái và tiến độ; trung tâm nối ví sao đang có.

Map là phần chính của màn, không phải nền của một dashboard nhiều thẻ. Có nút Tiếp tục chuyến đi đưa về tuần hiện tại.

**Xong khi:** UI01–UI03, UI13–UI14 và phần liên quan AS/PF đạt.

### UP06 — Map vùng

Tạo RegionMap dùng tối đa 7 vị trí theo nhóm tuần. Địa điểm là ảnh tách nền; số tuần, khóa, lựa chọn và đường đi là UI.

Đổi chương không nạp cả ngân hàng câu. Vị trí dùng week.position, không dùng chỉ số của mảng đã lọc môn.

**Xong khi:** UI04–UI06, DM04–DM08, API05–API07 đạt.

### UP07 — Bảng tuần/bộ/trò

Tạo MapWeekPanel: desktop ở cạnh map, điện thoại là bảng nổi từ dưới. Bộ câu giữ nguyên tên/phiên bản. Chỉ yêu cầu packGames khi cần cho bộ hiện tại; không gọi cho tuần khóa.

Dùng GAME_COMPONENTS/preloadGameComponent và OnlineExerciseRunner hiện có. Không tạo nguồn câu mới, không tạo cách tính sao riêng theo skin.

**Xong khi:** UI07–UI09, RG01–RG06 và RG17 đạt.

### UP08 — Trở về đúng chỗ và chống dữ liệu cũ

Giữ vùng, chương, weekId, packId, version và mục tiêu focus trong state phiên giao diện. Dọn state/các request khi logout hoặc đổi tài khoản.

Hủy/loại kết quả request cũ khi đổi vùng/chương, bắt đầu chơi, hoàn thành, chuyển tuần, chuyển lớp hoặc cập nhật bộ. Map không được ghi đè số dư ví từ projection cũ.

Tái sử dụng start/leave/complete guards trong OnlineStudentWorld. Nếu tách thành hook, giữ bằng chứng về chống nhấp lặp và retry.

**Xong khi:** UI10–UI12, API11–API12, RG07–RG10 đạt.

## 7. Hoàn thiện các màn — UP09 đến UP11

### UP09 — Responsive, bàn phím và lỗi ảnh

Kiểm các chiều rộng 320, 390, 768, 1024, 1440; kiểm thêm landscape 844 × 390 cho bảng nổi. Không ép map ngang vào màn hẹp rồi thu chữ tới mức khó đọc.

Nút chạm tối thiểu 48 px; mục tiêu chặng điện thoại 56 px. Nhãn không bị cây/địa điểm che. Có thứ tự Tab, nhãn đọc được, Esc đóng bảng và trả focus.

Khi ảnh lỗi, vẫn có danh sách vùng/chặng với chữ và đường vào bài; nút thử lại không tự chơi/cộng sao.

**Xong khi:** UI13–UI16, AS06–AS08, PF07 đạt.

### UP10 — Đồng bộ học sinh và game

Đăng nhập dùng tranh giới thiệu; kết quả có sao tăng thêm từ server và nút về chặng; ví/cài đặt là chức năng thật. Các game dùng khung nhẹ, nhân vật tĩnh nhỏ.

Năm trò phải được kiểm tra bố cục riêng. Các dạng nhập số/điền từ/đọc/nghe vẫn chạy bằng trình hiện có; không đổi thành hoạt động khác chỉ để hợp hình.

Không viết lại luật chơi hoặc bỏ các tiện ích đọc đề, gợi ý, âm thanh và giảm chuyển động.

**Xong khi:** RG01–RG14 và UI16 đạt; ảnh QA cho game có hình/audio và nội dung dài.

### UP11 — Quản trị và đường học liệu

Giữ nhập Excel/Word, xem trước, báo lỗi theo dòng, giao/cập nhật tuần, xuất đáp án, đổi sao và backup/restore. Bản đồ phản ánh thay đổi đúng sau refresh/đăng nhập lại.

Bản đầu alias vùng nằm trong cấu hình; không tự thêm một màn quản lý map phức tạp hoặc đổi 33 cột mẫu Excel. Nếu giao diện quản trị cần nhãn bổ sung, chỉ hiển thị dựa trên dữ liệu có sẵn.

**Xong khi:** RG11–RG18 đạt; dữ liệu có sẵn không cần nhập lại.

## 8. Hiệu năng và ngân sách — UP12

- Giữ cổng artifact hiện có **≤ 5 MiB**; không tắt hoặc tăng cổng chỉ để hợp bộ ảnh.
- JS trước đăng nhập ≤ 100 KiB gzip; CSS trước vào trò của học sinh ≤ 20 KiB gzip như kiểm thử hiện có.
- Chỉ tải map đang xem; không tải đủ 10 nền ngay khi đăng nhập.
- API map tóm tắt toàn bộ lớp chỉ chứa overview và tối đa 7 node của chương đang chọn.
- Xem thêm mục ngân sách trong hợp đồng. Mọi ngưỡng mới là mục tiêu để kiểm tra, không phải kết quả hiện đã đạt.

Nếu vượt tổng 5 MiB: giảm biến thể dư/nén phù hợp trước. Chỉ loại tài nguyên cũ sau khi có bằng chứng không còn đường chạy cần nó; lưu bản gốc/hash, rà soát CSS/build/test. Không xóa art hoặc nới gate hàng loạt.

**Xong khi:** PF01–PF08 và các kiểm thử online-performance/asset hiện có đạt.

## 9. Kiểm thử, đóng gói và bàn giao — UP13 đến UP16

### UP13 — Hồi quy đầy đủ

Chạy các bộ hiện có và các ca mới theo tài liệu lệnh. Sau khi sửa lỗi, chạy lại vùng ảnh hưởng rồi cổng toàn bộ trước đóng gói. Không lặp full suite nếu không có thay đổi hoặc nghi ngờ mới.

Mỗi ca mới phải có assert kết quả, không chỉ screenshot hoặc kiểm tồn tại class CSS. Ca kiểm quyền dùng response/database, ca layout có ảnh xem thật.

### UP14 — Gói pilot và khả năng quay lại

Bump phiên bản theo quy ước release sau khi chốt thay đổi, giữ build identity/frontend/backend thống nhất. Không đổi displayMode/protocol/schema version chỉ vì tên gọi “HTML map”.

Chạy công cụ đóng gói hiện có sau build. Gói đích có thể đã tồn tại và công cụ cố ý không ghi đè; không xóa gói cũ để vượt lỗi, dùng phiên bản phát hành mới phù hợp.

Giữ đường “Danh sách bài” hoạt động. Đề xuất cờ build BAO_AN_MAP_ENABLED, mặc định mới chỉ bật khi đủ ảnh/kiểm tra; khi tắt dùng giao diện nhẹ hiện có với cùng ID/protocol. Cờ chỉ chọn presentation, không đổi quyền hay dữ liệu.

### UP15 — Hồ sơ bàn giao

Ghi việc đã làm, tệp, test ID, lệnh, kết quả, ảnh, artifact hash và hạn chế. Cập nhật docs/KE_HOACH_GIAO_DIEN_VA_TIEN_DO.md cùng README.

### UP16 — Xác nhận môi trường triển khai thật

Staging/cloud thật là bước riêng khi có môi trường và quyền phù hợp. Chạy smoke bằng tài khoản thử; nếu cần đo tải thì dùng staging và kịch bản được phép, không đưa 30–100 luồng vào production.

Không coi PostgreSQL fixture/PGlite hoặc Playwright local là đo tải Supabase/Netlify thật. Nếu chưa có quyền/ảnh/thiết bị, ghi phần tương ứng chưa nghiệm thu và hoàn tất phần độc lập.

Không yêu cầu triển khai cloud để gọi mã local “đã làm”, nhưng cũng không gọi local là website đã cập nhật.

## 10. Cổng và thứ tự

| Cổng | Đầu việc | Điều kiện đi tiếp |
| --- | --- | --- |
| G0 — Baseline | UP00–UP01 | Biết bản nguồn, test nền, màn/API có thật và ảnh chờ |
| G1 — Dữ liệu/ảnh | UP02–UP04 | Hợp đồng, test hai backend và bộ A hợp lệ |
| G2 — Lát cắt Toán | UP05–UP08 | Map tổng → Toán → bộ → trò → đúng chặng, quyền/sao đúng |
| G3 — Trải nghiệm đủ | UP09–UP11 | Bộ B, bốn vùng, các màn và trạng thái đầy đủ |
| G4 — Pilot local | UP12–UP15 | Ma trận áp dụng, full checks, gói, rollback và hồ sơ |
| G5 — Cloud thật | UP16 | Smoke/tải theo phạm vi được cho phép; ghi môi trường rõ ràng |

Ước lượng tham chiếu sau khi có ảnh phù hợp: **8–14 ngày làm việc**, không bao gồm thời gian người dùng tạo/chỉnh ảnh và thay đổi thiết kế lớn. Không biến ước lượng thành lý do bỏ test hoặc gọi phần thiếu là hoàn thành.
