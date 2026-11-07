# Chốt phương án Bảo An Learning và SafeTime cho gia đình 1–2 người

Ngày 07/11/2026. Đây là kế hoạch bàn giao, **chưa phải tính năng kết nối đã triển khai**. Nguồn hợp đồng gốc: `D:\Phần mềm 2026\quản lý máy tính\docs\ket-noi-bao-an.md`; bản tham khảo trong Bảo An: `docs/KET_NOI_SAFETIME.md`. Các quyết định bổ sung cho cloud cần được đồng bộ vào hợp đồng gốc trước khi triển khai.

## 1. Quyết định đề nghị

**Giữ Bảo An Learning trên HTTPS/cloud làm nguồn học liệu, tài khoản và thành tích duy nhất. SafeTime phụ trách giờ dùng máy và quyền phụ huynh trên Windows.** Làm cầu nối theo từng bước, bắt đầu bằng mở đúng trang học và dùng đăng nhập Bảo An bình thường.

- Chưa đưa một kho SQLite mới vào sử dụng song song Supabase. Hai kho độc lập sẽ tạo hai hành trình và hai ví sao khác nhau nếu chưa có cơ chế đồng bộ.
- Chưa triển khai tự cộng giờ chơi từ sao. Sao, ví, quà và phê duyệt thuộc Bảo An; SafeTime không có quyền ghi vào chúng.
- Bảo An quyết định bài nào được học, tuần nào mở, kết quả thi nào hợp lệ. SafeTime quyết định khi nào máy được dùng theo chính sách cha mẹ. Cầu nối không được vượt giới hạn của một trong hai bên.
- Chỉ phát triển bốn mã môn chuẩn `toan`, `tieng-viet`, `tieng-anh`, `tin-hoc`. Giữ ID lịch sử ở dữ liệu cũ; ánh xạ khi xuất, không sửa lịch sử để làm đẹp mã. Người dùng tự cung cấp câu hỏi, không phát sinh dự án phân loại kỹ năng hay ngân hàng câu hỏi mới.

Hợp đồng cũ V1 chỉ áp dụng địa chỉ loopback `127.0.0.1:4180`. Web Netlify hiện tại không thể tự trở thành loopback bằng cách đổi URL. Với cách dùng hiện nay, cần phụ lục **cloud V2** trước khi làm SSO/đồng bộ kết quả; có thể tái sử dụng phần nghiệp vụ V1 nhưng không đưa bí mật loopback lên web.

## 2. Trách nhiệm dữ liệu

| Nội dung | Nguồn quyết định | SafeTime được dùng |
| --- | --- | --- |
| Tài khoản học sinh, lớp, liên kết phụ huynh | Bảo An | Mã học sinh đã được ghép đúng quyền |
| Bài tiếp theo, tuần khóa, số câu, tiến độ | Bảo An | Đọc và mở đúng nhiệm vụ; không đánh dấu hoàn thành thay |
| Điểm thi/nộp bài | Máy chủ Bảo An | Nhận sự kiện đã hoàn thành; không lấy điểm từ tham số URL |
| Sao, quà, vật liệu | Bảo An | Chỉ đọc nếu thật sự cần; không dùng để cộng giờ chơi |
| Khung giờ, phiên máy, ngân sách chơi | SafeTime | Tự thực thi trên Windows; không tin đồng hồ trình duyệt |
| Phiên đăng nhập, PIN phụ huynh | Mỗi phần mềm riêng | Không chép cookie, mật khẩu hoặc PIN giữa hai phần mềm |

## 3. Các đợt thực hiện

### S0 — Chốt bản Bảo An có thể thử dùng (0,5–1 ngày)

1. Người thực hiện đọc báo cáo khắc phục và chạy `npm run verify:local` trên bản mới; ghi version/source ID, kết quả thật, ca bị bỏ qua.
2. Sao lưu cloud, thử khôi phục ở kho riêng, xác nhận học sinh, bài, sao và quà giữ nguyên. Giữ bản deploy trước.
3. Cập nhật Netlify chỉ sau khi duyệt đúng build; kiểm tra build-info và đăng nhập thử. Bước này chưa được thực hiện trong đợt kiểm tra mã hiện tại.
4. Phụ huynh và Bảo An thử 20–30 phút trên thiết bị thực; theo dõi 48 giờ. Chỉ dùng ít người có giám sát, chưa công bố diện rộng.

Đầu ra: hồ sơ build, biên bản vòng học, bằng chứng backup/restore, đường quay lại bản trước. Qua cổng S0 khi không có P0/P1 còn mở và không mất dữ liệu.

### S1 — Mở trang học từ SafeTime, chưa cần cầu nối (1–2 ngày sau khi nền tảng Học tập của SafeTime đạt)

