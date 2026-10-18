> Cập nhật thực hiện RC9: người dùng đã chốt kế hoạch và yêu cầu chỉ làm mẫu Excel. H1–H4 đã có mã và kiểm thử; mẫu 36 câu, null và ô lỗi được xử lý. H5–H6 vẫn cần giáo viên/thiết bị thật, triển khai cùng commit và phục hồi cloud trên môi trường riêng. Xem báo cáo RC9 để biết bằng chứng và giới hạn.

# Hoàn thiện các phần còn tồn đọng và tuần học 3–4 môn

Ngày 17/10/2026. Đây là kế hoạch bổ sung sau RC8; trạng thái thực hiện RC9 được ghi ở đầu tài liệu và báo cáo kèm theo. RC8 đã kiểm thử cục bộ 292 ca Node và 90 ca Chrome/Edge; chưa xác nhận tốc độ, giọng đọc và vận hành trên website thật. Không thay đổi hoặc đóng gói lại các ZIP RC8 đã bàn giao trong bước lập kế hoạch này.

## 1. Phạm vi đã chốt và cấu hình đề xuất

Người dùng xác nhận: **mỗi tuần chỉ giao 3–4 môn, tất cả câu đều có sao**. Giới hạn này áp dụng cho số môn học, không phải số bộ câu hỏi hoặc số trò chơi. Một môn có thể có nhiều bộ/dạng câu.

Giữ các luật đã chốt: mỗi câu nguồn tối đa 3 sao dùng chung mọi trò; tăng 1→3 chỉ cộng 2; mọi câu của tuần phải đạt ít nhất 2 sao; đủ yêu cầu thì cho ôn hoặc xác nhận chuyển tuần; tuần đã qua vẫn khóa. Không đổi tỷ lệ đổi quà, không xóa sao và không chuyển sao cũ thành thành tích câu.

**Đề xuất để thử, chưa coi là yêu cầu đã chốt:** mặc định 3 môn, có thể chọn môn thứ 4; mục tiêu 12 câu/môn/tuần và trần mới đề xuất 12 câu/môn. Giảm số câu trùng mục tiêu để dành chỗ cho câu vận dụng. Tên môn do giáo viên chọn, ví dụ Toán, Tiếng Việt, Tiếng Anh; môn thứ 4 theo nội dung cần học, không tự chọn thay giáo viên.

| Phương án đủ 12 câu/môn | Tổng câu mới/tuần | Tổng sao khi mọi câu đạt 2 | Trần sao khi mọi câu đạt 3 |
|---|---:|---:|---:|
| 3 môn | 36 | 72 | 108 |
| 4 môn | 48 | 96 | 144 |

So với 140 câu/420 sao, hai phương án giảm lượng câu và trần sao nhưng không thay giá trị sao đã kiếm được. Chỉ giới hạn số môn chưa đủ: 3 môn vẫn có thể chứa 140 câu nếu không kiểm soát số câu/môn. Số lượng thực tế có thể thấp hơn 12, nhưng mỗi nhóm môn/dạng vẫn cần 2–30 câu theo giới hạn đang có; không cắt câu âm thầm để vừa trần.

## 2. Những khoảng trống đã đối chiếu trong mã

