# Báo cáo rà soát Bảo An Learning — 16/10/2026

**Cập nhật 17/10/2026 — RC6:** bổ sung nhập chung tài liệu/ảnh/âm thanh, chọn tuần bằng danh sách, loại câu lỗi và giao phần hợp lệ, cùng bộ mẫu đầy đủ; xem mục 14. Bản Netlify thật chưa được cập nhật vì kết nối GitHub hiện chỉ đọc.

**Cập nhật mới nhất:** đã sửa R05–R09 và đóng gói RC4; bằng chứng trước/sau và kết quả cuối ở mục 12. Các mục 10–11 giữ nguyên phát hiện trước sửa để đối chiếu.

Các lỗi đã xử lý gồm: R05 kho trên 300 tư liệu, R06 dùng chung khác khối, R07 đồng bộ tư liệu, R08 chữ trên thẻ có ảnh và R09 khôi phục ảnh lỗi. Kết quả kỹ thuật cục bộ PASS; nghiệm thu giáo viên/học sinh và cloud live vẫn UNVERIFIED.

## Tiến độ sửa theo kế hoạch

Được người dùng xác nhận thực hiện sau đợt rà soát. Các mục 1–8 bên dưới là **baseline trước sửa**, được giữ để đối chiếu bằng chứng.

| Task | Trạng thái hiện tại | Kết quả |
|---|---|---|
| T01 | PASS | Tái hiện 2 test thất bại trước sửa; kiểm tra session trong transaction và tuần tự hóa logout; toàn bộ 31 test cloud đạt. |
| T02 | PASS | Test trước sửa nhận 200 thay vì 409; sau sửa 20 test local/API/recovery và 5 test cloud API đạt. Note Unicode 300 ký tự sao lưu/khôi phục được. |
| T03 | PASS | Test trước sửa không tìm thấy nút chơi lại; sau sửa Chrome/Edge đạt 2 ca: nâng 2→3 sao, không cộng lặp, không mở tuần khóa, vẫn chơi lại sau hoàn tất. |
| T04 | PASS | Đã tạo ZIP 3.8.0-rc.3, xác minh 60 tệp theo manifest và thử Chrome từ ZIP sạch; đóng gói lại reuse thành công; RC2 giữ nguyên hash. |
| T05 / R08 | PASS | Chữ và ảnh cùng hiện trên thẻ Nối Từ, Chrome/Edge ở 360/768/1440 px. |
| T06 / R05 | PASS | Word/Excel nhập được với catalog 300/301/1.000 tệp; tên trùng và hash sai vẫn bị từ chối. |
| T07 / R07 | PASS | Làm mới nhận hình/âm thanh từ tab khác; có kiểm tra lỗi kết nối, thử lại và preview. |
| T08 / R09 | PASS | Nối Từ/Trí Nhớ tải lại ảnh ngoài nút đáp án; không ghi thêm attempt. |
| T09 / R06 | PASS | SQLite/PostgreSQL dùng chung bộ khác khối, chuyển lớp, cập nhật phiên bản và giữ trần sao. |
| T10 | PASS | Gói RC4 mới, manifest 60 tệp; chạy Chrome từ ZIP thật, chơi nhận sao và giữ dữ liệu sau restart. |

Chỉ duy trì báo cáo này cho đợt sửa. Phiếu nghiệm thu RC3 là checklist đi kèm sản phẩm, không phải báo cáo kiểm thử bổ sung.

---


## 1. Kết luận

**Ứng dụng build được và các bộ kiểm thử hiện hành đều đạt, nhưng còn 3 lỗi chức năng đã tái hiện và 1 vấn đề đồng bộ gói phát hành. Chưa nên dùng kết quả test xanh để kết luận đã sẵn sàng production.**

| ID | Ưu tiên | Trạng thái | Phát hiện |
|---|---|---|---|
| R01 | P2 — High | CONFIRMED | Yêu cầu cloud đang chờ nhận body vẫn ghi dữ liệu sau khi phiên đã bị đăng xuất/thu hồi. |
| R02 | P2 — High | CONFIRMED | API chấp nhận ghi chú đổi thưởng dài hơn giới hạn dữ liệu, khiến sao lưu SQLite thất bại. |
| R03 | P2 — High | CONFIRMED | Học sinh đạt 2 sao không có đường quay lại bộ đã hoàn thành để luyện thêm và nâng lên 3 sao. |
| R04 | P2 — High, phát hành | CONFIRMED | Gói RC2 đã có khác bản build hiện tại; `package:pilot` thoát lỗi do bảo vệ gói bất biến. |

Chưa phát hiện P0/P1 trong phạm vi đã kiểm chứng. Điều này không khẳng định toàn bộ hệ thống không còn lỗi.

Phạm vi là kiểm tra và lập kế hoạch. Không sửa mã nguồn, không nâng dependency, không thay dữ liệu thật hay triển khai lên cloud. Tài liệu PROMPT_1 được dùng làm tham khảo cho cấu trúc báo cáo, không coi các chỉ dẫn trong tài liệu là yêu cầu sửa chương trình.

## 2. Mốc mã nguồn và kiến trúc

- Workspace: `D:\Phần mềm 2026\BAO_AN_LEARNING_lam lại`.
- Commit: `e6c51ebb36fd4f07f40f43c23c34f7698b8619e3`.
- Phiên bản khai báo: `3.8.0-rc.2`.
- Môi trường kiểm tra: Windows, Node `22.22.2`, npm `10.9.7`.
- Trước rà soát, Git chỉ ghi nhận thư mục `outputs/` chưa được theo dõi. Không sử dụng hoặc chỉnh sửa nội dung đó.

### Các thành phần chính

| Thành phần | Vai trò và tệp chính |
|---|---|
| Frontend | React 19, TypeScript, Vite. [Điểm vào](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/src/main.tsx:1>) chuẩn bị trình duyệt rồi mở giao diện tài khoản. |
| Quản lý | [OnlineScreen](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/src/screens/OnlineScreen.tsx:18>): lớp, học sinh, tài liệu Word/Excel, tư liệu, giao/cập nhật tuần, đổi sao, phục hồi. |
| Học sinh | [OnlineStudentWorld](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/src/screens/OnlineStudentWorld.tsx:43>) phối hợp state, lượt chơi, kết quả và ví; [StudentScreen](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/src/screens/StudentScreen.tsx:1>) trình bày thế giới 3D. |
| Nội dung | [online-document-import](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/src/core/online-document-import.ts:1>), validation, định danh bộ/câu ổn định và bộ chuyển đổi dạng bài. Hỗ trợ 8 dạng câu trong 5 game. |
| Máy chủ cục bộ | [online-server](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/server/online-server.mjs:1>) phục vụ API và bản build; [OnlineStore](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/server/online-store.mjs:24>) dùng SQLite với transaction. |
| Cloud | [Netlify Function](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/netlify/functions/online.mjs:1>) → cloud API → PostgreSQL và Supabase Storage riêng tư. |
| Chấm điểm | [online-exercises](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/src/core/online-exercises.ts:1>) chấm câu trả lời gốc trên máy chủ; lưu bằng chứng và chỉ cộng phần sao tiến bộ theo bộ nguồn. |
| Phục hồi | [online-recovery](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/server/online-recovery.mjs:40>) kiểm tra schema, nội dung, tư liệu, bằng chứng chơi và sổ sao trước phục hồi. |
| Phát hành | [package_release](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/tools/package_release.mjs:1>) tạo ZIP và manifest hash; giữ gói cùng phiên bản bất biến. |

Luồng chính: quản lý đăng nhập → tạo lớp/học sinh → tải tư liệu → đọc Word/Excel và xem trước → giao tuần → học sinh mở bộ được giao → máy chủ xác thực câu trả lời → lưu sao → mở tuần tiếp theo/đổi thưởng.

Authentication dùng mật khẩu scrypt và session cookie HttpOnly; các thao tác ghi kiểm tra origin, CSRF và vai trò. SQLite và PostgreSQL có hai lớp repository riêng, dùng chung phần lớn logic nội dung/chấm điểm; cần kiểm thử tương đương giữa hai đường chạy.

Các test và tài liệu phiên bản cũ còn nhiều trong repository. Tệp README của tests đã giải thích chúng được giữ làm lịch sử và không thuộc gate hiện hành. Không có đủ bằng chứng để kết luận các tệp này nên bị xóa. Không xóa hoặc đánh dấu chúng là lỗi chức năng.

## 3. Kết quả kiểm chứng thực tế

| Kiểm tra | Kết quả đợt này | Giới hạn diễn giải |
|---|---|---|
| `npm ls --depth=0` | PASS | Các dependency trực tiếp được nhận diện, không báo thiếu/invalid. |
| `npm audit --json --ignore-scripts` | PASS — 0 advisory | 0 low/moderate/high/critical tại thời điểm truy vấn; không thay thế audit mã ứng dụng. |
| `npm run typecheck` | PASS | Cấu hình TypeScript hiện tại bao phủ `src`, Vite và declaration của tools; không typecheck toàn bộ server `.mjs`. |
| `npm run build` | PASS | Vite build 106 modules, hoàn thành thành công. |
| `npm test` | PASS | Các nhóm syntax, renderer, release, online và cloud đều hoàn tất. Nhóm online: 65 pass; cloud: 29 pass. |
| `npm run test:assets` | PASS | 5 model bắt buộc đạt kiểm tra tài nguyên. |
| `npm run test:online:browser` | PASS | 18/18 trên Chrome và Edge; 0 skipped, 0 unexpected, 0 flaky; khoảng 127 giây. |
| Runtime/API/SQLite | PASS các ca hiện hành | Máy chủ HTTP thật, database riêng cho test; bao gồm đăng nhập, học liệu, game, sao, đổi thưởng và phục hồi. |
| Cloud API/database | PASS các ca hiện hành | Request/Response adapter và PostgreSQL PGlite cục bộ; không phải nghiệm thu Netlify/Supabase live. |
| Tái hiện bổ sung | Xác nhận R01–R03 | Chạy trực tiếp trên fixture riêng, xem bằng chứng ở mục 4. |
| `npm run package:pilot` | FAIL | Gói cùng phiên bản đã tồn tại nhưng khác nội dung; xem R04. |
| Lint | Chưa chạy | `package.json` không có script lint. Không ghi nhận PASS thay cho kiểm tra chưa có. |

