# Bảo An Learning V3.8 — Hoàn thiện giao diện game và thêm hoạt động học

**Ngày lập:** 14/10/2026. **Trạng thái:** kế hoạch triển khai; mốc bảo toàn hồ sơ V38-00B đã được thực hiện trong đợt hoàn thiện V3.7. Các game mới và khung UI V3.8 chưa được triển khai.

Chủ dự án đã yêu cầu tiếp tục chủ động, không chờ xin phép từng bước. Tiếp tục sửa và kiểm tra phần V3.7 còn thực hiện được trên máy hiện tại; tài liệu này chuẩn bị lộ trình V3.8 theo các lát cắt bên dưới. Việc chưa có điện thoại thật kết nối hoặc chưa có nhận xét mỹ thuật được ghi là hạng mục nghiệm thu còn mở; không tự đánh dấu FINAL, cũng không lấy đó làm lý do dừng các công việc lập trình đã được giao.

## 1. Nền hiện có và mục tiêu

V3.7 đã có ba đảo GLB, cáo chung, môi trường chung và ba màn chơi cùng hệ màu/ánh sáng. Chọn đảo dùng vòng quay và cáo nhảy; lúc mới mở cáo chờ bên góc ngoài đảo. Trang chủ và bài học dùng lại một canvas/context/renderer và tài nguyên đã tải. Bằng chứng hiện tại ở [báo cáo V3.7](V37_art_qa/verification.md); kết quả emulation không thay số đo Android/iPhone thật.

V3.8 cần biến bộ giao diện này thành nền dùng lại cho nhiều hoạt động: học sinh hiểu ngay phải làm gì, biết kết quả đã lưu hay chưa, đọc được phản hồi, thao tác chạm/bàn phím thuận tiện và trở về đúng đảo. Game mới lấy học liệu từ dữ liệu, được biên soạn và nhập/xuất qua Xưởng học liệu như ba game hiện tại.

| Nền thực tế | Ý nghĩa khi mở rộng |
|---|---|
| `src/core/contracts.ts`: SDK V1, ba `ModuleId`, `quiz`/`pairs`/`sentences` | Game mới cần đăng ký module và kiểm tra tương thích; không ép mọi luật chơi vào câu trắc nghiệm hoặc ghép câu. |
| `src/core/content-io.ts`: JSON `baoan-learning-content`, `formatVersion: 1`, tối đa 1 MB/40 bộ | Loại nội dung mới cần đường đọc phiên bản cũ, validator và định dạng xuất rõ ràng. |
| `src/core/storage.ts`: IndexedDB v1, `packs`/`sessions`/`events` | Giữ nguyên DB và dữ liệu học; thêm loại pack chưa đòi hỏi thêm object store. |
| `src/core/sdk.ts`: `attemptKey`, `makeLearningEvent`, chống ghi trùng | Một lần nộp hợp lệ ghi một event; lỗi lưu phải thử lại cùng khóa, không tăng điểm trước khi lưu. |
| `src/core/reports.ts`: độ chính xác theo tất cả lượt thử | Không đổi âm thầm thành điểm lần đầu hoặc điểm sao; báo cáo mới phải ghi rõ cách tính. |
| `src/core/registry.ts`, `src/games/loaders.ts` | Catalog và lazy component phải có cùng tập module. |
| `src/world3d/scenes/islandCarousel.ts`: tính theo số lượng | Toán vòng quay đã tổng quát; các bảng scene, asset, theme và engine vẫn cần bỏ giả định chỉ ba module. |

Nhóm nội dung đầu tiên hướng vào lớp 3, cùng mức với các bộ mẫu hiện tại. Bộ mẫu được ghi là minh họa cho đến khi được rà soát đáp án và mục tiêu kiến thức; không tự gắn nhãn đã được duyệt theo SGK.

## 2. Thứ tự triển khai và điểm kết thúc từng lát cắt