| Vấn đề còn lại | Bằng chứng hiện tại | Việc cần hoàn thiện |
|---|---|---|
| Chưa có giới hạn 3–4 môn và tổng câu/môn | Tuần chứa danh sách `sets`; `subjectLabel` là nhãn tác giả nhập | Chuẩn hóa mã môn, cộng số câu qua mọi bộ của cùng môn, kiểm tra trước giao và tại máy chủ |
| Nhãn môn không phải mã môn ổn định | `Toán`, `toán`, nhãn chủ đề có thể thành nhóm khác; `pack.subject` phục vụ game và chỉ có bốn giá trị | Tách định danh môn của tuần khỏi tên hiển thị và loại môn dùng cho game; không đếm số bộ hoặc dùng `thinking` để gộp mọi môn khác |
| Độ khó trong Word/Excel chưa được sử dụng đúng nghĩa | `QuestionMetadata` có `difficulty: easy/medium/hard`, nhưng `rowMetadata` hiện gán mọi câu `medium`; `level` chỉ lưu chuỗi nhãn | Thêm trường độ khó tùy chọn vào mẫu/import, dùng đúng metadata có sẵn và đối chiếu tỷ lệ khi preview |
| Trang quản trị vẫn tải rộng | `OnlineScreen.refresh` lấy dashboard và media; dashboard đọc học liệu các lớp và tính thống kê | Tách danh sách tóm tắt, chi tiết tuần được chọn và tư liệu theo nhu cầu; đo cả truy vấn máy chủ |
| Ngưỡng sao và độ khó giữa trò chưa được nghiệm thu | Mốc theo dạng đã có; ghép cặp có thể dễ đạt 3 sao hơn câu tính giờ | Thử với học sinh, dùng trò phù hợp mục tiêu của câu; chưa tăng sao cho câu khó hoặc tự đổi luật lấy mức cao nhất |
| Sửa tuần đã có học sinh chuyển qua dễ gây khó hiểu | API cập nhật phiên bản vẫn cho sửa; con trỏ học sinh không lùi | Cảnh báo số học sinh đã đóng tuần và bảo vệ thay đổi nội dung ảnh hưởng tiến độ |
| Thông báo phiên bản chưa đủ rõ | `assertCurrentPlay` dùng chung lỗi tuần cho cả phiên bản bộ đã đổi | Phân biệt tuần khóa, bộ vừa cập nhật, lượt hết hạn và mất mạng; giữ sao đã lưu khi mở lại |
| Trần sao chưa xuyên mọi bộ sao chép từng phần | ID câu giữ qua phiên bản cùng bộ; bản sao riêng sang bộ khác có thể là nguồn khác | Cảnh báo nguồn trùng cho người soạn; chỉ thêm liên kết nguồn chung khi có quy trình biên soạn cần dùng |
| Vận hành thật còn thiếu bằng chứng | Kiểm thử cục bộ đạt; chưa có log nguyên văn lỗi chậm trên Netlify và nghiệm thu thiết bị thật | Đo mở trang/trò/media/lưu đáp án, nghe giọng Việt, kiểm tra nhiều thiết bị và phục hồi cloud |

Nguồn đối chiếu: `src/core/online-document-import.ts`, `src/core/contracts.ts`, `src/core/online-contracts.ts`, `src/screens/OnlineScreen.tsx`, `server/online-store.mjs`, `server/postgres-store.mjs`, `server/student-summary.mjs`.

## 3. Thiết kế tuần mới và chất lượng câu hỏi

### Giao 3–4 môn mà không làm rối luồng nhập

1. Trong màn giao tuần, giáo viên chọn 3 hoặc 4 môn từ một danh sách chung. Môn đã dùng được chọn lại; không buộc gõ tên trên từng dòng nếu tài liệu đã xác định rõ môn.
2. Gắn mã môn ổn định cho nhóm được giao, giữ `subjectLabel` để hiển thị. Cùng mã môn có nhiều bộ vẫn chỉ tính một môn. Các nhãn gần giống được đề nghị đối chiếu, không tự gộp hai môn khác nhau chỉ vì chuỗi giống nhau.
3. Preview hiện một bảng ngắn: môn, số câu, số câu theo độ khó, số bộ, game phù hợp và trần sao cả tuần. Chỉ mở chi tiết câu khi cần.
4. Bản nháp có thể chưa đủ môn. Khi giao tuần mới, kiểm tra 3–4 môn và giới hạn câu/môn tại UI lẫn SQLite/PostgreSQL. Nhập một phần vẫn chỉ giữ câu hợp lệ, nhưng tuần thiếu môn hoặc vượt trần phải chỉnh lại trước giao. Không tự bỏ môn thứ 5, không tự chọn câu dễ để cắt bớt.
5. Câu thiếu tư liệu, sai đáp án hoặc không có trò chung tiếp tục được báo rõ như RC8. Mỗi môn chỉ nên dùng 2–3 dạng phù hợp trong một tuần, để tránh các nhóm chỉ có một câu không thể giao. Không tách bộ chỉ vì khác độ khó.