Lượt `npm test` đầu tiên trong sandbox bị chặn HTTP loopback (`EACCES 127.0.0.1`). Chạy lại với quyền thực thi phù hợp đã PASS. Đây là giới hạn môi trường kiểm tra, không được tính là lỗi chương trình.

Các kiểm thử trình duyệt đã bao phủ tạo tài khoản, nhập Word/Excel, 8 dạng câu, 5 game, tư liệu có xác thực, đổi thưởng giữa các phiên, cập nhật tuần, phục hồi và xử lý service worker cũ. Báo cáo runner hiện tại nằm ở [online-browser-report.json](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/test-results/online-browser-report.json>); đây là đầu ra tự sinh, có thể bị thay ở lần chạy sau.

## 4. Phân tích các phát hiện

### R01 — Phiên cloud đã thu hồi vẫn hoàn tất được yêu cầu đang chờ body

**P2 — High · CONFIRMED trên cloud adapter + PostgreSQL PGlite.**

- Bằng chứng mã: [cloud-api dòng 70](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/server/cloud-api.mjs:70>) lấy `auth` và kiểm tra CSRF trước khi chờ đọc body. [PostgresStore.activeActor dòng 42](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/server/postgres-store.mjs:42>) chỉ kiểm tra user còn active, vai trò và student ID, không kiểm tra session `tokenHash` còn tồn tại/hết hạn tại thời điểm ghi.
- Tái hiện: tạo quản lý trên fixture mới → bắt đầu POST `/classes` với body dạng stream chưa hoàn tất → POST `/logout` bằng cùng session → gửi nốt body tạo lớp.
- Kết quả: setup `201`; logout `200`; GET `/me` với cookie cũ `401`; nhưng POST đang chờ trả `201`, và database có thêm 1 lớp.
- Nguyên nhân gốc: snapshot quyền ở đầu request tiếp tục được dùng sau một khoảng chờ bất đồng bộ. Kiểm tra user active không tương đương kiểm tra phiên chưa bị thu hồi.
- Ảnh hưởng: đăng xuất không chặn được thao tác ghi còn đang chờ body. Không chứng minh rằng request mới gửi hoàn toàn sau đăng xuất có thể truy cập; request mới đã trả `401` đúng.
- Phụ thuộc: cloud API, `mutate`, `activeActor`, `revokeSession` và các thao tác vô hiệu hóa phiên. Đường SQLite đã có `authenticatedBody`/`authenticatedActor` kiểm tra lại, nên không kết luận lỗi giống nhau ở local.
- Hướng sửa: kiểm tra session/expiry/quyền trong transaction ghi, với cơ chế khóa hoặc thứ tự tuần tự phù hợp cho thao tác thu hồi. Kiểm tra lại sau body ở adapter là lớp bổ sung nhưng chưa đủ đóng mọi cửa sổ race trong transaction.
- Rủi ro hồi quy: thêm truy vấn và lock; cần thống nhất thứ tự khóa để tránh deadlock, giữ hoạt động các fixture gọi store trực tiếp.
- Test sau sửa: request có body trì hoãn, logout hoàn tất trước commit thì trả `401` và không ghi; mở rộng ca tương tự cho reset mật khẩu, hết hạn session và chuyển lớp; xác nhận request hợp lệ và idempotent retry vẫn hoạt động.

### R02 — Ghi chú đổi thưởng không hợp lệ làm mất khả năng sao lưu qua API

**P2 — High · CONFIRMED qua HTTP thật và SQLite.**

- Bằng chứng mã: [changeRewardRequest dòng 63](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/src/core/reward-wallet.ts:63>) chỉ `trim` ghi chú rồi lưu, không kiểm tra kiểu, độ dài hoặc ký tự điều khiển. [validateRewardWallet dòng 30](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/src/core/reward-wallet.ts:30>) lại giới hạn ghi chú 300 ký tự. [inspectOnlineBackup dòng 86](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/server/online-recovery.mjs:86>) từ chối sổ đổi thưởng không hợp lệ.
- Tái hiện: tài khoản học sinh làm bài để có sao thật → gửi yêu cầu đổi 1 sao → quản lý gọi `/redemptions/{id}/transition` với `status: approved` và `note` gồm 301 ký tự → gọi `/backup`.
- Kết quả: transition trả `200`, database lưu note dài `301`; backup trả `400`: “Lịch sử đổi thưởng hoặc số sao giữ chỗ không hợp lệ.”
- Nguyên nhân gốc: ràng buộc ở đường ghi không thống nhất với ràng buộc dữ liệu/khôi phục.
- Điều kiện kích hoạt: gọi API với dữ liệu vượt giới hạn UI. Ô nhập hiện tại có `maxLength={300}`, nên chưa tái hiện được bằng thao tác nhập thông thường trong ô đó. Máy chủ vẫn phải tự bảo đảm dữ liệu lưu hợp lệ.
- Ảnh hưởng: chỉ một ghi chú không hợp lệ có thể chặn tạo bản sao toàn kho; chưa quan sát mất dữ liệu đã lưu. Cả hai repository gọi chung hàm transition, nhưng hậu quả backup đã kiểm chứng cụ thể ở SQLite.
- Hướng sửa: kiểm tra kiểu string, giới hạn 300 và ký tự điều khiển trước ghi, dùng chung quy tắc với validator; từ chối bằng lỗi 4xx và giữ nguyên trạng thái yêu cầu. Phân tích dữ liệu tồn tại trước khi đề xuất cách sửa các ghi chú đã lưu; không tự cắt lịch sử.
- Phụ thuộc: reward-wallet, transitionReward của SQLite/PostgreSQL, backup validator.
- Rủi ro hồi quy: xử lý ghi chú trống, Unicode, retry cùng trạng thái và lịch sử cũ phải giữ tương thích.
- Test sau sửa: note 300 được chấp nhận; 301, object và ký tự không hợp lệ bị từ chối, không ghi; sau mọi transition hợp lệ vẫn tạo/kiểm tra/khôi phục được backup.

### R03 — Bộ đạt 2 sao bị loại khỏi đường vào game trên giao diện

**P2 — High · CONFIRMED bằng Chrome và API thật.**

- Bằng chứng mã: [OnlineStudentWorld dòng 65](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/src/screens/OnlineStudentWorld.tsx:65>) chỉ truyền `state.current?.pack` cho thế giới game. Dòng 66 hiển thị các bộ trong lịch sử bằng text, không có thao tác chọn/chơi lại. [OnlineStore.progress dòng 159](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/server/online-store.mjs:159>) bỏ bộ đã đạt từ 2 sao khỏi `current`.
- Tái hiện: giao 1 bộ 5 câu, trả lời đúng 4/5 rồi hoàn tất → mở trang học sinh với `controls=1`.
- Kết quả: `tier=2`, `current=null`, `done=true`; số nút/link hành động trong `.online-week-path` bằng `0`; số nút vào chơi bằng `0`; giao diện báo đã hoàn thành toàn bộ học liệu.
- Đối chứng: gọi `/play` lại cùng bộ, request ID mới, trả `201`. Máy chủ vẫn cho chơi lại bộ đã mở; sự thiếu hụt nằm ở đường chọn bộ của UI.
- Nguyên nhân gốc: dùng bộ gợi ý tiếp theo làm lựa chọn duy nhất, trong khi lịch sử không cung cấp cách chọn bộ khác.
- Ảnh hưởng: không thể nâng bộ 2 sao lên 3 sao qua giao diện thông thường; khi hết bộ chưa hoàn thành, thế giới game không còn bộ để chơi. Điều này không khớp thông tin trong ví rằng chơi lại cộng phần sao tiến bộ.
- Hướng sửa: thêm thao tác chọn/chơi lại cho bộ thuộc tuần đã mở, giữ bộ tiếp theo làm lựa chọn mặc định. Tiếp tục để máy chủ kiểm tra quyền mở tuần và version, không cấp lại sao đã đạt.
- Phụ thuộc: OnlineStudentWorld, StudentScreen, state lựa chọn bộ; có thể tận dụng `/play` hiện tại.
- Rủi ro hồi quy: không cho chọn tuần khóa; xử lý đúng khi giáo viên cập nhật phiên bản/chuyển lớp và khi lượt cũ còn đang chơi.
- Test sau sửa: đạt 2 sao → chọn lại bộ → làm hoàn hảo → tổng tăng đúng 1 sao; bộ 3 sao chơi lại không cộng thêm; bộ tuần khóa không mở được; học sinh đã hoàn thành tất cả vẫn luyện lại được.

### R04 — Gói phát hành RC2 không đại diện bản build hiện tại

**P2 — High, phát hành · CONFIRMED.**

