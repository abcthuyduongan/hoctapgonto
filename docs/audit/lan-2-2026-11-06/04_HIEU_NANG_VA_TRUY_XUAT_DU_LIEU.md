# Hiệu năng và dữ liệu — kiểm toán lần 2, 06/11/2026

## 1. Phương pháp có thể chạy lại

Đo trên production dist source ID `5d9b56a43e18706af1f541af5ef12477c679a8d2fa0c0b1e667f45f1b48261a8`, sau khi bộ Node/Playwright nặng đã kết thúc. Giữ cùng harness/phương pháp lần 1 để so sánh: Chrome headless + PerformanceObserver/CDP/Resource Timing/CSS coverage, HTTP localhost + SQLite fixture.

- Windows, Intel Core Ultra 5 125H, 18 CPU logic, RAM khoảng 31,4 GiB, Node 22.22.2.
- Desktop: 1440×900, không làm chậm CPU/mạng bổ sung.
- Mobile giả lập: 390×844, touch/mobile, CPU ×4; CDP latency cấu hình 150 ms, 1,6 Mib/s download, 750 Kib/s upload, không mất gói.
- 3 lần/profile/kịch bản; 9 kịch bản × 2 profile = **54 mẫu**. Harness hoàn tất exit 0, không có exception/pageerror được thu thập.
- Dataset browser: 23 lớp, 1.000 hồ sơ giả lập, 8 tuần/lớp và gói 12 câu dùng chung. Không phải 1.000 người dùng đồng thời hoặc dữ liệu điểm danh THCS.
- Cold xóa HTTP browser cache; warm điều hướng lại cùng context. Không gọi cold này là cold-start Netlify/DB.
- Mốc dùng được: locator nghiệp vụ và ảnh trong viewport tải xong; game có lựa chọn bấm được; lưu đáp án có ACK hiển thị.
- Snapshot sau ready 650 ms; usableMs loại thời gian chờ đó nhưng còn overhead nhỏ phép đo. Lượt 1 có quét axe/chụp ảnh trước một số thao tác, trạng thái prefetch có thể khác lượt sau; giữ đủ ba số và không suy ra p95/SLA từ mẫu nhỏ.

LCP/CLS là quan sát trong cửa sổ lab, không phải field p75. FCP/LCP navigation không được đổi tên thành chỉ số riêng cho thao tác SPA. Requests/bytes ở mốc sau thao tác là lũy kế từ document. TTFB localhost không phải latency Supabase/RTT thực. encodedBodySize, transfer bytes và gzip cục bộ là ba đại lượng khác nhau.

## 2. Kết quả thời gian tới mốc dùng được

Đơn vị ms; ba lần giữ nguyên, không chỉ chọn số tốt nhất.

| Kịch bản | Desktop: ba lượt (ms) | Mobile: ba lượt (ms) |
| --- | --- | --- |
| Đăng nhập cold | 943,3 / 956,2 / 965,5 | 2.546 / 2.590,9 / 2.573,9 |
| Đăng nhập warm | 399,2 / 389,8 / 403,1 | 1.253,7 / 1.256,5 / 1.250,7 |
| Bấm đăng nhập quản trị | 902,3 / 884,3 / 869,2 | 1.478,3 / 1.482,6 / 1.520,5 |
| Khôi phục phiên quản trị cold | 937,9 / 889,7 / 939,5 | 4.011,5 / 4.061,2 / 4.059,1 |
| Quản trị → Học liệu tuần | 79,1 / 76,3 / 108,8 | 257,6 / 314,5 / 309,3 |
| Khôi phục phiên học sinh cold | 924,5 / 995,1 / 896,7 | 4.626 / 4.482,1 / 4.467,4 |
| Học sinh → game sẵn sàng | 481,7 / 1.016,1 / 480,2 | 3.888,7 / 3.495,2 / 3.537,7 |
| Chọn đúng → ACK hiển thị | 106,6 / 83,9 / 83 | 465,3 / 437 / 457,8 |
| Thoát game | 83,9 / 81,2 / 96,8 | 378,3 / 362,2 / 390,4 |

## 3. FCP, LCP, CLS và TTFB

Profile mobile, cùng thứ tự ba lượt. TTFB là `requestStart→responseStart` tại localhost và cách CDP ghi timing, không dùng để kết luận mạng sản xuất nhanh.