### Ít câu hơn nhưng tăng yêu cầu tư duy

Đề xuất cho 12 câu/môn: **4 câu nền tảng, 5 câu vận dụng, 3 câu nâng cao**. Đây là tỷ lệ biên soạn để thử, không phải kết luận tự động về chất lượng đề.

- Câu nâng cao yêu cầu áp dụng vào tình huống, liên hệ nhiều dữ kiện hoặc thực hiện nhiều bước trong phạm vi lớp học. Không tạo độ khó bằng đề mơ hồ, chữ quá nhỏ, đoạn quá dài hoặc hạn giờ ngắn.
- Có đáp án rõ, lời giải kiểm chứng được và gợi ý theo bước ở dạng hỗ trợ gợi ý. Câu trắc nghiệm có một đáp án đúng, phương án nhiễu có ý nghĩa; câu đọc/nghe giữ đủ ngữ cảnh.
- Thêm cột `difficulty` tùy chọn nhận `easy`, `medium`, `hard`; hiển thị nhãn tiếng Việt. `level` vẫn là nhãn tác giả, không tự biến thành độ khó. Tài liệu cũ tiếp tục đọc được; nhãn trung bình mặc định cũ chưa chứng minh đã được giáo viên phân loại.
- Độ khó thuộc từng câu, không tạo bản sao câu hoặc nguồn sao mới. Sửa nhãn độ khó/gợi ý giữ ID; nội dung học khác thực sự phải phân biệt rõ khi biên soạn.
- Câu cần suy luận phải chọn trò giữ được ngữ cảnh; người soạn có thể dùng `allowedGameIds` để tránh trò ghép cặp làm lộ ngay kết quả cần suy luận. Tối đa 3 sao/câu vẫn giữ nguyên, không tự thưởng thêm cho nhãn `hard`.
- Chưa chốt ngưỡng thời gian mới cho câu khó. Thử theo dạng/độ dài/độ khó, sau đó ghim cấu hình đã chọn vào lượt chơi để máy chủ, giao diện và phục hồi dùng cùng một luật. Mốc của lượt đã mở không đổi giữa chừng.

Mọi câu nâng cao vẫn cần 2 sao theo yêu cầu hoàn thành tuần. Vì vậy phải duyệt độ vừa sức, gợi ý và mốc thời gian trước giao; không chữa tình trạng kẹt tuần bằng bỏ qua câu hoặc tự cấp sao.

### Dữ liệu cũ và tuần đã học

- Giới hạn 3–4 môn và trần câu mới chỉ áp dụng cho tuần mới khi tính năng được triển khai. Tuần cũ nhiều môn/câu được đánh dấu cấu hình cũ; không tự xóa, chia tuần, cắt câu hoặc đặt lại tiến độ.
- Không đổi ID câu/bộ vì chuẩn hóa tên môn. Thay đổi hiển thị hoặc cách phân nhóm không tạo nguồn thưởng khác.
- Với tuần đã có học sinh xác nhận chuyển qua: cảnh báo số học sinh bị ảnh hưởng; đề xuất chặn thêm/bớt/đổi nội dung chấm điểm trong tuần đó. Giao nội dung bổ sung ở tuần chưa học. Chỉnh lời giải thuần trình bày vẫn phải giữ lịch sử phiên bản và không phát sao mới.
- Trước thay hợp đồng/lưu trữ, thiết kế và kiểm tra migration trên bản sao riêng. Không mặc định có thể giữ nguyên schema chỉ vì RC8 chưa cần migration; sao lưu/khôi phục phải chứa được cấu hình môn mới.