| Đợt | Công việc cụ thể | Sản phẩm có thể kiểm tra | Phụ thuộc |
|---|---|---|---|
| V38-00 | Đóng các lỗi V3.7 có thể tái hiện, ghi baseline UI/game/dữ liệu và số đo | Báo cáo với commit/build, ảnh trạng thái, số event và hạng mục điện thoại/mỹ thuật còn mở | Bản V3.7 đang chạy |
| V38-00B — đã thực hiện | Sao lưu/khôi phục hồ sơ học tập bằng giao dịch nguyên tử | Export/restore pack, session và event thật; preview xung đột, rollback khi lỗi; [bằng chứng](V37_backup_qa/verification.md) | Đã bổ sung trong V3.7 trước mở rộng module/schema |
| V38-01 | Khung màn chơi chung, HUD, tiến độ, feedback, lỗi lưu, completion và khả năng tiếp cận | Math là lát cắt đầu; đủ vào bài → trả lời → lưu → phần thưởng → quay về | V38-00 |
| V38-02 | Hoàn thiện thao tác đặc thù Memory/Sentence, gỡ CSS trùng trong phạm vi đã kiểm tra | Ba game dùng thành phần chung, vẫn giữ đúng luật/điểm trước sửa | V38-01 |
| V38-03 — đã thực hiện | Tách module trò chơi khỏi đảo/cảnh; catalog theo dữ liệu qua `sceneCatalog.ts` | Hoàn thành `TASK-ARCH-01`, giải phóng trói buộc 1:1, kiểm tra tương thích scene 3/4 đảo | V38-00B, V38-01 |
| V38-04 — đã thực hiện | Game Nối từ khám phá (`word-connect`): luật chơi 2 cột, học liệu PairsPack, TTS speech, companion reaction | Hoàn thành `TASK-GAME-01`, chơi trọn bộ lớp 1-5, đạt 164/164 tests regression | V38-02, V38-03 |
| V38-05 | Định dạng nội dung v2 cho thứ tự/trục số/phân loại; đọc v1, editor và fixture | Round-trip nội dung v1/v2, thông báo lỗi dễ hiểu, dữ liệu cũ giữ nguyên | V38-04 ổn định |
| V38-06 | Bậc thang quy luật, rồi Đường đua trục số, rồi Vườn phân loại | Mỗi game có một bộ hoàn chỉnh và báo cáo riêng trước khi thêm game kế | V38-05 |
| V38-07 | Thêm đảo Tư duy khi có hoạt động phù hợp; nghiệm thu cả catalog | Một cảnh mới cùng mỹ thuật và ngân sách; kiểm tra quay/nhảy và tất cả game | Ít nhất game quy luật hoặc phân loại đã ổn định |

Không ước lượng ngày hoàn tất trước khi lát cắt đầu được đo. Mỗi đợt là checkpoint nhỏ; phát hiện lỗi dữ liệu phải xử lý trước khi mở rộng gameplay tiếp theo. Có thể chuẩn bị nội dung và concept đảo song song với lập trình nhưng chỉ đưa vào catalog sau khi chơi được.

### 2.1. Mốc bảo toàn hồ sơ trước khi mở thêm module

Gate B trong kế hoạch V3.7 yêu cầu backup/khôi phục dữ liệu mẫu. Khi đối chiếu ban đầu React chỉ xuất học liệu; đợt hoàn thiện này đã bổ sung **Sao lưu hồ sơ học tập ở Góc phụ huynh** bằng các module riêng `backup-io.ts` và `backup-storage.ts`. Đã đạt 17 unit và 11 targeted production cases: hồ sơ ba game khôi phục đủ, report bằng nhau, conflict/rollback giữ dữ liệu. [Bằng chứng và full regression cuối](V37_backup_qa/verification.md). Các yêu cầu dưới đây tiếp tục áp dụng khi mở module/schema mới; không thay cho kiểm tra lại parser backup.

