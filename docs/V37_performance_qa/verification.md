# V3.7 PR05 — Hiệu năng và hồi quy production

Đã kiểm tra checkpoint PR05 trên Windows/Edge và Chrome. Bản này tiếp tục là **RC**; phép đo desktop/emulation không thay cho nghiệm thu điện thoại hoặc mỹ thuật. Sau phép đo này đã thêm UI sao lưu hồ sơ; build và hồi quy mới được ghi riêng tại [QA hồ sơ](../V37_backup_qa/verification.md). Các số đo bên dưới thuộc đúng bundle PR05 liệt kê ở đây, chưa phải benchmark chạy lại sau khi thêm UI hồ sơ.

## Build và phạm vi

- Build: `index-DW3hY3JA.js`, `PremiumWorldRenderer-Bg0lq9Pl.js`, `geometryLod-C3pQQttj.js`, CSS `index-CqsJkXTY.css`; đối chiếu [build.txt](build.txt) và danh sách bundle trong [performance.json](performance.json).
- Frontend cuối có LOD tùy chọn, cache bóng của cảnh game và chuẩn bị hai biến thể shader bằng `compileAsync`. Máy đo có `KHR_parallel_shader_compile`; không suy ra mọi GPU đều hỗ trợ.
- Middleware Vite preview phục vụ Brotli/gzip theo `Accept-Encoding`. Năm GLB gốc, đường dẫn, luật game và callback lưu dữ liệu giữ nguyên. LOD đổi geometry trong cùng scene, dùng lại material/texture.
- Các lượt trước được giữ riêng: [b3702c2 baseline](baseline-performance.json), [trước shader prewarm](before-shader-prewarm-performance.json), [shader prewarm chưa nén](shader-prewarm-performance.json). Kết quả cuối là `performance.json` và `stress-performance.json`, không lấy lượt trước làm kiểm chứng build cuối.

## Kiểm tra đạt trên build PR05

| Kiểm tra | Kết quả | Bằng chứng |
|---|---:|---|
| TypeScript và build | PASS | [typecheck](typecheck.txt), [build](build.txt) |
| Renderer/asset/carousel/viewport/LOD/shadow/HTTP transport | 85/85 | [test-renderer.txt](test-renderer.txt); gồm 8 kiểm tra HTTP transport |
| Full Edge production | 58/58, 3,1 phút | [browser-tests.txt](browser-tests.txt) |
| Chrome production smoke | 4/4 | [chrome-tests.txt](chrome-tests.txt) |
| Core/content/guide animation | 44/44, 4/4, 13/13 | [core](test-core.txt), [content](test-content.txt), [guide](test-guide-animation.txt) |
| Hai profile không throttle, một profile stress | Không lỗi | [performance.json](performance.json), [stress-performance.json](stress-performance.json) |

Full Edge bao gồm ba kiểm tra hiệu năng mới: đổi high/low và chơi cả ba game vẫn dùng cùng canvas/context; geometry low giảm ít nhất 25% và high khôi phục đúng geometry gốc, material/texture không nhân bản; chunk LOD 404 vẫn giữ renderer premium/geometry gốc và chơi được cả ba game. Kiểm tra cache bóng xác nhận cáo tiếp tục animation nhưng bóng đảo không render lại khi game đứng yên; đổi quality làm bóng được cập nhật.

Fixture sửa GLB qua route bỏ `Content-Encoding`, `Content-Length` và ETag trước khi trả body đã giải nén/chỉnh sửa. Full suite cuối đã chạy lại với transport thật; không dùng một targeted retest để ghi thành full PASS.

## Phép đo bình thường

Máy: Windows 10.0.26300, Intel Core Ultra 5 125H, Intel Arc qua ANGLE/D3D11; Edge 155.0.4283.45. Mỗi viewport dùng context riêng, DPR 1. Đây là một mẫu localhost mỗi viewport; cache server/driver có thể ấm giữa các lượt, không phải thử nghiệm thống kê hay đo cold GPU.

| Chỉ số | 1440×900 | 390×844 touch emulation |
|---|---:|---:|
| Cảnh 3D ready từ navigation | 1186,1 ms | 581,3 ms |
| Median FPS ở các phase đã warm | 59,9 | 59,9 |
| P95 frame duration lớn nhất trong các mẫu phase | 16,8 ms | 16,8 ms |
| Click → feedback DOM + hai RAF, ba game | 44,3–45,3 ms | 44,1–45,5 ms |
| Long tasks trước ready | 214 và 393 ms | 76 ms |
| Long task ở lần yêu cầu low được đo | 90 ms | Không ghi nhận; cache đã chuẩn bị từ mobile low ban đầu |
| CPU chuẩn bị cache LOD / mesh lớn nhất | 235,7 / 19,0 ms | 246,3 / 19,2 ms |

