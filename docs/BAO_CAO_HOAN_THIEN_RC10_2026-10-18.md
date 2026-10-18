# Hoàn thiện và kiểm tra phát hành RC10

Đợt 17–18/10/2026. Phiên bản `3.8.0-rc.10`; nhánh làm việc `feature/v37-premium-world`, nền Git `ab202e9`. Báo cáo kiểm toán ban đầu ngày 17/10 và các gói RC9/RC8 được giữ nguyên để truy vết.

## Kết luận

Các lỗi đã tái hiện trong kiểm toán và những lỗi phát hiện thêm khi sửa đã được xử lý trong mã nguồn RC10. Bộ Node đạt **323/323**; Chrome/Edge đạt **108/108**, không skip/flaky; TypeScript và bản dựng đạt. Sau chỉnh cuối về bảng môn dễ đọc và giấy phép, kiểm lại **12/12** ca quản trị/tài khoản/PWA, **2/2** ca file gốc/mobile và **19/19** ca đóng gói/worker đều đạt. ZIP cuối đã được giải nén và khởi động riêng, kiểm đủ 69 hash, không node_modules.

Chưa đủ cơ sở công bố phát hành rộng. RC10 là ứng viên để triển khai staging/nghiệm thu giới hạn; còn thiếu đo cloud thật, thiết bị/giọng đọc thật, giáo viên/học sinh dùng thử và diễn tập phục hồi cloud. Không coi website đang dùng đã cập nhật chỉ vì mã cục bộ đạt.

## Các lỗi đã sửa

| Mã | Vấn đề đã xác nhận | Sửa và kiểm chứng |
|---|---|---|
| AUDIT-01, P1 | API gửi trước đáp án/lời giải; bài nghe có thể nhận sao dù chưa tải âm thanh | Allowlist dữ liệu học sinh, mở câu lần lượt; chỉ feedback đúng mới có đáp án/transcript; máy chủ ghi hint, clock và biên nhận tải/đủ thời lượng. Thử API trực tiếp trên SQLite và PostgreSQL fixture, HEAD/Range thiếu không được tính |
| AUDIT-02, P1 | Đổi nghĩa câu cùng ID nhưng giữ sao cũ, tuần mới sẵn sàng sai | Preview và publish chặn; câu mới cần ID mới và bắt đầu 0 sao; sửa lời giải giữ sao. Giữ ví/lịch sử và kiểm lại khôi phục |
| AUDIT-03, P2 | Tên file gốc dài làm trang nhập tràn 390px | Grid co đúng, tên file ngắt dòng; kiểm 320/360/390px và cỡ chữ gốc 200% trên Chrome/Edge, không che nội dung bằng overflow hidden |
| RC10-04, P1 | WAV có RIFF/WAVE nhưng nội dung hỏng vẫn được công bố, tới lúc học mới lỗi | Xác minh thời lượng trước ghi DB/Storage; tệp lỗi không lưu. Batch lỗi dữ liệu được tách để nhận tệp tốt; mạng/auth/5xx không phát sinh tải lại từng tệp |
| RC10-05, P1 | Xếp Câu/Bậc Thang xem gợi ý nhưng server ghi hintsUsed 0 và vẫn cấp 3 sao | Gợi ý có biên nhận máy chủ cho câu hiện tại; không gửi sẵn hint trong presentation; chờ/error khóa gửi đáp án, đúng sau hint được 2 sao. Có ca HTTP/browser và kiểm tra backup giả biên nhận |
| RC10-06, P2 | Giữ base64 toàn bộ tư liệu, không có ngân sách tổng lựa chọn | Chỉ giữ File/metadata, mã hóa batch hiện tại; tối đa 100 tư liệu/32 MiB/lượt, báo chia nhỏ trước đọc/tải và giữ lựa chọn trước. Kiểm giải mã tối đa ba tệp đồng thời |
| RC10-07, P2 | Cache build cũ tích lũy không giới hạn qua cập nhật | Worker chỉ giữ current + hai build trước và chỉ dọn cache đúng tên do app tạo. Test VM kiểm phạm vi xóa, fallback chunk, kích hoạt lặp và API không cache |
| Giao diện, P3 | Đáp án đọc/nghe đúng không tô xanh do khóa đáp án đã được giấu | Tô theo feedback đúng từ máy chủ, kiểm không tô trước đáp án và xóa màu khi chuyển câu |

