# Sao từng câu và chuyển tuần có xác nhận

**Bổ sung sau RC8:** người dùng xác nhận mỗi tuần chỉ giao 3–4 môn và mọi câu đều có sao. Xem [kế hoạch hoàn thiện tiếp theo](KE_HOACH_HOAN_THIEN_CON_TON_DONG_2026-10-17.md); giới hạn môn/số câu chưa được triển khai, dữ liệu và gói RC8 giữ nguyên.

Ngày 17/10/2026. Yêu cầu đã được người dùng chốt: tốc độ là tiêu chí chính của trắc nghiệm; mỗi câu nguồn tối đa 3 sao dùng chung mọi game; mọi câu trong tuần đạt ít nhất 2 sao mới được chuyển; báo số câu 2 sao để chọn ôn thêm; sang tuần mới không quay lại tuần cũ. Trạng thái: đã triển khai và qua kiểm thử cục bộ (292 Node, 90 Chrome/Edge); chưa đưa lên website. Kết quả và số đo ở mục 17 báo cáo rà soát; các bước đề xuất chưa triển khai ở mục 6–7 dưới đây.

## 1. Các điểm chưa hợp lý phải xử lý

| Điểm | Hệ quả nếu làm đơn giản | Cách xử lý |
|---|---|---|
| Dùng đồng hồ tự gửi từ trình duyệt | Có thể sửa elapsedMs để nhận sao nhanh; thời gian từ mở phiên còn gồm tải game | Máy chủ ghi mốc mở câu riêng, idempotent; chỉ mở sau khi UI sẵn sàng, câu nghe sau khi nghe hết; không đặt lại khi thử lại |
| Mọi câu cùng một mốc thời gian | Câu đọc dài/nghe/numeric bị bất lợi; có thể kẹt tuần | Mốc riêng theo dạng; hết mốc vẫn trả lời, chỉ ảnh hưởng sao; cho ôn lại/game phù hợp khác |
| Bắt đầu tính giờ khi hình còn đang tải | Mạng chậm làm mất thời gian học | Câu có hình chờ tải hình thành công; lỗi có thử lại/thoát. Câu nghe còn chờ lượt nghe bắt buộc |
| Mỗi câu 3 sao thay cho mỗi bộ 3 sao | 140 câu có thể đạt 420 sao, tăng ngân sách đổi quà | Giữ tỷ lệ hiện tại, báo rõ tổng sao mới; cần người quản lý đối chiếu ngân sách trước bật đổi quà, không tự thay tỷ lệ/quy đổi |
| Biến sao bộ cũ thành sao từng câu | Nhân số dư hoặc giả thành tích chưa có | Giữ nguyên credit cũ, không tự phát 3 sao cho mọi câu. Credit cũ được bù trừ trong cùng nguồn khi ghi thành tích câu mới; tổng chỉ tăng phần chưa nhận |
| Tự động mở tuần ngay khi đủ sao | Học sinh mất cơ hội ôn lên 3 sao | Lưu trạng thái tuần đã sẵn sàng; chỉ chuyển sau thao tác xác nhận riêng |
| Ôn một cặp duy nhất trong Trí Nhớ | Hai thẻ duy nhất khiến ghép đúng quá dễ | Thêm ít nhất một cặp nguồn làm đối chiếu; cặp đã 3 sao không nhận thêm. Không tự tạo câu/nguồn thưởng mới |
| Một bộ trộn nhiều câu không có trò chung | Có thể gây khó hiểu vì từng câu có trò phù hợp nhưng cả bộ bị chặn | Giải thích game phù hợp từng câu ngay ở preview, yêu cầu người soạn chia nhóm trước khi giao; không tự bỏ câu hoặc tạo thêm nguồn sao |
| Tải cả học liệu để cộng sao | Nhiều tuần làm tăng RAM, JSON và DOM | Tiến độ dùng ID + mức sao + số đếm; danh sách tối đa 20 bộ/trang. Chỉ tải presentation của trò đang mở; không lưu cache nền học liệu |
| Thêm câu vào tuần học sinh đã đóng | Tiến độ câu mới trống nhưng học sinh không quay lại được | Giữ con trỏ và phiên bản đã đạt trong lịch sử; tránh sửa tuần đã qua, giao nội dung mới ở tuần chưa học |