- Tệp riêng `baoan-learning-backup`, `formatVersion: 1`, có metadata app/schema/export thời điểm, packs và sessions/events. Không dùng `parseContentImport()` để nhận hồ sơ; tệp học liệu vẫn không chứa kết quả. Snapshot đọc ba store trong cùng readonly transaction để không lấy pack/session/event ở ba thời điểm khác nhau; chụp đủ pack `id@version` được lịch sử tham chiếu, kể cả builtin cần thiết.
- Tạo `src/core/backup-io.ts` với parser/export/validator riêng, giới hạn byte/số bản ghi trước ghi và chặn dữ liệu không tin cậy. Kiểm tra pack qua validator nội dung; session có id/module/version/trạng thái/timestamp hợp lệ; event có id, session/pack/content/module version khớp, item/objective tồn tại, đúng/sai/hints/elapsed hợp lệ và id không trùng mâu thuẫn. Không import code, HTML hoặc nhầm tệp HTML/localStorage sang hồ sơ React.
- Thêm vùng Sao lưu hồ sơ ở `ParentScreen.tsx` cùng callback host; dữ liệu lưu cục bộ được tải về chỉ khi người dùng chọn xuất. Restore có bản xem trước số bộ/phiên/lượt thử sẽ thêm, trùng giống và xung đột. Mặc định chỉ thêm: bản ghi trùng hoàn toàn bỏ qua; cùng `id@version`, `sessionId` hoặc `eventId` nhưng khác nội dung thì từ chối cả restore, không ghi đè. Không đổi id để né xung đột hoặc trộn điểm giữa hai phiên.
- Sau parse/preview, revalidate sự trùng trong **một readwrite transaction trên cả ba store** ở `backup-storage.ts`, dùng kết nối gốc được `storage.ts` export; ghi bổ sung hoặc abort toàn bộ nếu một mục/constraint/transaction thất bại. Không xóa DB, không tăng DB version nếu vẫn ba store. Chỉ cập nhật React sau transaction commit. Trước restore hỗ trợ tạo bản sao hiện trạng; chế độ chỉ thêm không có thao tác thay toàn bộ hay quay DB về một thời điểm cũ.
- Chỉ thao tác khi không có game đang chạy. Phiên `active` trong backup không được hứa là resume; định rõ xử lý trên preview theo chính sách abandoned hiện tại trước khi ghi. Không tự import PIN, dữ liệu cá nhân khác hoặc cài đặt ngoài phạm vi phiên/học liệu đã công bố.
- Kiểm thử round-trip vào DB thử trên cùng origin; so sánh pack/version, mọi session/event và báo cáo trước/sau. Thử file sai schema, thiếu pack/session, event giả/mâu thuẫn, bản trùng giống, nhiều tab thêm dữ liệu sau preview, quota/constraint failure và lỗi giữa giao dịch. **Khi abort, counts và bytes nội dung của cả ba store phải giữ nguyên**; có test thực bằng IndexedDB/browser, không chỉ mock parser.
- Kiểm tra trên đúng hostname/cổng của hồ sơ mẫu và trên profile QA riêng; không reset dữ liệu chủ dự án để tạo fixture. Xuất học liệu sang origin khác chưa phải khôi phục hồ sơ. File sao lưu có thông tin học tập nên UI nói rõ phạm vi và người dùng giữ bản cục bộ; không tự gửi lên server.

Mốc đã đạt trên Windows production khi backup từ hồ sơ mẫu có ba game khôi phục được đầy đủ, report bằng trước xuất, conflict/transaction rollback được chứng minh và UI hiện thông báo thành công sau commit. V38-01/02 là lát cắt tiếp theo. Khi bổ sung module hoặc schema mới, phải mở rộng parser/fixture backup và kiểm lại các điều kiện này.

## 3. Hoàn thiện khung chơi chung

Các tệp mới dự kiến: `src/games/ui/GameShell.tsx`, `GameHud.tsx`, `GameProgress.tsx`, `GameFeedback.tsx` và `GameActions.tsx`. Dùng token hiện có trong `src/styles/premium-games37.css`; nếu tách token ra tệp riêng thì thay các chỗ dùng đã kiểm chứng, tránh thêm một lớp override nữa.

- **Header/HUD:** tên bài và tên đảo, tiến độ có nhãn bằng chữ, một số kết quả có ý nghĩa theo game, nút Thoát dễ chạm. Không đặt timer gây áp lực trong chế độ học mặc định.
- **Vùng học:** nền kem và chữ đủ tương phản, cảnh 3D hỗ trợ nhận diện đảo; câu hỏi/thẻ/từ nằm trên DOM. Desktop có vùng cáo bên góc; mobile thu gọn vùng cáo để ưu tiên thao tác.
- **Feedback:** giữ chỗ ổn định; trạng thái chờ, đang lưu, đúng, cần thử tiếp và lỗi lưu phân biệt bằng chữ/ký hiệu cùng màu. Mở lời giải dài bằng vùng cuộn hoặc mở rộng do học sinh chọn; không đẩy đáp án ra khỏi màn khi phản hồi xuất hiện.
- **Hành động:** chỉ một hành động chính ở từng trạng thái; khóa thao tác khi đang ghi kết quả, giữ các lựa chọn phù hợp với luật từng game. Nút thử lưu lại chỉ phục hồi việc ghi đã thất bại, không tạo một đáp án mới.
- **Hoàn thành:** chỉ hiện sau `onComplete()` thành công. Tóm tắt đúng mẫu số, nhãn kết quả và gợi ý luyện tiếp; trả về đúng đảo, trả focus về nút mở bài. Nút Chơi lại nếu thêm phải gọi host mở phiên mới sau khi đóng phiên cũ, không sửa phiên đã hoàn thành.
- **Khả năng tiếp cận:** focus hiển thị rõ, tab theo thứ tự đọc, bẫy focus trong dialog và thoát/quay về hợp lý; vùng báo kết quả `aria-live` không đọc lặp mỗi khung hình. Không dùng màu là dấu hiệu duy nhất, không bắt buộc kéo thả, có chế độ giảm chuyển động và âm thanh tắt mặc định.

