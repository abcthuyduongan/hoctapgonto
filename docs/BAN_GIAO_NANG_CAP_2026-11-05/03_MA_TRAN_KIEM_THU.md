# Ma trận 80 ca kiểm thử nghiệm thu

Ngày: **05/11/2026**. Toàn bộ mã ca trong tài liệu là đặc tả, trạng thái ban đầu **CHUA_CHAY**. Lịch sử test giao diện cũ không được điền thay kết quả mới.

## Cách thực hiện và ghi kết quả

Mỗi ca cần: build/sourceId, fixture, bước thực hiện, assert/quan sát, kết quả, đường dẫn log/ảnh/trace và lỗi liên quan. Xem [mẫu báo cáo](04_LENH_CHAY_VA_BAO_CAO.md).

- **P0:** sai quyền, sai bài, mất/nhân đôi sao, đổi tuần sai, lộ dữ liệu hoặc không thể dùng luồng chính.
- **P1:** lỗi đáng kể về bố cục, khả năng truy cập, hiệu năng, lỗi ảnh hoặc đóng gói.
- Ca tự động phải assert kết quả nghiệp vụ. Screenshot không thay assert quyền/sao.
- Bước “chọn/chơi” phải qua UI/API thật; không sửa state trình duyệt để giả hoàn thành.
- Dữ liệu kiểm thử đặt ở thư mục tạm riêng, không dùng .online hay Supabase production.
- Tệp test mới và các test script dưới đây là **đề xuất sẽ phải viết/đăng ký**, chưa tồn tại trong package hiện tại.

## Bộ fixture chung

| Mã | Dữ liệu có thể tái tạo |
| --- | --- |
| FX00 | Workspace/lớp/học sinh mới, chưa có tuần; số dư 0 |
| FX01 | Một tuần hợp lệ bốn môn; ít nhất hai câu mỗi bộ; có quiz, pairs, sentences, sequence và các dạng bài hiện có |
| FX02 | 35 tuần hợp lệ, bốn môn, tên tuần tùy ý; có tuần thiếu một môn trong dữ liệu phù hợp quy tắc xuất bản hoặc legacy fixture riêng |
| FX03 | Hành trình ở position 22, các tuần trước đóng bằng nghiệp vụ/fixture minh bạch; còn nhiều chương chưa tới |
| FX04 | Nhãn có dấu/không dấu, Toán bằng tiếng Anh, một môn tự đặt, nhiều bộ trong cùng tuần; dữ liệu mới vẫn theo validation tuần hiện hành |
| FX05 | Hai workspace; mỗi workspace có hai lớp/học sinh; có packId trùng chữ để bắt lỗi scope |
| FX06 | Bộ đã chơi rồi tăng version, giữ itemId cũ và thêm/bớt câu theo đường cập nhật thật; có request đang chờ |
| FX07 | Bộ media từ mẫu hiện có, ảnh thật PNG/WebP và WAV fixture có thời lượng; đủ tám dạng câu |
| FX08 | 28 asset chính hợp lệ, các biến thể hỏng kích thước/hash/alpha/mất tệp; dùng cả 8 asset đợt A |
| FX09 | Cho phép điều khiển độ trễ/lỗi: giữ response map, đổi vùng, lưu câu, thoát, offline và session-expired |

FX02/FX04 có tuần cấu trúc cũ phải dùng helper legacy được nêu rõ, chỉ để kiểm dữ liệu cũ. Các luồng nhập/giao mới dùng API thật và validation hiện hành. Không dùng legacy helper để bỏ qua lỗi feature mới.

## A. Tài nguyên và build — 8 ca

Tệp đề xuất: **tests/world-map-assets.test.mjs**; một phần ảnh hưởng build chạy lại **tests/release-online-assets.mjs**. Kiểm alpha/kích thước phải đọc ảnh thật bằng công cụ decode phù hợp, không dựa tên tệp.