| Màn mobile | FCP (ms) | LCP quan sát (ms) | CLS | TTFB localhost (ms) |
| --- | --- | --- | --- | --- |
| Đăng nhập cold | 1.640 / 1.660 / 1.672 | 2.124 / 2.144 / 2.156 | 0,2798 / 0,2798 / 0,2798 | 2,3 / 2,2 / 2,5 |
| Đăng nhập warm | 328 / 320 / 312 | 644 / 620 / 632 | 0,2324 / 0,2324 / 0,2324 | 2,4 / 2 / 1,9 |
| Khôi phục phiên quản trị cold | 1.540 / 1.552 / 1.544 | 3.240 / 3.256 / 3.244 | 0,096 / 0,096 / 0,096 | 2,4 / 2 / 2,7 |
| Khôi phục phiên học sinh cold | 1.532 / 1.548 / 1.536 | 4.652 / 4.484 / 4.472 | 0,1119 / 0,1119 / 0,1119 | 2 / 1,8 / 1,9 |

Mục tiêu tham chiếu từ prompt: LCP ≤2,5 giây, CLS ≤0,1, INP ≤200 ms với điều kiện/nguồn đo phù hợp. **INP field: CHƯA KIỂM CHỨNG.** Harness chỉ giữ Event Timing có interactionId và long tasks; không triển khai đầy đủ phép tính vòng đời INP hoặc có dữ liệu người dùng thực tế.