- `npm run package:pilot` thoát mã `1`: “Đích đã có gói khác build/nội dung. Không ghi đè; dùng phiên bản phát hành mới.”
- Manifest gói sẵn có ghi build ID `26b666a45d9787c2`; bản build từ mã hiện tại ghi `28cb0b7b50d68587`.
- Đối chiếu read-only: tên/hash nhiều JS chunk khác; `app/index.html` và `app/sw.js` khác. Đây không phải bằng chứng các tệp bị mất khỏi ZIP; tên chunk trong bản build mới đã thay đổi so với manifest cũ.
- Nguyên nhân gốc của lỗi đóng gói: cùng phiên bản `3.8.0-rc.2` đang gắn với hai tập byte build khác nhau. [checkExisting dòng 61](<D:/Phần mềm 2026/BAO_AN_LEARNING_lam lại/tools/package_release.mjs:61>) chủ động từ chối thay gói bất biến, đúng với thiết kế an toàn.
- Ảnh hưởng: quy trình `verify:release` trên workspace hiện tại chưa thể xanh; không được chuyển chứng nhận của bản source mới sang ZIP RC2 cũ.
- Hướng xử lý: sau khi chốt sửa lỗi, phát hành bằng phiên bản mới; đồng bộ version trong package, công cụ đóng gói, hướng dẫn và checklist. Kiểm tra lại ZIP thực tế trên thư mục sạch. Giữ nguyên RC2 cũ.
- Rủi ro hồi quy: cập nhật không hết version hard-code; gói mới vô tình không giữ dữ liệu người dùng; khác biệt runtime trong ZIP.
- Test sau xử lý: build → package phiên bản mới → kiểm hash manifest/ZIP → smoke test từ ZIP sạch → kiểm tra cập nhật giữ nguyên database; chạy lại đóng gói cùng byte phải reuse thành công.

## 5. Kế hoạch sửa theo task

| Task | Ưu tiên | Vấn đề/nguyên nhân | Tệp ảnh hưởng | Thay đổi đề xuất | Kiểm thử và tiêu chí xong | Rủi ro |
|---|---|---|---|---|---|---|
| T01 | P2, làm trước cloud release | R01: dùng auth cũ sau await | cloud-api, postgres-store, cloud-api tests | Ràng buộc session còn hiệu lực vào transaction ghi và đồng bộ với thu hồi phiên | Ca body trì hoãn sau logout/reset không ghi; session hợp lệ và retry vẫn đạt | Lock/deadlock và hiệu năng |
| T02 | P2, làm trước rollout dữ liệu | R02: thiếu validation note ở đường ghi | reward-wallet, online-store, postgres-store, online-recovery tests | Chung quy tắc note trước commit; kế hoạch xử lý lịch sử cũ nếu thực sự có | Biên 300/301, kiểu sai, control characters; backup round-trip sau transition hợp lệ | Tương thích dữ liệu cũ |
| T03 | P2 | R03: current là lựa chọn UI duy nhất | OnlineStudentWorld, StudentScreen, browser tests | Chọn/chơi lại bộ đã mở từ hành trình, giữ mặc định bộ tiếp theo | 2→3 cộng đúng 1 sao; 3→3 cộng 0; tuần khóa bị chặn; hết hành trình vẫn luyện lại | Chọn nhầm version hoặc mở bộ khóa |
| T04 | P2, sau T01–T03 | R04: version không đổi dù build khác | package.json, package_release, tài liệu/checklist phiên bản | Tạo phiên bản phát hành mới và giữ nguyên gói cũ | Toàn bộ gate + đóng gói + nghiệm thu ZIP sạch đạt; hash đúng | Lệch version, gói cũ bị dùng nhầm |

Mỗi task nên có thay đổi nhỏ và ca hồi quy riêng. Không cần đổi framework, đổi API contract hay migration schema để bắt đầu xử lý các phát hiện trên. Nếu giải pháp cụ thể sau này cần migration, phải đánh giá dữ liệu/khôi phục trước khi thực hiện.

## 6. Các phần chưa xác minh và rủi ro còn lại

- **UNVERIFIED:** Website Netlify và kết nối Supabase thật ở môi trường đang sử dụng. Đợt này không chạy migration, không đọc dữ liệu học sinh thật, không sử dụng secret cloud. Báo cáo live cũ trong repository không được tính là kết quả mới.
- **UNVERIFIED:** Độ trễ/tải đồng thời thực tế của PostgreSQL. PGlite fixture có một backend và hàng đợi, không chứng minh toàn bộ hành vi nhiều connection trên PostgreSQL production.
- **UNVERIFIED:** Hiệu năng với hàng nghìn học sinh, nhiều tuần và kho tư liệu lớn. Dashboard hiện tải nhiều dữ liệu liên quan; cần benchmark riêng trước khi kết luận thành lỗi hiệu năng.
- **UNVERIFIED:** Thiết bị di động thật và nghiệm thu của giáo viên/học sinh. Viewport trình duyệt tự động không thay thế thiết bị và người dùng thật.
- Giới hạn phục hồi UI 32 MB và CLI 512 MB đã được tài liệu cục bộ mô tả; không tính đây là lỗi mới. Cloud có quy trình backup PostgreSQL/Storage riêng.
- Không đánh giá ZIP RC2 cũ là tương đương bản source hiện tại. Đợt rà soát chỉ đối chiếu hash và phát hiện chênh lệch; chưa nghiệm thu lại toàn bộ ZIP cũ.

## 7. Definition of Done cho vòng sửa

1. R01–R03 có ca hồi quy tái hiện trước sửa và đạt sau sửa; kiểm tra cả local/cloud ở nơi dùng chung logic.
2. `typecheck`, `npm test`, `test:assets`, `build`, `test:online:browser` đạt; không tắt test để đạt gate.
3. Validation note bảo đảm dữ liệu mới luôn phù hợp validator sao lưu; nếu có dữ liệu cũ không hợp lệ thì có phương án kiểm tra/xử lý được xem xét riêng.
4. Học sinh luyện lại được bộ đã mở và hệ thống chỉ ghi phần sao tiến bộ.
5. Phiên bị thu hồi trước điểm commit không được thực hiện mutation mới từ request đang chờ.
6. Gói phiên bản mới có hash/manifest đúng và được chạy từ ZIP sạch; cập nhật giữ nguyên dữ liệu.
7. Ghi rõ kết quả live cloud, tải thực tế và nghiệm thu người dùng; chỉ chuyển trạng thái phát hành khi các điều kiện cần thiết đã được xác minh.

## 8. Thay đổi trong đợt rà soát

Chỉ bổ sung báo cáo Markdown này vào mã nguồn. Các lệnh kiểm tra có sinh lại `dist`, cache TypeScript và đầu ra runner trong các thư mục được Git bỏ qua. Fixture bổ sung được tạo riêng và đã dọn sau kiểm tra. `git diff` trước khi tạo báo cáo không có thay đổi mã nguồn. Gói RC2 cũ được giữ nguyên vì công cụ từ chối ghi đè.

## 9. Kết quả thực hiện sau phê duyệt — RC3

### T01 — PASS

- Problem/root cause: snapshot auth trước khi nhận body không phản ánh phiên bị thu hồi; đã xác minh bằng test thất bại trước sửa (201 thay vì 401).
- Files changed: server/postgres-store.mjs; tests/cloud-api.test.mjs.
- Fix: activeActor kiểm tra token hash, user, CSRF và expiry trong transaction ghi. Logout lấy cùng khóa workspace với mutation/reset; nếu mutation đã lấy khóa trước thì logout chỉ hoàn tất sau transaction đó, nếu logout hoàn tất trước thì mutation bị từ chối. Không thay schema/API contract.
- Verification: body trì hoãn qua logout, expiry, reset mật khẩu đều trả 401 và không ghi dữ liệu; 31/31 test cloud đạt ở regression gate.
- Regression: setup, session, phân quyền, học liệu, tư liệu, chấm điểm và đổi sao cloud vẫn đạt.
- Remaining risk: chưa nghiệm thu nhiều connection PostgreSQL thật. Fixture PGlite có một backend; không tuyên bố đã stress-test production. Lời gọi nội bộ tin cậy không có tokenHash vẫn được hỗ trợ; HTTP actor luôn mang tokenHash do máy chủ tạo.

### T02 — PASS

- Problem/root cause: transition ghi note không phù hợp validator backup; test trước sửa trả 200 thay vì 409.
- Files changed: src/core/reward-wallet.ts; tests/online-recovery.test.mjs; tests/cloud-api.test.mjs.
- Fix: kiểm tra kiểu string, ký tự điều khiển và độ dài sau trim tối đa 300 trước transition, kể cả retry. Ghi chú trống vẫn được bỏ qua như trước.
- Verification: 301 ký tự, object, null, newline và NUL bị từ chối; lịch sử giữ nguyên. Unicode 300 ký tự được ghi, retry không thêm lịch sử; tải backup qua HTTP và phục hồi sang database sạch giữ đúng note.
- Regression: 66/66 test online (bao gồm recovery/API/ZIP) và 31/31 cloud đạt.
- Remaining risk: chưa rà dữ liệu thật để xác định có note cũ sai hay không. Bản sửa ngăn dữ liệu mới sai, không tự cắt hoặc chỉnh lịch sử cũ. Nếu backup thật báo lịch sử không hợp lệ, cần kiểm tra read-only và phương án xử lý riêng.

### T03 — PASS

