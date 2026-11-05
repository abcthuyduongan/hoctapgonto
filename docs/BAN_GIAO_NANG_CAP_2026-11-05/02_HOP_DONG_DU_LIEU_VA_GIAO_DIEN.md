# Hợp đồng dữ liệu, map và giao diện

Ngày: **05/11/2026**. Tên API/kiểu mới dưới đây là **đề xuất cần triển khai**, không phải những thành phần đã tồn tại.

## 1. Nguồn sự thật hiện có

| Thành phần | Tệp | Cách dùng |
| --- | --- | --- |
| Identity, summary, packGames, chơi/thoát/chuyển tuần | src/core/online-client.ts | Giữ giao thức request/session/CSRF hiện có |
| Student summary và phân trang theo bộ | src/core/online-contracts.ts | Không coi một trang 20 bộ là toàn bộ 35 tuần |
| Summary rows và trang | server/student-summary.mjs | Tái dùng projection/tiến độ nếu phù hợp |
| Luật hành trình và khóa | server/question-journey.mjs | Cùng nguồn với giao diện tuần hiện tại |
| SQLite/PostgreSQL | server/online-store.mjs, server/postgres-store.mjs | Tương đương nghiệp vụ |
| State/guards/receipts | src/screens/OnlineStudentWorld.tsx | Giữ chống request cũ, chống nhấp lặp, focus |
| Bộ trò | src/games/loaders.ts, src/core/registry.ts | Chỉ chọn game tương thích |
| Ảnh build | tools/onlineBuild.mjs, vite.config.ts | Plugin phát hành toàn public; copyPublicDir:false không loại PNG gốc nếu đã đặt trong public |
| Cổng size | tests/release-online-assets.mjs | Tổng artifact ≤ 5 MiB; không có 3D/private data |
| Build ID | tools/buildIdentity.mjs, server/build-identity.mjs | Gồm working-tree runtime inputs, không chỉ commit |

Nhật ký có từ “2D” và trường displayMode hiện dùng giá trị 2d trong build contract. Không đổi tên trường này riêng lẻ: nó là hợp đồng tương thích hiện có, không yêu cầu dựng nhân vật/cảnh đồ họa.

## 2. Nhận diện vùng

RegionId cố định: **math, vietnamese, english, computing, discovery**.

Chuẩn hóa nhãn để so alias: Unicode NFD, bỏ dấu, thay đ → d, lowercase, gom khoảng trắng, trim. Giữ nguyên subjectLabel gốc để hiển thị.

Alias mặc định đề xuất:
- math: toan, toan hoc, math, mathematics, toan bang tieng anh, toan tieng anh.
- vietnamese: tieng viet, vietnamese.
- english: tieng anh, english.
- computing: tin hoc, computer science, informatics.
- discovery: mọi nhãn còn lại.

So alias rõ ràng, không fuzzy-match từ rời. Nhãn chứa cả Toán và tiếng Anh nhưng không đúng alias không được tùy tiện chuyển vào English. Có thể bổ sung alias cấu hình khi đối chiếu dữ liệu người dùng, kèm test cho nhãn mới.

Tham chiếu subjectId ổn định nếu dữ liệu thực có; không tự coi label chuẩn hóa là khóa thay packId hoặc weekId.

## 3. Nhóm tuần và vị trí

Dùng **vị trí tuần trong cả lớp**, không đánh lại số sau lọc môn.

- chapter = floor((position - 1) / 7) + 1.
- slot = ((position - 1) mod 7) + 1.
- maxPosition là vị trí lớn nhất của các tuần thực được giao; totalChapters = ceil(maxPosition / 7), hoặc 0 khi chưa có tuần. totalWeeks vẫn là số tuần thực, không phải maxPosition; cách này giữ được dữ liệu cũ có khoảng trống vị trí.
- Region không có môn ở một tuần: không có node tại slot đó; các tuần sau giữ slot/chapter.
- Vị trí và thứ tự dùng dữ liệu máy chủ; title không được parse để lấy số tuần.
- Trước khi tính, xác nhận position là số nguyên dương theo dữ liệu hiện hữu; dữ liệu legacy không hợp lệ phải báo, không tự sửa DB khi GET.
- 35 tuần, 4 môn không có nghĩa phải trả 140 bộ câu đầy đủ hoặc dựng 140 nền.
- Mỗi node khóa bằng weekId; mỗi bộ khóa bằng packId + version. Array index chỉ là vị trí render, không phải ID.

