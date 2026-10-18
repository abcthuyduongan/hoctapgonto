# Phạm vi và vận hành RC10

Đợt hoàn thiện 17–18/10/2026. Tài liệu mô tả ứng viên hiện có, chưa thay cho biên bản nghiệm thu trên website thật.

## Phạm vi phát hành đầu

| Thành phần | Phạm vi RC10 |
|---|---|
| Web | Một giao diện quản lý và học sinh; Chrome/Edge Windows là mục tiêu kiểm thử tự động |
| Quản lý | Lớp, tài khoản học sinh, nhập Excel và tư liệu cùng lượt, xem lỗi và chỉ giao câu hợp lệ; cập nhật nguồn, sao lưu, quà/sổ sao |
| Học sinh | Năm trò, tám dạng câu phù hợp theo bộ; sao từng câu, hành trình tuần, tự đổi mật khẩu |
| Tuần mới | 3–4 môn, tối đa 12 câu/môn; mọi câu cần ít nhất 2 sao, xác nhận chuyển tuần rồi khóa tuần đã qua |
| Sao | Tối đa 3 sao/câu nguồn qua các trò; 1→3 chỉ thêm 2, chơi lại 3 không thêm; ví cũ được bảo toàn |
| Học liệu | Mẫu Excel trắng và bộ mẫu ZIP Excel 36 câu/3 môn kèm ảnh/âm thanh; giải nén rồi chọn tệp chung. Không làm mẫu Word mới |
| Bản cục bộ | ZIP Windows chạy bằng Node 22.22.2+, SQLite; không cần node_modules khi dùng gói đã đóng |
| Cloud | Mã Web/Netlify Function/PostgreSQL/Storage đã có kiểm thử fixture; cần staging thật trước phát hành rộng |

Các yêu cầu workbook về portal phụ huynh, ứng dụng native, quy trình nhiều người duyệt, xuất/thu hồi nâng cao không được ghi thành tính năng đã có. Không suy diễn mọi mục của workbook đều thuộc bản đầu. Safari/iPhone/Android thật, PWA mất mạng dài ngày, độ dễ đọc/phát âm thực tế và tải nhiều kết nối chưa có nghiệm thu. Workbook có 280 ca đề xuất; số test tự động trong báo cáo là bộ khác, không chuyển thành “280 ca đã chạy”.

## Dữ liệu, tải và giới hạn

Danh sách trình duyệt dùng metadata/phân trang. Khi chơi trắc nghiệm hoặc bài nhập/đọc/nghe, máy chủ chỉ giao nội dung câu hiện tại sau khi mở đồng hồ; chưa giao đáp án, lời giải hay bản chép lời. Lượt chơi chỉ thêm các map nhỏ theo câu được chọn: thời điểm mở, biên nhận gợi ý, biên nhận âm thanh. Không thêm bản sao toàn ngân hàng vào trình duyệt để xử lý chống gian lận. Các trò ghép cặp/xếp thứ tự cần công khai các thành phần chơi; dùng bảng trò phù hợp/allowedGameIds khi phương pháp đó không phù hợp mục tiêu câu hỏi.

Đọc thời lượng âm thanh chạy lười trên máy chủ, không thêm thư viện đó vào JavaScript giao diện. Giới hạn byte theo môi trường giữ nguyên: cloud 2 MiB/tệp và mỗi batch, SQLite 8 MiB/tệp; thời lượng xác minh tối đa 10 phút. Trình duyệt có thể tải hết tệp rồi chờ, vì vậy biên nhận và thời lượng **không chứng minh học sinh thực sự chú ý nghe**. Bài nghe phải có tệp WAV/MP3/OGG đọc được thời lượng; tệp hỏng có thông báo cần giáo viên thay.