| ID | Mức | Fixture và thao tác | Kết quả bắt buộc |
| --- | --- | --- | --- |
| AS01 | P1 | FX08: đọc checklist/manifest bộ A rồi bộ đầy đủ; đếm assetId, kiểm cặp wide/tall và tệp tham chiếu | Bộ A đủ 8; bản đầy đủ đủ 28; không ID trùng, không biến thể trỏ tệp mất; thiếu ảnh ghi rõ chặn nghiệm thu hình ảnh |
| AS02 | P1 | Đưa ảnh ngang bị khai là dọc và ảnh sai kích thước vào công cụ chuẩn bị | Báo đúng tên tệp/kích thước mong đợi; không kéo méo hoặc silently nhận manifest sai |
| AS03 | P1 | Decode 12 địa điểm; một bản nền caro vẽ sẵn hoặc opaque giả alpha | Bản chuẩn có alpha; bản opaque không được coi là trong suốt; người kiểm nhìn thêm viền, bóng và lề |
| AS04 | P1 | Sửa bytes một file sau khi tạo manifest, giữ tên và metadata cũ | Hash/bytes mismatch bị phát hiện; bản không khớp không được đóng gói thành thành công |
| AS05 | P1 | Kiểm anchor wide/tall có điểm ngoài 0–100%, slot trùng hoặc thiếu; build bản chuẩn | Manifest lỗi bị từ chối có lý do; bản chuẩn có 7 anchor và 5 điểm tổng cần dùng; tọa độ không phụ thuộc tuần fixture |
| AS06 | P1 | Mở map, chặn 404 một nền và một địa điểm | UI dùng nhãn/fallback, retry được; không crash/khung trắng, không gọi play hoặc thêm sao vì lỗi ảnh |
| AS07 | P1 | Xem network/cache ảnh art có hash; gọi API map cùng phiên | Art tĩnh có URL nội dung ổn định; API riêng tư vẫn no-store; không đưa JSON API vào service worker/cache tĩnh |
| AS08 | P1 | Build cả bộ; kiểm cây dist, PNG gốc, URL asset và tệp riêng tư | Chỉ biến thể đã chọn; không PNG gốc lớn/dữ liệu riêng/GLB; không tham chiếu ảnh 404; gate 5 MiB còn hoạt động |

## B. Hàm thuần và trạng thái — 10 ca

Tệp đề xuất: **tests/world-map-domain.test.mjs**. Dùng input nhỏ định lượng, không dựng component chỉ để test hàm.

| ID | Mức | Fixture và thao tác | Kết quả bắt buộc |
| --- | --- | --- | --- |
| DM01 | P1 | FX04: nhãn “ TIẾNG   VIỆT ”, “Tieng Viet”, Unicode dấu tách; chuẩn hóa | Cùng region vietnamese; label hiển thị vẫn là giá trị tác giả, không ghi ngược vào pack |
| DM02 | P1 | FX04: “Toán bằng tiếng Anh”, “English”, “Sinh hoạt lớp”, nhãn lạ chứa một từ giống alias | Lần lượt math, english, discovery; nhãn không có alias rõ ràng không bị fuzzy-match sai |
| DM03 | P0 | Ba tuần position 1,2,3; Toán chỉ có ở 1 và 3 | Map Toán có slot 1 và 3 trong chapter 1, không nén/chuyển số vì lọc môn |
| DM04 | P0 | Tính vị trí 7,8,35 và toàn FX02; thêm dữ liệu cũ chỉ có position1,14 | 7→chapter1/slot7; 8→chapter2/slot1; 35→chapter5/slot7; tối đa7node/chương; dữ liệu1,14 có2tuần thực và2chương, không làm mất tuần14 |
| DM05 | P1 | Đảo thứ tự rows/packs ở input có cùng IDs/positions | Kết quả thứ tự/nodeKey/selected target không đổi; không dùng array index làm ID |
| DM06 | P0 | Một node có total8, zero2, one1, two3, three2 | counts tổng 8; 5 câu đạt ≥2 sao; ready không tự true khi còn 3 câu chưa đạt; không coi 1 sao là đạt |
| DM07 | P0 | Current ready=true, hasNext=true nhưng chưa có xác nhận advance | Node vẫn current; tuần sau locked; chỉ thao tác xác nhận qua server mới đổi tuần |
| DM08 | P0 | Cùng pack/source xuất hiện nhiều tuần, có award cũ và version mới | Projection không nhân đôi số dư; không tự cấp sao; diễn giải counts theo tiến độ server, không cộng đời học vào map |
| DM09 | P0 | Selected pack version1 bị thay version2, hoặc weekId không thuộc lớp mới | Loại lựa chọn không còn hợp lệ; không mở bản cũ hay tự chọn bộ thuộc lớp cũ |
| DM10 | P1 | FX00, một tuần và FX03; tính catalog/chương hiện tại | 0 tuần→0 chương/node; 1 tuần→1 chương; position22→chapter4; closedWeekCount không gộp current ready thành đã qua |

## C. API và hợp đồng hai backend — 12 ca

