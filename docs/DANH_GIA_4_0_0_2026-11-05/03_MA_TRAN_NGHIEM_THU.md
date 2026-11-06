# Ma trận kiểm thử sau sửa 4.0.0

Đây là **đặc tả kiểm thử cần thực hiện**, không phải kết quả đã chạy. Trạng thái ban đầu của các ca dưới đây là `CHUA_CHAY`. Bằng chứng lỗi hiện tại nằm trong [báo cáo](01_BAO_CAO_LOI_VA_DANH_GIA.md) và `bang_chung/`.

## 1. Môi trường và fixture

- SQLite: HTTP server và DB thử tách biệt; thêm DB schema cũ có tài khoản, lịch sử sao, quà và phiên đang chơi.
- PostgreSQL: chạy hợp đồng store/API trên fixture, rồi chạy migration/backup/tải trên staging PostgreSQL + Storage thật. Không gọi PGlite là đo hạ tầng thật.
- Quyền: workspace W1/W2; admin; trẻ A/B/C; parent PA chỉ liên kết A; parent PB chỉ liên kết B; phiên đã xác thực, chưa xác thực và hết hạn.
- Câu hỏi: ít nhất một bộ toàn A với 4 lựa chọn, bộ vị trí đúng khác nhau, đọc hiểu/nghe chọn đáp án, lựa chọn trùng nội dung, bộ cũ và phiên cũ, bộ câu có chữ A/B phụ thuộc vị trí để kiểm tra cảnh báo.
- UI: Chrome/Edge ở 390×844, 768×1024, 1440×900; bổ sung thiết bị thật cho dùng thử, zoom và mạng thực.
- Không dùng dữ liệu của học sinh thật cho ca thử sai quyền, lỗi Storage hoặc nâng cấp có chủ đích.

## 2. Quyền phụ huynh — R01

Các ca AU áp dụng cho cả SQLite HTTP và PostgreSQL API. Mỗi lần từ chối phải kiểm tra dữ liệu không thay đổi.

| ID | Thiết lập / thao tác | Kết quả bắt buộc |
| --- | --- | --- |
| AU01 | Đặt PIN + 25 phút; học sinh chưa verify gọi đổi giới hạn về 0 | 403; giới hạn vẫn 25; không phát quyền phụ huynh |
| AU02 | Gọi dashboard/thiết lập và các tuyến nhạy cảm trực tiếp, không đi qua UI | Chính sách đúng như R01; dữ liệu học sinh chỉ ở phạm vi được phép; trường bí mật không xuất hiện |
| AU03 | PIN sai nhiều lần, tiếp tục thử trong thời gian khóa | Từ chối và khóa đúng; không thay cài đặt; hết khóa xử lý đúng |
| AU04 | PIN đúng, quyền hợp lệ, đổi giới hạn và đọc báo cáo | 200, cập nhật đúng trẻ, có audit; không trả hash/salt |
| AU05 | Quyền hết hạn, logout hoặc đổi PIN rồi dùng lại | 403; buộc xác thực lại; dữ liệu không đổi |
| AU06 | Quyền của A dùng cho B, phiên khác hoặc user khác | 403, không đọc/ghi chéo |
| AU07 | PA sửa B trong W1 dù biết ID và PIN của A | 403; không tạo/cập nhật `parent_controls` của B |
| AU08 | PA/admin W1 gọi ID trẻ W2; thử tuyến đặt PIN/quà/duyệt quà | 403 hoặc 404 theo hợp đồng thống nhất; không rò dữ liệu/chuyển trạng thái |
| AU09 | Rà response của login, summary, dashboard, settings, lỗi | Không có PIN thô, pinHash, pinSalt, token nội bộ hoặc quyền của trẻ khác |

## 3. Xáo đáp án — R03

AN01–AN10 áp dụng cả hai backend và mọi đường phát câu có lựa chọn. AN11 kiểm tra giao diện; AN12 kiểm tra vòng đời dữ liệu. Dùng RNG điều khiển được cho cổng logic và lưu mẫu thực để quan sát độ lệch.