Thành phần chung nhận props trình bày và callback hành động của game. Chúng không import storage, tự chấm đáp án, tự tạo `attemptKey` hay tự tăng điểm. `GameMascot`, `FeedbackEffects` và `GameCompletion` tiếp tục dùng cảnh và tài nguyên chung.

### Quy ước kết quả phải giữ nguyên khi chỉ sửa giao diện

| Game | Hành vi hiện có cần bảo vệ | Điều được cải thiện trong V38-01/02 |
|---|---|---|
| Math Quest | Mỗi câu nộp một lần, ghi event theo `question.id`; đúng/sai rồi mới qua câu. HUD đếm câu đúng lần đầu; gợi ý tối đa một lần theo luật hiện tại. | Gọi số HUD là “câu đúng” cho rõ; phân biệt đáp án đã chọn và đáp án đúng, lời giải dễ đọc, trạng thái đang lưu dễ thấy. Không thêm quyền thử lại tính điểm trong đợt UI. |
| Memory Match | Một cặp chọn ghi một event `move-N`; cặp sai mở khoảng 700 ms rồi úp, ghép đúng tăng số cặp sau lưu. | Thẻ dài không tràn; đánh dấu thẻ đang chọn/đã ghép bằng ký hiệu; trạng thái lưu và úp lại rõ ràng. Giữ bố cục chạm và bàn phím, không thêm gợi ý mất sao trong đợt UI. |
| Sentence Builder | Nộp theo `item.id:try:N`; đúng lần đầu chỉ tính khi không dùng gợi ý. Từ được quản lý theo chỉ số, cho phép từ lặp; chỉ một câu mẫu. | Hiển thị ô trống và số từ còn thiếu; chạm để đặt/bỏ, có nút điều chỉnh thứ tự bằng bàn phím nếu cần; xếp lại rõ tác dụng. Không tự chấp nhận câu đồng nghĩa hoặc biến thể mới. |

Sao ngoài trang đảo hiện được suy ra từ số phiên hoàn thành ×3; ba ngôi sao trên lớp thưởng là trang trí. Đợt UI phải làm nhãn này rõ ràng, không nhập nhằng với số câu đúng trong bài. Nếu đổi sang thưởng theo thành tích, lập đặc tả tính thưởng và kiểm thử riêng; không tính lại dữ liệu lịch sử theo quy tắc mới.

## 4. Catalog nhiều hoạt động và nhiều đảo

Hiện `App.tsx` đưa trực tiếp `moduleId` vào `gameWorld`, `WorldId` trong `engine.ts` là ba tên module. Cần tách khái niệm trước khi thêm module thứ tư:

1. Tạo danh mục scene ở `src/world3d/scenes/sceneCatalog.ts`: `sceneId`, tên đảo, biểu tượng, màu nhấn, model, điểm cáo hạ xuống, bounds, palette vật liệu và cấu hình camera/cảnh bài học.
2. Manifest game có `sceneId`. `ModuleId` vẫn xác định component/phiên/báo cáo; `SceneId` xác định đảo. App tra scene của manifest thay vì cast module sang `WorldId`. Ba module cũ giữ id và được ánh xạ về đúng ba đảo hiện tại.
3. `StudentScreen` nhóm các hoạt động theo scene: chọn đảo rồi chọn hoạt động và bộ học liệu; một đảo có thể có nhiều game. Các nút DOM luôn dùng được khi renderer lỗi. Dòng “Ba miền…” và CSS ba cột phải theo catalog thực tế.
4. Renderer/catalog loader, `worldLayout`, `gameEnvironments`, chọn qua raycast và fallback đọc cùng scene catalog; loại bỏ mảng/index gắn cứng ba đảo trong `PremiumWorldRenderer.ts` và giả định ba vị trí trong engine dự phòng. Có kiểm tra thiếu config/material/model trước khi hiện lựa chọn.
5. Giữ ba đảo đầu ngang hàng và cáo chờ bên góc; chọn đảo quay theo cung ngắn, đảo đó nổi ra trước, cáo nhảy đúng vùng trống. Với 4/6 đảo, đo khoảng hở, camera fit, chọn nhanh giữa chuyển động và nút tổng quan ở cả mobile/desktop. Khi nhiều đảo hơn khả năng đọc trên hàng đầu, thêm điều hướng danh mục/nhóm đảo bằng DOM; không thu mọi đảo và nút xuống quá nhỏ.