- Problem/root cause: bộ đã đạt 2 sao không còn là current và lịch sử không có đường chơi lại; ca trình duyệt trước sửa không tìm thấy nút.
- Files changed: src/screens/OnlineStudentWorld.tsx; src/styles/online.css; tests/visual/online-games.spec.ts.
- Fix: các bộ đã hoàn thành trong tuần đã mở có nút Chơi lại cho từng game phù hợp. Dùng lại startGame/API hiện có, không thêm state chọn bộ hay thay cách chọn bài tiếp theo. Nhãn môn trong dialog lấy theo bộ đang chơi.
- Verification: Chrome và Edge kiểm tra 2→3 cộng đúng 1, 3→3 cộng 0, tuần khóa không có nút và API trả 403; hoàn thành toàn bộ hành trình vẫn chơi lại. Đã xem ảnh đầu ra để kiểm tra bố trí các nút.
- Regression: toàn bộ 20/20 ca trình duyệt đạt, bao gồm các game cũ, nhập học liệu, cập nhật tuần, đổi sao và phục hồi.
- Remaining risk: nghiệm thu thiết bị/người dùng thật chưa thực hiện; test tự động không thay cho bước đó.

### T04 — PASS

- Problem/root cause: gói RC2 bất biến khác build hiện tại nên đóng gói cùng version bị từ chối.
- Files changed: package.json, package-lock.json (chỉ version gốc), tools/package_release.mjs, tools/release-files/HUONG_DAN_SU_DUNG.html, README.md; thêm docs/NGHIEM_THU_CUC_BO_RC3.md làm checklist sản phẩm.
- Fix: version 3.8.0-rc.3, hướng dẫn và checklist đúng version; không nâng dependency, không đổi schema, không ghi đè RC2.
- Verification: package:pilot tạo gói mới thành công; chạy lại trả reused:true. Giải nén ZIP vào thư mục sạch, xác minh 60 tệp theo manifest; chạy standalone server và Chrome thực hiện khởi tạo, logout/login; restart giữ lớp và session.
- Regression: test gói hiện hành kiểm tra học liệu, sao, đổi thưởng, backup/restore và restart; test bản ZIP RC3 thật kiểm tra boot/UI và dữ liệu lớp tồn tại sau restart. Chưa chạy thử nâng cấp dữ liệu người dùng thật từ RC2 sang RC3.
- Remaining risk: vẫn là ứng viên phát hành chờ nghiệm thu; releaseReady:false, humanPilotStatus:UNVERIFIED.

### Regression Gate cuối

| Gate | Kết quả |
|---|---|
| npm ls --depth=0 | PASS, không thiếu dependency trực tiếp |
| npm audit --json --ignore-scripts | PASS, 0 advisory |
| git diff --check | PASS, chỉ cảnh báo chuyển LF/CRLF của Git |
| TypeScript và syntax parsing | PASS |
| Renderer | 98/98 PASS |
| Release package tests | 9/9 PASS |
| Online/API/SQLite/import/recovery/package | 66/66 PASS |
| Cloud/API/PostgreSQL fixture/config/storage | 31/31 PASS |
| Tổng npm test | 204/204 PASS |
| Tài nguyên 3D | PASS, đủ 5 model |
| Production build | PASS |
| Chrome/Edge | 20/20 PASS, khoảng 2,2 phút |
| ZIP RC3 thật | PASS: manifest, standalone boot, browser setup/logout/login, dữ liệu sau restart |
| Đóng gói lại cùng byte | PASS, reused:true |
| Lint | UNVERIFIED: dự án không cấu hình lint; không thêm framework/lint ngoài phạm vi |
| Netlify/Supabase live, tải nhiều connection, mobile thật | UNVERIFIED, chưa triển khai hoặc nghiệm thu trong đợt này |

Lượt smoke ZIP đầu dừng do locator kiểm thử dùng nhầm heading “Đăng nhập”; đã đối chiếu source, sửa script kiểm tra thành “Chào mừng bạn trở lại” và chạy lại thành công. Không sửa sản phẩm để né lỗi kiểm thử.

### Gói bàn giao

- ZIP: releases/bao-an-learning-3.8.0-rc.3.zip.
- Build ID: 7b1a7e82877d23ab.
- SHA-256 ZIP RC3: 0c6eab62f09f74eb7ce70c0f749d6fd143fddd647591bd76f3a35eb2f9d2a93f.
- SHA-256 RC2 trước và sau đều là 740315ad2385c931e410cb6a3fa4a2097f6c949abb8d4ffe31c9310fd80c126f.
- Database schema giữ SQLite 1 / PostgreSQL 1.
- Chỉ cập nhật một báo cáo này. Không commit/push/deploy. Không truy cập dữ liệu sử dụng thật; fixture smoke riêng đã dọn, đầu ra test tiêu chuẩn nằm trong test-results.

### Kết luận chốt

**NOT READY FOR FINAL LOCK đối với phát hành production.** T01–T04 và regression kỹ thuật cục bộ đều PASS. Còn thiếu nghiệm thu thực tế giáo viên/học sinh trên gói RC3 và xác nhận quy trình cập nhật bằng bản sao dữ liệu thực tế. Nếu chọn triển khai cloud, cần thêm nghiệm thu Netlify/Supabase live và concurrency PostgreSQL thật. Các mục này không được tự đánh dấu đạt bằng test cục bộ.

## 10. Rà soát tiếp luồng nhập dữ liệu và nạp vào trò chơi

Phạm vi theo yêu cầu tiếp theo của người dùng: Word/Excel → kiểm tra và xem trước → gắn hình/âm thanh → giao lớp → chọn trò phù hợp → ghim phiên bản lượt chơi → gửi đáp án → tính sao. Kiểm tra thêm nhập lại, cập nhật phiên bản, dùng chung bộ giữa các lớp và kho tư liệu lớn. Lượt này bổ sung kiểm thử và báo cáo; không đổi mã chạy sản phẩm, database thật hoặc ZIP RC3.

### R05 — P1: kho trên 300 tư liệu làm ngừng nhập cả bài thuần văn bản — FAIL

- Vị trí: `src/core/online-document-import.ts`, đầu hàm `parseOnlineDocument`; `src/screens/OnlineScreen.tsx` truyền toàn bộ `mediaAssets` vào bộ nhập. `server/online-store.mjs` và `server/postgres-store.mjs` giới hạn tổng dung lượng 256 MB nhưng không giới hạn 300 bản ghi.
- Tái hiện bằng SQLite in-memory: tải cùng PNG hợp lệ dưới 301 tên khác nhau, cả 301 lần thành công, `listMedia` trả 301 bản ghi và tổng dung lượng vẫn dưới 256 MB.
- Cùng một tài liệu có hai câu nối cặp, không tham chiếu ảnh hay âm thanh: catalog 300 bản ghi nhập thành công; catalog 301 bản ghi báo “Catalog đa phương tiện không hợp lệ.” Kết quả giống nhau với Word và Excel.
- Tác động: khi kho tích lũy vượt ngưỡng, giáo viên không thể xem trước/giao thêm tài liệu, kể cả tài liệu không dùng tư liệu. Chia nhỏ tài liệu không giải quyết vì lỗi phụ thuộc toàn bộ kho. Dữ liệu đã giao không bị thay đổi trong thử nghiệm.
- Hướng sửa: tách giới hạn số tư liệu của một tài liệu khỏi kích thước toàn kho; tra cứu và kiểm tra các tham chiếu mà tài liệu thực sự dùng. Giữ kiểm tra tên trùng, loại tệp, hash và quyền sở hữu. Không xóa tư liệu cũ để né lỗi.
- Gate cần thêm khi sửa: 300/301/>301 tư liệu, bài thuần chữ và bài dùng tư liệu ở cuối catalog, Word/Excel, cả local/cloud; tên trùng vẫn phải từ chối rõ ràng.

### R06 — P2: dùng lại cùng nguồn/phiên bản ở lớp khác khối bị xung đột — FAIL cho kịch bản dùng chung khác khối

- Vị trí: `publishWeek` ở cả hai store ghi đè `pack.grade` bằng khối của lớp nhận; sau đó so sánh `onlineImmutablePackIdentity` với bản đã công bố, trong khi mã nguồn tự sinh không chứa khối.
- Tái hiện độc lập trên SQLite và PostgreSQL fixture: tạo hai lớp khối 3 và một lớp khối 4; giao cùng bộ nguồn v1 với cùng nhãn vào hai lớp khối 3 đều thành công. Giao bộ đó sang lớp khối 4 nhận 409 “đã công bố và không thể sửa”. Dashboard vẫn chỉ có hai tuần, không có bản ghi dở dang.
- Tác động: giáo viên dùng lại cùng học liệu ôn tập cho lớp khác khối bị báo đang sửa nội dung dù câu hỏi/đáp án không đổi. Đây là giới hạn tái sử dụng đã xác nhận, không phải lỗi làm sai đáp án. Chính sách dùng chung học liệu khác khối cần được thể hiện rõ trước khi sửa.
- Hướng xử lý: tách khối của lớp nhận khỏi danh tính nội dung bất biến, hoặc thiết kế rõ phiên bản riêng theo khối và hướng dẫn trong preview. Không tự tạo mã nguồn khác để vượt cơ chế chống nhân sao; kiểm tra cả trường hợp chuyển lớp và cập nhật sau khi dùng chung.

### Các luồng đã kiểm chứng

