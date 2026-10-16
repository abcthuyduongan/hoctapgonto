# V3.7 — Sao lưu và khôi phục hồ sơ học tập

Ngày kiểm tra: 14/10/2026. Đây là phần hoàn thiện Gate B và mốc bảo toàn hồ sơ V38-00B, trên React production. Bản ứng dụng tiếp tục là RC; nghiệm thu điện thoại và mỹ thuật còn riêng.

## Chức năng đã có

Trong **Góc phụ huynh → Sao lưu hồ sơ học tập**, tải tệp JSON chứa học liệu, phiên chơi và lượt thử. Chọn tệp để xem trước số bản ghi sẽ thêm, đã có và xung đột; chỉ ghi khi bấm **Thêm hồ sơ vào thiết bị**. Báo thành công và cập nhật báo cáo sau khi giao dịch hoàn tất.

- Envelope riêng `baoan-learning-backup`, format 1; tối đa 10 MiB UTF-8, 500 bộ học liệu, 10.000 phiên và 100.000 lượt thử. Giới hạn được kiểm cả với hồ sơ tổng sau khi hợp, theo đúng JSON xuất có thụt dòng và metadata. Tệp học liệu Creator vẫn dùng định dạng riêng.
- Snapshot đọc `packs`, `sessions`, `events` trong cùng một giao dịch readonly; bổ sung các builtin còn thiếu để đủ học liệu được lịch sử tham chiếu. Không đổi nội dung hoặc timestamp học liệu.
- Parser kiểm cấu trúc, loại nội dung, timestamp, liên kết pack/version/session/module/item/objective và kết quả theo SDK. Học liệu v1 đã được importer chấp nhận vẫn sao lưu được, kể cả objective dài, tiêu đề có khoảng trắng, phiên bản số lớn và extension JSON thuần dữ liệu.
- Restore chỉ thêm. Bản trùng giống được bỏ qua; cùng khóa nhưng khác nội dung làm từ chối toàn bộ. Kiểm lại dữ liệu hiện tại và xung đột bên trong **một giao dịch readwrite trên cả ba store**, không có await giữa kiểm tra cuối và ghi. Constraint/quota hoặc lỗi giữa chừng abort toàn bộ.
- Nếu thiết bị có phiên đang chơi, restore bị chặn, kể cả khi phiên đó bắt đầu ở tab khác sau preview. Phiên active mới trong tệp được nhập thành abandoned tại thời điểm xuất; preview giải thích chưa hỗ trợ tiếp bài giữa phiên. Không sửa phiên đã có.
- DB giữ tên `bao-an-learning-v3-alpha`, version 1 và ba store. Các hàm storage/game/SDK cũ giữ nguyên; `storage.ts` chỉ thêm export dùng lại kết nối. [19 đối chiếu nguồn](../V37_games_qa/game-logic-audit.json) ghi rõ ngoại lệ duy nhất này; không tuyên bố SHA toàn bộ storage vẫn giống trước.
- Component và CSS backup được lazy load khi mở Parent. Build có entry `index-BV_zeW5o.js`, renderer `PremiumWorldRenderer-BZFGJ8hg.js`, LOD `geometryLod-DwiEQM00.js`, backup `LearningProfileBackup-COqsxmTH.js` (19,50 kB / gzip 6,68 kB), CSS backup 1,14 kB. [Build](build.txt) giữ cảnh báo Three >500 kB.

## Kết quả kiểm tra

| Kiểm tra | Kết quả | Bằng chứng |
|---|---:|---|
| Typecheck và build | PASS | [typecheck](typecheck.txt), [build](build.txt) |
| Parser, round-trip, v1 compatibility, conflict, active normalization | 17/17 | [test-backup.txt](test-backup.txt) |
| Targeted Edge backup trên production | 11/11, 27,3 giây | [backup-browser-tests.txt](backup-browser-tests.txt) |
| Full Edge production sau tích hợp backup | Đang kiểm tra | [browser-tests.txt](browser-tests.txt) |
| Core/content/guide | 44/44, 4/4, 13/13 | [core](test-core.txt), [content](test-content.txt), [guide](test-guide-animation.txt) |
| Renderer/carousel/LOD/shadow/HTTP | 85/85 | [test-renderer.txt](test-renderer.txt) |
| Đối chiếu logic được bảo vệ | 19/19 | [audit](game-logic-audit.txt) |
| Năm GLB/PBR/rig/animation | File gate PASS | [gate](gate-premium-art.txt) |

Browser test chơi Math 8 câu, Memory 6 cặp, Sentence 6 câu thật, ghi 3 phiên completed và 20 event; tải backup bằng download UI, khôi phục vào context QA mới rồi so từng bản ghi và report. Nhập lại không thêm bản ghi. Có kiểm tra conflict riêng cho cả ba collection, tab khác đổi dữ liệu sau preview, session active phát sinh sau preview, tệp sai schema/thiếu liên kết và hồ sơ tổng vượt giới hạn.

Rollback được kiểm trên IndexedDB thật: constraint case gây lỗi request sau khi write đầu đã success; quota case ném `QuotaExceededError` ở add thứ hai sau khi write đầu đã được enqueue. Cả hai xác nhận transaction cả ba store abort, đọc lại và so counts cùng toàn bộ JSON byte trước/sau giống nhau. Đây là mô phỏng lỗi qua instrumentation **trong profile QA**, không đo dung lượng vật lý đầy ổ đĩa và không thay adapter ứng dụng.

## Hiển thị và phạm vi

Ảnh/bounds phần backup ở 1440, 390 và 320 px đang được chụp trên build này; kiểm trạng thái ban đầu, xem trước, thành công, trùng và xung đột. Nút thao tác chính tối thiểu 44 px. Các viewport touch dùng CPU/GPU Windows, chưa thay kiểm tra điện thoại thật.

Mọi dữ liệu kiểm tra là fixture/context QA độc lập. Không đọc, xóa hoặc migrate hồ sơ trong trình duyệt người dùng. Không tự gửi tệp lên máy chủ. Backup này áp dụng ba game/schema hiện tại của React; không khôi phục nhánh HTML localStorage hay PIN/cài đặt ngoài hồ sơ. Khi thêm module/schema mới theo V3.8 phải mở rộng parser và fixture, giữ khả năng đọc bản v1.

Phép đo PR05 trước phần UI hồ sơ vẫn được giữ tại [V37_performance_qa](../V37_performance_qa/verification.md), với bundle riêng được ghi rõ. Full regression hiện tại kiểm lại cơ chế LOD/shadow/tài nguyên, không dùng số đo bundle cũ để tuyên bố đã benchmark lại build mới. [Đối chiếu phát hành](../V37_RELEASE_READINESS.md), [kế hoạch giao diện và game mới](../KE_HOACH_V38_GIAO_DIEN_VA_GAME_MOI.md).