Game Nối từ và Trục số dùng lại đảo Ngôn từ/Toán. Game quy luật và phân loại ban đầu có thể dùng cảnh Rừng được cấu hình phù hợp; sau đó bổ sung **Đảo Tư duy** khi gameplay đã rõ. Không sản xuất thêm một GLB lớn cho mỗi biến thể câu hỏi. Model đảo mới là tài nguyên tùy chọn tải khi scene đó cần; model cáo và môi trường dùng chung vẫn một bản. Lỗi model đảo tùy chọn không làm ba đảo cũ cùng mất chế độ premium.

## 5. Bốn game mới ưu tiên

| Ưu tiên / module dự kiến | Luật và mục tiêu | Học liệu / thay đổi bắt buộc | Scene và bộ đầu |
|---|---|---|---|
| 1 — `word-connect`, **Nối từ khám phá** | Hai cột thẻ đang mở; chạm một từ rồi chạm nghĩa tương ứng, tạo kết nối. Sai thì bỏ nối để thử tiếp; đúng khóa cặp. Khác Memory ở việc đọc/đối chiếu trực tiếp, không lật thẻ. | Dùng `PairsPack` hiện có, không đổi JSON v1 hay SDK event. Mở rộng `ModuleId`, registry/loader và tương thích; manifest có giới hạn môn nếu chỉ nhận English. | Xưởng Ngôn từ; một bộ 6 cặp gia đình lớp 3 lấy theo nội dung dữ liệu, sau đó thêm đồ dùng học tập. |
| 2 — `sequence-trail`, **Bậc thang quy luật** | Đặt 3–8 thẻ theo thứ tự để hoàn tất dãy số hoặc quy trình đơn giản; bấm Kiểm tra mới tính lượt. | `SequencePack`/`SequenceItem` v2, token có id ổn định và một `correctOrder`; không dùng `SentenceItem.words` cho số/bước có nhiều từ. | Rừng/Đảo Tư duy; 6 mục tăng/giảm và quy luật cộng đơn giản lớp 3. |
| 3 — `number-line`, **Đường đua trục số** | Đặt dấu tại số đích trên trục; câu có thể yêu cầu xác định kết quả phép tính. Chạm, nút ± và bàn phím đều thao tác được. | `NumberLinePack` v2: `prompt`, `min`, `max`, `step`, `target`, `explanation`; số hữu hạn, đích trong miền và trùng bước. Mỗi trục đầu tiên tối đa 21 vạch hiển thị. | Đảo Toán; 8 câu nhận biết vị trí, cộng/trừ theo đơn vị/chục. Miền số được khai báo trong dữ liệu. |
| 4 — `category-sort`, **Vườn phân loại** | Đưa 2–10 thẻ vào 2–4 nhóm; chạm thẻ rồi chạm nhóm hoặc dùng điều khiển bàn phím. Kiểm tra toàn bảng tạo một lượt thử. | `CategoryPack` v2: category/token id duy nhất, một `correctCategoryId` cho mỗi token, hướng dẫn/hint/giải thích. Không tự phân loại từ mơ hồ bằng thuật toán đoán. | Rừng/Đảo Tư duy; 6 bảng số chẵn/lẻ hoặc nhóm từ rõ nghĩa, rà soát theo từng objective. |

Các id trên là đề xuất để triển khai, chưa phải module đã đăng ký. Nội dung đến từ pack; component không giữ đáp án hay câu hỏi cố định. Bộ đầu phải dùng mục tiêu riêng như `ENG3.FAMILY`, `MATH3.SEQUENCE`, `MATH3.NUMBER_LINE`; không dồn mọi kiến thức mới vào `MATH3.NUMBER`.

Hình minh họa từ vựng và đọc âm là đợt sau. Hiện các pair chỉ có chữ, `experience.ts` phát âm báo hiệu tổng hợp, chưa có kho audio đọc từ. Trước khi thêm phải có catalog media tự chứa, nguồn/giấy phép, transcript/alt, xử lý tải lỗi và điều khiển âm thanh; không lấy âm báo thành tính năng luyện nghe hoặc phụ thuộc giọng TTS ngẫu nhiên để chấm phát âm. Slice đầu dùng chữ để hoàn thành gameplay và lưu kết quả trước.