## 4. Thứ tự thực hiện và tiêu chí hoàn thành

| Mốc | Công việc | Kết quả nghiệm thu bắt buộc |
|---|---|---|
| H1 — ưu tiên đầu | Chốt cấu hình tuần, thêm mã môn và kiểm tra số môn/câu ở hai kho dữ liệu | 3 và 4 môn giao được; 2/5 môn bị báo khi giao tuần mới; nhiều bộ cùng môn cộng đúng số câu; API trực tiếp không vượt giới hạn; tuần cũ và sao cũ không đổi |
| H2 | Nâng mẫu Excel, đọc độ khó và bảng preview theo môn | Mẫu đầy đủ 3 môn/36 câu, mỗi môn có ảnh hoặc âm thanh ở nơi cần; import đọc đúng độ khó; tệp cũ vẫn nhận; lỗi chỉ rõ dòng/bảng; không tự nạp mẫu vào lớp |
| H3 | Bảo vệ cập nhật tuần đã đóng và sửa thông báo lỗi theo nguyên nhân | Tuần cũ không mở lại; giáo viên biết có bao nhiêu học sinh đã chuyển; cập nhật không làm mất sao/lượt đã ghi; mất mạng, khóa tuần và đổi phiên bản có thông báo khác nhau |
| H4 | Giảm dữ liệu trang quản trị và thêm thao tác tiếp tục các câu chưa đạt 2 sao | Danh sách tối đa 20 mục/trang, thay trang cũ thay vì tích lũy; mở một tuần mới tải chi tiết tuần đó; bộ cần học tiếp tối đa 30 câu, giữ ID và cặp đối chiếu nếu game cần |
| H5 | Duyệt học liệu khó, thử thời gian và giọng Việt trên thiết bị thật | Giáo viên kiểm đáp án/gợi ý; có số liệu câu đúng nhưng chỉ đạt 1 sao; không có câu kẹt vì đáp án lỗi; ghi rõ giọng có sẵn/thiếu và thử lần đầu mở ứng dụng |
| H6 | Kiểm tra triển khai, tốc độ website và phục hồi cloud | UI/Function cùng phiên bản; đúng nhánh Netlify; ghi cold/warm, mã lỗi và thời gian từng bước; thử đăng nhập hai thiết bị; khôi phục PostgreSQL và tệp Storage vào môi trường riêng |

Đo tốc độ website và xác nhận lỗi hiện tại có thể làm sớm, không cần chờ mọi chức năng mới. Việc tách truy vấn quản trị phải có số đo trước/sau; không chỉ phân trang trên trình duyệt sau khi đã tải mọi dữ liệu về.

Ở H4, thống kê dùng truy vấn tổng hợp thay vì đọc toàn bộ JSON câu hỏi để đếm. Phân trang danh sách tư liệu không được làm trình nhập báo thiếu nhầm tệp ngoài trang đang mở: tra cứu metadata của đúng các tên/mã tư liệu mà tài liệu tham chiếu, vẫn kiểm tra hash, loại tệp và quyền truy cập.

Nếu phép đo cho thấy cảnh 3D chiếm đường truyền hoặc làm máy giật, ưu tiên tải game và tư liệu câu hỏi trước cảnh nền, đánh giá chế độ Nhẹ đang có và dọn tài nguyên khi thoát. Không thêm cảnh/model mới vào đợt hoàn thiện này để bù cho lỗi tải.

Liên kết nguồn câu xuyên các bộ đặt sau H1–H6, trừ khi phát hiện dữ liệu trùng thực tế ảnh hưởng sổ sao. Không tự gộp chỉ từ prompt giống nhau vì hình, đoạn đọc, âm thanh hoặc đáp án có thể khác. Chuyển toàn bộ SQLite lên cloud chỉ bổ sung nếu thực tế cần chuyển kho; không tự nhập đè kho đang chạy.