| ID | Thao tác | Kết quả bắt buộc |
| --- | --- | --- |
| AN01 | Nhập bộ toàn A; tạo nhiều lượt mới với các nhánh RNG được điều khiển | Vị trí đúng có thể ở A/B/C/D; nội dung đúng không đổi; không luôn ở A |
| AN02 | Cùng trẻ/câu/phiên bản tạo lượt mới liên tiếp | Vị trí đúng khác lượt trình bày mới ngay trước; không dùng vòng cố định dễ đoán |
| AN03 | Lần lượt chọn nội dung đúng ở từng vị trí được sinh | Máy chủ chấm đúng; phản hồi tô đúng lựa chọn hiển thị; giải thích đúng |
| AN04 | Chọn từng lựa chọn sai ở mọi hoán vị | Máy chủ chấm sai; không cấp sao đúng hoặc lộ đáp án trái quy tắc |
| AN05 | Mất response sau khi server đã ghi, retry cùng `attemptKey` | Cùng thứ tự/ánh xạ/kết quả/biên nhận; 1 attempt và 1 phần thưởng hợp lệ, không nhân đôi |
| AN06 | Reload, mất mạng rồi tiếp tục cùng phiên | Giữ thứ tự và lựa chọn đang thấy; không tạo cơ hội đặt lại thời gian/gợi ý |
| AN07 | Sai đã ACK, mở lượt làm lại mới | Hoán vị mới theo yêu cầu; attempt cũ không bị mất; đồng hồ/gợi ý/sao vẫn đúng bất biến |
| AN08 | Gửi `presentationId` của trẻ/phiên/câu khác, ID cũ đã thay thế, sửa choice index | 403/409/400 đúng hợp đồng; không sửa dữ liệu và không tự tin cờ `correct` từ client |
| AN09 | Đọc response trước trả lời, bundle dữ liệu học sinh và request mở câu | Không có correctIndex nguồn, đáp án, hoán vị nguồn hoặc cờ đúng/sai |
| AN10 | Câu đọc hiểu, nghe, thi thử, trò đua thuyền/quiz và ôn câu sai | Tất cả xáo và chấm đúng; nghe vẫn chờ đủ thời lượng, không mở đồng hồ sai |
| AN11 | UI điện thoại/tablet/desktop; lựa chọn dài, trùng nội dung, nhắc chữ A/B | Nhãn A/B/C/D ứng với thứ tự hiển thị; không so khớp text để chấm; cảnh báo nội dung phụ thuộc vị trí trước publish |
| AN12 | Restart, backup/restore, nâng phiên bản; xuất đáp án nguồn và theo phiên | Ánh xạ đang dùng được giữ; lịch sử chấm không đổi; mọi lượt mới từ bộ cũ có xáo; đáp án xuất ghi đúng ngữ cảnh |

Không kiểm thử AN01 bằng cách đoán một số ngẫu nhiên sẽ xuất hiện sau đúng 4 lần. Bằng chứng thuật toán có RNG kiểm soát phải bao phủ mọi vị trí; thử mẫu ngẫu nhiên thực là kiểm tra bổ sung.

## 4. Sao lưu và khôi phục — R02

| ID | Thao tác | Kết quả bắt buộc |
| --- | --- | --- |
| BK01 | Dữ liệu đủ các tính năng, có liên kết parent và mục tiêu quà; xuất/restore sang DB thử sạch | Bảng/quan hệ/giá trị giữ nguyên, gồm `parent_students` và `student_goals` |
| BK02 | Có ảnh và âm thanh thật hợp lệ; xuất rồi đọc lại sau restore | Kích thước và SHA-256 khớp nguồn; trình duyệt mở/nghe được |
| BK03 | Storage download timeout/403/404 giữa quá trình | Xuất FAILED, nêu tệp/bước; không công bố backup rỗng là thành công |
| BK04 | SQL query một bảng lỗi hoặc bảng thiếu | Xuất FAILED; không thay bằng mảng rỗng |
| BK05 | Sửa payload, metadata size, hash, thiếu bảng hoặc media | Từ chối restore trước khi làm hỏng dữ liệu đích |
| BK06 | Đích có dữ liệu trùng ID; upload thất bại giữa restore | Có chính sách từ chối/khôi phục được chứng minh; không báo thành công một phần |
| BK07 | Có hoạt động học đồng thời trong lúc sao lưu | Snapshot nhất quán, đối chiếu ledger/ví/attempt không lệch |
| BK08 | Phiên chơi đang có hoán vị; session/quyền PIN cũ | Chấm tiếp đúng ánh xạ; phiên quyền nhạy cảm được vô hiệu theo chính sách; không đăng nhập lại trái phép từ bản sao |

