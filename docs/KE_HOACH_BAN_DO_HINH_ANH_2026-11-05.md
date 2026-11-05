# Kế hoạch bản đồ hình ảnh và giao diện Bảo An Learning

Ngày lập: **05/11/2026**. Trạng thái: **đề xuất thiết kế và bộ hướng dẫn tạo ảnh để người dùng chuẩn bị**. Chưa triển khai bản đồ hình ảnh trong đợt lập kế hoạch này.

Tài liệu này bổ sung [kế hoạch và nhật ký giao diện](KE_HOACH_GIAO_DIEN_VA_TIEN_DO.md). Giao diện hiện tại là nền nghiệp vụ đã kiểm tra; các khung chọn bài hiện nay chưa phải bản đồ có phong cảnh.

## 1. Mục tiêu và phạm vi đã chốt

Xây trải nghiệm: **mở bản đồ → chọn vùng đất → chọn chặng tuần → chọn bộ câu và trò → chơi → trở về đúng địa điểm, thấy tiến độ mới**.

- Người dùng tạo và cung cấp ảnh; người phát triển ghép ảnh, tạo vùng bấm, nút, chữ, đường đi và nối dữ liệu.
- Học liệu và câu hỏi do người dùng đưa lên. Không cần danh mục kỹ năng, skillId, bộ sinh câu hay chốt SGK để làm bản đồ.
- Nhân vật đồng hành giữ thật nhẹ: emoji hoặc một hình tĩnh nhỏ nếu người dùng muốn thay. Không làm mô hình, sprite sheet, nhân vật đi bộ hoặc hệ thống dựng cảnh thời gian thực.
- Theo yêu cầu mới, bản đồ có **ảnh minh họa tĩnh**. Đây là phần bổ sung cho quyết định giao diện nhẹ trước đó, không khôi phục engine đồ họa.
- Giữ quyền truy cập, câu hỏi, sao, khóa tuần và đổi thưởng hiện có.
- Tham khảo tinh thần khám phá và hình ảnh thân thiện của [Munworld](https://munworld-explorer.vercel.app/). Những bố cục và địa điểm dưới đây là đề xuất riêng cho Bảo An. Việc tham khảo trước đó mới xem trang giới thiệu công khai, chưa xác minh giao diện bản đồ sau đăng nhập của Munworld.

## 2. Chốt cấu trúc: hai cấp bản đồ

### Cấp 1 — Bản đồ thế giới

Một quần đảo liền mạch về hình ảnh, gồm bốn vùng quanh một quảng trường nhỏ:

| Vị trí | Vùng | Dấu hiệu hình ảnh | Khi bấm |
| --- | --- | --- | --- |
| Trên trái | Đảo Số — Toán | Đồi xanh, ruộng ô vuông, bánh xe số không có chữ, con suối | Vào bản đồ vùng Toán |
| Trên phải | Rừng Chữ — Tiếng Việt | Rừng cây, lối mòn, vườn hoa, khoảng trống đặt thư viện | Vào bản đồ vùng Tiếng Việt |
| Dưới trái | Cảng English — Tiếng Anh | Biển xanh, bến cảng, đảo nhỏ, đường ven biển | Vào bản đồ vùng Tiếng Anh |
| Dưới phải | Phố Robot — Tin học | Vườn công nghệ hiền hòa, đường mạch đơn giản, cây xanh | Vào bản đồ vùng Tin học |
| Giữa | Quảng trường Bảo An | Bãi cỏ hoặc quảng trường trống, biểu tượng nhỏ do ứng dụng đặt | Điểm trở về; mở ví sao từ nút hiện có |

Mỗi vùng có tên và tiến độ bằng chữ thật của giao diện. Không vẽ sẵn chữ vào tranh.

Tên môn do người dùng tự đặt vẫn được giữ. Môn ngoài bốn nhóm sẽ dùng bản đồ chung bằng nền màu ở bản đầu; có thể bổ sung ảnh vùng chung ở nhóm tùy chọn.

Bốn vùng có thể xuất hiện về mặt cảnh quan từ đầu. Trạng thái truy cập dựa trên học liệu thực tế: vùng chưa có bài hiển thị thông tin đang chờ, không tạo bài hay tuần giả.

### Cấp 2 — Bản đồ từng vùng

Mỗi vùng dùng một phong cảnh riêng, có **tối đa 7 vị trí chặng** trên một đường khám phá.

- Một chặng tương ứng **một tuần đã giao có học liệu của môn đó**.
- Chọn chặng mở bảng bộ câu của tuần/môn; một tuần có thể có nhiều bộ với nhiều dạng câu.
- Một nền vùng được dùng lại cho các nhóm 7 tuần. Nếu có 35 tuần thì tối đa 5 trang hành trình; số trang dựa trên tuần thực có.
- Không tạo 35 tranh cho từng môn. Bốn nền vùng được tái sử dụng, còn số tuần, dấu hoàn thành và trạng thái khóa do giao diện hiển thị.
- Vị trí chưa có tuần không hiện nút chặng. Phong cảnh vẫn liền mạch.
- Không tự phân loại câu vào bài SGK. Việc chọn vùng chỉ ánh xạ nhãn môn của bộ đã tải lên.

### Quy tắc tuần phải giữ

| Trạng thái từ máy chủ | Cách nhìn | Hành động |
| --- | --- | --- |
| Tuần đang học, chưa đủ yêu cầu | Điểm đánh dấu nổi bật, nhãn Đang khám phá | Mở bộ câu và trò được phép |
| Tuần đang học, đã đủ yêu cầu | Dấu hoàn thành và nút chuyển tuần theo luồng hiện có | Được ôn trước khi xác nhận; chuyển tuần qua hộp xác nhận |
| Tuần đã qua và khóa | Màu dịu, dấu khóa và trạng thái Đã qua | Xem tóm tắt; không tự mở chơi lại |
| Tuần tương lai đã được giao | Khóa, nhãn Chưa tới | Xem lý do chưa mở; không gọi bắt đầu chơi |
| Chưa có học liệu | Không có điểm chơi; thông báo chờ | Làm mới hoặc trở về bản đồ |

Mức sao của mỗi câu và điều kiện chuyển tuần vẫn do máy chủ quyết định. Vào xem bản đồ, chọn vùng hoặc chọn địa điểm không sinh sao.

## 3. Phong cách hình ảnh đề xuất

**Sổ phiêu lưu thiên nhiên, màu dịu, dễ nhận ra từng vùng.**

- Tranh phẳng, hình khối lớn, viền mềm và rõ; góc nhìn từ trên xuống hơi nghiêng để đọc được đường đi.
- Không dùng phong cách render đồ chơi 3D, đổ bóng nặng, ánh sáng điện ảnh, chất liệu kim loại bóng hoặc phong cảnh quá chi tiết.
- Nền ít tương phản; địa điểm quan trọng rõ nét hơn. Cây, mây và cỏ có thể tĩnh hoàn toàn.
- Không thêm người hoặc thú làm nhân vật chính vào bản đồ nền. Cáo nhỏ nằm ở một góc giao diện, không cần chạy trên đường.
- Mỗi vùng nhận ra bằng hình dạng và cảnh vật, không chỉ bằng màu.
- Giữ phong cách và hướng ánh sáng giống nhau giữa map, địa điểm và ảnh trò.
- Tránh chép nhân vật, logo, tên trò, hình ảnh hay bố cục đặc trưng của trang tham khảo.

Bảng màu tham khảo để bạn tạo ảnh đồng bộ:

| Vai trò | Màu |
| --- | --- |
| Nền giấy | #F7F3E6 |
| Màu mực/viền chính | #405747 |
| Toán | #A9C88F, #DDE9C7 |
| Tiếng Việt | #7FA77B, #E8C5A1 |
| Tiếng Anh | #8FC5D5, #E9D6A8 |
| Tin học | #B9B0D3, #D8E4DE |
| Điểm nhấn phần thưởng | #D7AA50 |

Các mã màu là định hướng, không bắt buộc tranh phải khớp từng pixel.

## 4. Bố cục map để bạn vẽ đúng chỗ

### 4.1. Bản đồ tổng

Tọa độ dưới đây tính theo phần trăm từ góc trên trái của **riêng ảnh bản đồ**, không tính thanh tiêu đề của ứng dụng.

| Điểm neo | Bản ngang: x, y | Bản dọc: x, y |
| --- | --- | --- |
| Vùng Toán | 24%, 27% | 27%, 24% |
| Vùng Tiếng Việt | 75%, 27% | 73%, 24% |
| Quảng trường giữa | 50%, 50% | 50%, 46% |
| Vùng Tiếng Anh | 24%, 73% | 27%, 70% |
| Vùng Tin học | 75%, 73% | 73%, 70% |

- Để bốn vùng dễ phân biệt bằng địa hình, có cầu hoặc đường nối nhẹ về trung tâm.
- Chừa quanh mỗi điểm neo khoảng trống để ghép biểu tượng địa điểm và tên vùng.
- Những kiến trúc chính dùng làm điểm bấm sẽ ghép từ ảnh tách nền, không vẽ lặp vào nền.
- Có thể vẽ cây, đá, bãi cỏ hoặc chi tiết nhỏ trang trí ngoài vùng bấm.
- Không cần bản đồ ngang và dọc là cùng một ảnh bị cắt. Bản dọc cần sắp xếp lại đủ bốn vùng và quảng trường.

### 4.2. Bản đồ vùng

| Chặng | Bản ngang: x, y | Bản dọc: x, y |
| --- | --- | --- |
| 1 | 12%, 72% | 26%, 82% |
| 2 | 24%, 50% | 67%, 72% |
| 3 | 38%, 70% | 30%, 60% |
| 4 | 50%, 44% | 68%, 49% |
| 5 | 63%, 66% | 31%, 37% |
| 6 | 77%, 40% | 69%, 25% |
| 7 | 89%, 62% | 45%, 13% |

- Giữ địa hình nhẹ quanh các điểm này; chừa một vùng đất trống cho từng địa điểm.
- Không đặt thân cây, núi, tường hay chi tiết chính đè vào chỗ nhãn tuần sẽ nằm.
- Nền chỉ cần gợi ý lối mòn. Đường nối biểu thị tiến độ sẽ được dựng trong giao diện để đổi trạng thái theo dữ liệu.
- Không vẽ sẵn chấm số, sao, ổ khóa, chữ Tuần 1–7 hoặc nét đường màu mở khóa.
- Đây là lưới thiết kế đề xuất. Nếu bố cục ảnh của bạn khác đẹp hơn, gửi ảnh trước; người phát triển sẽ đo lại tọa độ. Không cần bạn tự làm tệp tọa độ.

## 5. Bộ ảnh cần tạo

**Bộ đầy đủ cho bản đồ và giao diện hiện có: 28 tệp ảnh.**

| Nhóm | Số tệp | Mục đích |
| --- | ---: | --- |
| 5 map × bản ngang và bản dọc | 10 | 1 thế giới và 4 vùng môn học |
| 3 địa điểm tách nền × 4 vùng | 12 | Tái sử dụng tại các chặng, ghép lên nền |
| Ảnh đại diện 5 trò hiện có | 5 | Màn chọn trò và bảng bộ câu |
| Ảnh góc giới thiệu/đăng nhập | 1 | Đồng bộ màn vào ứng dụng |
| Tổng bắt buộc theo thiết kế đầy đủ | **28** | Có thể bàn giao theo nhiều đợt |

**Nhóm tùy chọn: 11 tệp**, gồm nền vùng chung ngang/dọc, Cáo tĩnh, ba ảnh trạng thái và năm nền chơi nhẹ. Các tệp này không chặn việc ghép map chính.

Danh sách tên tệp, kích thước và nội dung từng ảnh nằm trong [checklist bàn giao](BO_ANH_BAN_DO_DANH_SACH_BAN_GIAO.md). Mô tả có thể sao chép sang công cụ tạo ảnh nằm trong [bộ prompt tạo ảnh](BO_ANH_BAN_DO_PROMPT_TAO_ANH.md).

## 6. Đặc tả từng màn giao diện

### Màn 1 — Đăng nhập

**Desktop:** hai cột. Bên trái là tranh giới thiệu nhẹ, câu chào và Cáo nhỏ; bên phải là logo chữ, tài khoản, mật khẩu, đăng nhập và thông báo.

**Điện thoại:** đầu trang thấp với một mảng tranh nhỏ; biểu mẫu một cột bên dưới. Không ép toàn bộ tranh desktop vào điện thoại.

Bạn chuẩn bị: **auth-welcome.png**. Logo, tiêu đề, trường nhập, nút và trạng thái lỗi do ứng dụng dựng.

### Màn 2 — Bản đồ thế giới

**Desktop:**
- Thanh trên: tên Bảo An, tên học sinh, sao khả dụng và nút cài đặt.
- Bản đồ là phần chính, chiếm khoảng 70–80% vùng nội dung.
- Bên cạnh hoặc một dải phía dưới là tiến độ tuần và nút Tiếp tục chuyến đi.
- Tên vùng, nhãn chưa có bài và tiến độ đặt bằng giao diện trên bản đồ.
- Nút Hành trình tuần và Ví sao truy cập được mà không phải đi qua một cảnh khác.

**Điện thoại:**
- Thanh trên gọn; ảnh map dọc giữ đủ bốn vùng.
- Nút vùng đủ lớn, có tên đọc được; không buộc trẻ phải phóng to hoặc kéo bản đồ để thấy vùng còn lại.
- Thanh tác vụ dưới cùng: Bản đồ, Tiếp tục học, Ví sao; chừa khoảng an toàn dưới màn hình.
- Chạm vùng mở màn vùng; khi quay lại giữ vị trí/địa điểm đang xem.

Bạn chuẩn bị: **map-world-wide.png**, **map-world-tall.png**; tái dùng các địa điểm tiêu biểu ở nhóm ảnh tách nền.

### Màn 3 — Bản đồ vùng

**Desktop:** đầu màn có Trở về bản đồ, tên vùng, tuần hiện tại và bộ chọn nhóm tuần. Nền vùng chiếm phần lớn màn; tối đa 7 chặng. Bấm chặng mở bảng bên cạnh.

**Điện thoại:** dùng nền dọc; các chặng đi zích zắc từ dưới lên, nhãn ngắn. Bấm chặng mở bảng nổi từ cạnh dưới. Nút đóng và trở về luôn nhìn thấy.

Địa điểm đã chọn có viền/đế nổi nhẹ; trạng thái không chỉ thể hiện bằng màu. Đổi từ ngang sang dọc vẫn chọn cùng một weekId, không đổi nội dung đang xem.

Bạn chuẩn bị: hai ảnh map của từng vùng và ba địa điểm tách nền của vùng đó.

### Màn 4 — Bảng chặng tuần và chọn bộ câu

Trên desktop là bảng bên phải map; trên điện thoại là bảng nổi có thể cuộn.

Thông tin theo thứ tự: tên tuần → môn → số câu đã đạt → các bộ câu → trò phù hợp → nút chơi. Nêu rõ Đang học, Đã qua hoặc Chưa mở.

Một tuần có nhiều bộ thì hiển thị thành danh sách gọn, không rải tất cả bộ thành hàng chục nút trên map. Tên bộ lấy nguyên từ nội dung được giao.

Bạn chuẩn bị: **không cần ảnh riêng**. Dùng lại hình địa điểm và ảnh đại diện trò.

### Màn 5 — Chọn trò

Có thể nằm trong bảng chặng hoặc thành màn đầy đủ khi danh sách dài.

Mỗi thẻ: ảnh trò, tên trò, một dòng cách chơi và nút bắt đầu. Chỉ hiện trò tương thích với bộ đã chọn. Những bộ nhập số, đọc hoặc nghe dùng trình chạy bài hiện có, không giả thành trò khác.

Bạn chuẩn bị: **5 ảnh game-card** trong checklist.

### Màn 6 — Đang chơi: năm cách tương tác

| Trò hiện có | Bố cục cần giữ rõ | Phần hình ảnh |
| --- | --- | --- |
| Đảo Câu Hỏi | Câu hỏi ở giữa, media rõ, đáp án lớn, tiến độ, gợi ý, nút thoát | Có thể dùng màu nền vùng; nền tranh là tùy chọn |
| Trí Nhớ | Lưới thẻ là trọng tâm; thanh số cặp/lượt thử phía trên | Thẻ có viền rõ; không đặt phong cảnh nhiều chi tiết dưới chữ |
| Ghép Câu | Dòng câu cần ghép và ngân hàng từ, thao tác chạm hoặc kéo | Trang trí nhỏ ở rìa; ô ghép do giao diện tạo |
| Nối Từ | Hai cột có đủ khoảng cách, trạng thái chọn và đường nối rõ | Tranh không che điểm nối hoặc làm lẫn màu trạng thái |
| Bậc Thang Quy Luật | Các vị trí sắp xếp, bộ thẻ và nút kiểm tra | Có thể gợi ý đường đá/bậc nhỏ, nhưng thẻ và thứ tự đều là giao diện |

Các dạng nhập số, điền từ, đọc hiểu và nghe vẫn dùng màn bài tập hiện có. Với câu có ảnh hoặc âm thanh, media của người dùng luôn có ưu tiên đọc/nhìn cao hơn tranh trang trí.

Cáo nhỏ tĩnh chỉ nằm ở góc hoặc trong lời động viên; không chiếm một cột lớn. Đồng hồ tiếp tục theo quy tắc tải ảnh/nghe hiện hành.

Bạn chuẩn bị: không bắt buộc thêm ảnh ngoài thumbnail. Năm nền chơi là tùy chọn sau khi map đã đạt.

### Màn 7 — Kết quả và trở về map

Bảng kết quả ở giữa: hoàn thành gì, sao tăng thêm thực tế, tiến độ câu/tuần và hai lựa chọn phù hợp: ôn tiếp hoặc trở về chặng.

Nếu đủ điều kiện, cho mở hộp xác nhận sang tuần hiện có. Khi trở về, đúng địa điểm vẫn được chọn; chỉ số cập nhật từ biên nhận máy chủ.

Bạn chuẩn bị: không cần vẽ sao, số điểm, nút hay huy hiệu giả. Ứng dụng tạo các thành phần này.

### Màn 8 — Hành trình tuần và lịch sử

Giữ bảng tuần đọc rõ để học sinh/người lớn xem chi tiết. Có thể mở từ map hoặc từ thanh điều hướng. Hiện từng câu và sao như luồng hiện tại.

Đây cũng là đường dùng được khi ảnh map chưa tải xong. Không yêu cầu tải toàn bộ ảnh của mọi tuần để xem tiến độ.

Bạn chuẩn bị: không cần ảnh mới.

### Màn 9 — Ví sao và yêu cầu đổi thưởng

Mở từ biểu tượng/điểm trung tâm hoặc thanh tác vụ. Hiện sao khả dụng, sao đang chờ, lịch sử và chức năng đổi thưởng đang có.

Bản đồ không tự bổ sung vật liệu, quà hay phần thưởng mới. Nếu có màn kệ quà/thị trấn trong bản mã khác mà người dùng đã hoàn thành, cần đối chiếu bản đó để nối đúng màn; không dựng một màn quà minh họa không có dữ liệu.

Bạn chuẩn bị: không cần ảnh quà mẫu giả. Ảnh quà thực tế dùng dữ liệu do người lớn cung cấp trong tính năng tương ứng.

### Màn 10 — Cài đặt và tài khoản

Một bảng gọn: âm thanh, hiệu ứng, đổi mật khẩu, đăng xuất. Dùng chữ và biểu tượng giao diện, có nhãn đọc được, không phụ thuộc chỉ vào icon.

Bạn chuẩn bị: không cần ảnh mới.

### Màn 11 — Quản trị

Giữ bốn nhóm công việc: học sinh, học liệu tuần, đổi sao/lịch sử, sao lưu/khôi phục. Giao diện quản trị tập trung đọc dữ liệu và thao tác nhập bài.

Bản đầu ánh xạ tên môn sang vùng bằng cấu hình. Nếu cần màn tự chọn map cho môn, lên đầu việc riêng sau khi hình ảnh ổn định; không đổi mẫu nhập câu chỉ để ghép tranh.

Bạn chuẩn bị: không cần phong cảnh riêng cho quản trị.

### Màn 12 — Chờ tải, rỗng và lỗi ảnh

- Khi chờ ảnh: nền màu vùng, thông báo ngắn; đường danh sách bài vẫn dùng được.
- Khi ảnh lỗi: hiện vùng bấm/nút có nhãn và nút tải lại, không để trang trắng.
- Khi chưa có bài: lời nhắn chờ giáo viên, không hiển thị nút chơi giả.
- Khi mất mạng trong lúc lưu: giữ luồng thử lại hiện có; không tự cập nhật sao.

Ba ảnh trạng thái nhỏ nằm trong nhóm tùy chọn, không bắt buộc cho các trạng thái hoạt động đúng.

## 7. Cách chia lớp để ảnh ghép được

Từ dưới lên trên:

1. **Ảnh nền map**: địa hình, nước, cỏ, cây trang trí; không có UI hoặc kiến trúc bấm chính.
2. **Địa điểm tách nền**: thư viện, chợ, hải đăng… ghép vào các điểm neo.
3. **Đường và dấu chặng do ứng dụng vẽ**: nét nối, số tuần, trạng thái hiện tại.
4. **Nhãn và vùng bấm**: chữ thật, nút, biểu tượng khóa, tiến độ.
5. **Bảng tuần/trò chơi và thông báo**: không nằm trong ảnh.

Nếu gửi một ảnh map hoàn chỉnh có mọi tòa nhà dính vào nền, vẫn có thể đặt vùng bấm lên trên, nhưng khó đổi vị trí hoặc trạng thái sau này. Bộ tách lớp ở đây là phương án đề xuất để dùng lâu dài.

## 8. Quy chuẩn kỹ thuật cho người tạo ảnh

| Loại ảnh | Kích thước bàn giao | Nền |
| --- | --- | --- |
| Map ngang | 2560 × 1600 px, tỉ lệ 16:10 | Có nền, phủ kín |
| Map dọc | 1536 × 2048 px, tỉ lệ 3:4 | Có nền, phủ kín |
| Địa điểm | 512 × 512 px | Trong suốt thật |
| Thumbnail trò | 960 × 640 px, tỉ lệ 3:2 | Có nền |
| Tranh đăng nhập | 1200 × 900 px, tỉ lệ 4:3 | Có nền |
| Cáo tĩnh tùy chọn | 512 × 512 px | Trong suốt thật |
| Ảnh trạng thái tùy chọn | 640 × 480 px | Trong suốt thật |
| Nền game tùy chọn | 1920 × 1080 px, tỉ lệ 16:9 | Có nền, vùng giữa rất thoáng |

Bạn có thể gửi **PNG gốc** chất lượng tốt, không cần tự nén WebP. Người phát triển sẽ tạo bản dùng trên web và giữ bản gốc ngoài thư mục web công khai.

- Không có chữ, logo, watermark, nhãn AI hoặc khung trình duyệt trong ảnh chạy thật.
- Không vẽ thanh sao, nút, ổ khóa, số tuần, hộp câu hỏi hoặc ảnh chụp UI vào nền.
- Ảnh tách nền không có nền caro vẽ sẵn, viền trắng hay nền đen. Chừa lề khoảng 10% quanh vật thể.
- Vật thể chính phải nhận ra khi thu về khoảng 64–96 px. Không dựa vào chi tiết nhỏ để phân biệt địa điểm.
- Dùng cùng góc nhìn và ánh sáng cho tất cả địa điểm. Bóng đổ mỏng, không bị cắt ở cạnh.
- Vùng quan trọng của map nằm trong khoảng 8–92% chiều ngang, 8–92% chiều dọc; cảnh vẫn kéo tới mép ảnh.
- Các nền dùng cho gameplay phải giữ khoảng giữa 60% ít chi tiết, tránh cạnh tranh với câu hỏi.

Mục tiêu sau khi tích hợp, cần đo thực tế: map đang xem khoảng 200–350 KB, địa điểm khoảng 15–45 KB, thumbnail khoảng 40–80 KB sau nén. Nếu nén làm mất chất lượng, ưu tiên giảm kích thước hiển thị/tạo biến thể phù hợp trước khi ép chất lượng. Đây là ngân sách thiết kế, chưa phải kết quả đo.

## 9. Ảnh mẫu toàn màn nếu bạn muốn dựng trước

Có thể tạo thêm **6 ảnh concept giao diện**, không tính vào 28 tài nguyên chạy thật:

- concept-world-desktop.png — 1600 × 1000 px.
- concept-world-phone.png — 390 × 844 px.
- concept-region-desktop.png — 1600 × 1000 px.
- concept-region-phone.png — 390 × 844 px.
- concept-game-picker-desktop.png — 1600 × 1000 px.
- concept-game-picker-phone.png — 390 × 844 px.

Ảnh concept được phép thể hiện bố cục nút, bảng và chữ mẫu để truyền đạt ý tưởng. Khi ghép vào ứng dụng, người phát triển sẽ dựng lại UI bằng thành phần thật; không dùng ảnh concept làm một tấm nền thay toàn màn hình.

Nếu chỉ muốn làm một loại trước, ưu tiên **map tổng ngang/dọc và map Toán ngang/dọc**. Không cần vẽ cả 12 màn thành ảnh.

## 10. Bàn giao theo ba đợt

| Đợt | Bạn tạo | Kết quả cần xem |
| --- | --- | --- |
| A — Thử một vùng | 4 map: tổng ngang/dọc, Toán ngang/dọc; 3 địa điểm Toán; 1 thumbnail Đảo Câu Hỏi = **8 ảnh** | Phong cách thống nhất, chọn đúng vùng/chặng, nút rõ trên điện thoại |
| B — Hoàn thiện bộ chính | 6 map của ba vùng còn lại, 9 địa điểm, 4 thumbnail và 1 tranh đăng nhập = **20 ảnh** | Đủ bộ chính **28 ảnh**, mọi vùng và màn chọn trò thống nhất |
| C — Bổ sung tùy chọn | Vùng chung, Cáo tĩnh, trạng thái, nền game | Chỉ thêm những ảnh thực sự giúp trải nghiệm tốt hơn |

Mỗi đợt gửi một ZIP theo [checklist bàn giao](BO_ANH_BAN_DO_DANH_SACH_BAN_GIAO.md). Ghi rõ ảnh nào là bản chính nếu có nhiều lựa chọn.

Sau đợt A, nên xem thử cả desktop và điện thoại trước khi tạo 20 ảnh còn lại. Điểm cần đối chiếu là khoảng trống đặt nút, kích thước vật thể và sắc độ nền, không chỉ độ đẹp khi xem ảnh nguyên kích thước.

## 11. Kế hoạch triển khai sau khi nhận ảnh

Đây là kế hoạch công việc; chưa phải những tính năng đã làm.

| Bước | Công việc | Đầu ra và cổng hoàn thành |
| --- | --- | --- |
| M0 | Nhận và kiểm bộ ảnh đợt A: kích thước, alpha, bố cục, quyền sử dụng, phiên bản | Danh sách ảnh hợp lệ; chỗ cần chỉnh được đánh dấu cụ thể |
| M1 | Ghép bản đồ tổng và vùng Toán bằng HTML/CSS, ảnh tĩnh, nút thật; hỗ trợ ngang/dọc | Bản thử có vùng bấm khớp ảnh, dùng được chuột, chạm và bàn phím |
| M2 | Tạo lớp chuyển dữ liệu tuần/môn/bộ câu thành địa điểm; nối vào luồng chơi hiện có | Chọn địa điểm mở đúng bộ, sao/khóa tuần đúng máy chủ; quay về giữ lựa chọn |
| M3 | Ghép đợt B, bảng chặng, ảnh trò, đăng nhập và trạng thái tải lỗi | Bốn vùng đủ hình, không thêm nội dung học tự động |
| M4 | Nén ảnh, tải theo màn/vùng, chuẩn bị ảnh vùng sắp mở khi phù hợp; kiểm tra mobile | Không tải toàn bộ map ngay màn đăng nhập; không chặn thao tác khi tranh lỗi |
| M5 | Kiểm thử luồng tuần, sao, media, nhập bài, bàn phím và xem ảnh thực tế | Nhật ký, kết quả kiểm tra và ảnh xem trước lưu trong dự án |

Ước lượng lập lịch cho một người phát triển: khoảng **8–14 ngày làm việc sau khi có bộ ảnh phù hợp**, chia thành thử vùng đầu và hoàn thiện. Chưa bao gồm thời gian bạn tạo/chỉnh ảnh, thay đổi thiết kế lớn hoặc phát triển trò mới. Đây là ước lượng, cần điều chỉnh sau đợt A.

### Phần dữ liệu cần xử lý rõ trước M2

Hiện OnlineStudentSummary có dữ liệu tuần phân trang theo bộ, bộ hiện tại, tổng tuần và tiến độ tuần. Chưa có hợp đồng riêng cho một map 35 tuần theo vùng.

Bản triển khai cần xác định một trong hai cách từ dữ liệu thực tế; đề xuất ưu tiên bản đọc gọn:
- API đọc tóm tắt map theo vùng/nhóm tuần, chỉ trả id, tên, vị trí, trạng thái, số bộ và tiến độ tổng hợp. Là đầu việc bổ sung dự kiến, không phải API hiện đã có.
- Dùng lại phân trang hiện có nếu đủ cho nhóm tuần đang hiển thị và không gây nhiều yêu cầu nối tiếp.

Không tải toàn bộ câu hỏi, đáp án hoặc media của 35 tuần chỉ để vẽ chặng. Không đổi schema nội dung hoặc quy tắc sao vì cách trình bày bản đồ.

### Tệp dự kiến để triển khai

- src/screens/WorldMap.tsx — bản đồ tổng.
- src/screens/RegionMap.tsx — vùng và các chặng.
- src/screens/MapWeekPanel.tsx — bảng tuần/bộ câu/trò.
- src/core/world-map-layout.ts — vị trí và cấu hình ảnh, tách khỏi dữ liệu học.
- src/core/world-map-adapter.ts — chuyển summary thành trạng thái hiển thị.
- src/styles/world-map.css — bố cục, vùng bấm, trạng thái và responsive.
- public/art/maps/, public/art/places/, public/art/game-cards/ — các biến thể tối ưu dùng trên web.

Tên tệp ở đây là đề xuất. Không tạo trước các màn rỗng hoặc nút dẫn tới tính năng chưa được nối.

## 12. Tiêu chí nghiệm thu

### Hình ảnh và giao diện

- [ ] Map tổng nhìn ra bốn vùng và trung tâm, không giống danh sách thẻ đặt trên một tấm hình.
- [ ] Map dọc giữ đủ địa điểm; chữ và nút không cần phóng to mới đọc được.
- [ ] Điểm bấm khớp địa điểm ở 320, 390, 768, 1024 và 1440 px.
- [ ] Vùng chạm tối thiểu 48 × 48 px; mục tiêu thiết kế 56 px với chặng trên điện thoại.
- [ ] Các nhãn có nền/viền giúp đọc rõ dù phía dưới là tranh.
- [ ] Có thể vào vùng/chặng, đóng bảng và trở về bằng bàn phím.
- [ ] Tôn trọng tắt hiệu ứng và giảm chuyển động; map không bắt buộc hoạt ảnh.
- [ ] Ảnh không tải được vẫn có tên vùng, đường chọn bài và nút thử lại.

### Liên thông nghiệp vụ

- [ ] Môn tự đặt, một môn/nhiều môn, một tuần/nhiều tuần, nhiều bộ trong cùng tuần đều hiển thị đúng.
- [ ] Vị trí chặng ổn định sau làm mới; không thay đổi theo thứ tự phần tử của trang API vừa tải.
- [ ] Tuần đã khóa không được bản đồ mở lại; tuần mới vẫn cần xác nhận.
- [ ] Chọn map/địa điểm không cộng sao; trả lời mới đi qua giao thức hiện có.
- [ ] Quay lại từ trò giữ đúng vùng/chặng/bộ đang chọn; số sao hiển thị theo kết quả đã lưu.
- [ ] Câu có media và các game không bị nền trang trí che nội dung hoặc mở đồng hồ sớm.
- [ ] Kiểm thử phù hợp đạt trên Chrome và Edge; cập nhật kế hoạch và nhật ký trong dự án.

## 13. Những gì được bàn giao trong đợt lập kế hoạch này

- Tài liệu kế hoạch này.
- Checklist đủ **28 ảnh chính + 11 ảnh tùy chọn**.
- Bộ prompt để người dùng tạo ảnh và 6 concept giao diện tùy chọn.
- Gói hướng dẫn ZIP kèm thư mục để đặt ảnh và gửi lại.
- Cập nhật kế hoạch hiện hành và README để lần sau tiếp tục đúng hướng.

**Chưa tạo tranh, chưa ghép map hình ảnh mới, chưa triển khai website trong đợt này.** Bước tiếp theo là người dùng tạo/gửi bộ thử 8 ảnh ở đợt A; các ảnh khác có thể gửi bổ sung sau.
