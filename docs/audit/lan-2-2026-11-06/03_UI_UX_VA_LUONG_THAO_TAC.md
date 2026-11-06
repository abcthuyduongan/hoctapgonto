# UI/UX và thao tác — kiểm toán lần 2, 06/11/2026

## 1. Đối chiếu luồng đã sửa

Các phép thử dùng production build mới, Chrome và dữ liệu tổng hợp. Fault injection điều khiển thời gian/request để tái hiện logic, không dùng làm số đo hiệu năng hay biên bản người dùng thật.

| Luồng | Kết quả độc lập lần 2 | Giới hạn |
| --- | --- | --- |
| Hết giờ thi sau khi đã trả lời đúng | Giữ được đáp án, điểm 10/1 câu đúng trong fixture ép countdown 3 giây; không còn gửi object rỗng như lần 1 | Không chứng nhận mọi tình huống deadline/multi-tab/ACK |
| Autosave hai câu khác nhau đến đảo thứ tự | Cả hai câu còn trong DB | Vẫn còn N06 khi sửa cùng một câu |
| Preview Excel → focus cửa sổ | Preview giữ nguyên, chưa publish | Chỉ kiểm tra handler focus và dữ liệu thử; class/source switch cần hồi quy riêng |
| Thi xong → “Ôn các câu sai ngay” | API trả quiz; có learning dialog và số play tăng từ 1 lên 2 | Còn quyền cross-child N05 và chính sách gói ôn cần khóa |
| UI MathQuest gửi ID lượt câu | Hai attempt đều có presentationId; ID cũ sau client khác mở lại nhận 409 | Lần làm lại bình thường vẫn không mở lượt mới; thiếu ID vẫn được backend chấp nhận ở đường hiện tại |
| Map/Town có dữ liệu, axe mặc định | Trong fixture 390×844: hai danh sách violations đều rỗng | Không thay nghiệm thu mọi màn/zoom thật/thiết bị thật |

## 2. N06 — P1: merge autosave chưa chống ghi đè khi sửa cùng câu

1. **Vị trí:** `server/online-store.mjs:1357–1376`, `server/postgres-store.mjs:1538–1558`, autosave ở `ContestMockScreen.tsx`.
2. **Hiện trạng:** chấp nhận `seq/revision` nhưng không dùng để quyết định phiên bản mới; `{...old,...input.answers}` vẫn cho request cũ thắng ở cùng khóa câu.
3. **Bằng chứng:** ghi lựa chọn mới revision 2, sau đó giao request cũ revision 1; giá trị cũ thắng. Cả SQLite/PostgreSQL có cùng kết quả. Ca `autosave-same-question-stale-overwrite` trong evidence.
4. **Nguyên nhân:** hợp nhất khóa giải quyết trường hợp hai câu khác nhau, không giải quyết thứ tự cập nhật cùng câu; client tiếp tục gửi bất đồng bộ và nuốt lỗi save.
5. **Ảnh hưởng:** học sinh sửa đáp án đúng nhưng DB quay về lựa chọn trước, đặc biệt khi mạng chậm/đảo thứ tự; UI không biết đã mất cập nhật.
6. **Sửa:** revision được server kiểm tra nguyên tử hoặc cập nhật theo câu có version; serialization/coalescing có ACK và quy tắc nhiều tab. UI hiện đang lưu/đã lưu/chưa lưu; lỗi không bị bỏ qua im lặng.
7. **Kỳ vọng:** request cũ không thay bản mới; nộp bài dùng đúng dữ liệu đã chốt, có cách retry.
8. **Rủi ro:** đáp án pending tại deadline, thay/xóa lựa chọn có chủ ý, reconnect và nộp trùng; debounce đơn thuần không đủ.
9. **Nghiệm thu:** hai câu khác nhau, cùng câu sửa A→B→C, request đảo, hai tab, 500/timeout, nộp khi save chờ; đối chiếu UI và DB ở cả hai backend.

## 3. N07 — P1: hợp đồng lượt câu và lịch sử xáo còn thiếu