Thời gian máy chủ vẫn có thể gồm độ trễ gửi yêu cầu/đáp án. Kiểm thử mạng chậm phải đo ảnh hưởng này; không hứa loại bỏ hoàn toàn mạng khỏi thời gian khi chưa có bằng chứng. Đây là ứng dụng luyện tập, không được mô tả như hệ thống thi có giám sát chống mọi hành vi can thiệp thiết bị.

## 2. Luật sao dự kiến ban đầu

Chỉ câu đã trả lời/ghép đúng mới có sao. Sai thì được sửa, không tự qua câu để ghi sao. Mỗi câu lấy mức cao nhất 0–3 giữa mọi game/lượt/phiên bản của nguồn; 1 → 3 chỉ cộng 2, 3 → 3 cộng 0. Biên nhận gửi lại do mất mạng không được cộng lần nữa. Đáp án đúng đã được máy chủ ghi thì sao giữ cả khi thoát giữa bộ.

| Dạng | 3 sao | 2 sao | 1 sao |
|---|---|---|---|
| Trắc nghiệm thường | Đúng trong 30 giây | Đúng trong 60 giây | Đúng chậm hơn |
| Nhập số/điền từ | Đúng trong 45 giây | Đúng trong 90 giây | Đúng chậm hơn |
| Đọc chọn đáp án | Đúng trong 90 giây | Đúng trong 180 giây | Đúng chậm hơn |
| Nghe chọn/điền | Đúng trong 30 giây sau lần nghe bắt buộc | Đúng trong 60 giây | Đúng chậm hơn |
| Trí Nhớ/Nối Từ | 0 lần ghép sai trước lần đúng | 1 lần ghép sai | Từ 2 lần sai |
| Ghép Câu/Quy Luật | 0 lần kiểm tra sai/gợi ý | 1 lần | Từ 2 lần |

Với câu tính giờ, mỗi lần trả lời sai cộng 15 giây và mỗi gợi ý cộng 30 giây vào thời gian xét sao. Số gợi ý là số tích lũy tối đa của câu, không cộng lặp lại từ các request thử lại. Ghép sai A–B tính một lỗi cho từng câu A và B, lật một thẻ chưa tính sai. Các mốc này là mặc định triển khai để thử, cần nghe phản hồi học sinh trước chốt production.

## 3. Luồng chuyển tuần

1. Chỉ một tuần hiện tại được chơi. Tuần tương lai khóa; tuần đã qua chỉ xem tóm tắt thành tích.
2. Tất cả câu của tuần hiện tại đạt ít nhất 2 sao thì hiện tổng câu 2 sao và 3 sao, ví dụ: “Con đã đạt yêu cầu. Còn 18 câu 2 sao; con muốn ôn lên 3 sao hay sang tuần 2?”
3. Chọn ôn thì giữ tuần hiện tại, tải đúng bộ/câu cần ôn, vẫn giữ mã nguồn và mức sao cũ.
4. Chọn sang tuần thì xác nhận rõ tuần cũ sẽ khóa. Máy chủ kiểm tra lại mọi câu, tuần kế có tồn tại và requestId; ghi con trỏ tuần và kết thúc lượt cũ trong một giao dịch.
5. Mất phản hồi rồi gửi lại trả cùng kết quả, không nhảy thêm tuần. Bắt đầu lượt cũ, mã mở lượt cũ, đáp án đang chờ và thiết bị khác đều không kiếm được sao ở tuần đã khóa.
6. Nếu chưa được giao tuần tiếp theo, tiếp tục ôn tuần hiện tại; không tự chuyển vào tuần rỗng. Chuyển lớp phải có con trỏ riêng theo lớp; quay lại lớp cũ không đặt lại tuần đã qua.