## 5. Kế hoạch kiểm tra tải và dữ liệu

- Hai bộ dữ liệu riêng để đo: 52 tuần × 3 môn × 12 câu = **1.872 câu**; 52 tuần × 4 môn × 12 câu = **2.496 câu**. Thêm một fixture tuần cũ 140 câu để bảo đảm không áp giới hạn mới ngược vào dữ liệu đã có. Mọi phép thử ghi dữ liệu dùng kho thử, không dùng tài khoản học sinh thật.
- So sánh số byte phản hồi, số truy vấn và thời gian máy chủ của danh sách, chi tiết tuần, mở game và gửi đáp án; đếm cả dữ liệu đã đọc trước phân trang. Không gửi toàn bộ câu/đoạn đọc/media trong danh sách tóm tắt.
- Đo sau warm-up và 20 lần vào/thoát: heap sau GC, DOM, listener, audio, canvas và texture/geometry/program. Tìm xu hướng tăng theo vòng; không coi một lần heap tăng là bằng chứng rò rỉ, cũng không suy bộ nhớ GPU từ ZIP.
- Thử mạng chậm/ngắt, ảnh và audio lỗi, tải scene/chunk thất bại, đổi lớp/đăng xuất khi request đang chờ; không cộng sao trùng, không hiện dữ liệu của tài khoản trước và không bị khóa nút thử lại vô hạn.
- Thử 10 rồi 30 phiên đồng thời trên môi trường thử có kiểm soát, gồm gửi trùng và chơi nhiều game cùng câu. Đo mức dùng kết nối/lỗi/thời gian đáp ứng rồi xác định quy mô phục vụ; không coi các con số này là năng lực production đã được bảo đảm.
- Log chẩn đoán chỉ gồm thao tác, đường API, mã HTTP, thời gian và mã đối chiếu; giới hạn số bản ghi, không ghi mật khẩu, cookie, đáp án hoặc học liệu. Không thêm polling hoặc bộ đệm không giới hạn để theo dõi lỗi.
- Kịch bản chuyển tuần: mọi câu của cả 3/4 môn đạt 2 sao; báo số câu 2/3 sao; ôn hoặc xác nhận; tuần trước vẫn khóa trên thiết bị khác và request cũ. Sao lưu/khôi phục phải giữ luật tuần, môn, ID, sao và lịch sử.

Kết quả tốc độ cục bộ RC8 chỉ là baseline. Mục tiêu của đợt mới là số liệu trước/sau trên cùng máy, học liệu và điều kiện mạng; chưa đặt lời hứa thời gian tải Netlify khi chưa đo thực tế.

## 6. Điều kiện bàn giao và phạm vi chưa thay đổi

Thực hiện H1–H4 thành thay đổi có thể kiểm tra trên máy, kèm mẫu và báo cáo; H5–H6 cung cấp bằng chứng dùng thử/vận hành trước khi đánh dấu sẵn sàng production. Kiểm thử mới tập trung vào quy tắc môn, độ khó, tính tương thích dữ liệu, tải quản trị và bảo vệ tuần; chạy lại các ca hồi quy sao, phục hồi và quyền truy cập liên quan.

Gói tiếp theo dùng số phiên bản mới, có manifest/hash và hướng dẫn cập nhật UI/Function cùng đợt; giữ các gói RC8 bất biến. Không tự xuất bản website hoặc mô tả đề xuất 12 câu/môn, tỷ lệ 4/5/3, giới hạn môn và bảo vệ chỉnh tuần là đã hoạt động khi mới có kế hoạch.

Tài liệu gốc: [sao và khóa tuần RC8](KE_HOACH_SAO_TUNG_CAU_VA_KHOA_TUAN_2026-10-17.md), [tải dữ liệu và phân màn](KE_HOACH_TAI_DU_LIEU_VA_PHAN_MAN_2026-10-17.md), [báo cáo rà soát](BAO_CAO_RA_SOAT_2026-10-16.md).
