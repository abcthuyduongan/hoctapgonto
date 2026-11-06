# Kế hoạch cải tiến sau kiểm toán lần 2 — 06/11/2026

## 1. Phạm vi

Baseline cần sửa: **4.0.1**, source ID `5d9b56a43e18706af1f541af5ef12477c679a8d2fa0c0b1e667f45f1b48261a8`. Chưa triển khai mã sửa trong đợt kiểm toán này. Các đề xuất dưới đây để chủ dự án giao thực hiện và nghiệm thu bằng bằng chứng.

Giữ các sửa đã tốt: timeout dùng đáp án mới, preview không bị refresh nền xóa, luồng ôn sai mở được game, khóa PIN đồng bộ, map/town đã cải thiện truy cập. Giữ bản đồ và nhân vật nhẹ hiện có. Nội dung học liệu do chủ dự án/giáo viên cung cấp; không tự ký duyệt hoặc thêm danh mục kỹ năng.

Không sửa bằng cách đổi nhãn báo cáo thành PASS, tăng ngưỡng, bỏ assert/skip bài hoặc chỉ làm cho một ca cũ hết lỗi. Mỗi thay đổi phải có ca dương tính, âm tính, dữ liệu cũ và hai backend khi chạm server.

## 2. Mười cải tiến ưu tiên

| # | Công việc | Lý do/tác động | Tệp chính | Cổng đóng |
| --- | --- | --- | --- | --- |
| 1 | DTO session công khai theo allowlist | N01 P0: chỉ số đúng/hoán vị đang lộ cho học sinh trước câu trả lời | `question-protocol.mjs`, `student-summary.mjs`, mọi tuyến trả session, public types | R201–R203 |
| 2 | Restore có staging, điểm commit và compensation | N02 P0: Storage bị ghi đè dù SQL rollback | `cloud-backup-restore.mjs`, Storage adapter, công cụ vận hành | R204–R207 |
| 3 | Autosave version/revision thật | N06: sửa cùng câu vẫn bị request cũ ghi đè | hai store, `ContestMockScreen`, client/contracts | R208–R210 |
| 4 | Quyền sở hữu gói ôn | N05: tiền tố review không được phép thay ACL | hai store, review schema, start/open/media/answer/finish | R211–R213 |
| 5 | Hợp đồng lượt câu hoàn chỉnh và lịch sử đúng khóa | N07: ID optional, game chưa đồng bộ, dấu chấm làm lookup mất vị trí | question protocol, hai store, contracts/client, mọi game/runner | R214–R218 |
| 6 | Migration SQLite có transaction và phục hồi mọi bước | N08: sau DROP trước RENAME có thể mất tài khoản ở bảng đang dùng | `online-store.mjs`, migration helper, recovery tests | R219–R220 |
| 7 | Snapshot backup và inventory media đầy đủ | N03/N04: snapshot rách user/student, thiếu bytes vẫn valid | `cloud-backup-restore.mjs`, manifest/preview/restore verifier | R221–R223 |
| 8 | Đồng bộ E2E với semantics/hành vi mới, mở rộng negative cases | N09: nhóm test con đạt không đóng fullsuite; caller theo tên cũ chưa tới nghiệp vụ | visual specs, shared locators, evidence checker, CI | R224–R226 |
| 9 | Tách CSS game, tối ưu shell và layout | N10: đường tải lớn/CLS chưa được xử lý trong bộ sửa hiện tại | `game-base.css`, game entry styles, `OnlineScreen`, ảnh nền/card | R227–R229 |
| 10 | Công cụ tải/phát hành có số đo và artifact đúng | N11/N12: runner lỗi vẫn tốt, ZIP/website chưa là build mới | staging runner, package/deploy, ma trận/người dùng/học liệu | R230–R232 |

## 3. Giai đoạn 1 — Bảo mật, toàn vẹn và tính đúng

**Việc:** 1–7. **Độ khó:** trung bình đến cao. **Dự toán:** 8–14 ngày công, cần chốt hợp đồng trước khi chia việc. Không phải cam kết tự động hoàn thành theo ngày lịch.