## 4. Giới hạn tải và vòng đời

- Chỉ thêm một request metadata nhỏ để mở đồng hồ cho câu tính giờ. Bộ đếm hiển thị chạy tại máy mỗi giây, không polling máy chủ.
- Ghép cặp/xếp câu dùng các đáp án đã gửi để đếm lỗi, không gửi thêm request cho từng lần lật một thẻ hoặc di chuyển một từ.
- Cộng sao cùng giao dịch ghi đáp án đúng; biên nhận chỉ có delta và mức sao của tối đa hai câu liên quan. Không đọc lại ví hoặc tải cả hành trình sau mỗi đáp án; số dư đối chiếu lại khi hoàn tất/thoát.
- Một ô chọn trò chung cho bộ và một nút học lại mỗi câu; không dựng 5 nút game cho từng câu (30 câu có thể thành 150 nút). Chỉ dựng danh sách khi mở chi tiết.
- Nhập lại lời giải/gợi ý/chính sách game giữ mã câu nguồn nếu nội dung học không đổi, tránh đặt lại sao chỉ vì mã nhập tự sinh khác.
- Tiến độ tuần dùng metadata và số đếm; danh sách câu chỉ mở theo bộ (tối đa 30 câu). Hai game ghép cặp vẫn giới hạn 4/6 cặp/màn như RC8.
- Khi thoát/đổi tài khoản: hủy request không dùng, dừng timer/TTS/audio, bỏ presentation. Không giữ nhiều trò hoặc các tuần cũ trong bộ nhớ.

## 5. Các bước phải nghiệm thu trước phát hành

1. Hàm sao thuần dữ liệu: raw answer, đồng hồ, lỗi/gợi ý, cap từng câu, retry/concurrency, source identity.
2. Hai kho dữ liệu và API: cộng sao ngay khi đúng, không cộng lại lúc hoàn tất, bảo toàn credit/số dư cũ, giao dịch rollback, không cấp quyền tuần khác.
3. UI: đồng hồ chờ ACK, nghe xong mới tính giờ, sai được sửa, thông báo sao máy chủ, danh sách câu cần ôn và xác nhận chuyển tuần.
4. Sao lưu/khôi phục: tái kiểm chứng được ledger từng câu từ phiên/đáp án, giữ lịch sử đổi quà và con trỏ tuần; bản sao cũ vẫn đọc được.
5. Tải/bộ nhớ: so sánh JSON/DOM/heap/tài nguyên GPU sau warm-up và 10 lần vào/thoát; kiểm tra mạng chậm/lỗi tải; không suy RAM từ byte ZIP.
6. Chỉ đóng gói sau các kiểm thử phù hợp. Cần nghiệm thu giọng Việt, tốc độ, ngưỡng thời gian và ngân sách đổi quà trên website/thiết bị thật; chưa tự đổi trạng thái production.

## 6. Điểm còn cần đo và đề xuất bước tiếp theo