Đường công khai cũ `/play` cũng buộc giao thức an toàn và che đáp án; vẫn giữ pool sao di sản tối đa 3/bộ để tương thích, không tạo mastery từng câu. Luồng UI hiện hành dùng `/play/compact` luật từng câu v2; pool di sản được lấy max với tổng sao câu, không cộng chồng. Các lời gọi kho dữ liệu nội bộ cũ dùng cho migration/fixture không phải API công khai cho học sinh.

Không thay luật đã chốt: mỗi câu tối đa 3 sao qua nhiều game; 1→3 thêm 2; mọi câu đạt ít nhất 2 sao rồi học sinh chọn ôn hoặc xác nhận chuyển tuần, tuần đã qua khóa. Tuần mới 3–4 môn, tối đa 12 câu/môn. Không đặt lại sao, chia tuần cũ hay tự sửa nội dung Excel.

## Bằng chứng kiểm thử

Máy Windows, Node `v22.22.2`, Chrome và Edge headless. Chỉ dùng DB/tài khoản/tư liệu thử trong `test-results`, không dùng `.online` thật.

| Nhóm | Kết quả |
|---|---|
| TSX syntax / TypeScript | Đạt |
| Node | 323/323: renderer 103, release 10, online 170, cloud fixture 40; không skip/cancel |
| Đóng gói trong Node suite | Gói giải nén chạy không node_modules; audio parser hoạt động thật; sao lưu, phục hồi thư mục sạch, đăng nhập/sao/đổi quà được đối chiếu |
| Tài nguyên 3D | Gate tài nguyên đạt; không thay cho FPS trên máy yếu |
| Dependency audit | Production và toàn bộ cây báo 0 lỗ hổng đã biết khi quét; không thay SAST/pentest hoặc rà giấy phép đầy đủ |
| Browser mới trước lượt chốt | 8/8 Chrome: hint hai trò, file lỗi/client/server, fallback giữ file tốt, 5xx không fan-out, mẫu đầy đủ và ngân sách chọn tệp |
| Browser toàn bộ | 108/108; 54 Chrome và 54 Edge, không skip/flaky. Kiểm lại artifact cuối 12/12 sau thay đổi bảng/giấy phép |
| File gốc của chủ dự án | 2/2 Chrome/Edge đạt, Excel và 16 WAV, 320/360/390px + root font 32px |

Lượt toàn bộ kết thúc 108/108 (54 Chrome, 54 Edge) trong 8,6 phút; không skip, không flaky. Sau đó bảng môn được giữ độ rộng dễ đọc trong vùng cuộn có hướng dẫn và hỗ trợ phím; công cụ build thêm giấy phép đầy đủ. Các thay đổi cuối này được kiểm lại đúng phạm vi: 12 ca browser quản trị/tài khoản/PWA trên artifact cuối, hai ca file gốc có kiểm cuộn phím, 19 ca package/worker. Không cộng các lượt kiểm lại thành số ca khác nhau. Manifest cuối ghi build `572c8a1ac555136f`.

Ca browser hint mới ban đầu tìm nút bằng nhãn “Kiểm tra” trong lúc nó đổi thành “Đang lưu…”, gây thất bại locator. Ảnh/trace xác nhận nút đã disabled đúng. Đổi test sang class hành động ổn định, không nới kiểm tra chặn đáp án/hint/số sao; hai host đạt sau kiểm lại. Giữ log lượt thất bại và lượt chạy lại. Tương tự, ca replay cũ cần chờ React dựng body chi tiết trước kiểm tra nút; đã thêm chờ body thực tế.

### File Excel 140 câu và âm thanh gốc