### 3.1. Đóng đường rò đáp án N01

1. Chốt type DTO công khai; session nội bộ và session gửi UI là hai kiểu riêng.
2. Serializer chỉ tạo các trường cần thiết cho UI. Không giữ `...session` rồi xóa vài trường; loại cả bản đồ mới/lịch sử hoán vị/answer key.
3. Rà start/reopen/resume/summary/journey/complete/error/legacy. Bảo toàn dữ liệu nội bộ để chấm/restore, không xóa khỏi DB chỉ để tránh leak.
4. Fixture đặt thêm trường nội bộ giả để chứng minh serializer không tự đưa trường mới ra ngoài.
5. Gắn ca HTTP bảo mật vào script chuẩn cho cả SQLite/PostgreSQL, không chỉ test `questionView`.

**Rủi ro:** client đang vô tình phụ thuộc trường nội bộ, mất state khi resume. **Đạt khi:** mọi đường trước phản hồi được phép không lộ đáp án; chọn đúng/chấm/sao/retry vẫn hoạt động.

### 3.2. Restore và backup

1. Khai báo manifest versioned, đủ bảng và media; validate đầy đủ schema/quan hệ trước mọi ghi.
2. Export trên một kết nối/snapshot nhất quán, ví dụ transaction đọc với isolation phù hợp PostgreSQL; một BEGIN mặc định READ COMMITTED chưa tự bảo đảm các SELECT thấy cùng snapshot.
3. Media staging theo restore job, đường dẫn chưa được sử dụng bởi dữ liệu đang hoạt động; verify upload/readback.
4. Chốt SQL trỏ sang bộ media đã chuẩn bị; có phương án cho lỗi trước/sau commit và restart. Cleanup chỉ xóa object thuộc job và không còn tham chiếu.
5. Snapshot/backup đích, khóa job và trạng thái; người vận hành biết FAILED/PENDING/SUCCESS thực tế. Không hardcode hash/balance match hoặc RPO bằng 0 khi chưa đối soát.
6. Inventory media đối chiếu một-một với rows: missing/duplicate/path/hash/size đều được xử lý. So sánh giá trị/quan hệ/invariant, không chỉ số dòng awards.
7. Cung cấp đường vận hành cloud có quyền, preview và chọn đúng đích; diễn tập staging. Không thử lỗi cưỡng bức trên production.

**Rủi ro:** SQL và Storage khác transaction, tệp mồ côi, backup cũ, job bị ngắt. **Đạt khi:** fault injection mọi bước không làm lệch DB/media đang dùng; backup khi có ghi đồng thời vẫn phục hồi được.

### 3.3. Autosave thi thử và review ACL

1. Revision/sequence phải được lưu và kiểm tra nguyên tử tại máy chủ; client gửi theo hợp đồng. Chọn chính sách nhiều tab rõ ràng; một số tăng trong từng tab không đủ phân xử mọi thiết bị.
2. Cập nhật đáp án theo câu hoặc serialize/coalesce với ACK; request cũ không thắng bản mới. Không nuốt lỗi save.
3. Nộp/hết giờ dùng trạng thái đã chốt, xử lý pending/deadline/idempotency; giữ fix answersRef đã có.
4. Gói ôn có record owner/workspace/source contest/version; không phân quyền bằng `startsWith('review-')`.
5. Mọi API gói ôn cùng kiểm tra quyền và thời hạn. Định nghĩa rõ sao khi ôn để cùng nội dung không thành nhiều nguồn thưởng độc lập.

**Rủi ro:** lost update, nộp hai lần, gói ôn cũ, media quyền riêng. **Đạt khi:** sửa cùng câu và đảo request không mất bài; B không mở được gói A; A vẫn ôn được và sao đúng.

### 3.4. Lượt câu và migration