## 6. Lát cắt đầu: Nối từ khám phá

Phạm vi đủ nhỏ: một game React mới, một bộ 6 cặp lớp 3, dùng scene Ngôn từ và khung chung. Không thêm model, tài khoản, đồng bộ cloud hay luật sao mới trong slice này.

Luồng: chọn Xưởng Ngôn từ → chọn Nối từ → chọn bộ → host tạo phiên → chọn cặp sai/đúng → khóa đúng sau ghi thành công → ghép hết → `onComplete()` → phần thưởng → về đảo → refresh và kiểm tra báo cáo.

- Thêm `src/games/WordConnect.tsx`; đăng ký trong `src/core/contracts.ts`, `registry.ts`, `validation.ts`, `src/games/loaders.ts`. Nếu thêm lọc môn, `compatible()` và `assertModuleContract()` cùng kiểm tra capability manifest; có test cho pack đúng loại nhưng sai môn.
- `attemptKey: connect-N` tăng theo lần nộp hai thẻ; `itemId`/`objectiveId` lấy từ cặp bên trái được chọn. Sai không khóa vĩnh viễn, đúng chỉ đánh dấu sau `onAttempt` resolve. Khi ghi lỗi giữ cùng khóa/đáp án để thử lưu lại; không ghi click chọn thẻ thành event.
- Các thẻ là button; trên 320 px có hai cột dễ chạm hoặc bố cục xen kẽ giữ rõ hai phía, mỗi mục tối thiểu 44 px. Đường nối SVG là trang trí, không chặn pointer; trạng thái nối được đọc bằng chữ. Không yêu cầu kéo ngón tay chính xác.
- Dùng `GameSceneContext` cho phản ứng cáo, không gọi renderer mới. Không tự nhập storage vào game. Hoàn thành và thoát đi qua host.

**Xong slice khi:** chơi trọn 6 cặp trên build production; có ít nhất một cặp sai rồi sửa; spam click không ghi trùng; lỗi ghi có thể thử lại; completed chỉ xuất hiện sau lưu; history vẫn đúng sau refresh. Ghi được hai event nếu một lần sai rồi một lần đúng cho cùng mục — đó là hai lượt thử thật, không phải lỗi dedup. Các phép đo và ảnh cho game mới được lưu riêng, cả ba game cũ vẫn qua regression.

## 7. Nội dung v2, editor và bảo toàn dữ liệu

Nối từ sử dụng định dạng v1. Trước ba game còn lại, bổ sung phiên bản v2 cho cấu trúc mới, tách khỏi `pack.version` (phiên bản nội dung) và `moduleVersion` (phiên bản game).

1. Mở rộng `ContentPack` thành union có kind mới và thêm validator theo kind ở `validation.ts`. Common fields, giới hạn 2–30 mục/bộ, id/grade/subject và chống trùng giữ như hiện có. Token dùng id ổn định nên cùng chữ có thể xuất hiện nhiều lần mà vẫn phân biệt.
2. `content-io.ts` đọc cả envelope v1 và v2 bằng nhánh parser rõ ràng; v1 giữ đúng ý nghĩa cũ. Không ép sequence vào sentence hay tự đoán schema. Xuất v1 khi chỉ chứa loại cũ nếu chọn tương thích; xuất v2 khi có loại mới, thông báo bản ứng dụng cũ không đọc được tệp này. Round-trip không mất objective, đáp án, thứ tự hay miền số.
3. Validator v2 kiểm tra permutation của `correctOrder`; tất cả đích category tồn tại; số trục hữu hạn và `(target-min)/step` hợp lệ với quy tắc sai số đã đặc tả. Khống chế số token/ký tự/vạch; từ chối HTML/media URL ngoài catalog, index sai, đáp án thiếu hoặc mơ hồ. Parse dữ liệu không tin cậy phải kiểm tra type trước truy cập thuộc tính.
4. `CreatorScreen.tsx` thêm editor theo loại: kéo hoặc nút lên/xuống để chọn thứ tự; trường miền/bước/đích cho trục số; nhóm và đáp án nhóm cho phân loại. Có preview, lỗi chỉ đúng mục/trường và xác nhận bộ đủ dữ liệu trước xuất bản. Nội dung mới đã xuất bản không bị ghi đè; sửa tạo `id@version` mới.
5. Giữ IndexedDB tên `bao-an-learning-v3-alpha`, version 1 và ba store nếu không thêm cấu trúc lưu. Không xóa store/DB/localStorage để nâng game; nội dung cũ đọc nguyên dạng. Nếu về sau cần store mới hoặc resume, lập migration riêng có backup và bài kiểm tra khôi phục trước khi chạy.
6. Callback `GameHostProps`, event tối thiểu và SDK V1 có thể giữ khi cơ chế nộp không đổi. Chỉ tăng SDK version khi thật sự thay contract giao tiếp; không tăng chỉ vì thêm kind nội dung. Update test compatibility để tránh module quảng cáo hỗ trợ pack mà game không xử lý được.
7. `LearningEvent` tiếp tục mang module, pack, content/module version, objective, correct, hintsUsed và elapsedMs. New games nộp một event cho một mục/bảng hoàn chỉnh. Kéo thẻ/chỉnh trục không tự cộng event. Nếu muốn phân tích chi tiết bước đi, bổ sung payload có version hoặc telemetry riêng, không lén thay ý nghĩa event cũ.