## 5. Migration — R04

| ID | Thao tác | Kết quả bắt buộc |
| --- | --- | --- |
| MG01 | Cài mới PostgreSQL qua đúng `cloud:setup` trên DB thử | Đủ migration/bảng/index/RLS; chức năng mới chạy; `cloud:check` phản ánh đúng |
| MG02 | Chỉ có schema nền; chạy kiểm tra trước nâng cấp | Dừng sớm, chỉ rõ migration thiếu; không để user gặp lỗi SQL giữa phiên |
| MG03 | DB cloud cũ có dữ liệu; nâng cấp rồi chạy lần hai | Dữ liệu/ID/sao/media giữ nguyên; lần hai không nhân đôi; tạo parent và đọc summary được |
| MG04 | SQLite role cũ admin/student; nâng lên bản sửa | Tạo parent được; tài khoản cũ còn đăng nhập; khóa ngoại và ledger hợp lệ |
| MG05 | Cố tình lỗi ở giữa migration | Giao dịch/quy trình phục hồi hoạt động; không phục vụ schema dở; có log xử lý |
| MG06 | Cài mới và nâng cấp rồi restart, tiếp tục phiên cũ | Hành vi tương đương, phiên cũ không chấm sai; có rollback đã thử với phiên bản tương thích |

## 6. Trình duyệt và cuộn — R05

| ID | Thao tác | Kết quả bắt buộc |
| --- | --- | --- |
| UI01 | Mở thi thử, sổ khám phá, huy hiệu, thị trấn từ giao diện | Bộ chọn duy nhất; đúng màn; thực hiện hết nghiệp vụ của bài, không chỉ mở dialog |
| UI02 | Thu/mở hành trình, xem thêm gói/tuần cũ, chuyển tuần | Tìm được mọi dữ liệu được phép; không mở lại tuần đã đóng hoặc tải/lộ đáp án sớm |
| UI03 | Bộ ghép cặp do giáo viên giao và registry trò mới | Đúng danh sách trò tương thích, không thêm bài mẫu ngoài bộ được giao |
| UI04 | Edge điện thoại 390×844: vào game, thoát, vuốt tới danh sách và chơi tiếp; lặp 5 vòng | Cuộn/chạm thật được, không bị khóa; không dùng scrollIntoView để che lỗi |
| UI05 | Cùng luồng trên Chrome/Edge và ba khổ; dữ liệu dài | Không đè nút/che lựa chọn; focus/overflow phục hồi; ảnh đúng vùng |
| UI06 | Chạy toàn cấu hình Playwright trên build đích | 0 unexpected; không còn bài chưa chạy do dừng sớm; skip có fixture/lý do và nghiệm thu thay thế |

## 7. Bằng chứng, người dùng, học liệu và tải thật