| Luồng | Bằng chứng / giới hạn |
|---|---|
| Tám dạng câu Word/Excel | Parser hiện có kiểm tra trường bắt buộc, đáp án, nhóm câu, metadata, ảnh, bản chép lời và báo đúng dòng/bảng lỗi; browser kiểm tra xem trước đủ tám dạng. |
| Dữ liệu sai | Từ chối file rỗng, đáp án thiếu/trùng, trường sai dạng, công thức Excel, media nhúng Word và giới hạn giải nén. |
| Chuyển nối cặp sang trắc nghiệm | Bổ sung test lâu dài cho mọi kích thước 4–30 câu: 459 câu, 1.836 lượt chấm lựa chọn; giữ đúng item ID, bốn lựa chọn khác nhau và đáp án gốc. |
| Nhập lại/cập nhật | Test SQLite/PostgreSQL giữ mã nguồn, nhập lại không nhân tuần/sao, cập nhật nguyên tử, lượt đang chơi giữ bản cũ và lượt sau nhận bản mới. |
| Giao bài/chơi | Kiểm thử hiện có kiểm tra cách ly lớp/workspace, tuần khóa, trò không phù hợp, nạp học liệu được giao thay vì bài mẫu. |
| Chấm/lưu sao | Máy chủ chấm đáp án gốc, không tin cờ đúng do trình duyệt gửi; kiểm tra thứ tự, phiên bản, gửi lại, hoàn tất đủ câu và trần ba sao theo bộ nguồn. |
| Mất mạng | Browser có ca gửi đáp án khi offline rồi gửi lại, kiểm tra số bản ghi để tránh lưu lặp. |

### Kết quả kiểm thử lượt này

- Năm ca khảo sát riêng chạy đạt các assertion: hai ca xác nhận biên catalog và ma trận chuyển trò; hai ca xác nhận xung đột khác khối trên hai store; một ca xác nhận tải 301 ảnh. **Assertion tái hiện lỗi đạt không có nghĩa R05/R06 đã được sửa.** Script khảo sát tạm đã dọn; các bước tái hiện được ghi ở trên.
- Đã giữ lại test ma trận chuyển trò trong `tests/online-document-import.test.mjs`.
- `npm run test:online`: **67/67 PASS**, bao gồm test mới.
- `npm run test:cloud`: **31/31 PASS**, dùng PostgreSQL fixture và storage giả lập, không phải cloud live.
- `npm run test:online:browser`: **20/20 PASS** trên Chrome/Edge, 2,6 phút; gồm nhập Word/Excel, tám dạng ở preview, tư liệu, chơi bài được giao, cập nhật phiên bản, mất mạng/gửi lại và lưu sao.
- `git diff --check`: PASS; chỉ cảnh báo LF/CRLF. Không build/đóng gói lại vì lượt này chỉ bổ sung test và báo cáo.
- Lượt đầu trong sandbox không gọi được localhost (`EACCES`) và Edge bị chặn khởi động. Đã chạy lại phần HTTP/browser ngoài sandbox với fixture riêng; không sửa sản phẩm để vượt test.

**Kết luận lượt rà soát bổ sung: NOT READY FOR FINAL LOCK.** Luồng thông thường có kiểm thử tốt, nhưng R05 cần xử lý trước khi mở rộng kho học liệu; R06 cần xử lý rõ chính sách dùng chung khác khối. Chưa có bằng chứng mất dữ liệu hoặc sai chấm điểm trong những kịch bản đã chạy.

## 11. Kiểm tra giao diện nhập câu hỏi có hình ảnh và âm thanh

Phạm vi theo yêu cầu: kiểm tra giao diện và luồng tư liệu. Đã đọc `PROMPT_HOAN_THIEN_GIAO_DIEN_WEB_CHUYEN_NGHIEP.md` làm tài liệu tham chiếu về form, trạng thái lỗi, responsive và khả năng sử dụng. Chưa thực hiện thiết kế lại toàn ứng dụng hoặc coi các mệnh lệnh mở rộng trong tài liệu là yêu cầu thay đổi sản phẩm của lượt này.

### R08 — High / P1: chữ câu hỏi biến mất khi thẻ Nối Từ có ảnh — FAIL

- Vị trí: `src/styles/game-base.css:2785`, `.connect-card-text` dùng `flex: 1 1 0` và `overflow: hidden`; `src/styles/online.css:6` chuyển thẻ có `.question-media` sang `flex-direction: column`.
- Tái hiện: nhập Word có bốn câu nối cặp, mỗi câu có nội dung vế trái khác nhau và ảnh PNG hợp lệ; giao lớp, học sinh mở Đảo Nối Từ. Ảnh hiển thị nhưng cả bốn dòng “Vế trái 1…4” biến mất. Đã thử lại với ảnh tải thành công sau khi thoát/mở lượt chơi mới, không chỉ khi mô phỏng mất mạng.
- DOM vẫn có chữ và accessible label trên nút, nhưng chiều cao phần chữ bằng **0 px**, `scrollHeight` **22 px**, computed flex **1 1 0px**. Kết quả giống nhau ở **360, 768, 1440 px**, cả Chrome và Edge.
- Tác động: học sinh nhìn màn hình không nhận được đầy đủ câu hỏi. Nếu nhiều câu dùng cùng ảnh minh họa, các thẻ trông giống nhau mặc dù nội dung khác nhau.
- Hướng sửa nhỏ: với thẻ có ảnh, bảo đảm phần chữ có chiều cao theo nội dung, không bị co bởi flex; kiểm tra xuống dòng, nhãn dài, ảnh ngang/dọc, thẻ đã chọn/đã nối và màn hình nhỏ. Giữ nguyên mã câu, đáp án và cách tính sao.
- Bằng chứng ảnh: `test-results/online-browser-output/online-mediaaudit-media-UI-ba567-resh-and-game-image-failure-online-chrome/matching-image-loaded-1440.png`; có thêm bản 360/768 và bản Edge.

### R07 — Medium / P2: “Làm mới dữ liệu” chưa cập nhật kho tư liệu — FAIL

- Vị trí: `src/screens/OnlineScreen.tsx`, `refresh()` chỉ đọc dashboard; `onlineApi.media()` được gọi khi mount và sau lượt tải tư liệu của chính tab đó.
- Tái hiện: tab A có hai tư liệu; tab B cùng tài khoản tải thêm `from-second-tab.png` hợp lệ. Tab A bấm “Làm mới dữ liệu”, nhận thông báo thành công nhưng danh sách vẫn hiện **2 tệp**, trong khi API đã trả **3 tệp**.
- Tài liệu Word tham chiếu tệp mới vẫn bị từ chối: “Word, bảng 2: Tệp from-second-tab.png: cần tải lên đúng một tệp hình ảnh có tên này.” Tải lại toàn trang thì danh sách mới hiện đủ ba tệp.
- Tác động: giáo viên tưởng tệp chưa được tải hoặc đã nhập sai tên; nút làm mới không giúp khôi phục đúng quy trình. Không có bằng chứng mất tệp trên máy chủ.
- Hướng sửa: đồng bộ catalog cùng dashboard khi làm mới/quay lại tab; xử lý thứ tự phản hồi và preview đang mở để không dùng catalog cũ. Gate: hai tab cùng tài khoản, tải mới, refresh và preview lại thành công mà không cần reload toàn trang.

### R09 — Medium / P2: ảnh lỗi trong thẻ trò chơi không có trạng thái khôi phục — FAIL

- Vị trí: `src/components/QuestionMedia.tsx`, nhánh `failed && !imageOnly` loại bỏ thông báo lỗi và nút tải lại khi component được dùng với `imageOnly`.
- Tái hiện trên Đảo Nối Từ: chặn tải ảnh bằng browser route; bốn ảnh có `naturalWidth=0`, số thông báo `.question-media-error` bằng **0**, nút “Tải lại” bằng **0** trên cả Chrome/Edge. Người dùng chỉ thấy ảnh hỏng/alt text.
- Trong preview quản trị, cùng loại lỗi có thông báo và nút tải lại; bỏ chặn rồi bấm tải lại khôi phục được ảnh. Như vậy khả năng khôi phục không thống nhất giữa xem trước và trò chơi.
- MemoryMatch cũng dùng `imageOnly` theo source; chưa tái hiện trực tiếp lỗi ảnh trong trò này ở lượt kiểm tra này.
- Hướng sửa: hiển thị trạng thái ảnh lỗi rõ ràng và cung cấp thao tác tải lại ở vùng ngoài nút thẻ. Không lồng một button tải lại vào button chọn đáp án; tải lại không được tính thành lượt trả lời.

### Kết quả kiểm tra UI/UX và âm thanh

| Hạng mục | Kết quả |
|---|---|
| Tải PNG/WAV qua form, liên kết đúng tệp trong Word | PASS trên Chrome/Edge với dữ liệu thử riêng |
| Preview ảnh, phát WAV đến hết, hiển thị đúng bản chép lời | PASS |
| Ảnh lỗi ở preview → bấm tải lại | PASS, kiểm tra `naturalWidth>0` sau phục hồi |
| Chọn thẻ Nối Từ → điều khiển âm thanh đúng media ID | PASS |
| Responsive màn hình quản trị có preview | Đã đo 360, 390, 768, 1024, 1366, 1440, 1920 px; không tràn ngang toàn trang trong fixture. Tab điều hướng cuộn ngang ở 360/390, một số tab nằm ngoài vùng nhìn ban đầu; đây là điểm dễ bỏ sót thao tác, chưa kết luận là mất chức năng. |
| Quan sát hình thức | Form chia bước rõ, preview có ảnh/âm thanh/đáp án; kho tư liệu hiện chỉ có tên, loại, dung lượng và mã, chưa có thumbnail hoặc nghe thử ngay trong kho. Đây là đề xuất UX, không phải lỗi dữ liệu. |
| Bàn phím/screen reader/contrast toàn ứng dụng | UNVERIFIED trong lượt này; có label và accessible name qua DOM nhưng chưa đủ để kết luận đạt accessibility toàn diện. |
| Trình duyệt/thiết bị khác | UNVERIFIED: Safari/iOS/Android thật và bộ sưu tập MP3/OGG thực tế chưa được thử. |