V1 báo cáo là độ chính xác của tất cả lượt thử. Có thể thêm tab theo game/mục tiêu và chỉ số đúng lần đầu bằng reducer có test, nhưng phải giữ chỉ số tổng hiện có và ghi rõ định nghĩa. `subject`/`grade` nằm trên pack; filter báo cáo cần lookup `packId@contentVersion`, xử lý pack cũ không còn trong catalog mà không làm mất lịch sử.

Nhánh HTML độc lập không tự có game mới khi React được nâng cấp. Ghi rõ phạm vi từng bản; nếu cần parity thì có backlog/build/test riêng. Giữ hostname/cổng khi kiểm tra hồ sơ cũ vì đổi origin tạo bộ IndexedDB khác, không phải migration.

## 8. Mỹ thuật và ngân sách hiệu năng

Giữ phong cách đã có: nền kem, teal, cây/mặt đá PBR, cáo chung bên góc; mỗi đảo có biểu tượng và màu nhấn riêng. Bảng thẻ/từ/trục số cần nhiều khoảng trống hơn cảnh nền. Tránh thêm vật trang trí vào vùng thao tác hoặc dùng hiệu ứng che phản hồi.

| Ngân sách cho đợt mới | Cách đo / điều kiện |
|---|---|
| 1 canvas/context/renderer, 1 render RAF đang hoạt động | Home → bất kỳ game → home; 20 vòng không tăng canvas/listener/RAF. Tab ẩn và giảm chuyển động có kết quả riêng. |
| Tối đa 2 GLB tải/giải mã đồng thời; không tải lại khi đổi câu | Network từ production, cache/ownership trong cùng vòng đời renderer; scene mới tải một lần khi cần. |
| Game Nối từ không tăng byte model/texture | Tái dùng đủ tài nguyên hiện có; entry chỉ tăng manifest/UI tối thiểu, component game lazy load. |
| Model đảo Tư duy dự kiến ≤2 MiB, ≤35.000 tam giác, texture mỗi cạnh ≤1.024 px | Kiểm tra cấu trúc, PNG decode, provenance và PBR; có phiên bản giản lược nếu đo thiết bị vượt ngân sách. Chỉ một GLB mới trước khi đánh giá lại tổng catalog. |
| Texture estimate catalog đang khoảng 27,25 MiB; tăng thêm mục tiêu ≤8 MiB cho scene mới đang hiện | Báo cáo có mipmaps và số scene resident; không gọi estimate là GPU memory peak. Tài nguyên scene tùy chọn có dispose theo ownership. |
| Desktop máy baseline: FPS median ≥55, P95 frame ≤25 ms sau warm-up; không giảm quá 10% cùng quality | Đo tối thiểu 60 giây riêng từng cảnh và game, cùng máy/build/viewport. Không chạy nhiều trình duyệt GPU cùng lúc để lấy số. |
| Điện thoại thật mục tiêu: median ≥30 FPS, P95 frame ≤50 ms ở low; tương tác vẫn lưu và dùng được | Ghi thiết bị/OS/browser/pin/nhiệt. Không đạt thì giảm shadow/DPR/detail/LOD rồi đo lại; nếu không có thiết bị ghi “chưa đo”. |
| Phản hồi thị giác sau chạm ≤100 ms ở P95 khi chưa tính I/O; đang lưu hiện ngay | Đo production, tách thời gian xử lý DOM và IndexedDB; không hiện “đúng/đã lưu” trước giao dịch thành công. |