Tệp đề xuất: **tests/world-map-store.test.mjs**, **tests/world-map-api.test.mjs**. Chạy cùng assertion trên SQLite và PostgresStore/PGlite; route HTTP local và createCloudApi phải cùng shape.

| ID | Mức | Fixture và thao tác | Kết quả bắt buộc |
| --- | --- | --- | --- |
| API01 | P0 | Gọi GET map không cookie; gọi bằng admin | 401 khi chưa đăng nhập, 403 khi sai vai trò; không có payload map/PII kèm lỗi |
| API02 | P0 | FX05: login học sinh A, thêm workspaceId/classId/studentId của B vào query | 400 do query không được phép; request hợp lệ chỉ có dữ liệu lớp/workspace A |
| API03 | P0 | FX02/FX07: đọc response và duyệt keys đệ quy, đối chiếu scope | Không trường câu/đáp án/questionIds/media bytes/secret; không username/số dư của người khác. Không dùng regex cấm từ trong title để thay kiểm field |
| API04 | P0 | Snapshot counts/records nghiệp vụ trước và sau 10 GET map | Không tạo/sửa plays, attempts, awards, redemptions, journey/audit; giữ nguyên dấu hành trình |
| API05 | P1 | region lạ, chapter -1/0/01/1.5/text, query thừa, chương vượt total | 400 có thông báo ổn định; không 500 hoặc truy cập ngoài scope |
| API06 | P1 | FX00: overview, region+current, region+1, region+2 | Ba request đầu 200/rỗng hợp lệ; chapter2 trả 400; không giả 35 tuần |
| API07 | P0 | FX02: gọi cả 5 chương; vùng thiếu môn; tuần có nhiều bộ | Node đúng weekId/position/slot; nhiều bộ nằm trong đúng node; không bỏ bộ/trộn version vì giới hạn trang 20 bộ |
| API08 | P0 | FX03: gọi chapter=current; so với summary/journey hiện có | Trạng thái current/closed/locked và ready trùng nguồn hiện có, không suy từ số sao lifetime |
| API09 | P0 | FX06: cập nhật bộ qua API thật, đọc map rồi start version cũ | Map phản ánh version mới; server từ chối bản cũ theo giao thức hiện hữu; sao đã lưu còn nguyên |
| API10 | P0 | Dùng cùng fixture cho SQLite và PostgreSQL rồi chuẩn hóa ID/thời gian | Shape, counts, chapter, trạng thái và lỗi tương đương; không dùng hai thuật toán ready khác nhau |
| API11 | P0 | FX09: giữ response map cũ, hoàn thành câu/chuyển tuần, cho response cũ về | Client bỏ kết quả cũ phù hợp epoch; không đưa học sinh về tuần cũ hoặc làm mất số sao mới |
| API12 | P0 | FX05/FX09: giữ response, logout hoặc chuyển sang học sinh B rồi trả response A | Không hiện dữ liệu A trong B; request/state/cache phiên A được dọn; thao tác tiếp yêu cầu identity hợp lệ |

## D. Giao diện và điều hướng map — 16 ca

Tệp đề xuất: **tests/visual/online-worldmap.spec.ts**, **online-regionmap.spec.ts**, **online-mapflow.spec.ts**. Tên tuân theo testMatch hiện có của playwright.online.config.ts.