Không dùng duration sự kiện lớn nhất làm INP. Cần RUM/thử tương tác thiết bị thật với dữ liệu đủ, không gửi nội dung câu hỏi/tên học sinh/token vào analytics. Các ngưỡng và phân biệt lab/field cũng được mô tả tại [Google Search Central](https://developers.google.com/search/docs/appearance/core-web-vitals) và [PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/about).

## 4. So sánh với lần 1

Trung vị usableMs ở profile mobile, cùng harness/profile. Đây là so hai lần chạy riêng, không phải thí nghiệm khẳng định quan hệ nhân quả; biến động nhỏ không đủ chứng minh tối ưu hay hồi quy.

| Kịch bản mobile | Lần 1: trung vị ms | Lần 2: trung vị ms |
| --- | ---: | ---: |
| Đăng nhập cold | 2.580,5 | 2.573,9 |
| Đăng nhập warm | 1.379,1 | 1.253,7 |
| Bấm đăng nhập quản trị | 1.486,3 | 1.482,6 |
| Khôi phục phiên quản trị cold | 4.045,2 | 4.059,1 |
| Quản trị → Học liệu tuần | 313,8 | 309,3 |
| Khôi phục phiên học sinh cold | 4.668,7 | 4.482,1 |
| Học sinh → game sẵn sàng | 3.581,5 | 3.537,7 |
| Chọn đúng → ACK hiển thị | 434,1 | 457,8 |
| Thoát game | 388,6 | 378,3 |

CSS game lớn, shell auth và phần lớn tài nguyên chính chưa được tối ưu trong bộ sửa mới. Các sửa lần này chủ yếu tính đúng/truy cập; số đo chưa đủ cơ sở công bố tăng tốc đáng kể. Không kết luận Supabase chậm khi chưa đo deployment mới.

## 5. Request, dung lượng và coverage

| Mốc mobile, lượt 1 | Requests lũy kế | JS body B | CSS body B | Tổng body B |
| --- | ---: | ---: | ---: | ---: |
| Đăng nhập cold | 8 | 245.059 | 30.282 | 345.512 |
| Khôi phục phiên quản trị cold | 13 | 396.592 | 33.194 | 509.051 |
| Khôi phục phiên học sinh cold | 16 | 330.264 | 81.219 | 693.980 |
| Học sinh → game sẵn sàng | 32 | 348.203 | 360.940 | 1.368.984 |

`GameCompletion-DfX71KsR.css` vẫn **268.623 byte**, gzip cục bộ **52.022 byte**, trùng lần 1. Main JS 226.351 byte; admin chunk khoảng 141.954 byte; student chunk khoảng 79.217 byte. Artifact assets vẫn 113 tệp, 5,08 MiB; gate hiện tại cho 8 MiB, khác baseline 5 MiB trước đây.

| Resource chậm ở lượt mobile 1 | Body B | Duration ms |
| --- | ---: | ---: |
| /assets/GameCompletion-DfX71KsR.css | 268.623 | 2.748,5 |
| /art/maps/map-math-wide.webp | 222.302 | 2.325,2 |
| /assets/index-CIahrqYG.js | 226.351 | 1.256,9 |
| /art/game-cards/game-card-memory-grove.webp | 64.242 | 1.135,6 |
| /art/game-cards/game-card-question-island.webp | 61.316 | 1.119,6 |
| /art/game-cards/game-card-word-bridge.webp | 60.310 | 1.102,3 |

Các số resource là thời gian quan sát riêng, có thể chồng nhau, không cộng thẳng thành thời gian trang. Gzip cục bộ không đại diện cấu hình nén/cache CDN Netlify. Dùng byte/CPU/waterfall để chọn việc, không chỉ nhìn kích thước ZIP.

Coverage lượt 1 cho CSS game: desktop sử dụng 38.654 / 268.613 ký tự (14,39%); mobile 35.419 / 268.613 (13,19%).

Coverage trên một quiz chỉ cho biết các rules chưa dùng trong chuỗi đã chạy. Không xóa toàn bộ phần đó trước khi rà các game/trạng thái khác và chụp ảnh hồi quy.

## 6. N10 — P1: đường mở game và ổn định layout chưa được xử lý

1. **Vị trí:** `game-base.css`, imports CSS trong runner/game, các nền game/map; `OnlineScreen.tsx:29–30` và styles/shell tải theo vai trò.
2. **Hiện trạng:** CSS game vẫn 269 KB, nền wide lớn; loading khôi phục phiên vẫn dùng shell auth có ảnh eager rồi đổi bố cục role.
3. **Bằng chứng:** ba mẫu mới ở mục 2–5, bytes CSS trùng lần 1, CLS/LCP raw trong JSON; auth-welcome vẫn xuất hiện ở session restore.
4. **Nguyên nhân:** style dùng chung chứa nhiều trạng thái/game, tài nguyên ảnh/chunk cần tải; shell/role đổi layout và CSS bất đồng bộ là ứng viên gây shift. Chưa tách attribution từng node, không quy toàn bộ CLS cho một ảnh.
5. **Ảnh hưởng:** học sinh chờ vài giây tới game trên profile hạn chế; trang dịch vị trí và tải tài nguyên không cần cho người đã đăng nhập.
6. **Sửa:** tách shared CSS nhỏ + CSS riêng, tối ưu ảnh/nền theo viewport, ưu tiên câu đang học và giới hạn prefetch; shell kết nối nhẹ và vùng skeleton/ảnh có kích thước ổn định; đo layout-shift sources.
7. **Kỳ vọng:** giảm byte/time tới game và CLS trên cùng profile. Chỉ công bố mức tăng tốc sau khi đo bản sửa.
8. **Rủi ro:** CSS cascade/hint/result của game khác, cache sai quyền, prefetch tranh băng thông, flash sai role.
9. **Nghiệm thu:** ba mẫu cold/warm/login/chuyển màn, ảnh hồi quy mọi game/ba viewport, clock/media/ACK/sao đúng; đo staging thật để chốt SLA.

## 7. Đo truy xuất ở quy mô trường học

SQLite in-memory, 23 lớp/1.000 học sinh, 32.000 awards, 184 tuần, 32 gói/384 câu tổng hợp; ba lần mỗi tab. Đây là data-access thuần, không bao gồm auth/network/render hoặc Supabase.

| Tab | Ba lượt ms | Query | JSON B |
| --- | --- | ---: | ---: |
| students | 2 / 1,2 / 1,4 | 7 | 6.530 |
| weeks | 0,9 / 0,7 / 0,5 | 8 | 8.100 |
| wallet | 0,4 / 0,2 / 0,2 | 5 | 2.522 |

Số query và JSON vẫn gọn; chưa có bằng chứng cần viết lại tầng dữ liệu. Tab ví ở fixture không có yêu cầu đổi quà, không đại diện lịch sử lớn. Mỗi index/pool/cache mới phải có PostgreSQL trace/EXPLAIN và kiểm tra chi phí ghi, quyền và invalidation trước khi đề xuất triển khai.

## 8. N11 — P1: staging runner vẫn coi HTTP lỗi là thành công

1. **Vị trí:** `tools/staging_load_runner.mjs:85,91–100`, không đổi trong bộ sửa.
2. **Hiện trạng:** chưa đi đúng luồng đăng nhập/cookie/CSRF/mở câu/media/submit; fetch resolve bị coi là thao tác tốt.
3. **Bằng chứng mới:** fault injection toàn bộ **21 request trả 401/404**, runner vẫn báo **7 operations, 0 errors, 0,00%**. Đây là tái hiện false-positive, không phải số đo tải thực tế.
4. **Nguyên nhân:** không kiểm tra HTTP/body/nghiệp vụ, endpoint journey bị gán tên mở câu, media chỉ là icon và không nộp bài.
5. **Ảnh hưởng:** có thể xác nhận tốc độ/error rate tốt trong khi người dùng không học được; kết quả không đủ đóng cổng tải thật.
6. **Sửa:** kịch bản học qua HTTP thật và dữ liệu thử hợp lệ; xác thực, đọc hết body, phân loại lỗi, counter/exit nonzero và đối soát ledger. Chạy staging riêng.
7. **Kỳ vọng:** dữ liệu đo phản ánh đúng trải nghiệm; request thất bại không tạo mẫu thành công giả.
8. **Rủi ro:** tải ngoài ý muốn/làm bẩn dữ liệu; chỉ dùng staging và concurrency/thời lượng đã thống nhất.
9. **Nghiệm thu:** 401/403/404/500/timeout/body sai phải FAIL; luồng học thật có media/ACK; 30 người ≥30 phút và 100 nếu giữ tiêu chí; lưu raw timing và invariant.

## 9. N12 — P2 phát hành: source, ZIP và website không cùng build

1. **Vị trí:** build-info dist, artifact 4.0.1, package/deploy workflow và báo cáo kết quả.
2. **Hiện trạng:** mã/dist mới là `5d9b56…`, ZIP 4.0.1 đang có vẫn `59d67c…`; website đã biết vẫn 3.9.0-rc.1.
3. **Bằng chứng:** JSON/manifest cục bộ và hai endpoint công khai đọc lại trong `evidence/public-website.json`.
4. **Nguyên nhân:** sửa mã mà chưa tạo phát hành mới/deploy đúng identity; chỉ cùng số version không chứng minh cùng mã.
5. **Ảnh hưởng:** bàn giao ZIP/website hiện có không đưa các sửa mới tới người dùng; log có thể bị gán nhầm build.
6. **Sửa:** sau khi đóng lỗi, chốt source/commit, dùng phiên bản mới phù hợp, đóng gói immutable và deploy có smoke/rollback; đối chiếu identity ở mọi nơi.
7. **Kỳ vọng:** người dùng nhận đúng build đã nghiệm thu, báo cáo truy vết được.
8. **Rủi ro:** ghi đè artifact cũ, phát hành khi còn P0 hoặc schema không tương thích rollback.
9. **Nghiệm thu:** version/commit/source ID của source, dist, ZIP, API status và website khớp; mở gói sạch và diễn tập dữ liệu staging.

## 10. Những mục CHƯA KIỂM CHỨNG

- PostgreSQL/Supabase thực, RLS runtime, Storage bucket và Netlify cold-start/queue của source mới.
- 30/100 người hoạt động thật đồng thời đủ thời lượng; độ trễ mở câu/ảnh/audio p95 trên mạng/hạ tầng thật.
- INP field, thiết bị Android/iOS vật lý, packet loss và zoom trình duyệt 200% thật.
- Biên bản dùng thử học sinh/giáo viên/phụ huynh thật và duyệt chuyên môn.
- TKB/sơ đồ ghế/điểm danh: KHÔNG ÁP DỤNG, không có trong app.

Lý do: không có staging source mới đã triển khai và phép đo thật được cấp/ghi nhận trong đợt này. Kiểm chứng tiếp bằng staging cùng hạ tầng, seed dữ liệu thử, runner đã sửa, browser/API/DB timing cùng trace ID, buổi dùng thiết bị/người thật. Không thay các mục này bằng mô phỏng hoặc chấm điểm tối đa.