1. Bắt buộc presentationId theo hợp đồng phiên mới, cập nhật mọi game/runner/đọc/nghe/thi thử; không chỉ MathQuest.
2. Stale ID được từ chối nhưng UI phải có cách mở đúng lượt và tiếp tục. Retry cùng attempt mạng giữ nguyên ID/hoán vị/receipt.
3. Khi sai đã ACK rồi mở lượt làm lại mới, xáo lại theo yêu cầu; giữ đồng hồ/gợi ý/lịch sử để không tăng sao trái quy tắc.
4. Lịch sử dùng khóa workspace/student/pack/version/item bền, index và transaction. Nếu dùng JSON thì key phải literal, kiểm thử các ID có dấu chấm; không nuốt lỗi truy vấn thành null như chưa có lịch sử.
5. Migration SQLite có version, backup, transaction, kiểm tra bảng users/bảng tạm ở mọi trạng thái; sau DROP trước RENAME không được tạo users rỗng rồi coi như chưa khởi tạo.
6. Diễn tập gián đoạn mỗi bước và FK check, cài mới/nâng cấp/chạy lại; không chỉ kiểm tra một điểm sau CREATE.

**Rủi ro:** phiên cũ, chấm nhầm chỉ số, FK users, đồng hồ/sao. **Đạt khi:** toàn bộ R214–R220 và hồi quy scoring/media/advance/ledger đạt cả hai backend phù hợp.

## 4. Giai đoạn 2 — Hiệu năng tải và dữ liệu

**Việc:** 9 và công cụ đo ở 10. **Độ khó:** trung bình; **dự toán:** 2–4 ngày công sau khi tính đúng ổn định.

1. Dùng baseline lần 2 trong báo cáo 04, cùng profile/fixture và ba mẫu mỗi kịch bản để so trước/sau.
2. Tách CSS dùng chung nhỏ và CSS riêng từng game; coverage ở một quiz không cho phép xóa phần dùng ở game khác. Chạy ảnh hồi quy mọi game/trạng thái hint/result.
3. Giảm đường tải tranh nền theo viewport, giới hạn prefetch, ưu tiên câu/ảnh đang học. Tái sử dụng bộ ảnh hiện có và giữ độ rõ.
4. Phase khôi phục phiên dùng shell kết nối nhẹ, tránh ảnh đăng nhập eager khi không vào login/setup. Ghi layout-shift attribution, giữ chỗ cho ảnh/skeleton và styles cần sớm.
5. Giữ phân trang/batch balance quản trị hiện có. Đo PostgreSQL thật/EXPLAIN/index/queue trước khi thay pool hoặc thêm cache. Cache cần quyền, phiên bản/TTL và invalidation rõ.
6. Sửa staging runner: login/cookie/CSRF, endpoint mở câu/media/attempt thật, đọc body và phân loại HTTP/nghiệp vụ. Lỗi phải tính vào counter và exit failure, có đối soát ledger.

**Mục tiêu:** LCP lab tiến tới ≤2,5 s, CLS ≤0,1 ở profile đã chốt; INP field ≤200 ms chỉ kết luận khi có dữ liệu phù hợp. Cổng câu/ảnh p95 phải đo hạ tầng thật. Không hứa phần trăm tăng tốc trước khi có bản sửa và phép đo.

**Rủi ro:** CSS cascade, cache sai quyền, prefetch tranh băng thông, số đo khác profile. **Đạt khi:** R227–R229, rồi tải staging 30 người ít nhất 30 phút; 100 người nếu vẫn giữ tiêu chí kế hoạch.

## 5. Giai đoạn 3 — Giao diện và thao tác thống nhất

**Việc:** giữ và mở rộng kết quả truy cập tốt, cải thiện tác vụ thực tế. **Dự toán:** 1–3 ngày công và buổi thử người dùng.