1. Kiểm chứng giai đoạn quản lý Học tập/lọc web của SafeTime đã có mã và kiểm thử đạt; trạng thái PASS giai đoạn trước không thay cho phần này.
2. Thêm nút **Vào Bảo An Learning** trỏ tới đúng origin HTTPS đã chọn. Mở bằng hồ sơ học sinh; trẻ đăng nhập tài khoản Bảo An. Không tự động điền mật khẩu, không mượn phiên quản trị.
3. Cho phép đúng origin và các đường tài nguyên thực sự cần, kiểm tra ảnh/âm thanh. Không mở rộng toàn bộ trình duyệt hoặc cả Internet vì một ảnh chưa tải.
4. Định nghĩa rõ thời gian học có bị trừ giờ chơi/lượt bật máy không; chỉ hiển thị “không trừ giờ chơi” khi đo và chứng minh được trong SafeTime. Khi tính năng đó chưa có, phụ huynh quản lý thời gian thủ công theo khả năng đã kiểm chứng.
5. Có đường quay lại SafeTime, nút mở lại khi mất mạng, không tự nhấn câu trả lời hay tự nộp bài.

Nghiệm thu: hai tài khoản Windows tiêu chuẩn; vào/ra bài học 10 lần; đăng xuất/đổi học sinh; sleep/reboot; mất mạng; hết giờ; chuyển sang trang khác. Chỉ nhiệm vụ được phép mới mở. Không có việc “học” nhưng chạy ứng dụng/trang chơi bị cấm.

### S2 — Hoàn thiện hợp đồng cloud V2 (1–2 ngày thiết kế, trước khi lập trình)

Chốt bằng một phụ lục duy nhất có chủ sở hữu và phiên bản:

1. Origin HTTPS, đường API, JSON schema, mã lỗi, giới hạn gọi, timeout, mức dữ liệu tối thiểu; không dùng cookie trình duyệt như khóa ứng dụng.
2. Ghép thiết bị có cha mẹ xác nhận, mã ngắn dùng một lần/hết hạn, phân quyền theo học sinh và thiết bị. Không dùng khóa service-role/Supabase DB ở Windows hay frontend.
3. Phiên ứng dụng ngắn hạn, refresh token xoay vòng, thu hồi thiết bị, phát hiện dùng lại refresh token. Khóa dài hạn lưu an toàn theo tài khoản Windows; máy chủ lưu hash của bí mật khi phù hợp. Phụ lục phải chỉ rõ tuổi thọ token, phạm vi và quy trình đổi thiết bị.
4. Mở nhiệm vụ bằng vé một lần, hết hạn nhanh, ràng buộc học sinh/thiết bị/đích. Dùng trình duyệt hệ thống, không tự dựng màn nhập mật khẩu Bảo An. Không ghi vé/cookie/mật khẩu vào log, URL chia sẻ hoặc thông báo lỗi.
5. Sự kiện kết quả dùng `eventId`, `studentId`, `contestSessionId`, thời điểm máy chủ, trạng thái nộp, điểm và điểm tối đa. Chốt thứ tự ổn định, cursor, thời gian lưu, phân trang, cách đồng bộ lại khi cursor quá hạn.
6. Cắt nghĩa giới nghiêm trong bài thi: hết giờ máy, hết hạn Bảo An, gia hạn thi. Không để một phần mềm hứa gia hạn trong khi phần còn lại khóa ngay. Chính sách mặc định là giới hạn chặt hơn; muốn ngoại lệ phải có phụ huynh xác nhận và được cả hai phía hỗ trợ.

Đầu ra: bảng đối chiếu các yêu cầu BAO/LNK của hợp đồng gốc; ví dụ request/response; sơ đồ ghép/thu hồi; ma trận quyền; quyết định xử lý mất mạng. Khi chưa thống nhất thì chưa bật SSO hay đồng bộ tự động.

### S3 — Cầu nối đọc nhiệm vụ và mở bài (3–5 ngày, ước lượng)

**Phía Bảo An:** adapter trên cùng lớp quyền/nghiệp vụ SQLite/PostgreSQL; status JSON có giao thức; ghép/thu hồi; danh sách học sinh đúng liên kết; lấy nhiệm vụ hôm nay từ journey thật; đổi vé SSO một lần. Không tạo lại lớp, câu hỏi hoặc bảng thành tích riêng cho SafeTime.

**Phía SafeTime:** thay lớp mẫu `SafeTime.BaoAn` và host mẫu bằng client/host thực; lưu cặp ghép theo hồ sơ; bảng nhiệm vụ có trạng thái đang tải, chưa giao bài, khóa giờ, mất mạng; mở đúng môn/thi; xử lý đăng xuất và thu hồi ngay.

Kiểm thử bắt buộc: ghép hết hạn/dùng lại/sai nhiều lần; token bị thu hồi; thiết bị B không dùng vé A; học sinh B không thấy bài A; tuần khóa vẫn bị máy chủ từ chối; ghép lại không nhân đôi dữ liệu; mất mạng không coi là hoàn thành.

### S4 — Nhận kết quả có chống trùng (2–4 ngày, ước lượng)