### Kiểm thử và phạm vi thay đổi

- Kịch bản UI khảo sát cuối: **2/2 hoàn tất**, Chrome và Edge, khoảng 26 giây. Bao gồm đo lỗi R07–R09; việc script hoàn tất không có nghĩa các lỗi đã sửa. Đã đọc trực tiếp ảnh chụp quản trị mobile và trò chơi để đối chiếu số đo DOM.
- `node --experimental-strip-types --test tests/online-document-import.test.mjs tests/online-exercises.test.mjs`: **20/20 PASS**. Bao gồm thiếu/sai tên tư liệu, tên không duy nhất, mô tả ảnh/bản chép lời và chấm câu nghe/điền từ. Kết quả này không phủ lỗi bố cục thẻ ảnh.
- Lượt thử đầu dừng vì script đăng nhập lại trong context đã có cookie setup. Đã sửa cách khởi tạo script thử bằng xóa cookie trước login rồi chạy lại; không sửa mã sản phẩm để né lỗi.
- Script khảo sát tạm được dọn sau khi thu bằng chứng; ảnh chụp còn ở thư mục test-results. Giữ một báo cáo này. Không sửa mã chạy sản phẩm, không build lại, không thay ZIP RC3 hoặc dữ liệu thật.

**Ưu tiên tiếp theo:** R08 (chữ câu hỏi bị ẩn), R05 (kho tư liệu chặn nhập), R07 (đồng bộ catalog), R09 (khôi phục ảnh lỗi); sau đó hoàn thiện preview trong kho và kiểm tra accessibility. **NOT READY FOR FINAL LOCK** đối với luồng học liệu đa phương tiện.

## 12. Thực hiện sửa R05–R09 theo xác nhận của người dùng

Người dùng yêu cầu “thực hiện sửa theo kế hoạch”. Đã sửa các lỗi được tái hiện ở mục 10–11, theo thay đổi nhỏ trong kiến trúc hiện tại. Không thiết kế lại toàn ứng dụng, không thêm thư viện, không đổi route/API, authentication hay schema cơ sở dữ liệu. T01–T04 được giữ lại và kiểm tra hồi quy.

### T05 / R08 — PASS: hiện đầy đủ chữ trên thẻ có ảnh

- Sửa CSS riêng cho nhãn của thẻ chứa ảnh: `flex:0 0 auto`, cho xuống dòng và ngắt từ dài. Phần chữ không còn bị flex co chiều cao về 0.
- Before: test trình duyệt mới thất bại vì nhãn không visible trên bản RC3; số đo audit trước sửa là 0 px.
- After: cả bốn nhãn visible, chiều cao trên 15 px và ảnh giải mã thành công ở 360/768/1440 px, Chrome và Edge. Đã đọc ảnh chụp mobile để xác nhận chữ nằm dưới hình và các thẻ không chồng nhau.
- File: `src/styles/online.css`; regression: `tests/visual/online-media.spec.ts`.

### T06 / R05 — PASS: nhập tài liệu với kho tư liệu lớn

- Bỏ giới hạn 300 bản ghi áp nhầm lên toàn kho trong parser. Giữ kiểm tra cấu trúc catalog, tên tham chiếu duy nhất, định dạng ảnh/âm thanh, ID/hash, mô tả ảnh, bản chép lời, giới hạn tài liệu và kiểm tra server. Giới hạn dung lượng tải lên trên host vẫn có hiệu lực.
- Before: test mới nhận “Catalog đa phương tiện không hợp lệ” khi thêm tư liệu sau ngưỡng.
- After: 300/301/1.000 tư liệu không liên quan không chặn bài thuần chữ; Word và Excel dùng được ảnh/âm thanh nằm cuối catalog. Tên trùng và hash sai của tệp được tham chiếu vẫn bị từ chối.
- File: `src/core/online-document-import.ts`; 11 test document-import PASS, gồm test biên mới.

### T07 / R07 — PASS: làm mới đồng bộ catalog với dashboard

- `refresh()` đọc dashboard và catalog cùng đợt, chỉ áp dụng phản hồi của generation mới nhất. Bỏ lượt tải catalog riêng lúc mount để tránh ghi đè dữ liệu mới bằng phản hồi cũ.
- Khi catalog không đổi, giữ preview. Khi danh tính/nội dung tư liệu thay đổi, đóng preview cũ để kiểm tra lại trước khi giao. Nếu API catalog lỗi, hiện lỗi và giữ dữ liệu/preview hiện có; nút thử lại tải được dữ liệu sau phục hồi.
- Before: tab A vẫn báo hai tệp sau khi tab B tải thêm, test chờ bốn tệp thất bại.
- After: tab A nhận đủ ảnh và WAV từ tab B sau nút làm mới, Word tham chiếu đúng các tệp mới được xem trước; ảnh có `naturalWidth>0`, WAV phát đến hết. Không reload toàn trang và không ghi attempt khi thử trong preview. Đã thử refresh không đổi, lỗi 503 rồi thử lại, và catalog đổi làm mất hiệu lực preview cũ.
- File: `src/screens/OnlineScreen.tsx`; browser test còn kiểm tra không tràn ngang toàn trang ở 360/390/768/1024/1366/1440/1920 px.

### T08 / R09 — PASS: khôi phục ảnh ở Nối Từ và Trí Nhớ

- Thêm vùng khôi phục dùng chung bao quanh bảng thẻ. Ảnh lỗi hiện thông báo ngắn; nút **Tải lại hình** nằm ngoài các button chọn thẻ, dùng chung vòng retry cho hình trong bảng.
- Giữ điều khiển nghe ở vị trí ngoài thẻ và cơ chế tải lại tư liệu đầy đủ ở preview. Khi đổi media/retry, trạng thái lỗi cũ được đặt lại.
- Before: hai test Chrome không tìm thấy nút tải lại trong cả Nối Từ và Trí Nhớ.
- After: Chrome/Edge mô phỏng lỗi ảnh, thử tải lại khi kết nối vẫn lỗi, bỏ chặn rồi khôi phục ảnh thành công. DOM không có `button button`; số bản ghi attempt không tăng khi tải lại. MemoryMatch giữ trạng thái thẻ đã lật.
- File: `src/components/QuestionMedia.tsx`, `src/games/WordConnect.tsx`, `src/games/MemoryMatch.tsx`, CSS liên quan.

### T09 / R06 — PASS: dùng chung bộ giữa các khối

- Chốt cách xử lý nhỏ, không migration: thông tin khối của bộ nguồn giữ theo bản đã công bố. Khi chưa có đúng phiên bản, dùng khối từ phiên bản nguồn đầu tiên; bộ nguồn mới vẫn khởi tạo theo khối lớp nhận. Khối hồ sơ học sinh tiếp tục theo lớp hiện tại.
- Hai store đọc catalog trong transaction trước bước chuẩn hóa; sau đó vẫn so sánh toàn bộ nội dung bất biến và giữ cơ chế chống sao chép bộ nguồn. Không bỏ kiểm tra immutability hay thay mã để né trần sao.
- Before: SQLite và PostgreSQL đều thất bại khi giao cùng nguồn v1 sang khối 4 sau hai lớp khối 3.
- After: ba lớp dùng chung đúng một nội dung; học sinh học xong ở khối 3, chuyển sang khối 4, chơi lại được nhưng không nhận thêm sao. Cập nhật tuần khối 4 lên v2 rồi cập nhật lớp khối 3 bằng cùng v2 thành công; nội dung sửa ngầm và bộ đổi mã sao chép vẫn bị từ chối. Tổng sao giữ 3.
- Đã ghi chính sách vào `docs/ONLINE_QUESTION_IMPORT.md`. Thay đổi chỉ áp dụng khi giao/cập nhật từ đây; không viết lại pack hay lịch sử đã lưu.
- File: `server/online-store.mjs`, `server/postgres-store.mjs`; `tests/online-import-identity.test.mjs`: 7/7 PASS.

### Regression Gate cuối RC4

| Kiểm tra | Kết quả |
|---|---|
| Dependency trực tiếp / advisory | PASS: `npm ls --depth=0`; `npm audit --json --ignore-scripts`: 0 advisory |
| TypeScript / syntax | PASS |
| Renderer | 98/98 PASS |
| Release package | 9/9 PASS |
| Online/import/API/SQLite/recovery | 70/70 PASS |
| Cloud/API/PostgreSQL fixture/config/storage | 31/31 PASS |
| Tổng `npm test` | **208/208 PASS** |
| Tài nguyên 3D | PASS: đủ 5 model |
| Production build | PASS: 106 module |
| Chrome và Edge | **28/28 PASS**, khoảng 3 phút; 8 ca mới về tư liệu nằm trong gate đầy đủ |
| `npm run verify:local` | PASS, exit 0 |
| ZIP RC4 thật | PASS: kiểm tra hash 60 tệp, chạy server bundle, Chrome 390 px thấy đủ nhãn ảnh, giao cùng nguồn khối 3/4, chơi Nối Từ nhận 3 sao, restart giữ 3 sao và khối học sinh đúng |
| Console nghiêm trọng trong smoke ZIP | Không có `pageerror` |
| Lint | UNVERIFIED: chưa có lint trong dự án, không thêm framework ngoài phạm vi |
| Netlify/Supabase live, thiết bị di động thật, nghiệm thu người dùng | UNVERIFIED |