Excel 37.408 byte, 16 WAV tổng 1.002.058 byte; đọc trực tiếp từ Downloads, không ghi lại file nguồn. Upload chuẩn vẫn một POST media/batch, 16 đối tượng, không gọi dashboard trong luồng preview. 139/140 câu hợp lệ; câu `BA3.W01.WK.TOAN.quiz.008` bị loại rõ tại sheet Câu hỏi, dòng 122, ô F122 chứa `#NAME?` trong chính dữ liệu gốc.

File có 10 môn, vượt cấu hình tuần mới và có môn quá 12 câu; nút giao bị khóa đúng. Giáo viên cần sửa ô và chia học liệu theo tuần 3–4 môn. Không gọi đây là “file không load được”, không tự chọn bỏ 104 câu để vừa mẫu 36 câu. Bộ mẫu Excel ZIP 36 câu/3 môn/tám dạng kèm hai hình/hai âm thanh đã có ca nhập/giao bài riêng.

Lượt trên artifact cuối: Chrome **4.337 ms**, Edge **2.867 ms** từ bấm kiểm tra tới preview; một batch/16 đối tượng trên cả hai. Thời gian và kích thước được lưu trong `test-results/rc10-final-artifact-import/original-import-{chrome,msedge}.json`. Khi đo còn có kiểm thử khác trên cùng máy; các lượt khác dao động theo tải. Đây là fixture tại máy, không phải thời gian Netlify/Supabase thực tế hoặc cam kết hiệu năng mọi mạng.

### Tải và bộ nhớ

Mỗi trình duyệt chạy 30 ván hoàn chỉnh xoay qua năm game, 29 lần đổi host, ba môn/tám câu nguồn; ví giữ 24 sao, không có play active sau thoát. DOM sau khởi động/đến cuối cùng 168 node, canvas 1→1. Heap sau GC từ ván 5 đến ván 30 tăng 866.728 byte ở Chrome (~0,83 MiB), 622.440 byte ở Edge (~0,59 MiB), trong ngưỡng test 16 MiB. Ca này không gắn tư liệu audio nên số audio 0 không được dùng riêng để kết luận audio không rò; nhóm media riêng kiểm retry/phát/dọn khi thoát. Có thêm vòng đời 20 lần vào/thoát. Số liệu nằm trong `rc10-browser-resource-summary.json`; không suy ra “không rò bộ nhớ” từ một đường heap ngắn.

Ngân sách tư liệu và cache giải quyết hai đường tăng tài nguyên cụ thể. Chưa có thử 60 phút trên máy RAM thấp, 100 học sinh nộp đồng thời trên PostgreSQL thật, background kill/thermal, hoặc FPS/giọng Việt trên điện thoại. Biên nhận âm thanh chứng minh tải hợp lệ và thời gian tối thiểu, không chứng minh trẻ thực sự nghe/chú ý. Game ghép cặp/xếp thứ tự có các thành phần chơi công khai; người soạn cần giới hạn trò phù hợp mục tiêu, không hứa chống gian lận tuyệt đối từ client.

## Website hiện tại và điều kiện phát hành

Kiểm đọc công khai lúc 07:34 ngày 18/10 giờ Việt Nam: trang chủ và status HTTP 200, API configured true. `/sw.js` vẫn build `2bb9c2c7dbb008a8`, API chưa có runtimeVersion/giao thức RC10. Đây là bản online khác RC10; chưa push/deploy trong phiên này. Lần GET status đầu 3.243 ms, sau 572 ms, chưa tách cold start/DB/mạng; không có đăng nhập hoặc thử tải ghi dữ liệu production.