- Chưa có nguyên văn lỗi production hoặc số đo mạng Netlify: sau triển khai cùng commit UI/Function, đo riêng mở trang, mở trò, tải tư liệu và lưu đáp án; dùng thời gian từng request để quyết định tối ưu tiếp, không quy mọi lỗi về giao diện 3D.
- Mốc sao là mặc định thử nghiệm, chưa có dữ liệu tốc độ đọc của học sinh thật. Nếu nhiều em đúng nhưng liên tục 1 sao, điều chỉnh mốc theo dạng/độ dài sau đo; không thêm nhiều tùy chọn trước khi biết cần thiết.
- Dashboard quản trị vẫn có API tương thích đầy đủ để quản lý học liệu. Phần giảm dữ liệu hiện ưu tiên trang học sinh; khi kho quản trị lớn cần đo riêng rồi tách danh sách metadata và chi tiết tuần được chọn, thay vì khẳng định mọi màn đều đã phân trang.
- Không mở lại tuần cũ tự động khi giáo viên chỉnh sửa. Đề xuất ưu tiên kế tiếp là cảnh báo ngay ở thao tác cập nhật tuần có học sinh đã chuyển qua, kèm hướng dẫn giao nội dung bổ sung ở tuần mới; cần thiết kế với quy trình giáo viên trước khi thêm chức năng đặt lại hàng loạt.
- Trần sao hiện theo câu trong cùng bộ nguồn, dùng chung mọi game và giữ ID qua lịch sử phiên bản (kể cả câu bị bỏ rồi nhập lại cùng ý nghĩa). Giáo viên sao chép riêng một câu sang bộ nguồn khác có thể tạo nguồn sao khác; học sinh không có quyền tạo bộ. Nếu cần trần xuyên toàn ngân hàng, đề xuất mã câu nguồn dùng chung có kiểm duyệt; không tự gộp chỉ vì prompt giống nhau vì đoạn đọc, hình và ngữ cảnh có thể khác.

## 7. Thứ tự đề xuất và điều kiện đánh giá

| Ưu tiên | Việc | Trạng thái / điều kiện đánh giá |
|---|---|---|
| 1 | Hoàn tất luật sao và tuần, giảm tải trang học sinh | Đã triển khai cục bộ; phải qua kiểm thử máy chủ, trình duyệt, khôi phục và đóng gói trước bàn giao |
| 2 | Đo website sau cập nhật | Ghi riêng thời gian mở trang, mở trò, tải hình/âm thanh/cảnh 3D và lưu đáp án trên máy tính/điện thoại; thu nguyên văn lỗi, URL request và mã HTTP khi lỗi xảy ra. Đối chiếu cùng học liệu và điều kiện mạng. Nếu cảnh 3D chiếm đường truyền lúc vào bài, đánh giá trì hoãn tải cảnh hoặc chế độ Nhẹ trước khi thay tài nguyên |
| 3 | Thử mốc sao với học sinh và kiểm tra đổi quà | Theo dõi các câu đúng nhưng chỉ đạt 1 sao, tách dạng/độ dài; điều chỉnh mốc nếu cần. Đối chiếu trần 420 sao cho 140 câu với tỷ lệ đổi quà đang cấu hình trước sử dụng rộng |
| 4 | Giảm tải quản trị nếu phép đo cho thấy cần | Đo kho 52 tuần với lượng câu thực tế; tách danh sách tóm tắt và tuần đang chỉnh, chỉ tải chi tiết khi chọn. Kiểm tra cả thời gian truy vấn phía máy chủ vì phân trang JSON chưa đồng nghĩa máy chủ chỉ đọc 20 bộ |
| 5 | Cảnh báo chỉnh tuần đã đóng và quản lý mã nguồn chung | Cảnh báo trước cập nhật tuần đã có học sinh chuyển qua; làm rõ việc giao bổ sung. Chỉ thiết kế mã câu xuyên nhiều bộ khi quy trình biên soạn cần, tránh tự gộp sai hoặc thêm bảng/chức năng chưa sử dụng |

Một câu phù hợp nhiều trò có thể dễ kiếm 3 sao hơn ở trò ghép cặp so với trắc nghiệm tính giờ. Theo lựa chọn đã chốt, hệ thống lấy kết quả tốt nhất và coi sao là tiến bộ luyện tập; số sao giữa hai trò không phải thước đo độ khó tương đương. Cần quan sát ở bước thử học sinh trước khi đề xuất thay luật, không tự thêm điểm theo trò hoặc nhân số dư.

Không bổ sung tự tải mọi tuần, polling đồng hồ, hàng trăm nút trò chơi hoặc tự mở lại tuần cũ. Các bước đề xuất chưa triển khai được ghi riêng ở trên; không mô tả như tính năng đã có.