- Chuẩn hóa role/name và shared locators; đổi nhãn phải cập nhật caller/test. Không thêm `.first()` để hết strict mode.
- Giáo viên giữ lớp, nguồn và preview; trạng thái “chưa publish/đang kiểm tra/đã giao” rõ. Đổi class/source phải reset hoặc kiểm tra lại đúng ngữ cảnh.
- Học sinh có CTA học tiếp rõ; gom thao tác phụ vừa phải; trạng thái đang lưu/đã lưu/lỗi và xử lý 409 nhất quán.
- Parent đúng con/quyền, lỗi hết hạn và lockout rõ; giữ cải thiện PIN đã chứng minh.
- Axe trên nội dung đã tải hoàn chỉnh và đủ dữ liệu, bật contrast; kiểm tra form/admin/parent/contest/game, không chỉ map/town.
- Mobile/tablet/desktop, bàn phím và zoom trình duyệt thật 200%/tăng font. Thử với giáo viên/học sinh/phụ huynh thật; ghi trợ giúp và lỗi quan sát.

**Rủi ro:** style dùng chung, focus, mất draft hoặc giữ draft quá hạn. **Đạt khi:** tác vụ thực hiện được, ảnh hồi quy và biên bản có nguồn, không thay bằng mô phỏng.

## 6. Giai đoạn 4 — Nghiệm thu và phát hành

**Việc:** 8 và phần phát hành 10. **Dự toán:** 1–2 ngày công kỹ thuật, chưa gồm học liệu/thử tải/người dùng thật.

1. Sửa đúng selector/kỳ vọng cũ trong nhóm E2E, giữ assert nghiệp vụ phía sau; không xóa bài hỏng. Chạy nhóm mục tiêu rồi full Chrome/Edge cho build chốt.
2. Gắn các ca mới R201–R232 vào test chuẩn và kiểm tra evidence tự động: đường tồn tại, đúng build/môi trường/actual, chưa chạy không đổi thành PASS.
3. Đủ 350 Node checks hiện có chưa thay cho negative cases mới; bảo toàn các đường đã sửa bằng control test riêng.
4. Chốt mã bằng commit/source ID, kiểm kê câu hỏi theo phạm vi thực tế và người duyệt thật. Bộ hiện có ít hơn tiêu chí 384 câu nếu giữ bốn môn; chủ dự án cung cấp nội dung.
5. Gói 4.0.1 đang có mang source ID cũ. Sau khi đủ cổng, dùng phiên bản mới thích hợp, đề xuất **4.0.2**, đóng gói immutable; không ghi đè artifact cũ để giữ cùng tên phiên bản.
6. Diễn tập migration/backup/rollback trên staging; triển khai theo quyền chủ dự án giao; website/ZIP/API status cùng identity; smoke đủ học/PIN/quà/thi/ôn.
7. Giữ trạng thái pilot/unverified khi thiếu nghiệm thu thật. Không gọi “không còn rủi ro”; ghi rủi ro còn lại và cách theo dõi.

## 7. Ma trận kiểm thử bổ sung

Đây là đặc tả **sau sửa**, trạng thái ban đầu `CHUA_CHAY`. Reproduction lần 2 là bằng chứng lỗi baseline, không phải các ca dưới đây đã đạt.