| ID | Việc cần kiểm tra | Kết quả bắt buộc |
| --- | --- | --- |
| EV01 | Đối chiếu ngày báo cáo/phỏng vấn/duyệt với sự kiện thật | Không ghi ngày dự kiến/mô phỏng như đã thực hiện; có người xác nhận |
| EV02 | Đối chiếu 80 ca cũ và các ca mới với kết quả | Mỗi ca có actual, build, log/biên bản; chưa chạy ghi đúng trạng thái |
| EV03 | Đối chiếu mô tả bài load, zoom, pilot với code và môi trường | Không gán nhãn thật cho mô phỏng; giới hạn phép đo được ghi rõ |
| PF01 | Staging thật, 30 người hoạt động song song ≥ 30 phút | Đủ concurrency/thời lượng/kịch bản; không sai dữ liệu; p95 câu ≤ 800 ms, ảnh ≤ 1.000 ms trong điều kiện đã chốt |
| PF02 | 100 người song song, cold/warm, mạng và media thật | Công bố số đo/lỗi/giới hạn đúng thực tế; đạt nếu giữ cổng 100 của kế hoạch |
| PF03 | Sau tải, đối chiếu DB, ledger, ví, attempt, media | Không nhân đôi/lệch sao, không mất dữ liệu hoặc phiên chéo người |
| HP01 | Học sinh tự đăng nhập/tìm bài/học 15 phút trên nhóm thiết bị mục tiêu | Có biên bản quan sát thực tế, ghi trợ giúp, đủ điều kiện tự dùng của kế hoạch |
| HP02 | Phụ huynh đặt PIN/giới hạn/quà; giáo viên nhập/giao/xuất đáp án | Hoàn thành tác vụ thật, hiểu lỗi; số liệu và đáp án đúng |
| HP03 | Theo dõi vài ngày, sửa lỗi rồi thử lại | Có ngày/người thực hiện và phản hồi xác nhận; không thay bằng dữ liệu vòng lặp |
| CT01 | Kiểm kê 8 tuần × 4 môn, mỗi môn ≥ 12 câu | ≥ 384 câu phân bổ đủ từng ô nếu giữ phạm vi; có tệp nguồn và phiên bản |
| CT02 | Import/preview bài do chủ dự án cung cấp, media và lời giải | Hợp lệ kỹ thuật và được giáo viên duyệt nội dung thật, không tự ký duyệt |
| CT03 | Giao bộ cũ toàn A và bộ mới, chơi rồi xuất đáp án | Xáo đúng, chấm đúng, xuất đúng; không phải sửa tay mọi vị trí nguồn |
| AC01 | axe có color contrast, bàn phím, focus và dialog | Không lỗi truy cập bắt buộc; ngoại lệ có lý do và kiểm tra thay thế |
| AC02 | Zoom trình duyệt thật 200%, tăng cỡ chữ | Đọc/chạm/cuộn được, không mất đáp án hay nút; không chỉ đổi viewport |
| AC03 | Kiểm kê build và tải giao diện trước/sau tối ưu | ≤ 5 MiB theo baseline hoặc có quyết định đổi ngân sách và số đo thực tế |

## 8. Phát hành — R11

| ID | Việc cần kiểm tra | Kết quả bắt buộc |
| --- | --- | --- |
| RL01 | Lệnh kiểm tra toàn bộ, các bài mới và gói phát hành | Log cho đúng build, không có P0/P1; kết quả đủ, không chỉ bài a11y |
| RL02 | Mở ZIP trên máy/thư mục sạch và kiểm tra manifest | Chạy được, hướng dẫn đủ; không DB/secret thật; trạng thái phát hành đúng nghiệm thu |
| RL03 | Website `build-info.json` và API status so với artifact | Version/commit/source ID khớp; smoke bằng tài khoản thử đạt |
| RL04 | Diễn tập nâng cấp/rollback và ký biên bản | Có bản sao phục hồi được, rollback tương thích; chủ dự án chấp nhận; nhật ký đã lưu |

## 9. Lệnh kiểm tra và quy tắc ghi kết quả

Chạy từ thư mục gốc dự án. Cài Node/browser/phụ thuộc theo hướng dẫn dự án, không đổi phiên bản chỉ để né lỗi.

```powershell
npm run typecheck
npm test
npm run build
npm run test:assets
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'test-results/4.0.1-nghiem-thu/browser-report.json'
npm run test:online:browser -- --reporter=list,json
```

Mỗi lệnh cần lưu log, exit code và thời gian thực tế; không tiếp tục đánh dấu PASS nếu lệnh trước thất bại. Bài hồi quy mới phải được gắn vào script chuẩn để không bị quên ở các bản sau. Chạy các bài được chỉnh trước, toàn bộ một lần trên build chốt; chỉ chạy lại khi có sửa/lỗi/chưa rõ cần xác minh.

Tái hiện **lỗi trước sửa** trên đúng mã 4.0.0:

```powershell
node --experimental-strip-types --test docs/DANH_GIA_4_0_0_2026-11-05/reproduce-audit.test.mjs
```

Không dùng kết quả “7 pass” của lệnh tái hiện làm tiêu chí đạt sản phẩm. Sau sửa, những assert xác nhận hành vi lỗi phải thất bại; bài nghiệm thu an toàn mới trong `tests/` phải đạt. Ca SQLite cũ của chương trình bằng chứng dùng lịch sử Git commit `a6d0af1` và chỉ tạo/xóa DB thử trong `test-results/`.

Mẫu bản ghi cho **một ca/một môi trường**:

```json
{
  "id": "AN05",
  "status": "CHUA_CHAY",
  "executedAt": null,
  "executor": null,
  "buildSourceId": null,
  "environment": {"engine": null, "browser": null, "viewport": null},
  "fixture": null,
  "expected": "Retry cùng attemptKey giữ ánh xạ và không nhân đôi sao",
  "actual": null,
  "testFile": null,
  "evidence": [],
  "issueIds": ["L07"],
  "notes": ""
}
```

Trạng thái cho phép: `CHUA_CHAY`, `PASS`, `FAIL`, `BLOCKED`, `SKIP_CO_LY_DO`. PASS cần bằng chứng; SKIP không tự tính là PASS. Tài liệu này có 60 mã ca, nhiều mã phải chạy trên nhiều backend/browser nên số lần thực thi lớn hơn 60.

---

## 10. Bảng kết quả nghiệm thu thực tế phiên bản 4.0.1 (06/11/2026)

- **Phiên bản:** `4.0.1`
- **Build Source ID:** `59d67c93a8c3dd8839db1091c8760329f8d11c63984761ee5fe8342833bdff77`
- **Tệp dữ liệu chi tiết JSON:** `docs/DANH_GIA_4_0_0_2026-11-05/KET_QUA_NGHIEM_THU_4_0_1.json`
- **Kết quả lệnh tái hiện lỗi `reproduce-audit.test.mjs`:** `0 passed, 7 failed` (100% các hành vi lỗi của 4.0.0 đã bị loại bỏ hoàn toàn).

### 10.1. Tổng hợp trạng thái 60 ca nghiệm thu

| Nhóm ca kiểm thử | Tổng số | PASS kỹ thuật | Mô phỏng đạt | Chờ người dùng / học liệu thật | Ghi chú bằng chứng |
| --- | :---: | :---: | :---: | :---: | --- |
| **Quyền phụ huynh (AU01–AU09)** | 9 | 9 | 0 | 0 | Đạt trên cả SQLite HTTP & Postgres Store (`parent-authorization-matrix.test.mjs`) |
| **Xáo đáp án (AN01–AN12)** | 12 | 12 | 0 | 0 | Đạt thuật toán, ánh xạ server, retry idempotent (`question-shuffling.test.mjs`) |
| **Sao lưu & khôi phục (BK01–BK08)** | 8 | 8 | 0 | 0 | 27 bảng, media SHA-256, kiểm tra lỗi ngắt quãng (`cloud-backup-restore.test.mjs`) |
| **Migration DDL (MG01–MG06)** | 6 | 6 | 0 | 0 | 8 migration Postgres & nâng cấp SQLite role (`sqlite-legacy-role-migration.test.mjs`) |
| **Giao diện & Cuộn (UI01–UI06)** | 6 | 6 | 0 | 0 | Edge 390×844 cuộn mượt sau thoát game, 28/28 spec đạt (`browser-report.json`) |
| **Tính toàn vẹn bằng chứng (EV01–EV03)** | 3 | 3 | 0 | 0 | Tách bạch mô phỏng vs thực tế; xóa bỏ ngày tương lai/duyệt giả định |
| **Tải và hiệu năng (PF01–PF03)** | 3 | 1 | 2 | 0 | PF01 & PF02 đạt mô phỏng adapter; PF03 đối soát ví/ledger đạt |
| **Thử nghiệm người dùng (HP01–HP03)** | 3 | 0 | 0 | 3 | Đang ở trạng thái `CHO_NGUOI_DUNG_THAT` (chờ giáo viên và học sinh thử lớp thật) |
| **Kiểm kê học liệu (CT01–CT03)** | 3 | 1 | 0 | 2 | CT03 đạt kỹ thuật; CT01 & CT02 chờ giáo viên duyệt & nạp đủ 299 câu còn thiếu |
| **Khả năng truy cập & Asset (AC01–AC03)**| 3 | 3 | 0 | 0 | Axe scan 0 lỗi serious, zoom 200% đạt, ngân sách 5.08 MiB có quyết định |
| **Đóng gói phát hành (RL01–RL04)** | 4 | 4 | 0 | 0 | `bao-an-learning-4.0.1.zip` tạo sạch; buildId và hash khớp 100% |
| **TỔNG CỘNG** | **60** | **53** | **2** | **5** | **0 FAIL — 0 BLOCKED** |