1. Bảo An ghi kết quả và sự kiện gửi đi trong một giao dịch/outbox; không sinh sự kiện hoàn thành khi chỉ mở bài hoặc khi nộp lỗi.
2. SafeTime lưu khóa nhận `eventId`; kết quả thi còn đối chiếu `contestSessionId`. Nhận lại 100 lần vẫn chỉ có một kết quả.
3. Chỉ cập nhật cursor sau khi kết quả đã lưu bền vững. Crash giữa các bước, gửi lại, phân trang chồng, thứ tự trễ đều phải phục hồi đúng.
4. Sự kiện thuộc học sinh khác/đã thu hồi phải bị từ chối. Chuyển tài khoản Windows không kế thừa phiên của tài khoản trước.
5. Màn cha mẹ hiển thị nguồn “Bảo An”, giờ đồng bộ cuối, lỗi và nút thử lại. Không hiển thị thành công khi API trả HTML 200.

### S5 — Thử thực tế và phát hành nhỏ (2–3 ngày theo dõi)

Hai hồ sơ Windows, một phụ huynh, một học sinh, ít nhất hai ngày học thật. Chạy vòng học → khám phá → chơi → thi → xem kết quả; tắt mạng/khởi động lại/hết giờ tại từng bước quan trọng. Lưu ý kiến thật của trẻ và phụ huynh. Gói có thể quay lui riêng từng phần mềm; phiên và schema vẫn phải tương thích.

## 4. Ma trận kiểm thử bàn giao

| Mã | Kịch bản | Điều kiện đạt |
| --- | --- | --- |
| SH01 | Bảo An cũ nâng cấp, PIN 4/5/6 số, bài đang học và sao cũ | Vào được khu cha mẹ, không đổi lịch sử, không thêm sao ngoài luật |
| SH02 | Hai hồ sơ Windows/hai học sinh | Không thấy hoặc dùng token/bài/điểm của nhau |
| SH03 | Ghép một lần; hết hạn; thu hồi; đoán sai | Có giới hạn và audit, không ghép vượt quyền |
| SH04 | Vé mở bài dùng lại, sửa đích, đổi thiết bị | Từ chối; chỉ mở đúng bài của học sinh |
| SH05 | Token/cookie giả, thiếu quyền, giả Origin | Trả lỗi phù hợp, không có dữ liệu nhạy cảm |
| SH06 | Tuần tương lai, câu chưa đủ sao, nộp thi giả | Máy chủ Bảo An từ chối; SafeTime không ghi hoàn thành |
| SH07 | Một sự kiện được gửi 100 lần và sau reboot | Một kết quả; cursor không bỏ qua sự kiện chưa lưu |
| SH08 | 401/403/429/5xx/HTML 200/mạng mất | Trạng thái đúng, thử lại có giới hạn, không báo thành công giả |
| SH09 | Cha mẹ đổi PIN/đổi mật khẩu/thu hồi thiết bị | Phiên liên quan bị xử lý đúng hợp đồng; không tự đăng nhập vượt quyền |
| SH10 | Hết giờ máy/Bảo An/thi; sleep và đồng hồ sai | Không vượt chính sách đã chốt; không phụ thuộc giờ do frontend khai |
| SH11 | Sao, vật liệu, quà, thưởng thời gian | Cầu nối không tạo giao dịch hoặc đổi sao thành giờ chơi |
| SH12 | Desktop/điện thoại/zoom 200%/chỉ bàn phím | Đọc được thông báo, bấm được đường phục hồi, không kẹt focus |
| SH13 | Backup/restore và quay lui riêng hai phần mềm | Học sinh, điểm, lịch sử, quyền ghép và trạng thái token nhất quán |
| SH14 | Trẻ và phụ huynh sử dụng thật | Biên bản thật, không có lỗi P0/P1; cha mẹ biết tắt kết nối và quay lại dùng riêng |

Mọi ca cần ghi build hai phía, dữ liệu thử, bước, kết quả mong đợi/thực tế và bằng chứng. Ước lượng là thời gian kỹ thuật tham khảo; tính lại sau S2. Không ghi hoàn thành theo ngày dự kiến.

## 5. Cách giao việc cho AI/người thực hiện tiếp

1. Đọc báo cáo khắc phục, hợp đồng gốc và kế hoạch này; xác nhận build thật hai bên trước sửa.
2. Làm lần lượt S0 → S1. Chỉ thực hiện S2–S5 khi người phụ trách chốt phạm vi cloud V2.
3. Mỗi thay đổi có ca kiểm thử hành vi và bằng chứng; không xóa hoặc làm yếu ca bảo vệ sao/quyền/khôi phục để báo PASS.
4. Không lấy mật khẩu, token thật từ chat đưa vào mã, ảnh hoặc báo cáo. Không tự tạo người dùng/học liệu thử trong dữ liệu thật.
5. Cập nhật tiến độ, tài liệu vận hành và bằng chứng trong đúng từng dự án. Đợt kiểm tra này chỉ sửa và lưu hồ sơ tại Bảo An; không sửa repository SafeTime.

**Cổng cuối:** Bảo An dùng riêng có thể được phép thử trước. “Hai phần mềm tích hợp hoàn chỉnh” chỉ đạt khi S2–S5 và các SH01–SH14 có kết quả thực tế. Các lớp mẫu hoặc một trang mở được trong trình duyệt chưa đủ để nghiệm thu kết nối.