Các ngưỡng này là mục tiêu V3.8, chưa phải số đo đã đạt. Theo dõi bundle delta, cold load và long tasks cùng điều kiện; Three lazy chunk hiện vượt cảnh báo 500 kB nên không tăng ngưỡng để giấu vấn đề. Asset mới có generator/source, hash, tác giả/giấy phép và bản chụp runtime; chỉ nguồn đã rõ mới đưa vào phát hành.

## 9. Bộ nghiệm thu cho từng game/đợt

- **UI:** 320×640, 390×844, tablet, 1440×900 và landscape; không tràn ngang, cắt câu/thẻ, che nút hoặc nhảy khung do feedback. Nút/thẻ thao tác chính ≥44×44 px; kiểm tra bàn phím, focus dialog, zoom chữ 200%, reduced motion và bật/tắt âm.
- **Gameplay:** chờ, sai, đúng, gợi ý nếu có, đang lưu, lỗi lưu/thử lại, hoàn thành và thoát giữa bài. Với thao tác nhanh/lặp không bỏ qua mục, không tăng điểm hoặc tạo event hai lần cho cùng logical submission.
- **Dữ liệu:** fixture hồ sơ v1 trước nâng vẫn đọc được; phiên/event/pack đã xuất bản không bị sửa; bộ v1/v2 nhập/xuất đúng. Backup/restore hồ sơ dùng schema riêng, snapshot đủ và ghi ba store nguyên tử; conflict/rollback không làm đổi hồ sơ trước restore. Refresh/đóng mở tab giữ kết quả; phiên dở vẫn theo chính sách abandoned hiện tại, chưa tự hứa resume.
- **Scene:** cùng canvas/context và model qua bài; chọn/thoát phục hồi đúng đảo; cáo không vào đảo khi chưa chọn. Lỗi asset/texture/WebGL vẫn có đường làm bài bằng DOM; kiểm tra cấu hình thêm đảo, load tùy chọn và cleanup.
- **Chấm học:** unit test semantic cho sequence, target range, category, từ lặp và trường hợp đáp án mơ hồ; test báo cáo đúng mẫu số sau sai rồi sửa. Đáp án bộ mẫu được người có trách nhiệm nội dung rà soát, trạng thái duyệt ghi riêng với test code.
- **Build/regression:** `npm run build`, `test:core`, `test:content`, `test:renderer`, `test:guide-animation`; mở rộng Playwright production và content import fixtures cho module mới. Việc sửa UI có audit hoặc test event trước/sau, không dựa vào snapshot CSS để chứng minh điểm không đổi.
- **Bằng chứng:** lưu dưới `docs/V38_qa/<dot>/` gồm commit/build, log lệnh, browser/thiết bị, ảnh các trạng thái, video ngắn, thống kê network/frame/texture và lỗi còn mở. Phân biệt full suite với targeted retest sau sửa; chỉ ghi PASS cho lượt đã chạy thật.

Điện thoại và mỹ thuật dùng [checklist V3.7](V37_art_qa/phone-acceptance.md) mở rộng thêm game mới. Tiếp tục lập trình và kiểm tra trên môi trường có sẵn; khi có thiết bị/nhận xét thì xử lý trong đợt nghiệm thu. Chỉ ghi FINAL sau khi các điều kiện phát hành thực sự được xác nhận.

## 10. Công việc tiếp theo có thể bắt đầu ngay

1. Ghi baseline từ bản V3.7 có backup/restore đã kiểm tra; tách khung/HUD/feedback Math theo V38-01, rồi đưa Memory/Sentence qua cùng khung sau khi Math đã đạt regression.
2. Sau khi mốc bảo toàn hồ sơ đạt, tách scene catalog và mapping module → scene theo V38-03 để hoạt động mới không phát sinh đảo/model/renderer trùng.
3. Triển khai lát cắt Nối từ 6 cặp theo mục 6, kiểm tra đủ nhập học liệu, lưu lỗi/thử lại, hoàn thành và báo cáo; chưa bắt đầu đồng thời ba luật chơi mới.
4. Sau slice đó, hoàn thành parser/validator/editor v2 rồi làm lần lượt Quy luật → Trục số → Phân loại; thêm đảo Tư duy sau khi có gameplay đạt.

Tài liệu này là backlog cho bước kế tiếp. Các dấu hoàn thành và số kiểm tra chỉ cập nhật bằng kết quả implementation/QA thực tế; việc lập kế hoạch không có nghĩa các module hoặc schema v2 đã được thêm vào ứng dụng.