| ID | Mức | Fixture và thao tác | Kết quả bắt buộc |
| --- | --- | --- | --- |
| UI01 | P1 | FX01/FX08: đăng nhập, mở map tổng desktop và phone | Đúng nền wide/tall, tên bốn vùng và tiến độ thật; map là phần chính; không vẽ nhiều nút giả cho môn chưa có bài |
| UI02 | P0 | Bấm vùng Toán rồi trở về, chọn English, chọn vùng discovery | Đúng vùng/các bộ của vùng; tên môn tự đặt còn nguyên; không lẫn bộ giữa vùng |
| UI03 | P0 | FX03: bấm Tiếp tục chuyến đi từ world | Đưa tới current week chapter4, không về chương1 hoặc bộ đầu của trang API |
| UI04 | P1 | FX02: đổi chương 1→5→2; bấm một node | Đúng 7 slot tối đa; chọn node đúng tuần; chương hiển thị không phụ thuộc phần tử đầu/last fetch |
| UI05 | P0 | Bấm current, closed và locked | Current mở lựa chọn hợp lệ; closed chỉ tóm tắt; locked báo lý do; không gửi start cho closed/locked |
| UI06 | P1 | Một tuần thiếu môn và trường hợp chỉ có một môn vùng | Không hiện node/địa điểm giả ở slot thiếu; layout không sập hoặc thêm nhãn môn khác |
| UI07 | P0 | Tuần một môn có nhiều bộ khác kind/version; chọn từng bộ | Tên/số câu/phiên bản đúng; chọn bộ không phát sinh attempt/award; panel không bỏ sót do pagination |
| UI08 | P0 | Chọn quiz, pairs, sentence, sequence và learning | Chỉ hiện game hợp lệ; 8 dạng bài dùng runner/adapter hiện có, không giả tất cả thành MathQuest |
| UI09 | P0 | Nhấp đúp start và thoát khi mạng chậm | Một play/start/abandon tương ứng; trạng thái chờ rõ; không tạo lượt trùng hoặc click xuyên panel |
| UI10 | P0 | Mở một bộ khác mặc định, chơi một câu rồi thoát | Về đúng region/chapter/week/pack, focus về nút vừa dùng, tiến độ mới còn nguyên |
| UI11 | P0 | FX09: đổi vùng/chương A→B→C khi giữ A/B trả muộn | Cuối cùng chỉ C được chọn/hiện; không ló lại nội dung cũ hoặc mất lựa chọn do response đến muộn |
| UI12 | P0 | FX06: admin thay version/chuyển lớp khi map/game đang mở | Thông báo phù hợp, xác minh lại; không tiếp tục submit vào bộ/lớp cũ; tiến độ hợp lệ còn giữ |
| UI13 | P1 | 320,390,768,1024,1440 và landscape844×390; đổi hướng khi panel mở | Không tràn ngang/cắt nút; hit target ≥48px, mục tiêu56px cho chặng phone; hotspot khớp diện tích ảnh; giữ lựa chọn |
| UI14 | P1 | Chỉ dùng Tab/ShiftTab/Enter/Space/Esc ở world, region, phone sheet | Vào/đóng/chọn được, nhãn đọc được, focus không ra phần inert của modal; panel desktop không khóa Tab như modal |
| UI15 | P1 | Chặn nền/landmark, offline sau khi có summary; bấm retry | Có đường danh sách học liệu và tên/vùng thật; retry không tự chơi; không che nội dung bằng error overlay vô hạn |
| UI16 | P1 | Tắt âm thanh/hiệu ứng và mô phỏng prefers-reduced-motion | Settings có trạng thái đúng; map/địa điểm không yêu cầu animation; nhân vật tĩnh nhỏ; không canvas/WebGL |

## E. Hồi quy toàn luồng hiện có — 18 ca

Ưu tiên tái dùng/điều chỉnh test trong **online-games, online-weekplan, online-questionclock, online-imageclock, online-rounds, online-import, online-importfile, online-management, online-password, online-studentflow, online.spec.ts** và unit/API hiện có. Khi đổi selector, giữ assert nghiệp vụ; không xóa ca chỉ vì layout mới.

