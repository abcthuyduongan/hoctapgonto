# Nhập học liệu Word và Excel

Mở **[Quản lý lớp & học liệu](http://127.0.0.1:4180/?online=1)** sau khi chạy `npm run build` và `npm run online`, hoặc mở `MO_BAO_AN.cmd` trong ZIP đã giải nén. Đăng nhập quản trị viên, chọn lớp rồi mở **Học liệu tuần**.

Hướng dẫn này dành cho luồng tài khoản và dữ liệu máy chủ cục bộ ở cổng 4180. Bản cài mới có kho câu hỏi rỗng, chờ giáo viên nhập và giao bộ tuần; học sinh chưa có bài không nhận câu mẫu. Khi cập nhật, giữ lại dữ liệu giáo viên đã nhập. Giao diện cũ đã được gỡ khỏi bản này.

Người soạn tự đặt tên môn, chủ đề, tuần, cuộc thi và mức độ. Hệ thống nhận loại câu cùng đáp án để chọn trò chơi phù hợp; không suy đoán môn học từ nội dung.

Tải một trong hai mẫu ở mục quản trị: `public/question-templates/online-week.docx` hoặc `public/question-templates/online-week.xlsx`. Đây là mẫu luyện tập thông dụng. Nhãn Trạng Nguyên, IOE hoặc Violympic do người soạn ghi không xác nhận đề chính thức hay cấu trúc của một cổng thi.

## Quy trình nhập

1. Soạn nội dung trong Word `.docx` hoặc Excel `.xlsx` theo mẫu phiên bản 1. Tệp tối đa 1 MB; các định dạng Word `.doc` và Excel `.xls` cũ không được nhận.
2. Tải ảnh và âm thanh riêng trong ứng dụng. Điền đúng tên tệp đã tải lên vào bảng câu hỏi.
3. Chọn lớp và tuần, tải tài liệu, rồi kiểm tra bản xem trước. Mỗi môn và loại câu được gom thành một bộ, cần từ 2 đến 30 câu. Một tuần tối đa 30 bộ. Toàn tệp chỉ chứa một tuần.
4. Mở từng câu để kiểm tra đáp án, đoạn đọc, hình/âm thanh và thử trả lời. Chọn **Giao tuần học cho lớp** sau khi rà soát; việc xem trước và thử câu chưa đưa bài vào lớp, không ghi sao.

Các bảng Word và dòng Excel còn trống được bỏ qua. Hai mẫu chỉ chứa khung nhập, không có câu mẫu tự động đưa vào lớp. Nếu chưa điền câu hỏi, hệ thống báo mẫu trống.

## Tám loại câu

| `kind` | Dạng câu và trường cần điền | Trò chơi có thể nhận |
| --- | --- | --- |
| `quiz` | `prompt`, bốn phương án `A`–`D`, `answer` là A/B/C/D. Các phương án phải khác nhau. | Math Quest; Memory Match và Nối Từ Khám Phá khi các mặt thẻ ngắn và không mơ hồ |
| `pairs` | Mỗi câu là một cặp `left`, `right`. Không lặp nội dung mặt thẻ trong cùng bộ. | Memory Match, Nối Từ Khám Phá; thêm Math Quest khi có ít nhất 4 cặp với đáp án khác nhau |
| `sentences` | `prompt`; `answer` là câu đúng từ 3–15 từ, hoặc `words` tách từng từ bằng dấu `\|`. | Sentence Builder, Bậc Thang Quy Luật |
| `numeric-answer` | `prompt`, `answer` là số nguyên hoặc số thập phân; `unit` tùy chọn. | Math Quest với ô nhập số |
| `fill-blank` | `prompt`; `acceptedAnswers` gồm các đáp án chấp nhận, tách bằng `\|`; có thể dùng `answer` cho một đáp án. | Math Quest với ô điền từ |
| `reading-choice` | `passage`, `prompt`, bốn phương án `A`–`D`, `answer`; `passageTitle` tùy chọn. | Math Quest với đoạn đọc |
| `listening-choice` | `audioFile`, `audioTranscript`, `prompt`, bốn phương án `A`–`D`, `answer`. | Math Quest với trình phát âm thanh và lựa chọn |
| `listening-gap` | `audioFile`, `audioTranscript`, `prompt`, `acceptedAnswers`. | Math Quest với trình phát âm thanh và ô điền từ |

Danh sách trò chơi cuối cùng được kiểm tra trên nội dung thật. Các câu tạo ra mặt thẻ trùng nhau hoặc quá dài sẽ không được đưa vào trò ghép cặp. Phương án trắc nghiệm phải đủ bốn lựa chọn; đáp án mâu thuẫn bị từ chối.

`caseSensitive` của các câu điền từ nhận `true` hoặc `false`, mặc định `false`. `hint` dùng cho câu sắp xếp và các dạng nhập số, điền từ, đọc, nghe. `explanation` là lời giải cho trắc nghiệm và các dạng mở rộng. Hai trường này không dùng cho ghép cặp.

## Cách điền từng mẫu

Trong Word, giữ bảng thông tin `schema = baoan-online-week`, `formatVersion = 1`. Điền tên tuần ở `title`. Mỗi bảng câu hỏi có hai cột `field` và `value`; giữ nguyên cột tên trường và sao chép nguyên bảng khi thêm câu cùng loại. Nội dung ngoài các bảng câu hỏi không được nhập thành câu.

Trong Excel, giữ ba sheet `Thông tin bộ`, `Câu hỏi`, `Hướng dẫn`. Sheet `Câu hỏi` có mã mẫu ở hàng 1 và tên trường ở hàng 2; nhập dữ liệu từ hàng 3. Không đổi tên trường, không nhập công thức Excel. Hai dòng trống có sẵn cho mỗi loại giúp người soạn bắt đầu; có thể thêm dòng trong cùng sheet.

`subjectLabel` là tên môn tự đặt. `topic`, `competition`, `level` giữ nguyên nhãn tác giả cung cấp. `week` có thể ghi đè tên tuần trong bảng thông tin, nhưng phải thống nhất toàn tệp. `title` là tên bộ; các câu cùng môn và loại cần cùng `title`. `itemId` và `objectiveId` tùy chọn; khi bỏ trống, hệ thống tạo mã câu ổn định và dùng mục tiêu nội bộ chung.

## Nhập lại và cập nhật phiên bản

Trong giao diện, **Mã bộ tuần** tùy chọn nhận 3–48 chữ thường, số hoặc dấu gạch nối. Để trống để tạo mã ổn định từ tên tuần. Mã câu tác giả điền được giữ lại; mã tự sinh không đổi khi chỉ đảo thứ tự dòng. Nhập lại cùng nội dung không tạo tuần hoặc cấp sao thêm; đổi tên/mã một bộ cũ cũng không tạo nguồn thưởng mới.

Để sửa nội dung đã giao, chọn **Cập nhật tuần này** trong hành trình. Giữ nguyên các nhóm nhãn môn/dạng, mã bộ; ứng dụng tăng một phiên bản và cho đối chiếu nội dung cũ trước khi xác nhận. Tuần giữ vị trí, lượt chơi cũ giữ đáp án và tư liệu phiên bản cũ, lượt mới dùng bản mới. Sao tối đa vẫn tính chung theo bộ nguồn. Thêm/bớt nhóm thì tạo tuần mới; nội dung trùng một bộ cũ sẽ được báo để tránh nguồn sao lặp.

Lỗi Word chỉ rõ bảng/trường, lỗi Excel chỉ sheet/dòng/trường. Cả tuần được kiểm tra trước khi ghi; không giao một phần khi có lỗi. Không đổi tên cột hoặc tiêu đề `field`/`value` của bảng Word.

## Ảnh và âm thanh

Ảnh nhận PNG, JPEG, WebP. `imageFile` là tên tệp và `imageAlt` là mô tả thay thế, bắt buộc đi cùng nhau. Âm thanh nhận MP3, WAV, OGG; `audioFile` luôn cần `audioTranscript`. Hai dạng nghe bắt buộc có âm thanh. Có thể thêm ảnh hoặc âm thanh vào các dạng khác.

Bản cục bộ nhận tối đa 8 MB mỗi tệp (cloud hiện giới hạn 2 MB). Trình duyệt kiểm tra giải mã ảnh/phát âm thanh trước khi tải: ảnh tối đa 20 triệu điểm ảnh và 8192 điểm mỗi chiều; âm thanh hơn 0 đến 600 giây. Khi bị báo lỗi, xuất lại tệp theo định dạng được hỗ trợ hoặc chia nhỏ; không chỉ đổi đuôi tệp. Tệp cùng tên khác nội dung phải đổi tên để tham chiếu rõ. Bản chép lời bài nghe chỉ hiện cho học sinh sau khi trả lời.

Không nhúng tệp trực tiếp vào Word và không dùng địa chỉ web thay tên tệp. Khi hai tệp tải lên trùng tên, đổi tên để tham chiếu rõ ràng. Một tệp âm thanh được dùng lại cần cùng lời thoại và thông tin nguồn. Hệ thống đối chiếu mã tệp cùng hash từ danh mục đã tải lên; tài liệu không tự khai báo địa chỉ tải tệp.

`source` và `rights` ghi nguồn cùng quyền sử dụng. Khi bỏ trống, hệ thống ghi “Nội dung do người soạn cung cấp” và “Người soạn chịu trách nhiệm”. Nội dung nhập ở trạng thái bản nháp; việc nhập không tự xác nhận thẩm định chuyên môn.