| Cổng | Trạng thái RC10 |
|---|---|
| G0 | Phạm vi ứng viên Web/quản lý/học sinh/Windows được ghi rõ; các portal/native/quy trình ngoài phạm vi không được coi là đã làm |
| G1 | Kiểm kỹ thuật local đạt theo bảng; chưa có CI từ commit sạch/SAST và toàn bộ hồ sơ giấy phép theo phạm vi |
| G2–G3 | Lỗi chấm sao/định danh/gợi ý/tư liệu đã sửa; cần staging và giáo viên duyệt đáp án/gợi ý/mốc sao/độ vừa sức |
| G4 | Viewport tự động đạt theo test; thiết bị thật, giọng Việt, touch và FPS còn chưa xác nhận |
| G5 | SQLite/fixture có bằng chứng; tải 30→100, soak và phục hồi PostgreSQL+Storage thật còn mở |
| G6 | Chưa có biên bản giáo viên/học sinh dùng thử |
| G7 | Có version handshake, mã hỗ trợ/log tối thiểu, runbook; còn cảnh báo có người nhận, smoke cùng commit và diễn tập rollback |

Xem [phạm vi và trình tự vận hành](PHAM_VI_VA_VAN_HANH_RC10.md), [phiếu nghiệm thu](NGHIEM_THU_CUC_BO_RC10.md), [GitHub/Netlify](CAP_NHAT_NETLIFY_RC10.md). Workbook 280 ca vẫn là danh sách yêu cầu/đối chiếu, không phải 280 ca đã nghiệm thu. Không biến các phần cloud/máy thật/UAT chưa chạy thành trạng thái đạt.

## Gói và tái lập

Gói đã chốt sau hồi quy: `releases/bao-an-learning-3.8.0-rc.10.zip`, **6.281.946 byte**, SHA-256 `1c99361949fc8184d7c1beb08df6ef2f3a3c27795f57821ae35a38afcabd9b4e`, build **572c8a1ac555136f**, 58 tệp ứng dụng/69 tệp trong manifest. `pilot:true`, `releaseReady:false`, `humanPilotStatus:UNVERIFIED`; SQLite 1/PostgreSQL 1. Có giấy phép đầy đủ cho 18 package trong gói standalone và năm package trình duyệt trong bản Web; chưa thay cho rà giấy phép toàn bộ tài sản/sản phẩm.

`releases/bao-an-learning-rc10-cap-nhat-github.zip` là gói các tệp nguồn thay đổi, có `CAP_NHAT_MANIFEST.json`; checksum nằm ở `releases/RC10_SHA256.txt`. Không ghi đè RC9/RC8, không sửa thư mục mẫu người dùng đã giải nén hoặc `.online`. Không đưa bí mật, DB, outputs, node_modules hay kết quả thử vào gói nguồn. Chưa commit/push/deploy. Bộ mẫu Excel ZIP giữ SHA-256 `9b6f19b0975dd4a8c7cfaea5a8101cb6b7078c23e0ae8d079a62d4ddd11d773f`; ZIP RC9 giữ `e29512b4d35713310440bbe74f4ed8e185a7720950adcbd432d0ce442deb4c3d`.

Các log chính dưới `test-results/`: `rc10-node-acceptance.log`, `rc10-typecheck-artifact.log`, `rc10-build-artifact.log`, `rc10-assets-final.log`, `rc10-audit-production.json`, `rc10-audit-all.json`, `rc10-browser-final-pass.{log,json}`, `rc10-final-artifact-browser.{log,json}`, `rc10-final-artifact-import/`, `rc10-final-artifact-package.log`, `rc10-actual-zip-smoke.json`, `rc10-package-verification.json`, `rc10-release-audit/public-site-check.json`.

```powershell
npm ci
npm run typecheck
npm test
npm run test:assets
npm run build
npm run test:online:browser
npm run package:pilot
```

Bản dựng chốt dùng các tệp public của mã nguồn, loại riêng thư mục mẫu rời untracked của người dùng khỏi thư mục staging build; không xóa/sửa thư mục gốc đó. Khi clone/commit theo hướng dẫn, thư mục untracked này không được thêm nên build có cùng tài nguyên. Mã nguồn và manifest từng tệp giúp kiểm tra lại. Không chạy công cụ tái hiện lỗi lịch sử `adversarial-api.mjs` như một cổng chứng minh an toàn; regression mới nằm trong bộ test hiện hành.
