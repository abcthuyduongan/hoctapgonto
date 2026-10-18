# Nhập học liệu Excel

Mở **[Quản lý lớp & học liệu](http://127.0.0.1:4180/?online=1)** sau khi chạy `npm run build` và `npm run online`, hoặc mở `MO_BAO_AN.cmd` trong ZIP đã giải nén. Đăng nhập quản trị viên, chọn lớp rồi mở **Học liệu tuần**.

Hướng dẫn này dành cho luồng tài khoản và dữ liệu máy chủ cục bộ ở cổng 4180. Bản cài mới có kho câu hỏi rỗng, chờ giáo viên nhập và giao bộ tuần; học sinh chưa có bài không nhận câu mẫu. Khi cập nhật, giữ lại dữ liệu giáo viên đã nhập. Giao diện cũ đã được gỡ khỏi bản này.

Người soạn tự đặt tên môn, chủ đề, cuộc thi và mức độ; chọn tuần học trong danh sách của ứng dụng. Hệ thống nhận loại câu cùng đáp án để chọn trò chơi phù hợp; không suy đoán môn học từ nội dung.

Tải một trong hai mẫu ở mục quản trị: `public/question-templates/online-week.docx` hoặc `public/question-templates/online-week.xlsx`. Đây là mẫu luyện tập thông dụng. Nhãn Trạng Nguyên, IOE hoặc Violympic do người soạn ghi không xác nhận đề chính thức hay cấu trúc của một cổng thi.

## Quy trình nhập

1. Soạn nội dung trong Word `.docx` hoặc Excel `.xlsx` theo mẫu phiên bản 1. Tệp tối đa 1 MB; các định dạng Word `.doc` và Excel `.xls` cũ không được nhận.
2. Điền đúng tên ảnh và âm thanh vào bảng câu hỏi. Trong ứng dụng, chọn **Tuần học**, rồi dùng **Bộ câu hỏi, hình ảnh và âm thanh** để chọn cùng lúc một tài liệu và các tư liệu đi kèm. Dùng Ctrl/Shift để chọn nhiều tệp; có thể chọn tài liệu trước rồi chọn thêm tư liệu ở thư mục khác bằng cùng nút. Chọn tài liệu mới sẽ thay đợt nhập hiện tại.
3. Bấm **Kiểm tra & xem trước**. Tư liệu được kiểm tra và tải theo lô; câu hỏi được ghép theo đúng tên tệp. Mỗi môn và loại câu được gom thành một bộ, cần từ 2 đến 30 câu hợp lệ. Một tuần tối đa 30 bộ. Toàn tệp chỉ chứa một tuần nguồn.
4. Xem tổng câu hợp lệ và mục **Câu hỏi không được tải lên**. Câu lỗi có vị trí dòng Excel/bảng Word, mã câu nếu có và lý do; các câu này bị loại khỏi nội dung giao cho lớp. Mở các câu hợp lệ để kiểm tra đáp án, đoạn đọc, hình/âm thanh và thử trả lời, rồi chọn **Giao N câu hợp lệ cho lớp**. Việc xem trước và thử câu chưa đưa câu hỏi vào lớp, không ghi sao.

Ứng dụng nhận các tệp độc lập, chưa nhận ZIP làm đầu vào. Nút **Tải bộ mẫu đầy đủ (.zip)** cung cấp file Excel đã điền đủ tám dạng, ảnh, âm thanh có lời đọc và hướng dẫn. Giải nén, chọn file Excel cùng tất cả ảnh/âm thanh bên trong, chọn tuần rồi kiểm tra. Không cần nhập tay tên tuần. Chỉ cung cấp mẫu Excel trống; tệp Word phiên bản cũ vẫn đọc được để giữ tương thích.

Các bảng Word và dòng Excel còn trống được bỏ qua. Mẫu trống chỉ chứa khung nhập, không có câu mẫu tự động đưa vào lớp. Nếu chưa điền câu hỏi, hệ thống báo mẫu trống.

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

`subjectLabel` là tên môn tự đặt. `topic`, `competition`, `level` giữ nguyên nhãn tác giả cung cấp. `week` và tên trong bảng thông tin mô tả bộ nguồn, phải thống nhất toàn tệp; tuần được giao cho lớp lấy theo danh sách **Tuần học** trên giao diện. `title` là tên bộ; các câu cùng môn và loại cần cùng `title`. `itemId` và `objectiveId` tùy chọn; khi bỏ trống, hệ thống tạo mã câu ổn định và dùng mục tiêu nội bộ chung.

## Nhập lại và cập nhật phiên bản

Trong **Tùy chọn bộ câu hỏi**, **Mã bộ tuần** tùy chọn nhận 3–48 chữ thường, số hoặc dấu gạch nối. Để trống để tạo mã ổn định từ thông tin bộ nguồn trong tài liệu (hoặc tuần đã chọn nếu tài liệu không có tên). Đổi tuần trên danh sách không đổi mã của một bộ đã có thông tin nguồn. Mã câu tác giả điền được giữ lại; mã tự sinh không đổi khi chỉ đảo thứ tự dòng. Nhập lại cùng nội dung không tạo tuần hoặc cấp sao thêm; đổi tên/mã một bộ cũ cũng không tạo nguồn thưởng mới.

Để sửa nội dung đã giao, chọn **Cập nhật tuần này** trong hành trình. Giữ nguyên các nhóm nhãn môn/dạng, mã bộ; ứng dụng tăng một phiên bản và cho đối chiếu nội dung cũ trước khi xác nhận. Tuần giữ vị trí, lượt chơi cũ giữ đáp án và tư liệu phiên bản cũ, lượt mới dùng bản mới. Mỗi câu nguồn tối đa 3 sao dùng chung mọi trò và phiên bản; giữ mã câu khi sửa. Thêm/bớt nhóm thì tạo tuần mới; nội dung trùng một bộ cũ sẽ được báo để tránh nguồn sao lặp. Học sinh đã xác nhận sang tuần mới không quay lại tuần cũ; tránh thêm câu vào tuần đã đóng, nên giao nội dung bổ sung ở tuần chưa học.

Có thể giao cùng mã bộ và phiên bản cho nhiều lớp, kể cả khác khối. Thông tin khối của bộ giữ theo bản đã công bố; hồ sơ học sinh theo khối của lớp đang học. Chuyển lớp hoặc chơi lại bộ nguồn đã đạt sao không cấp lại sao từ đầu. Cập nhật tuần chỉ đổi phiên bản của tuần được chọn; các lớp khác tiếp tục giữ phiên bản đang được giao cho đến khi giáo viên cập nhật riêng.

Lỗi Word chỉ rõ bảng/trường, lỗi Excel chỉ sheet/dòng/trường. Các câu lỗi bị loại, còn các bộ hợp lệ vẫn có thể giao. Nếu sau khi loại chỉ còn một câu trong nhóm, câu còn lại cũng được báo chưa đủ ít nhất hai câu để chơi. Bộ quá 30 câu phải chia lại, không tự cắt bớt. Tệp hỏng, sai schema/cột chung hoặc chứa nhiều tuần nguồn phải sửa trước khi xem trước. Không đổi tên cột hoặc tiêu đề `field`/`value` của bảng Word.

Khi cập nhật tuần đã giao, phải giữ đủ nhóm môn và dạng của tuần gốc. Nếu loại câu làm mất cả nhóm, ứng dụng chặn xác nhận và yêu cầu sửa đủ nhóm; dữ liệu đã giao và lịch sử học không bị thay đổi.

## Ảnh và âm thanh

Ảnh nhận PNG, JPEG, WebP. `imageFile` là tên tệp và `imageAlt` là mô tả thay thế, bắt buộc đi cùng nhau. Âm thanh nhận MP3, WAV, OGG; `audioFile` luôn cần `audioTranscript`. Hai dạng nghe bắt buộc có âm thanh. Có thể thêm ảnh hoặc âm thanh vào các dạng khác.

Bản cục bộ nhận tối đa 8 MB mỗi tệp (cloud hiện giới hạn 2 MB). Trình duyệt kiểm tra giải mã ảnh/phát âm thanh trước khi tải: ảnh tối đa 20 triệu điểm ảnh và 8192 điểm mỗi chiều; âm thanh hơn 0 đến 600 giây. Tệp lỗi được liệt kê trong **Tệp không được sử dụng**; các câu cần tệp đó bị loại, các câu hợp lệ khác vẫn tiếp tục. Khi bị báo lỗi, xuất lại tệp theo định dạng được hỗ trợ hoặc chia nhỏ; không chỉ đổi đuôi tệp. Tệp cùng tên khác nội dung phải đổi tên để tham chiếu rõ, không tự dùng nhầm bản cũ. Bản chép lời bài nghe chỉ hiện cho học sinh sau khi trả lời.

Không nhúng tệp trực tiếp vào Word và không dùng địa chỉ web thay tên tệp. Khi hai tệp tải lên trùng tên, đổi tên để tham chiếu rõ ràng. Một tệp âm thanh được dùng lại cần cùng lời thoại và thông tin nguồn. Hệ thống đối chiếu mã tệp cùng hash từ danh mục đã tải lên; tài liệu không tự khai báo địa chỉ tải tệp.

Sau khi tải tư liệu ở tab quản trị khác, bấm **Làm mới dữ liệu** để cập nhật danh sách rồi kiểm tra tài liệu. Khi kho tư liệu thay đổi, phần xem trước cũ được đóng để bạn kiểm tra lại trước khi giao. Nếu hình trong trò Nối Từ hoặc Trí Nhớ chưa tải được, dùng **Tải lại hình** bên ngoài bảng thẻ; thao tác này không ghi đáp án.

Trên cloud, các tệp nhỏ được gom tối đa 24 tệp và 2 MB mỗi đợt để giảm thời gian chờ. Mỗi tệp vẫn được kiểm tra định dạng và quyền truy cập; có tiến độ trong lúc kiểm tra/tải. Xem trước không tải lại toàn bộ dashboard. Các câu đang đóng chỉ hiện tiêu đề; mở câu cần duyệt để xem đáp án, nghe âm thanh hoặc thử làm.

Ô không dùng phải để trống, không điền chữ `null`. Ví dụ, câu `fill-blank` cần `acceptedAnswers`, còn các cột A/B/C/D và tên tệp không sử dụng để trống. Lỗi nhập liệu chỉ rõ dòng/bảng, được đưa vào vùng nhìn để có thể sửa ngay.

RC8 bổ sung trường tùy chọn `allowedGameIds` trong Word/Excel và metadata JSON. Để trống thì dùng mọi trò hỗ trợ dữ liệu; nhiều mã tách bằng `|`: `math-quest`, `memory-match`, `word-connect`, `sentence-builder`, `sequence-trail`. Ví dụ câu 2 ghi `memory-match|word-connect` thì cả bộ chỉ dùng hai trò này nếu mọi câu còn lại đều phù hợp. Người soạn chỉ được bớt trò; không thể ép câu đọc/nghe vào trò không hỗ trợ. Bảng xem trước giải thích từng câu và game chung của cả bộ; không tự bỏ câu để mở thêm game. Bộ không còn game chung phải sửa hoặc tách trước khi giao. Sửa giới hạn cho bộ đã giao cần tăng phiên bản qua tuần gốc, vẫn giữ trần ba sao cho mỗi câu nguồn.

`source` và `rights` ghi nguồn cùng quyền sử dụng. Khi bỏ trống, hệ thống ghi “Nội dung do người soạn cung cấp” và “Người soạn chịu trách nhiệm”. Nội dung nhập ở trạng thái bản nháp; việc nhập không tự xác nhận thẩm định chuyên môn.

## Quy tắc RC9

Tuần mới có 3–4 môn, tối đa 12 câu/môn cộng chung mọi dạng/bộ; không tự cắt câu. Tuần đã giao trước RC9 giữ cấu hình cũ. Mỗi câu tối đa 3 sao dùng chung các game. Trước khi giao, chọn số môn và xếp các nhóm về đúng môn; bản xem trước hiện số câu theo độ khó và trần sao. Gợi ý 12 câu/môn: 4 easy, 5 medium, 3 hard; đây là nhãn biên soạn, cần giáo viên duyệt.

Thêm cột tùy chọn `difficulty`: `easy`, `medium`, `hard`; bỏ trống mặc định `medium`. `level` vẫn là nhãn tác giả. Chỉ cung cấp mẫu Excel trống và ZIP đầy đủ (36 câu/3 môn/10 bộ + 2 PNG + 2 WAV + hướng dẫn). Không tạo mẫu Word mới.

`null` không phân biệt hoa thường, có thể có khoảng trắng, được nhận là thiếu dữ liệu. Trường bắt buộc thiếu báo vị trí dòng/cột và loại câu khỏi nội dung giao. Trường tùy chọn coi như trống, áp dụng giá trị mặc định nếu có. `#NULL!`, `#VALUE!`, `#REF!` và ô lỗi Excel luôn bị báo lỗi, kể cả ở cột tùy chọn. Giá trị số `0` và boolean `false` được giữ nguyên. Dòng chưa điền nội dung trong mẫu trống được bỏ qua.

Danh sách quản trị/thư viện tải tối đa 20 mục mỗi lần. Khi xem trước, hệ thống tra metadata của đúng tên tệp tài liệu tham chiếu, không phụ thuộc trang thư viện đang xem. Mở chi tiết mới tải nội dung một tuần. Tuần đã có học sinh đóng không được thêm/bớt/đổi nội dung chấm điểm; chỉ cập nhật trình bày/lời giải, giữ ID và sao.