1. **Vị trí:** `MathQuest.tsx:137`, client/AttemptInput và các game; guard optional presentationId ở hai store; `online-store.mjs:118–133` lịch sử JSON.
2. **Hiện trạng:** MathQuest/runner đã gửi ID nhưng backend chỉ kiểm tra nếu request có ID. Nút “Trả lời lại” không gọi `question-open` mới. SQLite dựng JSON path bằng nối itemId, khiến ID có dấu chấm bị hiểu là đường lồng.
3. **Bằng chứng:** sai→làm lại ở UI vẫn chỉ **1 request mở câu**, cùng thứ tự lựa chọn. Client khác mở hoán vị mới thì UI cũ nhận 409, đã tốt hơn chấm sai ở lần 1. Với itemId hợp lệ `curriculum.q.1`, session đã lưu vị trí nhưng `lastQuestionCorrectPosition` trả null. Các ID có dấu chấm xuất hiện trong bộ học liệu thật. Xem `shuffle-client-reproduction.json` và `sqlite-dotted-question-history`.
4. **Nguyên nhân:** nối hợp đồng chưa đầy đủ mọi đường; xem việc có ID ở một game là đủ; truy vấn JSON chưa dùng khóa literal an toàn và chưa ghim đầy đủ pack/version.
5. **Ảnh hưởng:** chưa đạt yêu cầu gọi lại đổi vị trí; lịch sử có thể quên vị trí ở câu thật; client không gửi ID vẫn có nguy cơ chấm theo ánh xạ khác. N01 còn làm lộ chỉ số đúng.
6. **Sửa:** bắt buộc ID ở hợp đồng phiên mới; mọi game/đọc/nghe/thi thử gửi đúng ID; stale ID có luồng đồng bộ và tiếp tục rõ. Lượt làm lại mới được server cấp hoán vị, retry lỗi mạng giữ cũ. Lịch sử lưu/tra theo workspace/student/pack/version/item bằng khóa chính hoặc JSON literal đúng, có index và transaction.
7. **Kỳ vọng:** lượt mới đổi vị trí đúng; cùng lượt retry không đổi; chọn đúng nội dung luôn chấm đúng; không lộ chỉ số nguồn.
8. **Rủi ro:** phiên cũ, đồng hồ/gợi ý bị reset, feedback theo chỉ số nguồn, sao bị nhân; cần migration và invariant tối đa 3 sao.
9. **Nghiệm thu:** thiếu/stale/cross-session ID; mọi game; ID `q1`, `t19.m.01`, dấu gạch/dấu hai chấm hợp lệ; hai pack trùng itemId khác version; reload/restart/multi-instance và backup/restore.

## 4. N09 — P1 cổng nghiệm thu: E2E chưa theo kịp đổi nhãn và hành vi

Mã mới đã sửa accessible names và giữ preview. Một số bài vẫn đợi tên/điều kiện cũ, không tới được phần nghiệp vụ cần thử:

| Nhóm bài | Điểm dừng quan sát qua trace | Phân loại |
| --- | --- | --- |
| `online-studentflow` | Đợi nút tên chính xác “📋 Thu gọn bản đồ” | Selector theo nhãn cũ; không suy ra lưu câu/thoát game hỏng |
| `online-mapflow`, `online-mapperformance`, `online-regionmap` | Đợi “Trở về bản đồ thế giới” | Nhãn mới khác; cần cập nhật selector và giữ assert điều hướng |
| `online-games` | Đợi “Ví đổi sao” | Accessible name mới dùng nội dung nút; cần cập nhật và thử mở ví thật |
| `online-media` | Đợi preview count 0 sau refresh, thực tế 1 | Kỳ vọng cũ ngược với yêu cầu giữ bản nháp vừa sửa |

Kết quả fullsuite cuối được ghi trong báo cáo 01/evidence; không dùng số bài con đạt trong báo cáo triển khai làm toàn bộ PASS.

1. **Vị trí:** các tệp trên và `tests/visual/online-a11y.spec.ts`.
2. **Hiện trạng:** các thay đổi UI chưa có cập nhật đầy đủ ở bài gọi; a11y chuẩn vẫn tắt color-contrast và fixture/quét loading cần sửa.
3. **Bằng chứng:** trace ghi locator cũ và count preview; quét độc lập map/town có dữ liệu cho kết quả tốt, còn bài chuẩn không chứng minh zoom 200% thật bằng đổi viewport.
4. **Nguyên nhân:** nghiệm thu nhóm sửa thay cho full dependency/caller; semantics và hành vi thay đổi mà hợp đồng kiểm thử chưa cập nhật.
5. **Ảnh hưởng:** cổng phát hành không xanh; các bước sau điểm dừng chưa được chứng minh, dễ tạo báo cáo PASS quá phạm vi.
6. **Sửa:** cập nhật theo role/name hiện tại, chuẩn hóa test ID nơi cần; giữ kiểm tra nghiệp vụ phía sau; preview assert giữ draft đúng ngữ cảnh; axe phải có dữ liệu và chờ nội dung thật, bật contrast.
7. **Kỳ vọng:** fullsuite đúng nghĩa chạy hết các luồng và phát hiện lỗi thật, không mắc tại tên cũ.
8. **Rủi ro:** dùng `.first()`, bỏ assert, tăng timeout hoặc skip để che lỗi; sửa tên test mà bỏ hành vi.
9. **Nghiệm thu:** nhóm lỗi chạy trọn, sau đó full Chrome/Edge trên build chốt; mỗi skip có lý do; thêm fault injection mới N01–N08 vào script chuẩn.