Ví dụ: lớp có tuần position 1,2,3; môn Toán chỉ có ở 1 và 3. Trong map Toán vẫn là slot 1 và slot 3, không nén thành 1 và 2.

## 4. Endpoint đọc map đề xuất

**GET /api/online/student/map**

Query:
- Không có region/chapter: trả overview, regionView là null.
- region: một RegionId trong allowlist.
- chapter: current hoặc số nguyên dương không có số 0 ở đầu; chỉ được dùng khi có region.
- Không nhận studentId, classId, workspaceId, offset, URL ảnh hay tên tệp từ người gọi.
- Query lạ, region lạ, chapter âm/thập phân/01 hoặc vượt số chương: 400.
- Khi lớp chưa có tuần: region + chapter=1 hoặc current trả 200 với node rỗng; chapter>1 trả 400.
- current chọn chương theo vị trí tuần hành trình hiện tại, không theo chương được cache trước.
- Chưa đăng nhập: 401; vai trò admin gọi endpoint student: 403; tài khoản không còn hợp lệ theo luật auth hiện tại.
- JSON dùng Cache-Control no-store/private và không cache CDN như các API riêng tư hiện có.

### Hình dạng response cần chốt trong type

- schemaVersion: 1.
- currentWeek: null hoặc {weekId, position, title, ready, hasNext}.
- totalWeeks: số tuần được giao của lớp hiện tại.
- maxPosition: vị trí lớn nhất của tuần thực được giao, hoặc 0.
- regions: tối đa 5 phần tử {id, label, assignedWeekCount, closedWeekCount, hasCurrentWeek}.
- regionView: null hoặc {regionId, chapter, totalChapters, startPosition, endPosition, nodes}.
- nodes: tối đa 7 phần tử, mỗi phần tử:
  - weekId, position, slot, title.
  - state: current, closed hoặc locked, lấy từ luật hành trình hiện tại.
  - counts: {total, zero, one, two, three}; tổng các nhóm bằng total.
  - sets: metadata bộ của đúng vùng/tuần, gồm packId, contentVersion, title, kind, subjectLabel, itemCount, done và counts nếu cần.

Các tên trường có thể điều chỉnh một lần tại UP02, sau đó cập nhật client, store và kiểm thử hợp đồng cùng lúc. Không được để local/cloud dùng hai hình dạng khác nhau.

Response không có items, prompt, options, correctIndex, answer/acceptedAnswers, passage, transcript, questionIds, bytes media, CSRF/token, username người khác hoặc lịch sử quà của người khác.

Map không trả balance riêng để một projection cũ có thể ghi đè ví. Wallet vẫn đọc summary/receipts của luồng hiện hữu.

Danh sách game lấy qua packGames hiện có khi mở bộ current hợp lệ; không gọi packGames cho node closed/locked. Metadata của tuần khóa không đồng nghĩa quyền mở game.

## 5. Đọc không làm thay đổi trạng thái

Luồng màn học sinh hiện có khởi tạo hành trình bằng POST student/journey. Giữ bước đó và xử lý session-expired như hiện tại. GET map chỉ đọc, không pinJourney, không chuyển tuần, không tạo audit/lượt chơi/sao.

Hai store dùng chung logic projection nếu có thể. Tránh một query cho từng node/bộ. Có thể tính projection từ summaryProgress hiện có rồi thu gọn; đo số query/size để không vô tình giải mã toàn bộ packs cho game capability.

Đọc lớp từ student đã xác thực. Một request gửi classId của lớp khác phải bị từ chối như query không hợp lệ, không được đổi scope.

## 6. State và vòng đời giao diện

State phiên map tối thiểu:
- regionId hoặc world.
- chapter.
- weekId đang xem.
- packId và contentVersion đang chọn.
- mục tiêu trả focus.
- requestEpoch/generation cho các request đang chờ.

Không lưu số dư/sao vào localStorage. Nếu lưu sở thích vị trí xem, chỉ là lựa chọn giao diện, gắn đúng user/workspace/class và kiểm lại với máy chủ; ưu tiên state bộ nhớ ở phiên bản đầu.