| ID | Mức | Fixture và thao tác | Kết quả bắt buộc |
| --- | --- | --- | --- |
| RG01 | P0 | FX01: hoàn thành MathQuest qua câu đúng/sai rồi chơi lại | Chấm máy chủ; tối đa3/source, chơi lại chỉ cộng phần tăng; trở về chặng đúng |
| RG02 | P0 | FX01: chơi MemoryMatch có lượt sai, ghép đủ; thử lại | Lượt/cặp/star đúng luật hiện hành; không cộng lại câu đủ3; không sai mapping pack |
| RG03 | P0 | FX01: ghép câu bằng chạm và đường kéo hiện hữu | Câu đúng theo dữ liệu, gửi/lưu đúng item; nút và từ không bị art che |
| RG04 | P0 | FX01: Nối Từ và kiểm sai rồi đúng | Hai cột/đường nối đọc được, retry an toàn, không submit sai cặp do overlay |
| RG05 | P0 | FX01: Bậc Thang Quy Luật thao tác thứ tự rồi hoàn thành | Thứ tự/chấm/server receipt giữ nguyên; hoàn tất không tạo nguồn sao mới |
| RG06 | P0 | FX07: nhập số, điền từ, đọc hiểu, nghe chọn/nghe điền cùng các dạng hỗ trợ | Chuẩn hóa đáp án hiện có, passage/audio và media đầy đủ; dùng runner đúng; không lộ đáp án trước trả lời |
| RG07 | P0 | Giữ download ảnh câu đầu/câu kế, bấm start | Đồng hồ không mở trước ảnh sẵn sàng; art map tải xong không được xem là ảnh câu đã tải |
| RG08 | P0 | Câu nghe: chưa nghe, nghe đủ, gửi; thử request không biên nhận | UI và server giữ gate nghe; không gửi sớm nhờ thay đổi màn/bỏ overlay |
| RG09 | P0 | FX09: offline/lỗi503 khi attempt, complete và abandon; retry | Khóa các hành động cần khóa, retry cùng idempotency đúng, không nhân đôi attempt/sao hoặc rời trước lưu |
| RG10 | P0 | Đủ tất cả câu≥2 nhưng chưa advance; xác nhận hai lần; thử tuần cũ | Chỉ một lần chuyển; tuần mới đúng, tuần cũ bị khóa trên API và UI; refresh không hồi sinh tuần cũ |
| RG11 | P0 | Nhập file Excel đủ33 cột/mẫu có8 dạng và media; preview rồi giao | Validation/mapping source/itemId như cũ, câu đúng/sai theo dòng rõ; map phản ánh bộ đã giao |
| RG12 | P0 | Nhập Word hiện được hỗ trợ và lỗi tên/thiếu media | Luồng hiện có không bị bỏ do chỉ tập trung Excel; lỗi đúng dòng/phần; không publish dữ liệu hỏng |
| RG13 | P0 | Xuất xlsx/zip có media và thống kê rồi nhập lại không sửa | Giữ source/itemId, không mất sao; nhận trùng theo hành vi hiện có; file không chứa tài khoản trẻ |
| RG14 | P0 | Gửi ước muốn, duyệt/từ chối/trao/hủy qua đúng vai trò | Số dư khả dụng/pending/redeemed đúng; map không dùng tổng kiếm thay khả dụng; không nhấp trùng request |
| RG15 | P0 | Đổi mật khẩu, logout/login tài khoản khác, hết phiên hoặc khóa tài khoản | Về login đúng, dọn dữ liệu riêng map; giữ thành tích server; không phát lại dữ liệu tài khoản cũ |
| RG16 | P0 | Chuyển lớp, admin giao tuần mới, refresh hợp lệ | Map đọc lớp/tuần mới theo identity; không giữ quyền bộ lớp cũ hoặc thêm vùng bằng cache cũ |
| RG17 | P0 | Cập nhật version giữ/thêm/bớt câu sau khi đã có thành tích | Giữ lịch sử/sao theo luật hiện hữu; game version cũ không được dùng để ghi mới; chọn trò mới xác minh lại |
| RG18 | P0 | Backup/preview/restore local với tuần, sao, yêu cầu quà; thử import all-invalid | Preview không ghi; restore yêu cầu login lại và map đúng; file all-invalid không tạo tuần để map hiển thị |

## F. Hiệu năng và tài nguyên — 8 ca

Tệp đề xuất: **tests/world-map-performance.test.mjs**, **tests/visual/online-mapperformance.spec.ts**; đối chiếu online-performance.spec.ts và postgres-latency.test.mjs hiện có.

| ID | Mức | Fixture và thao tác | Kết quả bắt buộc |
| --- | --- | --- | --- |
| PF01 | P1 | Build cuối với28 ảnh và mẫu học liệu; tính tổngdist cùng từng nhóm asset | ≤5MiB; không tắt gate. Có bảng bytes thật so với ngân sách, không chỉ dự báo |
| PF02 | P1 | Capture request từ login tới world và một region trên phone/desktop | Login không tải toàn bộ map; chỉ tải biến thể đang dùng; không tải cả10 nền hoặc các trò/admin chưa vào |
| PF03 | P1 | FX02: đo UTF-8 bytes của JSON overview + region chapter | ≤64KiB không nén; ≤7node; không có items/answer/media; title/counts không bị cắt để lách size |
| PF04 | P1 | Count query không tính auth trên fixture1 và35 tuần, tất cả7node | ≤6 query mỗi request theo mục tiêu; không query/packGames từng node; không đọc full-content studentState |
| PF05 | P1 | Theo điều kiện lab trong hợp đồng, 5 lần cold và5 lần warm; ghi LCP/bytes | LCP mục tiêu≤2.5s trong lab được mô tả; tách cold/warm, nêu min/median/p95 nếu đủ mẫu và cỡ mẫu. Không gọi10 mẫu là kiểm định tải cloud |
| PF06 | P1 | Xem JS/CSS gzip trước login, trước vào trò; kiểm canvas/WebGL/GLB | Giữ JS≤100KiB, CSS học sinh trước trò≤20KiB theo gate hiện tại; không đồ họa engine/ngữ cảnh WebGL; không preload gamebase trước cần |
| PF07 | P1 | 20 vòng world→region→panel→game→thoát, đổi viewport xen kẽ | Không listener/dialog/scroll lock/audio/request tăng không dọn; không quá1 request đồng loại đang bay nếu được coalesce; UI còn dùng được |
| PF08 | P1 | Đọc log/trace/network diagnostic khi lỗi và khi bình thường | Chỉ số hỗ trợ debug, không token/password/đáp án hoặc PII không cần; ghi rõ fixture/PGlite/local hay cloud thật |