## 5. Đánh giá màn và luồng thống nhất

| Màn/luồng | Đánh giá mới | Cải tiến tiếp |
| --- | --- | --- |
| Auth/khôi phục phiên | Loading/retry/role lazy vẫn hoạt động; shell auth và ảnh eager chưa tối ưu | Shell kết nối nhẹ, tránh tải ảnh chào khi chỉ khôi phục phiên; giảm layout shift |
| Lớp/học sinh | Phân trang tốt ở quy mô thử | Giảm chiều dài card desktop, giữ thao tác thường dùng rõ, kiểm tra tên dài/keyboard |
| Import/preview/publish | Focus đã giữ bản nháp; có reset theo đổi lớp | Test nguồn/phiên bản hết hạn, đổi lớp và publish một lần |
| Map/vùng/hành trình | Màu/name đã cải thiện; bản đồ nhẹ và có kiểm thử hình học | Đồng bộ bộ chọn, giữ vị trí/điểm đến và CTA học tiếp; hạn chế hành động phụ ở đầu mobile |
| Quiz/game | ID đã đi qua MathQuest/runner; stale request được từ chối | Đóng N01/N07, mở lượt làm lại đúng, recovery khi 409, mọi game cùng hợp đồng |
| Thi thử | Timeout và autosave nhiều khóa đã sửa | Revision cùng câu, ACK/error, deadline/multi-tab và chốt bài |
| Ôn sai | Đã mở game và gói quiz hợp lệ | Quyền sở hữu, ngân hàng được giao và invariant sao của nguồn ôn |
| Parent/PIN | Lockout setup đã được xác minh cùng verify | Kiểm tra đồng thời, hết hạn, đổi PIN/logout và nhiều con |
| Town | Axe mẫu 390×844 đã hết lỗi trước; ô đo 34×44, không tràn trang trong mẫu | Bàn phím/zoom/thiết bị thật, mật độ nút và tải theo nhu cầu |
| Backup/recovery | Một số kiểm tra đầu vào tốt hơn | Job staging/rollback/manifest và đường vận hành cloud đầy đủ |

Giữ phong cách đồ họa hiện có. Chuẩn hóa token màu/font/focus/status và component form/dialog/notification; chỉ tối ưu theo số đo và ảnh hồi quy. Không cần thêm engine nhân vật. Học liệu thật vẫn do chủ dự án/giáo viên cung cấp.

## 6. N13 — P2: tương phản màn quản trị còn lỗi

1. **Vị trí:** màn `OnlineAdminDashboard`, các mô tả/phân trang/text-muted và styles dùng chung.
2. **Hiện trạng:** map/town mẫu đã tốt hơn, nhưng sửa màu chưa phủ hết quản trị.
3. **Bằng chứng:** axe mặc định sau khi quản trị có dữ liệu/đã render, ở cả 1440×900 và 390×844, đều có `color-contrast` với 6 node. JSON đầy đủ nằm trong `evidence/performance/desktop-local-admin-axe.json` và bản mobile tương ứng.
4. **Nguyên nhân:** còn token/selector màu nhạt hoặc bị cascade ghi đè ở màn khác; cần sửa theo node thực tế của phép quét, không suy từ màu đã sửa ở map.
5. **Ảnh hưởng:** khó đọc mô tả/trạng thái/form khi thao tác trên điện thoại hoặc ánh sáng mạnh.
6. **Sửa:** chuẩn hóa token text/secondary/muted đạt tương phản trên đúng nền và cỡ chữ, xử lý từng selector rồi quét lại mọi role/state.
7. **Kỳ vọng:** quản trị có cùng chuẩn đọc được như các màn đã chỉnh.
8. **Rủi ro:** đổi màu dùng chung ảnh hưởng trạng thái disabled/loading và game; phải giữ ảnh đối chiếu.
9. **Nghiệm thu:** axe đủ dữ liệu, ba viewport, trạng thái lỗi/empty/preview; kiểm tra mắt thường, font lớn và zoom thật; không tắt contrast để qua cổng.

## 7. Phần chưa kiểm chứng

Thiết bị Android/iOS vật lý, một tay khi đứng lớp, zoom trình duyệt thật 200%, screen reader đầy đủ, quan sát học sinh tự học và phụ huynh/giáo viên thật: **CHƯA KIỂM CHỨNG** trong đợt tự động này. Cần buổi thử có người tham gia thật, ghi thiết bị/tác vụ/trợ giúp và kết quả; không dùng axe hoặc mô phỏng để ký thay.