| ID | Ca bắt buộc | Kết quả mong đợi |
| --- | --- | --- |
| R201 | Mở câu rồi đọc summary/reopen/resume trên hai API | Không có displayedCorrectIndex/permutation/private maps trước phản hồi được phép |
| R202 | Thêm trường bí mật giả vào session nội bộ | DTO allowlist không tự đưa trường mới ra client |
| R203 | Nhiều dạng câu/game, retry/complete/error/legacy | Không leak; chấm/sao/clock/gợi ý đúng |
| R204 | Storage lỗi trước khi chốt dữ liệu | Đích cũ không thay đổi hoặc được rollback đúng |
| R205 | SQL lỗi sau chuẩn bị media | Không ghi đè object đang dùng; DB/media cũ khớp |
| R206 | Restart quanh từng bước commit/cleanup | Job phục hồi/rollback có trạng thái đúng, không mồ côi/mất tệp đang dùng |
| R207 | Restore vào đích mới hơn/trùng ID, readback | Manifest/count/value/hash thực khớp; xung đột không bị silently bỏ qua |
| R208 | Autosave cùng câu A→B→C, đảo request | Bản mới nhất thắng theo revision hợp lệ |
| R209 | Hai tab, reconnect, request thất bại | Không mất cập nhật, UI báo chưa lưu và retry đúng |
| R210 | Pending save tại deadline/nộp tay/timeout cùng lúc | Chốt đúng một kết quả, không xóa bài đã ACK hoặc nhận thay đổi trái deadline |
| R211 | A mở review của A | Tạo/mở đúng gói/phiên học, media và đáp án đúng |
| R212 | B cùng/khác lớp hoặc workspace biết ID review A | 403/404, không tạo play/award hoặc đọc câu/media |
| R213 | Pack giáo viên có prefix review, review cũ/hết hạn | Prefix không cấp quyền, không bypass tuần/sao |
| R214 | Thiếu/stale/cross-session presentationId | Bị từ chối theo contract mới; UI đồng bộ và tiếp tục được |
| R215 | Tất cả game/đọc/nghe chọn đáp án | ID truyền xuyên suốt, đúng mọi hoán vị và feedback |
| R216 | Sai rồi gọi lượt mới và retry mất ACK | Lượt mới đổi vị trí; retry cùng lượt giữ nguyên, không nhân sao/reset clock |
| R217 | ID q1/t19.m.01/dấu gạch/dấu hai chấm hợp lệ | Lịch sử tìm đúng literal key, không trả null vì lỗi query |
| R218 | Khác pack/version, >5 lượt xen kẽ, restart/multi-instance | Không trộn lịch sử, giữ anti-repeat nguyên tử |
| R219 | Ngắt migration sau CREATE/copy/DROP/RENAME | Giữ/khôi phục users và FK, không nhận nhầm chưa khởi tạo |
| R220 | Cài mới/nâng cấp/lặp hai lần với dữ liệu cũ | ID/tài khoản/sao/phiên/quan hệ nguyên vẹn |
| R221 | Export trong lúc tạo user/student và play/attempt/award | Snapshot nhất quán, restore FK/invariant đạt |
| R222 | Thiếu/thừa/trùng mediaAssets so với media rows | Preview từ chối trước mọi ghi |
| R223 | Hash/size/path sai, uploader thiếu hoặc readback sai | FAILED rõ, không hardcode match/thành công |
| R224 | Tên nút mới và preview giữ bản nháp | E2E đi hết nghiệp vụ, không kẹt tại locator/expect cũ |
| R225 | Fullsuite hai browser trên build chốt | Không unexpected, skip có lý do, không dùng nhóm con thay toàn bộ |
| R226 | Axe đủ dữ liệu, wait map/town thật, contrast bật | Quét đúng nội dung; zoom thật thử riêng |
| R227 | Cold/warm/login/restore/chuyển màn, ba mẫu/profile | Có raw data, điều kiện giống, so trước/sau được |
| R228 | Tách CSS/tối ưu tranh, ảnh hồi quy mọi game | Byte/thời gian giảm mà không mất kiểu/trạng thái |
| R229 | Shell kết nối/layout shifts/keyboard/zoom | CLS giảm, tác vụ đọc/chạm/cuộn hoàn chỉnh |
| R230 | Runner inject 401/404/500/timeout/body lỗi | Counter/exit báo lỗi thật; luồng thành công phải học/submit thật |
| R231 | Staging 30/100 người theo phạm vi đã chốt | Concurrency/thời lượng/media/ACK/ledger có bằng chứng, p95 không từ mock |
| R232 | ZIP/website/source ID và diễn tập + người duyệt | Artifact mới khớp, backup/rollback dùng được, giới hạn công bố đúng |

Mỗi ca cần engine/browser/viewport, fixture, expected/actual, thời điểm, source ID, test file và evidence. Tổng công kỹ thuật ước tính **12–23 ngày công**, phụ thuộc thiết kế restore và giao thức phiên; dùng thử/học liệu/tải thật cần lịch riêng. Chỉ chốt lịch khi biết người thực hiện và môi trường staging.