Các test hồi quy mới được giữ lại, không disable/skip test để đạt. Dữ liệu và tài khoản kiểm thử đều tạo trong fixture riêng. Không sửa dữ liệu đang sử dụng, không commit/push/deploy. Chỉ duy trì báo cáo này; checklist RC4 đi cùng gói dành cho nghiệm thu thực tế.

### T10 — PASS: bàn giao RC4

- ZIP: `releases/bao-an-learning-3.8.0-rc.4.zip`.
- Build ID: **ee7adf040877d937**.
- SHA-256 ZIP: **bfc8e07519fd162a8c15a1de1cf98fd72196afbd2171b403f6d120195593238a**.
- Manifest: 60 tệp, 50 tài nguyên ứng dụng; SQLite schema 1 / PostgreSQL schema 1; `pilot:true`, `releaseReady:false`, `humanPilotStatus:UNVERIFIED`.
- README, hướng dẫn đi kèm và checklist RC4 đã cập nhật. RC2/RC3 giữ nguyên ZIP và hash đã ghi ở mục 9.
- Script smoke ZIP và thư mục dữ liệu giải nén riêng đã dọn; ảnh kiểm tra còn trong `test-results` và ảnh thử ZIP là `test-results/rc4-zip-smoke.png`.

**Kết luận:** T05–T10 PASS trong phạm vi sửa và kiểm chứng kỹ thuật cục bộ. **NOT READY FOR FINAL LOCK đối với phát hành production** cho đến khi có nghiệm thu giáo viên/học sinh với dữ liệu thực tế và quy trình cập nhật; cloud live cần nghiệm thu riêng nếu triển khai. Các đề xuất UX bổ sung như thumbnail trong kho và audit accessibility toàn diện chưa thuộc các lỗi cần sửa của đợt này.

## 13. Sửa chậm khi xem trước và tải nhiều âm thanh · 17/10/2026

Người dùng xác nhận chậm ở nút **Kiểm tra & xem trước**, cung cấp workbook `BAO_AN_LOP3_TUAN01_MOT_FILE_140_CAU.xlsx` và thư mục 16 WAV, đang dùng `https://gontogontet.netlify.app/` qua GitHub. Chỉ đọc tệp gốc và endpoint trạng thái công khai; không đăng nhập hay ghi dữ liệu sản xuất.

### Bằng chứng và giới hạn xác minh

- Workbook gốc 37.408 byte; đọc cấu trúc Excel khoảng 30–33 ms trên Node cục bộ. Đây không phải bằng chứng tái hiện 5 phút trên trình duyệt sản xuất.
- Workbook gốc bị từ chối tại **dòng 73**: câu `fill-blank` chứa chữ `null` trong cột A và nhiều trường không sử dụng. Không hạ kiểm tra dữ liệu để chấp nhận các ô này.
- Tạo một biến thể **trong bộ nhớ kiểm thử**, thay 773 placeholder `null` bằng ô trống; parser nhận **17 bộ, 140 câu**. Tệp của người dùng trên Downloads không bị chỉnh sửa, không xuất thêm workbook đã sửa.
- Đo GET `/` công khai khoảng 997 ms và `/api/online/status` khoảng 2.106 ms trong một lần gọi; chưa đo được các request xác thực của người dùng. Suy luận: nhiều round trip liên tiếp có thể cộng dồn độ trễ cloud. Không khẳng định đây là nguyên nhân duy nhất của 5 phút thực tế.
- Source xác nhận: trước sửa mỗi tệp dùng một request và transaction riêng, sau upload/xem trước tải lại dashboard; mọi đáp án/điều khiển audio trong câu đang đóng vẫn được dựng sẵn.

### T11 — PASS cục bộ: giảm việc khi xem trước

- Chỉ dựng phần đáp án/tư liệu/thử làm khi mở từng câu; review cả bộ trong lịch sử/đối chiếu cũng chỉ dựng khi mở disclosure.
- Dùng memo cho phần review, cache media identity và kết quả so trùng tuần để tránh lặp khi thay đổi form.
- Xem trước và tải tư liệu không gọi refresh toàn dashboard sau thao tác. Upload vẫn tải catalog và đặt lại preview; giao/cập nhật bài vẫn refresh dữ liệu server và được server xác thực đầy đủ.
- Lỗi nhập liệu tự cuộn vào vùng nhìn. Chưa đổi API xuất bản, chấm điểm, trần sao hoặc nội dung câu hỏi.
- File: `src/screens/OnlineQuestionReview.tsx`, `src/screens/OnlineScreen.tsx`.

### T12 — PASS cục bộ: upload cloud theo đợt

- Thêm endpoint tương thích ngược **POST `/api/online/media/batch`**, tối đa 24 tệp và tổng 2 MB/đợt. Endpoint tải từng tệp cũ vẫn hoạt động; local tiếp tục dùng đường tải cũ.
- Trình duyệt vẫn kiểm tra giải mã/kích thước, tên trùng khác nội dung và hiển thị tiến độ. Cloud vẫn xác thực role, origin, CSRF, MIME thực, hash, tổng dung lượng và quyền sở hữu.
- Tải vào Storage với concurrency tối đa 3; ghi metadata/audit theo lô trong một transaction có khóa và tái kiểm tra session. Tối đa một INSERT metadata và một INSERT audit cho các tệp mới trong đợt.
- Tải lại/concurrent không tạo bản ghi hoặc object trùng; khi Storage lỗi hoặc audit lỗi sau INSERT, rollback metadata và dọn các object thử. Đăng xuất trong khi đang tải không thể commit. Dọn object dư sau commit chỉ đụng object không được tham chiếu, không xóa object vừa ghi thành công.
- File: `src/core/online-client.ts`, `src/screens/OnlineScreen.tsx`, `server/cloud-api.mjs`, `server/postgres-store.mjs`. Không migration, không thay biến bí mật.

### Đo trên đúng dữ liệu mẫu

| Phép thử | RC4 trước sửa | Sau sửa |
|---|---|---|
| 16 WAV thật, PostgreSQL fixture có độ trễ round trip giả lập 80 ms | 20.209 ms; 16 request tải lẻ | 2.387 ms; 1 batch |
| Tải dashboard trong upload + preview | 2 lần | 0 lần |
| Biểu mẫu trả lời được dựng khi 140 câu còn đóng | 140 | 0 |

Trong fixture không thêm trễ, 16 WAV thật tải khoảng **1.394 ms**, bản thử 140 câu mở khoảng **1.014 ms**; tệp gốc hiện lỗi dòng 73 khoảng **1.067 ms**. Timings UI gồm Playwright click/scroll/render; không dùng chúng để khẳng định tốc độ CPU parser hay tốc độ production. Đối chiếu RC4 sử dụng chính thư mục app của gói bất biến, không sửa RC4.

Test lâu dài bằng dữ liệu tổng hợp 16 WAV/140 câu cũng đạt: Chrome upload 1.465 ms, preview 430 ms; Edge upload 898 ms, preview 536 ms. Chỉ có một POST batch, không GET dashboard, mở câu cuối và thử đáp án được; lỗi hiện trong viewport.

### Kiểm chứng cuối

- TypeScript, syntax, 98 renderer + 9 release + 70 online + 33 cloud: **210/210 test PASS**. Hai test cloud mới còn phủ quá 24 tệp, tổng quá 2 MB, MIME/base64 sai, role/CSRF, audit rollback, lỗi Storage, retry, concurrent và logout.
- Browser: **30/30 PASS** Chrome/Edge, khoảng 3,3 phút. Lượt đầu hai ca mới đo tọa độ quá sớm khi trang còn cuộn; sửa assertion kiểm thử thành đợi vào viewport rồi chạy lại toàn bộ browser gate. Không đổi mã sản phẩm để né lỗi này.
- Sau thay nhãn RC5, chạy lại build và 9 test release đạt. Một lượt release trong sandbox bị EACCES localhost; chạy lại ngoài sandbox đạt.
- Bộ kiểm thử hiện không có lint; cloud production, tốc độ WAN thật và nghiệm thu tài khoản người dùng vẫn **UNVERIFIED**.
- Giữ script hồi quy `tests/visual/online-import.spec.ts`, `tests/helpers/cloud-browser-fixture.mjs` và hai ca batch trong `tests/cloud-api.test.mjs`. Script profiling tạm đã dọn; chỉ giữ một báo cáo này.

### Bàn giao và tình trạng triển khai