Low render 75.074 triangles mỗi frame, so với 118.632 ở low của baseline: ít hơn 36,7%. LOD diagnostics ghi 88.932 → 48.774 triangles ở phần geometry đủ điều kiện giảm, 41 geometry được thay. GPU render counters có thể tính nhiều lượt do bóng/transparent; kiểm tra geometry riêng loại trừ việc dùng giảm bóng hoặc DPR để đạt chỉ tiêu LOD.

Balanced home cập nhật bóng theo nhịp giới hạn; GPU triangles trong mẫu dao động 118.632–221.328. High giữ geometry gốc/bóng đầy đủ, 221.328 triangles. Đây là lượng công việc render, không phải phép đo điện năng.

Mẫu trước shader prewarm có task 293 ms khi lần đầu đổi low; mẫu cuối ghi 90 ms. Vẫn có task vượt 50 ms khi khởi tạo/đổi quality. Không gọi các phase đã warm có 0 long task là điều kiện “không khựng” toàn hành trình. [Bảng phép đo](performance-summary.md) và JSON giữ toàn bộ attribution được browser cung cấp; attribution chi tiết có thể là `unknown`.

## Truyền asset và vòng đời

- Browser nhận đủ năm response `Content-Encoding: br`: **7.271.708 bytes GLB giải nén → 3.428.044 bytes body Brotli**, giảm 52,9%; ResourceTiming transfer gồm overhead là 3.429.544 bytes. Gzip 3.791.705 bytes được xác minh bằng HTTP unit tests, không phải codec dùng trong hai profile browser này.
- Tối đa hai model request đồng thời. Không fetch lại GLB khi đổi quality, chọn game, trả lời hoặc trở về home; PNG PBR vẫn nhúng trong GLB.
- Một WebGL context và một canvas trong các cảnh đã ready; một RAF app khi có animation. Tab ẩn dừng RAF và mixer; quay lại tiếp tục cùng scene.
- Về Parent gỡ canvas, còn 0 RAF renderer, đủ **87/87 ImageBitmap đóng đúng một lần** trong từng profile. UUID material/texture giữ nguyên khi high → low → high; high khôi phục đúng UUID geometry gốc.
- `gpuGeometries`, `gpuTextures`, texture byte estimate và bitmap-close counters là counters/ước lượng, **không phải phép đo peak GPU/RAM**. Không đo nhiệt, pin hoặc mức sử dụng CPU đỉnh.

## Stress có throttle

CDP giả lập 390×844, download 1,6 Mbps, upload 0,75 Mbps, latency 150 ms và CPU chậm 4×; GPU vẫn là Intel Arc desktop. [stress-summary.md](stress-summary.md), [raw JSON](stress-performance.json), [log](stress-run.txt).

- Math thao tác được ở **2336,4 ms** khi host còn `loading`; lượt đúng thật được lưu và feedback tới frame có thể render sau **92,3 ms** từ click. Khi ấy chưa tạo WebGL context. Cảnh 3D sau đó ready ở **21.333,7 ms**.
- Tải cùng 3.428.044 bytes Brotli, tối đa hai GLB in flight; không refetch, không lỗi; 87/87 bitmap đóng một lần khi dispose.
- Sau warm, trả lời ba game mất 40,1–56,6 ms. Median FPS 59,9; P95 lớn nhất ở balanced phase đầu là **33,4 ms**, rồi low/high ổn định khoảng 16,8 ms. Balanced phase ghi hai long task.
- Trước ready có bảy task: **69, 233, 68, 102, 116, 66, 200 ms**; lần yêu cầu low được đo có **107 ms**. Chuẩn bị LOD dùng tổng 1155,4 ms CPU chia qua nhiều task; mesh lớn nhất 96,8 ms dưới throttle 4×. Không diễn giải tổng CPU như một task liên tục hoặc gọi phép thử này là điện thoại thật.

## Hình ảnh và phần còn mở

Đã xem [low desktop](home-low-1440.png), [low mobile](home-low-390.png) cạnh baseline: giữ silhouette ba đảo, cáo ở góc chờ, kiến trúc/cầu/cây và controls; mây low có ít mặt hơn nên góc cạnh hơn. Chấp nhận về kiểm tra hiển thị kỹ thuật, không tự gán điểm duyệt mỹ thuật. Full suite kiểm tra bố cục 320–1920 px, tablet/landscape và tương tác game.

Điện thoại Android/iPhone, FPS/nhiệt/pin/bộ nhớ và touch thật chưa được đo. Duyệt mỹ thuật chính thức còn mở; [checklist thiết bị](../V37_art_qa/phone-acceptance.md) vẫn cần kết quả thật. Sao lưu/khôi phục hồ sơ session/event đã được triển khai và kiểm tra ở đợt tiếp theo: [QA hồ sơ](../V37_backup_qa/verification.md); dữ liệu phép đo PR05 được giữ nguyên để tránh nhầm build. Xem [đối chiếu Gate A/B/C](../V37_RELEASE_READINESS.md) và [kế hoạch V3.8](../KE_HOACH_V38_GIAO_DIEN_VA_GAME_MOI.md). Tiếp tục phần được giao, giữ RC và không chốt FINAL bằng các số liệu emulation này.