Âm thanh mới được kiểm tra thời lượng trước khi lưu vào DB/Storage. Nếu batch bị từ chối vì dữ liệu 400/422, giao diện kiểm lại từng tệp trong batch đó để giữ tệp tốt và loại đúng câu phụ thuộc tệp lỗi. Lỗi mạng/xác thực/5xx dừng thao tác, không tạo thêm nhiều request hoặc gán nhầm mọi tệp là hỏng. Tệp cũ đã lưu trước RC10 vẫn được kiểm khi học sinh tải; tệp cũ hỏng cần giáo viên thay đúng nguồn, không tự cấp sao để bỏ qua.

Gợi ý xếp câu/quy luật cũng phải được máy chủ xác nhận và ghi giảm sao theo luật trò, cùng cơ chế với gợi ý của bài trắc nghiệm/đọc/nghe. Lỗi lấy gợi ý có nút thử lại; khi đang chờ xác nhận không cho gửi đáp án để né biên nhận.

Mỗi lần chọn tối đa 100 hình/âm thanh, tổng 32 MiB; vượt giới hạn báo chia nhỏ và giữ lựa chọn trước đó. Sau đối chiếu tên/hash, chỉ tạo base64 cho batch đang tải (cloud tối đa 2 MiB, local một tệp tối đa 8 MiB), không giữ base64 của toàn bộ lựa chọn. Kiểm giải mã vẫn tối đa ba tệp đồng thời.

Worker giữ cache bản hiện tại và tối đa hai bản build trước, chỉ dọn cache build hợp lệ của ứng dụng; không dọn dữ liệu học sinh hay cache khác. API luôn đi máy chủ. Tab quá cũ có thể cần tải lại khi lazy chunk đã hết thời gian lưu; giao diện có nút phục hồi tải lại. Ba bản cache không phải ngân sách byte cho mọi media: tư liệu riêng tư không được worker cache, tài nguyên public của các build vẫn cần theo dõi kích thước.

Một câu đổi prompt/đáp án/ngữ cảnh chấm phải dùng ID mới. Chỉnh lời giải/nhãn/gợi ý thuần biên tập giữ ID và sao; preview nêu số câu giữ/thêm/bỏ. Lịch sử cũ không bị viết lại. Những phiên bản trước RC10 đã đổi nghĩa nhưng tái dùng ID cần kiểm toán dữ liệu riêng trên bản sao; bản sửa không tự đặt lại ví hoặc đoán lại thành tích đã tồn tại.

Schema SQLite/PostgreSQL vẫn 1; giao thức câu hỏi mới có marker 1 trong JSON. Cùng số schema không có nghĩa có thể hạ ứng dụng: dùng RC10 trở lên để kiểm tra/khôi phục bản sao chứa lượt RC10. Chỉ các API công khai yêu cầu giao thức mới; công cụ nội bộ và kiểm thử di sản vẫn có đường đọc cũ có chủ đích. Tab/Function không tương thích phải báo tải lại, không âm thầm dùng đường chấm cũ.

## Vận hành và cảnh báo

`GET /api/online/status` cung cấp runtimeVersion và questionProtocolVersion. `/sw.js` cung cấp BUILD_ID giao diện. Đối chiếu cả hai với cùng commit Netlify đã Published; API HTTP 200 riêng lẻ chưa chứng minh UI đúng bản.

Lỗi máy chủ từ 500 có mã hỗ trợ `BA-...` khi ghi log thành công. Log chỉ có thời gian, phiên bản, nhóm route cố định, method, status và số ms; không ghi body, exception, cookie, token, tên/tài khoản/câu hỏi. Tối đa 30 bản ghi/phút/instance để tránh log tăng vô hạn; sau ngân sách này phản hồi vẫn lỗi rõ nhưng có thể không có mã. Phần khởi tạo kết nối của Function cũng có mã hỗ trợ. Đây là nhật ký tối thiểu, chưa phải hệ thống cảnh báo đã vận hành.

Trước mở rộng, người vận hành cấu hình và thử cảnh báo tại nhà cung cấp:

- Website/status thất bại 3 lần liên tiếp: người vận hành nhận và kiểm tra deploy/kết nối; không ghi thêm dữ liệu trẻ vào dịch vụ theo dõi.
- 5xx vượt 1% trong 5 phút khi có ít nhất 100 request, hoặc ít nhất 5 lỗi/5 phút với lớp nhỏ: điều tra trước khi thêm học sinh.
- Đo p50/p95 vào bài và lưu đáp án, tách cold/warm và mạng thử. Ngưỡng độ trễ được chốt từ staging, chưa có cam kết production từ số đo fixture.
- Ghi người nhận cảnh báo, kênh nhận, giờ trực và thời điểm thử cảnh báo vào biên bản. Chưa có các trường này thì G7 còn mở.

Các ngưỡng trên là đề xuất cấu hình thử, chưa được kích hoạt trên tài khoản Netlify/Supabase trong phiên làm việc này. Không lưu log vô hạn; thời gian lưu và quyền xem cần chủ ứng dụng phê duyệt theo chính sách dữ liệu đang áp dụng.

## Trình tự staging, phục hồi và nghiệm thu

1. Tạo site/project **riêng**, dữ liệu và tài khoản giả; UI/Function cùng commit RC10. Không trỏ test tải/restore vào website học sinh thật. Kiểm schema, quyền kho tư liệu riêng và hash tệp.
2. Smoke đầy đủ: nhập bộ mẫu 36 câu; sai/null/thiếu tư liệu bị loại có vị trí; giao ba môn; chơi các dạng, sai→sửa, hint, retry mạng, đăng nhập hai thiết bị, đổi mật khẩu, chuyển tuần và thử truy cập tuần cũ. Câu mới ID mới chưa có sao, chỉnh lời giải không thêm sao.
3. Đo file 140 câu + 16 WAV của chủ dự án ở mạng thật. File có một ô lỗi và vượt cấu hình tuần mới; dùng file để đo preview, sau đó dùng bản do giáo viên chia đúng 3–4 môn để nghiệm thu giao bài. Không tự cắt câu/sửa nguồn.
4. Tải 30 rồi 100 học sinh giả: mở bài, tải media, nộp sai/đúng/gửi lại, burst cùng lúc; chạy 60 phút. Ghi p50/p95, lỗi, khóa chờ DB, CPU/RAM, số dư trước/sau và tổng attempt hợp lệ. Chỉ tăng mức tải khi không mất/nhân đôi dữ liệu. PGlite local không thay thế bài này.
5. Sao lưu PostgreSQL và danh sách/toàn bộ đối tượng Storage cùng hash. Phục hồi vào project rỗng khác, đối chiếu tài khoản, tuần, attempt, sổ sao/đổi quà, media; thu hồi phiên cũ và thử đăng nhập mới. Đo RPO/RTO rồi ghi mục tiêu đã chấp nhận. Bản sao SQLite đã thử không phải chứng cứ phục hồi cloud.
6. Trên máy yếu thật, Chrome/Edge và điện thoại nếu chọn hỗ trợ: 30 ván hoàn chỉnh, thay cảnh, đổi tab/nền, giọng Việt lần mở đầu, đọc/nghe dài, chạm/phím và cỡ chữ lớn. Có giáo viên/học sinh đọc chậm đánh giá mốc sao và độ vừa sức; không tự đổi luật tốc độ đã chốt.
7. Chốt từng cổng G0–G7 bằng build/commit, người thử, thời gian, kết quả và liên kết bằng chứng. Phát hành giới hạn trước; không ghi “không lỗi/không rò bộ nhớ/chịu 100 học sinh” từ kiểm thử local.

Nếu triển khai lỗi, ngừng nhận lượt mới bằng kiểm soát vận hành của môi trường, giữ snapshot và log, sửa tiến tới bản tương thích. Không xóa DB, reset sao hoặc chạy RC9 trên dữ liệu đã ghi theo RC10. Phục hồi cả ứng dụng và dữ liệu chỉ sau diễn tập cách ly và quyết định của người chịu trách nhiệm, vì phục hồi có thể mất các ghi nhận sau snapshot.