- Gói mã cập nhật GitHub: `releases/bao-an-learning-rc5-cap-nhat-github.zip`; chỉ chứa mã thay đổi, test và tài liệu liên quan, không phải ZIP kéo-thả static Netlify. Có hướng dẫn `docs/CAP_NHAT_NETLIFY_RC5.md`.
- Bản pilot cục bộ riêng: `releases/bao-an-learning-3.8.0-rc.5.zip`, build ID **4138fcf90326e3c0**, SHA-256 **03da6ab2072dde84347e0b05f769e39d019cd1644919c13325e11d63d68ac0cb**. RC4 giữ nguyên hash cũ. Không coi ZIP cục bộ là cách cập nhật Function cloud.
- Kho GitHub đã đối chiếu: `abcthuyduongan/hoctapgonto`, nhánh `feature/v37-premium-world`, HEAD vẫn `e6c51ebb36fd4f07f40f43c23c34f7698b8619e3`, trùng commit gốc local. Kết nối GitHub trả **pull:true / push:false**.
- **Chưa commit/push/deploy.** Cần quyền ghi đúng kho để đưa bản sửa lên nhánh Netlify đang build, hoặc người dùng cập nhật theo hướng dẫn. Cần triển khai đồng thời UI và Function để endpoint batch có hiệu lực; sau deploy phải đo lại trên website thật.

**Kết luận:** bản sửa và kiểm thử cục bộ PASS; mục tiêu áp dụng trên website đang sử dụng còn phụ thuộc triển khai. **NOT READY FOR FINAL LOCK đối với production/live-performance**. Không dùng số đo fixture để cam kết 140 câu hoặc 16 âm thanh sẽ đạt thời gian cụ thể trên Netlify thật.

## 14. Nhập chung, chọn tuần và chỉ giao câu hợp lệ · RC6 · 17/10/2026

Yêu cầu mới của người dùng thay quy tắc từ chối cả tuần trước đây: cần chỉ rõ câu lỗi, không tải câu đó lên, cho phép giao các câu đảm bảo; gộp nhập âm thanh/hình với tài liệu, chọn tuần không nhập tay, và có bộ mẫu đầy đủ. Không thay đáp án hoặc tự đoán nội dung của người soạn.

### T13 — Loại câu lỗi, giữ các bộ hợp lệ

- Thêm `inspectOnlineDocument`, giữ nguyên API strict `parseOnlineDocument` cho các nơi cần nhập toàn bộ. Báo cáo có tổng câu, số câu chấp nhận, vị trí dòng Excel/bảng Word, mã câu/nội dung và lý do bị loại.
- Câu sai trường/đáp án, thiếu tư liệu, ID/nội dung trùng, metadata không nhất quán hoặc bảng riêng bị hỏng được loại theo đúng vị trí. Giữ câu hợp lệ xuất hiện trước khi gặp bản trùng sau; không đổi đáp án hoặc coi chữ `null` là ô trống.
- Chỉ trả về bộ đã qua `validatePack`, còn 2–30 câu. Còn một câu được báo thiếu bạn cùng nhóm; bộ quá 30 câu bị loại kèm yêu cầu chia lại, không tự cắt. Tệp hỏng, sai schema/cột chung và nhiều tuần nguồn vẫn là lỗi toàn tệp. Nếu không có bộ hợp lệ, nút giao bị khóa.
- Giao bài chỉ gửi `preview.sets`, không có những câu trong danh sách lỗi. Hai store tiếp tục kiểm tra toàn bộ payload hợp lệ trước commit. Khi sửa tuần cũ, kiểm tra `onlineRevisionOrder` trên UI và server; mất cả nhóm sẽ khóa xác nhận, giữ dữ liệu tuần gốc.
- Tệp gốc người dùng: **140 câu → 84 câu hợp lệ trong 12 bộ, 56 câu bị loại**; parser inspector khoảng **43 ms** ở một lần đo Node. Ví dụ dòng 73 `fill-blank` có trường A=`null`; dòng 128 có trường `acceptedAnswers` không thuộc `quiz`. Giữ nguyên file Downloads.

### T14 — Chọn tuần và một đợt nhập tài liệu/tư liệu

- Danh sách **Tuần học** có Tuần 01–52. Không cần nhập tay tên tuần. Khi sửa tuần cũ, giữ tên tuần gốc, kể cả tên tùy chỉnh trước đây. Tuần được giao lấy từ lựa chọn trên UI; mã nguồn vẫn theo thông tin tài liệu/mã tường minh, để đổi lựa chọn không đổi nguồn thưởng.
- Một nút **Bộ câu hỏi, hình ảnh và âm thanh** nhận một Word/Excel và nhiều ảnh/âm thanh. Có thể chọn thêm tư liệu ở thư mục khác bằng cùng nút; chọn tài liệu mới thay đợt nhập. Chỉ tải tư liệu khi bấm **Kiểm tra & xem trước**, không tải ngay lúc chọn.
- Kiểm tra giải mã theo nhóm tối đa ba tệp, rồi tải theo lô như RC5. Bỏ qua tệp đã có cùng tên/hash. Lỗi giải mã, tên trùng khác hash hoặc tải thất bại được báo theo tệp; catalog dùng để kiểm tra loại tất cả tên thất bại, không gắn nhầm bản cũ. Các câu không phụ thuộc tệp lỗi vẫn xem trước/giao được.
- Mọi thay đổi tuần/tài liệu/tư liệu làm hết hiệu lực preview cũ. Chọn nhiều tài liệu hoặc tài liệu quá lớn xóa đợt chọn cũ và khóa kiểm tra để tránh nhập nhầm. Mã nguồn, phiên bản, nhãn môn dự phòng chuyển vào **Tùy chọn bộ câu hỏi**.

### T15 — Bộ mẫu đủ câu hỏi, hình và lời đọc

- Link **Tải bộ mẫu đầy đủ (.zip)** cạnh hai mẫu Word/Excel trắng. Ứng dụng nhận các tệp độc lập, chưa nhận ZIP làm đầu vào; phải giải nén rồi chọn XLSX + bốn tư liệu.
- ZIP gồm **1 XLSX, 2 PNG, 2 WAV lời đọc tiếng Anh thật và HUONG_DAN.txt**. Có 16 câu, hai câu mỗi dạng trong tám dạng; đáp án, hình, transcript và tên tệp khớp nhau. Nội dung tự biên soạn, hình hình học tạo mới, lời đọc offline Microsoft Zira. Không sử dụng hoặc chỉnh sửa học liệu riêng của người dùng.
- XLSX được tạo bằng runtime Spreadsheets, render và kiểm tra cả ba sheet, giữ đúng schema/headers. Xác minh riêng bằng Node thông thường trả mã 0: ZIP đủ sáu tệp, XLSX khớp bản rời, strict và partial đều nhận 16/16, 0 lỗi, mọi bộ có trò phù hợp. Runtime bảng tính trả mã 1 ở lúc teardown sau xuất/render thành công; không ép mã thoát hoặc bỏ qua assertion, đã kiểm chứng độc lập tệp lưu.
- File: `public/question-templates/bo-mau-day-du.zip` và `.xlsx`; builder và helper đọc tiếng ở `tools/`. Mẫu chỉ được giao sau khi giáo viên nhập/xác nhận, kho mới vẫn rỗng.

### Kiểm chứng và bàn giao

- TypeScript/build và syntax đạt; **218/218 test Node PASS**: 98 renderer, 9 release, 78 online, 33 cloud. Tám test mới phủ nhận một phần đủ tám dạng, trùng câu, thiếu media, `null`, không có câu đạt, bộ lẻ/quá cỡ, title và vị trí lỗi cấu trúc. Asset gate năm model đạt.
- Browser **36/36 PASS** trên Chrome/Edge: 20 ca quản lý/media/học sinh, 6 ca nhập liệu, 4 ca trò chơi và 6 ca routing. Phủ giao 139/140 câu, file âm thanh hỏng chỉ loại câu phụ thuộc, toàn câu sai khóa giao, mất nhóm khi cập nhật giữ tuần gốc, và tải/nhập bộ mẫu thật. Lượt đầu locator kiểm thử dropdown dùng nội dung label có cả option nên timeout; đổi sang combobox role và thêm aria-label rõ trên sản phẩm, chạy lại đạt.
- Phép thử chọn một DOCX + PNG + 16 WAV: một POST batch, không GET dashboard khi preview, 140 câu đóng có 0 biểu mẫu thử được dựng; Chrome khoảng 1.566 ms/Edge 1.543 ms cho toàn upload + preview trong fixture. Không suy rộng thành cam kết mạng production.
- Bộ mẫu ZIP cuối **170.020 byte**, SHA-256 **53d4d1b3224338c607dab32ed2f68c8e3ad3c301d60ed3c352d2e9b8cb5d8058**. Browser tải từ link thật, chọn XLSX + cả bốn media, xem 16/16 và tám bộ, giải mã ảnh/phát audio, giao đúng tuần đã chọn; fixture ghi đúng 16 câu. Đã xem ảnh chụp giao diện và sheet hướng dẫn.
- RC6 giữ schema SQLite 1 / PostgreSQL 1; không migration, không đụng dữ liệu thật, không sửa trần sao hoặc lịch sử. RC5 và các gói trước giữ nguyên. Hướng dẫn triển khai: `docs/CAP_NHAT_NETLIFY_RC6.md`.
- Gói pilot: `releases/bao-an-learning-3.8.0-rc.6.zip`, build ID **2bb9c2c7dbb008a8**, SHA-256 **8fe0a1da34c4b41fd6386864e52590cc3872b653cb8fde71e0847cce49cca393**; 62 tệp, 52 tài nguyên ứng dụng, `pilot:true`, `releaseReady:false`, `humanPilotStatus:UNVERIFIED`. Gói mã nguồn cập nhật GitHub: `releases/bao-an-learning-rc6-cap-nhat-github.zip`; gồm các thay đổi tích lũy và bộ mẫu, không có dữ liệu/biến bí mật.
- **Chưa commit/push/deploy lên Netlify**. Không lấy kết quả fixture thay nghiệm thu website và mạng thật.