Sau các sự kiện sau phải loại dữ liệu cũ hoặc làm mới phù hợp:
- chuyển vùng/chương liên tục.
- play bắt đầu, attempt/complete có receipt mới.
- xác nhận chuyển tuần.
- admin cập nhật bộ/version hoặc chuyển lớp.
- logout, login tài khoản khác, session-expired, đổi mật khẩu.
- API response về sau khi màn đã unmount.

Kết quả GET cũ không làm mất sao, đổi chặng về tuần trước hoặc khôi phục game của tài khoản cũ. Hủy request dùng AbortController; đồng thời kiểm epoch vì abort không đảm bảo mọi handler đã ngừng.

Hoàn thành/thoát game xong: giữ vùng/chặng/bộ nếu còn hợp lệ; nếu version hoặc quyền đổi, báo ngắn và chọn lại theo summary mới. Không tự mở game tiếp theo.

## 7. Asset manifest và vùng bấm

Manifest tĩnh không chứa dữ liệu học sinh:
- artVersion.
- assetId, role, width, height, mime, bytes, sha256.
- src có hash nội dung, ví dụ /art/maps/map-world-wide.<hash>.webp.
- biến thể wide/tall.
- các anchor theo phần trăm và kích thước hit target được quy định riêng.
- variant/manifest phải khớp actual file, không chỉ đúng phần mở rộng.

Map hiển thị ảnh ở một mặt phẳng có aspect-ratio phù hợp. Overlay cùng hệ tọa độ của **diện tích ảnh thực**, không của container có letterbox. Nếu dùng object-fit:contain, phải xử lý offset vùng ảnh, hoặc chọn layout không sinh sai lệch này.

Bản dọc và ngang có anchor riêng. Chữ và vùng chạm không được thu nhỏ theo ảnh đến mức dưới ngưỡng. Label phải là HTML, không baked vào raster.

Mặc định lỗi/thiếu ảnh: có nền màu, tên vùng/node thật và nút retry; fallback không nạp ảnh từ domain tùy ý hoặc cho người dùng nhập URL.

## 8. Ngân sách đề xuất

Các số dưới đây là **mục tiêu nghiệm thu**, chưa phải số đo.

| Hạng mục | Ngân sách đề xuất |
| --- | --- |
| Artifact dist | ≤ 5 MiB theo cổng hiện có |
| Map tổng wide / tall | ≤ 240 / 200 KiB |
| 4 map vùng wide | ≤ 190 KiB mỗi ảnh |
| 4 map vùng tall | ≤ 150 KiB mỗi ảnh |
| 12 địa điểm | ≤ 20 KiB mỗi ảnh |
| 5 thumbnail | ≤ 40 KiB mỗi ảnh |
| Tranh auth | ≤ 90 KiB |
| Tổng 28 ảnh chính theo trần nhóm | ≤ 2.276 MiB xấp xỉ |
| JSON map fixture 35 tuần | ≤ 64 KiB UTF-8 không nén, chỉ overview + một chương |
| Query DB cho map, không tính auth | ≤ 6 trên fixture 35 tuần; không tăng tuyến tính theo số node |
| JS/CSS trước trò | Giữ các cổng đang có; thêm map lazy-load |
| Tải map warm | Không tải lại toàn bộ nền khi chỉ mở/đóng bảng tuần |

Tổng ảnh là dự toán; phải đo cả mã, bộ mẫu và asset cũ để qua gate 5 MiB. Không hạ chất lượng tới mức chữ/địa điểm khó thấy chỉ để đạt một số đơn lẻ; xem ảnh thực sau nén.

Điều kiện lab cho PF: cùng browser/build, cache lạnh/ấm tách riêng, viewport 390×844 và 1440×1000, network 4 Mbps down/1 Mbps up/RTT 150 ms, CPU slowdown 4× khi công cụ hỗ trợ. Mốc đề xuất: LCP ≤ 2.5 giây với fixture local controlled và không có tràn ngang; phải ghi số đo, không lấy số lab làm cam kết cloud thật.

PGlite chỉ có một backend theo fixture hiện hữu. Số query và latency mô phỏng có giá trị phát hiện N+1/đường gọi dư, không chứng minh tải đồng thời của PostgreSQL cloud.
