# Đồng bộ khung cảnh trong ba bài test — V3.7 RC1

Ngày 14/10/2026, múi giờ Việt Nam. Bản triển khai theo mục 13 của kế hoạch; chưa nghiệm thu mỹ thuật FINAL hoặc điện thoại thật.

## Thay đổi

Math, Memory và Sentence dùng cùng cảnh/nhân vật với trang chọn đảo. Lâu đài, khu rừng và xưởng được tái sử dụng làm dấu hiệu nhận diện; thêm mặt đất, đường đi, đồi, cây và vật dụng ở các lớp sâu khác nhau. Các bảng học, HUD, nút, gợi ý, phản hồi và phần thưởng dùng màu kem với màu nhấn của từng đảo.

WorldCanvas giữ một portal root và chuyển cùng canvas vào vùng cảnh của bài test. PremiumWorldRenderer chuyển chế độ trên cùng Scene, camera, WebGLRenderer và AnimationMixer; không khởi tạo bộ dựng thứ hai, không tải GLB theo câu hoặc khi mở/đóng bài. Về trang chủ khôi phục vị trí/visibility của đảo, cáo, cảnh nền và bóng. Cảnh game thêm 7–10 mesh hiển thị, chủ yếu instancing và chia sẻ geometry/material.

Cáo 3D khớp vào vùng DOM riêng bên trái trên desktop, dải hướng dẫn gọn trên mobile. Chờ/đúng/thử lại/hoàn thành phát phản ứng từ trạng thái game đã lưu, không ghi learning event thêm. Cue cho phép phát lại phản ứng qua các cặp Memory liên tiếp. Phản ứng gắn với session để không mang trạng thái ăn mừng từ bài trước sang bài mới.

Nếu không có WebGL hoặc model lỗi, bài vẫn có nền CSS dịu và ảnh cáo render từ chính model chung. Canvas legacy được giữ paused và ẩn khi đang ở bài. Giảm chuyển động render theo yêu cầu; tab ẩn dừng RAF và reset clock khi trở lại. Các observer/listener vị trí cáo được dọn sau khi thoát bài.

CSS trang trí cũ được loại khỏi `.premium-game`; theme mới không dùng `!important`. Các vùng câu hỏi/thẻ/từ là DOM thật, canvas không chặn pointer. Đã sửa nút tiếp theo quá thấp ở Math 320 px và kho từ bị sticky action che; các giải thích dài cuộn trong vùng phản hồi để giữ bố cục.

## Phạm vi bảo toàn

`game-logic-audit.json` đối chiếu checkpoint `d2cca6c`: 19 phép kiểm tra đều giữ nguyên. Ba game không đổi imports/state/effects/callback trước JSX; sáu hàm quản lý game/học liệu trong App và toàn bộ nguồn core không đổi. Chỉ phần JSX trình bày và component phản ứng/nhân vật thay đổi. Dữ liệu, SDK, schema IndexedDB và nội dung seed giữ nguyên. HTML offline độc lập chưa đổi.

## Bằng chứng

Build cuối: `index-CWcVMOt_.js`, `PremiumWorldRenderer-DmB5MhIG.js`, CSS `index-CqsJkXTY.css`. Entry 277,43 kB/gzip 86,70 kB, premium lazy 669,30 kB/gzip 172,96 kB, CSS 232,96 kB/gzip 45,39 kB. Hai GLB giữ nguyên; ảnh cáo dự phòng thêm 29.358 byte. Cảnh mới không tải chunk legacy khi premium thành công.

| Kiểm tra | Kết quả | Log |
|---|---|---|
| TypeScript, cú pháp, build | PASS | `typecheck.txt`, `test-syntax.txt`, `build.txt` |
| SDK/core | 44/44 PASS | `test-core.txt` |
| Học liệu | 4/4 PASS | `test-content.txt` |
| Model/hoạt ảnh cũ | 13/13 PASS | `test-guide-animation.txt` |
| Renderer/controller/vùng cáo | 53/53 PASS | `test-renderer.txt` |
| Edge đầy đủ | 47/48 PASS; trường hợp còn lại phát hiện chẩn đoán draw call cũ trong reduced motion | `browser-tests-before-static-diagnostics.txt` |
| Edge kiểm tra lại sau sửa cuối | 11/11 PASS: toàn bộ 9 trường hợp game scene và 2 regression reduced motion | `browser-tests-final-targeted.txt` |
| Chrome production | 4/4 PASS | `chrome-tests.txt` |
| Nguồn học tập được bảo vệ | 19/19 không đổi | `game-logic-audit.json` |
| Art gate đầy đủ | Chưa đạt: thiếu 3 model memory/language/environment | `gate-premium-art.txt` |

Tất cả 48 trường hợp Edge đã có kết quả đạt qua lượt đầy đủ và lượt xác minh sau sửa. Không ghi lần chạy đầy đủ 47/48 thành 48/48. Sửa cuối chỉ xuất diagnostics ngay sau render tĩnh, không thêm RAF hoặc thay hành vi học tập; chạy lại toàn bộ game scene/reduced motion để chứng minh trạng thái hiển thị và dừng hoạt ảnh đúng.

Ảnh trước nâng cấp ở `baseline/`. Ảnh hiện tại, số liệu, video và nhận xét trong `game-browser-evidence.json`, `capture-summary.md`, `visual-review.md`, `shared-games-demo.webm`. Chỉ dùng kết quả chạy cuối sau sửa lỗi, không coi lần thử trước là PASS. `browser-tests-first-attempt.txt` lưu lần phát hiện diagnostics pause bị cũ và Ngôn từ 375 px tự cuộn 8 px khi nhấn kiểm tra; hai lỗi này đã qua kiểm thử trong lượt đầy đủ kế tiếp.

Capture cuối đã được xem trực tiếp đủ 36/36 trạng thái chờ/thử lại/đúng/hoàn thành của ba game ở 1440×900, 390×844, 320×640. Không có nút bị che/vượt viewport, tràn ngang, lỗi trang/tài nguyên hoặc vùng chạm chính dưới 44 px. Median khoảng 59,9 FPS trên máy thử; draw call desktop Toán/Trí nhớ/Ngôn từ lần lượt 49/32/39, viewport nhỏ 17/16/17. Mỗi hồ sơ tải hai GLB và ảnh cáo dự phòng, không thêm GLB qua các câu và bài. Video VP9 3.768.578 byte ghi cùng canvas đi qua các chế độ cảnh; HTML bảng học nằm trong ảnh chụp.

Các kiểm thử production gồm dùng chung canvas/context/GLB, 20 vòng mở/đóng game, 20 vòng home/parent, phản ứng các trạng thái của ba game, reduced motion, hidden tab, resize, lỗi model/texture/context, Math 8 câu, Memory 6 cặp và Sentence 6 câu; history/persistence/nhập học liệu chạy qua UI/IndexedDB thật.

## Giới hạn

Số FPS từ cửa sổ của renderer trên Intel Arc/Windows là bằng chứng máy thử này. Viewport điện thoại được mô phỏng trên GPU desktop; cần đo Android/iPhone thật để nghiệm thu hiệu năng mobile. Memory/Language vẫn dùng landmark tạm; chưa bổ sung ba GLB còn thiếu của art gate. Bundle premium vẫn vượt cảnh báo 500 kB của Vite. Các mục này không được ghi thành FINAL.