PF05 là cổng lab mới, phải đo; nếu chưa đủ môi trường ghi BI_CHAN, không gán DAT. Mục tiêu cloud p95/tải được chốt riêng ở G5, không suy từ fixture PGlite.

## G. Phát hành và dùng thử — 8 ca

Tái dùng công cụ package/release tests hiện có; thêm assert cho asset/map/fallback nếu cần.

| ID | Mức | Fixture và thao tác | Kết quả bắt buộc |
| --- | --- | --- | --- |
| RL01 | P0 | So package version, build-info, #root data và /status của bản chạy | version/sourceId/protocol tương thích; không dùng dist cũ kèm server mới hoặc ghi nguồn chỉ bằng HEAD |
| RL02 | P0 | Kiểm ZIP source/local và danh sách public trước bàn giao | Có mã/asset/manifest cần thiết; không .env thật, .online, DB, backup, token hoặc node_modules không cần trong source |
| RL03 | P0 | Giải nén pilot vào thư mục tạm, khởi động với DB thử; backup rồi restore | Chạy độc lập theo launcher hiện có, map/ảnh không404; dữ liệu đúng. Static art đi theo gói app, không giả là dữ liệu nằm trong backupDB |
| RL04 | P0 | Chuyển cờ map sang tắt và chạy cùng DB thử, rồi bật lại | Dùng danh sách/giao diện nhẹ với cùng ID và sao; không migration/resetdata; quay lại map không mất kết quả |
| RL05 | P1 | Cố đóng gói vào version/đích đã có nội dung khác | Tool từ chối an toàn theo thiết kế; không xóa/ghi đè gói người dùng để biến lỗi thành pass |
| RL06 | P1 | Nếu có staging được phép: login, map, currentgame, media, save, return, adminimport/export | Cloud thật đúng build, không lỗi API/CSP/cache mới; ghi URL/build/kết quả. Không có môi trường thì BI_CHAN, không dùng local thay |
| RL07 | P0 | So backlog, matrix, report, ảnh và artifact hash với bản cuối | Các ca có bằng chứng/skip reason; không báo test mới đã chạy khi chỉ viết file; mỗi thiếu sót có ảnh hưởng/trạng thái rõ |
| RL08 | P1 | Người dùng/đứa trẻ thử không hướng dẫn trên phone: mở bài hiện tại và trở về | Vào bài đang học trong tối đa4 lần chạm sau login với fixture lựa chọn phù hợp; đọc được tên vùng, biết chỗ trở về; ghi quan sát thực. Chưa có người thử thì CHUA_CHAY, pilot giữ UNVERIFIED |

## Bản đồ coverage đầu việc

| Đầu việc | Các nhóm kiểm tra chính |
| --- | --- |
| UP00–UP01 | Baseline/log; AS01–AS03, RL07 |
| UP02 | DM01–DM10 |
| UP03 | API01–API12, PF03–PF04 |
| UP04 | AS01–AS08, PF01 |
| UP05–UP06 | UI01–UI06, UI13–UI16, DM03–DM05 |
| UP07–UP08 | UI07–UI12, RG01–RG10, RG17 |
| UP09–UP11 | UI13–UI16, RG01–RG18 |
| UP12 | PF01–PF08 |
| UP13–UP15 | Tất cả ca áp dụng, RL01–RL05, RL07–RL08 |
| UP16 | RL06 và đo cloud riêng nếu có quyền/phạm vi |

**Tổng: 8 AS + 10 DM + 12 API + 16 UI + 18 RG + 8 PF + 8 RL = 80 ca đặc tả.** Một ca có thể được thực hiện bằng nhiều test và nhiều browser/backend; không lấy số case ID làm số test Playwright.
