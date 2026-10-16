# Bảo An Learning V3.7 — Đối chiếu điều kiện phát hành

**Ngày đối chiếu:** 14/10/2026. **Nhãn hiện tại:** RC, chưa FINAL.

Đối chiếu với [Gate A/B/C của kế hoạch gốc](KE_HOACH_V37_PREMIUM.md#8-bộ-kiểm-thử-bắt-buộc-trước-gắn-nhãn-v37-final). Chủ dự án đã cho phép tiếp tục chủ động: hoàn thiện phần có thể thực hiện, ghi rõ phần chưa đo/duyệt và chuẩn bị V3.8. Không cần chờ xin phép từng bước; quyền tiếp tục không thay cho bằng chứng nghiệm thu điện thoại hoặc đánh giá mỹ thuật.

## Phạm vi bản đang kiểm tra

- **React/Vite:** ba đảo GLB có PBR, môi trường và cáo rig/Idle/Cheer/Victory; cảnh bài học dùng lại cùng canvas/context/renderer/tài nguyên. Ban đầu các đảo ngang hàng, cáo chờ góc trái; chọn đảo quay ra trước và cáo nhảy vào đảo.
- **Game:** Math 8 câu, Memory 6 cặp, Sentence 6 câu mẫu; UI đồng bộ, DOM vẫn thao tác được khi renderer lỗi. Luật game, SDK và các hàm storage cũ được bảo vệ bằng [19 phép đối chiếu nguồn](V37_games_qa/game-logic-audit.json). Storage chỉ thêm export kết nối cho module backup riêng; không đổi schema hoặc đường lưu cũ.
- **PR05 hiệu năng:** LOD tùy chọn, cache bóng, pause/on-demand, chuẩn bị shader và Brotli/gzip đã được kiểm tra trên checkpoint PR05. [Phép đo và đúng bundle](V37_performance_qa/verification.md) có normal/stress riêng, không thay benchmark điện thoại. Sau đó đã thêm UI hồ sơ lazy; [build cuối và full regression 69/69](V37_backup_qa/verification.md) kiểm lại chức năng và vòng đời. Không coi số đo checkpoint PR05 là benchmark đã chạy lại build có backup.
- **Hồ sơ học tập:** Góc phụ huynh có tải bản sao, xem trước và restore chỉ thêm qua một giao dịch ba store; trùng giống bỏ qua, xung đột từ chối, lỗi giữa chừng rollback. [Bằng chứng round-trip và rollback](V37_backup_qa/verification.md).
- **HTML offline:** nhánh V3.6.2 độc lập dùng localStorage; không được nâng thành Three/PBR/rig premium của React. Kết quả riêng tại [offline-evidence.json](V37_qa/offline-evidence.json).

## Gate A — Mã nguồn và asset

| Điều kiện gốc | Trạng thái thực tế / bằng chứng |
|---|---|
| Đúng source tree/lockfile; typecheck, core/content, guide, build và browser regression | **PASS trên build cuối có backup.** [Build/typecheck, core 44, content 4, guide 13, renderer 85, backup 17, Edge 69](V37_backup_qa/verification.md). Checkpoint PR05 có Edge 58/58 và Chrome 4/4 riêng; các log cũ giữ đúng lịch sử. |
| Đủ năm GLB, nguồn/giấy phép, texture PBR và animation thực | **Đã triển khai và kiểm tra Windows.** [Provenance/hash/thông số](ASSET_LICENSES_V37.md), [file gate](V37_art_qa/gate-premium-art.txt), [model runtime/PNG decode](V37_art_qa/model-runtime-tests.txt), [browser GLB/material](V37_art_qa/browser-tests.txt). File gate PASS chỉ xác nhận mức kỹ thuật, không xác nhận đẹp đạt concept. |
| Chạy Idle/Cheer/Victory trong runtime; render có chiều sâu | [Game scene/hoạt ảnh](V37_art_qa/browser-tests.txt), [ảnh/video PR03 và giới hạn](V37_art_qa/verification.md); không dùng concept làm ảnh phẳng thay model. |
| Premium lỗi vẫn chơi Math/Memory/Sentence, tài nguyên được dọn | Missing GLB, PNG decode, context loss và cleanup trong [suite PR03](V37_art_qa/browser-tests.txt), [fixture retest](V37_art_qa/catalog-cleanup-retest.txt). LOD tùy chọn lỗi giữ scene gốc ở [optional-lod-tests.txt](V37_performance_qa/optional-lod-tests.txt). |

PR03: renderer 67/67, core 44/44, content 4/4, guide 13/13, model runtime 12/12; Edge full suite 54 PASS và một lỗi fixture, fixture đã sửa/targeted retest 1/1, Chrome 4/4. Không ghi lượt full thành 55/55. [Báo cáo chi tiết PR03](V37_art_qa/verification.md) giữ nguyên lịch sử; PR05 phải được đọc từ log của chính build PR05.

**Kết luận A:** nền premium đủ asset; build, typecheck và regression cuối đạt trên Windows. Cảnh báo chunk Three >500 kB được giữ trong báo cáo, không sửa ngưỡng để giấu. File gate không thay duyệt mỹ thuật.

## Gate B — Gameplay và dữ liệu

| Điều kiện gốc | Trạng thái thực tế / bằng chứng |
|---|---|
| Math 8/8 và bộ JSON mới, chống đáp án/Next đôi | **Đã kiểm tra React production.** [Gameplay và import UI/build cuối](V37_backup_qa/browser-tests.txt). |
| Memory 6/6, chọn sai/spam hồi phục, ghi đúng lượt | **Đã kiểm tra.** Có lượt sai rồi sửa; số event được kiểm qua IndexedDB thật trong cùng suite. |
| Sentence đủ 6 câu React, chạm/drag và reject chỉ số sai | **Đã kiểm tra.** Không đổi seed thành 5 chỉ để khớp nhánh HTML; câu đồng nghĩa ngoài mẫu chưa được đánh giá. |
| `completed`/`abandoned`, event/session/pack/contentVersion đúng | **Đã kiểm tra** completed, thoát, refresh và đóng/mở tab trên localhost bằng profile QA riêng, không dùng fake localStorage. [Nguồn và phạm vi bảo toàn](V37_games_qa/verification.md). |
| Xuất/khôi phục dữ liệu theo giới hạn sản phẩm; lỗi lưu rõ | **Đã triển khai/kiểm tra hồ sơ React.** 17 unit, 11 production cases trong full69: hồ sơ ba game đủ 3 phiên/20 event, report bằng nhau; duplicate, conflict, tab race và atomic constraint/quota rollback. [Báo cáo/evidence](V37_backup_qa/verification.md). |
| HTML offline kiểm tra độc lập, công bố khác biệt | **Có bằng chứng nhánh cũ:** Math 8/8, Memory 6/6, Sentence 5/5 và history sau refresh trong [offline evidence](V37_qa/offline-evidence.json). File-URL/profile QA này không chứng minh premium parity hoặc durability mọi browser. |

**Kết luận B:** gameplay, persistence và backup/restore ba game React đã đạt kiểm tra production Windows trên origin thật với context QA riêng. Hồ sơ hiện tại của chủ dự án không bị mở/xóa/thay để tạo fixture. Không tự hứa resume giữa phiên hoặc khôi phục nhánh HTML bằng tệp React.

### Phân biệt bản sao nguồn và bản sao hồ sơ

- Baseline mã nguồn Git `645a6b6`, [ZIP trước V3.7](../backups/V362_RC2_before_V37.zip), [checksum gói nguồn/snapshot](V37_qa/baseline-checksums.json) giúp phục hồi mã nguồn.
- [baseline-isolated-data.json](V37_qa/baseline-isolated-data.json) là snapshot profile QA riêng, dữ liệu học ban đầu rỗng; **không phải backup hồ sơ của chủ dự án**. Chưa đọc/xóa/chuyển DB của profile đang dùng.
- Origin gồm hostname và cổng. `localhost`/`127.0.0.1`, cổng 5173/5178/5180 có IndexedDB riêng; dùng preview origin khác không có nghĩa dữ liệu origin cũ mất. Không reset storage để nâng mỹ thuật hay rollback renderer.

Mốc **V38-00B đã được thực hiện trong đợt V3.7 này**: schema riêng, snapshot nhất quán, validation liên kết pack/session/event, restore nguyên tử chỉ thêm, kiểm xung đột và rollback. [Đặc tả tiếp tục áp dụng](KE_HOACH_V38_GIAO_DIEN_VA_GAME_MOI.md#21-mốc-bảo-toàn-hồ-sơ-trước-khi-mở-thêm-module), [kết quả thực](V37_backup_qa/verification.md). Khi mở module/schema mới phải cập nhật parser backup và giữ đọc v1.

## Gate C — Mỹ thuật và sử dụng trên màn hình thật

| Điều kiện gốc | Trạng thái thực tế / bằng chứng |
|---|---|
| Ảnh browser thật có cáo/ba đảo, đối chiếu concept | **Có ảnh runtime và video**, đủ home/selected/game ở 1440/390/320: [visual review](V37_art_qa/visual-review.md), [capture summary](V37_art_qa/capture-summary.md). Đánh giá concept chính thức chưa ghi nhận. |
| Duyệt nhân vật/kiến trúc/PBR/chiều sâu/animation/nhất quán ≥4/5 | **Chưa nghiệm thu.** Chưa có điểm duyệt thực từ chủ dự án/người duyệt mỹ thuật; không tự chấm thay. |
| Start, pack select, Parent/Creator vẫn dùng, canvas không chặn | **Đã kiểm tra Windows** và emulation; [suite UI/carousel/game](V37_art_qa/browser-tests.txt). |
| Không tràn ngang/nhảy khung/che đáp án, chạm chính ≥44 px | **Đã kiểm tra viewport 320–1920, tablet/landscape**, ảnh và DOM bounds. Emulation dùng CPU/GPU desktop, chưa nghiệm thu cảm ứng điện thoại thật. |
| Reduced motion, chuyển scene chọn đảo vẫn hoạt động | **Đã triển khai và regression**, cùng scene dừng RAF khi tab ẩn/giảm motion. [Game verification](V37_games_qa/verification.md), [performance tests](V37_performance_qa/performance-tests.txt). |
| FPS/cảm ứng/bộ nhớ thật, tier thấp/fallback | **Windows desktop có phép đo; Android/iPhone chưa đo.** [PR05 raw performance](V37_performance_qa/performance.json), [summary](V37_performance_qa/performance-summary.md). Texture estimate không phải GPU/RAM peak; local cold-load sample không đại diện mạng chậm. |

Máy đã đo: Windows 10.0.26300, Core Ultra 5 125H, Intel Arc qua ANGLE/D3D11, Edge 155.0.4283.45. 390×844/320×640 touch emulation vẫn chạy trên máy này. Chưa có Android tầm trung/Chrome hoặc iPhone/Safari thật kết nối; chưa có nghiệm thu nhiệt, pin, memory peak hoặc mạng thiết bị mục tiêu. [Checklist điện thoại](V37_art_qa/phone-acceptance.md) có hướng dẫn và bảng kết quả còn trống.

**Kết luận C:** bố cục/tương tác và cơ chế giảm chất lượng có bằng chứng Windows; mỹ thuật chính thức và sử dụng trên điện thoại thật còn mở. Vì vậy Gate C chưa đạt nghiệm thu FINAL.

## Việc còn lại và cách tiếp tục

- [x] Chốt PR05 trên đúng bundle có normal/stress, long tasks và quality transition; giữ nguyên evidence. Sau UI backup đã chạy full Edge 69/69 trên build mới, ghi riêng bằng chứng; không gọi số đo trước là benchmark mới.
- [x] Thực hiện backup/restore hồ sơ mẫu theo V38-00B; chứng minh atomic rollback, conflict handling và kết quả báo cáo trên origin thật.
- [ ] Khi có Android/iPhone, chạy ba game trọn bài, quay/nhảy, orientation, tab nền, refresh và ghi FPS/frame/cảm ứng/nhiệt/pin/bộ nhớ thật. Giảm quality/LOD nếu phép đo không đạt.
- [ ] Ghi nhận đánh giá mỹ thuật thực và sửa điểm còn yếu; hình/animation trong runtime là đối tượng nghiệm thu, không dùng file gate hoặc ảnh đẹp thay đánh giá.
- [ ] Gắn FINAL chỉ khi A/B/C đều có bằng chứng đạt. Giữ RC và tiếp tục phần việc được giao trong thời gian các mục thiết bị/mỹ thuật còn mở.

[Kế hoạch V3.8](KE_HOACH_V38_GIAO_DIEN_VA_GAME_MOI.md) đã được chuẩn bị. Mốc bảo toàn hồ sơ đã có; tiếp theo hoàn thiện HUD/feedback/reward và UX ba game → catalog module/scene nhiều đảo → slice Nối từ dùng `PairsPack` v1 → schema/editor v2 → Quy luật, Trục số, Phân loại. Khung UI V3.8, các module mới, schema v2 và đảo Tư duy **chưa được triển khai**; hiện vẫn ba game.
