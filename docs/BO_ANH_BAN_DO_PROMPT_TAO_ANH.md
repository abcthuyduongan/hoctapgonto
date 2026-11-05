# Bộ mô tả tạo ảnh bản đồ Bảo An

Ngày: **05/11/2026**. Đây là hướng dẫn cho người dùng tự tạo ảnh. Không yêu cầu dùng một công cụ AI cụ thể.

Dùng cùng [checklist tên tệp](BO_ANH_BAN_DO_DANH_SACH_BAN_GIAO.md) và [kế hoạch bố cục/giao diện](KE_HOACH_BAN_DO_HINH_ANH_2026-11-05.md).

## 1. Cách dùng để bộ ảnh nhất quán

1. Tạo trước map tổng, chọn phong cách phù hợp.
2. Dùng ảnh phong cách đã chọn làm tham chiếu cho các ảnh sau, nếu công cụ có hỗ trợ.
3. Mỗi lần tạo một ảnh, ghép **mô tả chung + mô tả cảnh + bố cục/kích thước + điều cần tránh** ở dưới.
4. Với map ngang/dọc, giữ cùng thế giới nhưng sắp lại bố cục. Đừng chỉ cắt mép hoặc kéo giãn.
5. Công cụ không xuất đúng kích thước thì giữ tỉ lệ gần nhất và độ phân giải cao; ghi kích thước trong NOTES để người phát triển xử lý. Ảnh tách nền ưu tiên PNG alpha thật.

Không cần công cụ tạo chữ tiếng Việt chính xác vì ảnh chạy thật không chứa chữ.

## 2. Mô tả phong cách chung — thêm vào mọi ảnh

“Thiết kế cho Bảo An Learning, một thế giới khám phá học tập dành cho trẻ khoảng 8 tuổi. Phong cách sổ phiêu lưu thiên nhiên, tranh phẳng, hình khối lớn rõ ràng, nét viền mềm, màu kem và xanh lá dịu, điểm nhấn vàng ấm. Góc nhìn từ trên xuống hơi nghiêng, cùng hướng ánh sáng từ trên trái. Không gian hiền hòa, sạch, ít chi tiết vụn; có đủ khoảng trống để ứng dụng đặt nhãn và nút sau này. Hình ảnh độc lập, không sao chép nhân vật hoặc tài nguyên của ứng dụng khác. Không có người hoặc thú làm nhân vật chính.”

### Điều cần tránh cho tài nguyên chạy thật

“Không chữ, không chữ cái, không số, không logo, không watermark, không giao diện trình duyệt, không nút bấm, không bảng điểm, không sao thưởng, không ổ khóa, không hộp câu hỏi. Không render 3D, không chất liệu nhựa bóng, không ánh sáng điện ảnh, không chi tiết dày đặc, không nét quá nhỏ, không phối cảnh sâu. Không vẽ nền caro lên ảnh trong suốt.”

Nếu công cụ không có ô negative prompt, ghép phần này vào mô tả chính.

## 3. Khuôn bố cục map

### Map tổng ngang

“Ảnh ngang tỉ lệ 16:10, kích thước bàn giao 2560 × 1600. Toàn cảnh một quần đảo có bốn vùng quanh quảng trường cỏ nhỏ ở giữa. Toán ở góc trên trái, rừng ngôn ngữ ở góc trên phải, cảng biển ở góc dưới trái, vườn công nghệ ở góc dưới phải. Chừa vùng thoáng gần các tâm 24%–27%, 75%–27%, 24%–73%, 75%–73% và trung tâm 50%–50%. Các vùng nối bằng cầu/lối đi nhẹ. Nền gồm địa hình, cây, suối và trang trí nhỏ; không có tòa nhà lớn tại các tâm vì địa điểm sẽ ghép riêng.”

### Map tổng dọc

“Ảnh dọc tỉ lệ 3:4, kích thước bàn giao 1536 × 2048. Sắp xếp lại cùng quần đảo thành hai vùng ở phần trên, quảng trường nhỏ giữa, hai vùng ở phần dưới; tất cả nằm trọn trong ảnh. Tâm vùng khoảng 27%–24%, 73%–24%, 27%–70%, 73%–70%; quảng trường 50%–46%. Không cắt mất vùng và không thu các chi tiết quan trọng thành quá nhỏ. Chừa chỗ ghép địa điểm và nhãn, không có tòa nhà chính.”

### Map vùng ngang

“Ảnh ngang 16:10, 2560 × 1600. Một phong cảnh liền mạch có bảy khoảng đất trống đủ lớn để ghép địa điểm, gần các vị trí phần trăm x–y: 12–72, 24–50, 38–70, 50–44, 63–66, 77–40, 89–62. Gợi ý một lối mòn liên tục nhưng không vẽ chấm chặng, đường tiến độ, số tuần, khóa hoặc kiến trúc chính. Cây và chi tiết trang trí ở ngoài các khoảng trống.”

### Map vùng dọc

“Ảnh dọc 3:4, 1536 × 2048. Cùng phong cảnh, sắp thành đường khám phá zích zắc từ phía dưới lên trên. Bảy khoảng đất trống gần x–y phần trăm: 26–82, 67–72, 30–60, 68–49, 31–37, 69–25, 45–13. Không có số, chấm chặng, khóa, chữ hay kiến trúc chính; để ứng dụng ghép các điểm bấm. Giữ đủ bảy khoảng trống trong ảnh.”

Tọa độ là định hướng để chừa khoảng thoáng. Nếu công cụ không làm đúng vị trí, gửi bản phác trước để cân chỉnh, thay vì tạo hết bộ cùng một lỗi.

## 4. Mô tả cảnh cho năm map

Ghép mỗi cảnh với phong cách chung và khuôn bố cục tương ứng.

### map-world-wide.png / map-world-tall.png

“Một thế giới quần đảo nhỏ có bốn môi trường rõ ràng. Vùng đồi cỏ với mảng ruộng hình học; vùng rừng cây ấm với lối đi; vùng biển nông màu xanh ngọc và bờ cát; vùng vườn công nghệ có những lối đi hình mạch đơn giản nhưng nhiều cây xanh. Quảng trường trung tâm là bãi cỏ trống hình tròn, không có lâu đài lớn. Cảnh quan thống nhất, tạo cảm giác có thể đi khám phá từng nơi, không giống bốn tấm ảnh rời ghép lại.”

Tạo một ảnh theo khuôn map tổng ngang và một ảnh theo khuôn map tổng dọc.

### map-math-wide.png / map-math-tall.png

“Đảo Số: thung lũng cỏ xanh hiền hòa, suối nhỏ, luống cây vuông và tròn, đá có hình khối đơn giản, cầu gỗ nhỏ. Gợi tư duy hình học bằng cảnh vật nhưng không có ký hiệu toán hoặc chữ số. Chừa bảy bãi đất cỏ để đặt nhà, vườn và chợ nhỏ sau này. Màu xanh non, kem và vàng nhạt.”

Tạo hai ảnh theo khuôn map vùng ngang/dọc.

### map-vietnamese-wide.png / map-vietnamese-tall.png

“Rừng Chữ: rừng cây tròn mềm, hoa nhỏ, tán cây tạo các khoảng sân, suối và lối mòn, lá có hình đơn giản như những trang sách nhưng không có chữ. Cảnh gợi đọc và kể chuyện, ấm áp và yên tĩnh. Chừa bảy bãi đất sạch để đặt thư viện và nhà kể chuyện sau này. Màu xanh lá trầm dịu, kem và nâu đào.”

Tạo hai ảnh theo khuôn map vùng ngang/dọc.

### map-english-wide.png / map-english-tall.png

“Cảng English: vùng ven biển thân thiện với nước xanh ngọc nông, đảo nhỏ, bờ cát, vườn cây ven biển, một vài cầu gỗ trang trí rất nhỏ ngoài điểm neo. Gợi du lịch và giao tiếp, không có cờ quốc gia hoặc chữ. Chừa bảy bãi đất để ghép bến tàu, hải đăng và quán nhỏ. Màu xanh biển nhạt, kem cát và vàng ấm.”

Tạo hai ảnh theo khuôn map vùng ngang/dọc.

### map-computing-wide.png / map-computing-tall.png

“Phố Robot: một vườn công nghệ hiền hòa, đường đi có vài nhánh vuông gợi mạch điện đơn giản, luống cây, vườn năng lượng sạch, cột đèn nhỏ. Không phải đô thị tương lai tối hoặc xưởng kim loại nặng. Không có robot nhân vật, màn hình chứa chữ hoặc bàn phím đầy ký tự. Chừa bảy khoảng trống để ghép địa điểm. Màu xanh xám, tím nhạt và kem.”

Tạo hai ảnh theo khuôn map vùng ngang/dọc.

## 5. Khuôn ảnh địa điểm

Ghép với phong cách chung, bỏ mọi mô tả phong cảnh rộng:

“Một địa điểm đơn lẻ dùng làm biểu tượng bấm trên bản đồ, góc nhìn từ trên xuống hơi nghiêng giống bộ map. Vật thể ở giữa ảnh vuông 512 × 512, chừa khoảng 10% lề, không cắt mái hoặc bóng. Nền trong suốt thật. Hình khối dễ nhận khi thu xuống 64–96 pixel. Không có chữ, số, nhân vật, viền nút hoặc tấm nền hình vuông phía sau.”

Ghép thêm một trong các mô tả sau:

| Tên tệp | Mô tả vật thể để ghép |
| --- | --- |
| place-math-number-house.png | Một ngôi nhà nhỏ mái xanh, cửa sổ tròn và vuông rõ nét, chân nhà thấp bằng đá sáng màu. |
| place-math-garden.png | Một vườn rau nhỏ trong các ô luống vuông, vài bụi cây hình tròn, lối đi ngắn đơn giản. |
| place-math-market.png | Một quầy chợ nhỏ mái vải màu kem/vàng, hai giỏ quả có hình dạng rõ; không nhãn giá. |
| place-vietnamese-library.png | Một thư viện gỗ nhỏ mái lá xanh, cửa lớn, vài cuốn sách có gáy trống phía trước. |
| place-vietnamese-word-tree.png | Một cây tròn lớn, ghế gỗ nhỏ dưới gốc, vài quyển sách trống gợi học tập, không treo chữ trên lá. |
| place-vietnamese-story-house.png | Một căn nhà kể chuyện nhỏ với mái ngói đất, hiên có ghế và đèn ấm, không bảng hiệu. |
| place-english-harbor.png | Một bến gỗ ngắn cùng thuyền buồm nhỏ màu kem, chỉ một ít nước sát chân để gợi vị trí, phần còn lại trong suốt. |
| place-english-lighthouse.png | Một hải đăng thấp thân sáng, mái xanh, cửa lớn rõ, bệ cỏ nhỏ, không chữ hoặc đèn chớp. |
| place-english-cafe.png | Một quán ven biển rất nhỏ, mái vải xanh nhạt, hai ghế ngoài hiên, bảng gỗ trống. |
| place-computing-workshop.png | Một xưởng sáng màu thân thiện, mái tím nhạt, bánh răng nhỏ làm trang trí, không robot hoặc máy phức tạp. |
| place-computing-keyboard-garden.png | Một khu vườn nhỏ với vài khối phím vuông trống và cây xanh, bố cục đơn giản dễ nhận. |
| place-computing-info-station.png | Một trạm thông tin nhỏ với màn hình trống, mái xanh xám và cột phát tín hiệu thấp; không chữ/số. |

Không tạo cả 12 địa điểm chung trong một ảnh hoặc trên sprite sheet. Mỗi tệp là một vật thể riêng.

## 5b. Khuôn ảnh công trình Thị trấn (12 công trình)

Ghép với phong cách chung của Bảo An, ảnh vuông tách nền trong suốt thật (alpha), góc nhìn từ trên xuống hơi nghiêng, tỉ lệ phù hợp để đặt vào ô lưới 10 × 10:

“Một công trình kiến trúc hoặc cảnh quan thị trấn Bảo An đơn lẻ, góc nhìn từ trên xuống hơi nghiêng (isometric/top-down), bóng chân nhẹ mờ, không gian nền hoàn toàn trong suốt. Đồ họa 2D phong cách sổ phiêu lưu ấm áp, màu sắc hài hòa tươi vui, đường viền mềm, không chi tiết rườm rà. Định dạng WebP có kênh alpha, dung lượng ≤ 60 KB. Không chữ, không số, không nhân vật, không khung viền ô lưới.”

| Tên tệp | Tên công trình | Mô tả vật thể để tạo ảnh | Vật liệu cần |
| --- | --- | --- | --- |
| building-cottage.webp | Nhà nhỏ | Ngôi nhà ngói đỏ nhỏ ấm áp, tường kem, cửa gỗ vòm, cửa sổ sáng đèn, ống khói nhỏ. | 3 Gỗ |
| building-log-cabin.webp | Nhà gỗ | Nhà mộc mạc dựng bằng các thân gỗ tròn nằm ngang, mái dốc phủ rêu xanh, bậc thềm gỗ nhỏ. | 5 Gỗ |
| building-ancient-tree.webp | Cây cổ thụ | Cây đại thụ tán lá tròn nhiều tầng xanh mướt, thân gỗ vững chãi, chiếc ghế gỗ nhỏ dưới bóng râm. | 2 Gỗ |
| building-water-well.webp | Giếng nước | Giếng tròn ghép đá xám, mái che gỗ có ròng rọc cuốn dây thừng và thùng múc nước bằng gỗ. | 3 Đá |
| building-flower-garden.webp | Vườn hoa | Bồn hoa vuông bằng gỗ chứa đất màu mỡ, nhiều luống hoa rực rỡ (đỏ, vàng, tím), bình tưới nhỏ cạnh bồn. | 2 Gỗ, 1 Đá |
| building-wooden-bridge.webp | Cầu gỗ | Cầu gỗ hình vòm cong bắc qua dòng nước trong, tay vịn thân gỗ mộc, hoa sen nhỏ trôi dưới chân cầu. | 4 Gỗ, 2 Đá |
| building-mini-library.webp | Thư viện mini | Thư viện nhỏ hai tầng mái ngói xanh biển, cửa kính lớn nhìn thấy giá sách bên trong, cột cờ nhỏ trên đỉnh. | 5 Gỗ, 4 Đá, 3 Linh kiện |
| building-village-market.webp | Chợ quê | Quầy sạp gỗ mái bạt sọc đỏ trắng vui mắt, thùng gỗ đựng hoa quả nông sản và giỏ cá tươi. | 4 Gỗ, 3 Đá, 3 Cá |
| building-windmill.webp | Cối xay gió | Cối xay gió thân đá hình nón cụt sáng màu, mái đỏ, 4 cánh quạt gỗ dạng nan quay đón gió. | 4 Gỗ, 3 Đá, 2 Linh kiện |
| building-bell-tower.webp | Tháp chuông | Tháp chuông đá cao vút, cửa vòm có quả chuông vàng kim, mặt đồng hồ tròn và chóp tháp đồng xanh. | 6 Đá, 3 Gỗ, 2 Linh kiện |
| building-street-lamp.webp | Đèn đường | Cột đèn kim loại thanh mảnh trên đế đá, lồng đèn kính tỏa ánh sáng vàng ấm, chậu hoa treo trên thân cột. | 2 Đá, 1 Linh kiện |
| building-fishing-dock.webp | Bến cá | Cầu tàu sàn gỗ chìa ra mặt nước xanh ngọc, cọc neo buộc thuyền nan nhỏ, thùng cá và cần câu gác bờ. | 4 Gỗ, 4 Cá |


## 6. Khuôn ảnh đại diện trò

“Ảnh bìa một trò học tập, tỉ lệ 3:2, 960 × 640. Cùng phong cách và bảng màu với map Bảo An. Cảnh có một chủ thể lớn rõ, ít chi tiết; nhìn ở kích thước nhỏ vẫn hiểu. Không chữ, số, nút bấm, giao diện trò, câu hỏi thật, đáp án thật, logo hoặc nhân vật chính. Không vẽ các chi tiết mà người chơi sẽ phải bấm vì đây chỉ là ảnh đại diện.”

| Tên tệp | Mô tả cảnh |
| --- | --- |
| game-card-question-island.png | Một đảo cỏ nhỏ, lối đi tới ba phiến đá sáng màu và cổng gỗ đơn giản, gợi chuyến khám phá thử thách. |
| game-card-memory-grove.png | Một góc rừng sáng, các thẻ hình lớn đặt thành ba cặp; trên thẻ chỉ có hình lá, quả và sao trang trí đơn giản, không ký tự. |
| game-card-sentence-house.png | Một ngôi nhà nhỏ đang được hoàn thiện bằng các khối gỗ trống xếp thành hàng, gợi xây và ghép câu. |
| game-card-word-bridge.png | Hai bờ cỏ có các bụi cây tương ứng, một cây cầu gỗ nhỏ nối qua dòng nước, gợi kết nối đúng cặp. |
| game-card-sequence-trail.png | Một đường gồm các bậc đá lớn theo thứ tự lên một đồi thấp, xen cây nhỏ, không số hoặc chữ. |

Các hình ngôi sao trong tranh thumbnail chỉ là họa tiết, không hiển thị số sao học sinh. Nếu dễ gây lẫn với phần thưởng, thay bằng hoa hoặc quả.

## 7. Tranh đăng nhập

**auth-welcome.png**, 1200 × 900:

“Một góc yên bình của thế giới Bảo An, có bãi cỏ, đường mòn dẫn qua cầu nhỏ, cây xanh và vài hòn đảo xa. Cùng màu sắc và nét vẽ với map tổng, chủ thể gọn, cảnh thoáng. Không nhân vật, không chữ, không logo, không nút đăng nhập. Tranh dùng ở phần giới thiệu cạnh biểu mẫu; không vẽ biểu mẫu vào trong tranh.”

## 8. Nhóm tùy chọn

### Vùng chung — map-discovery-wide.png / map-discovery-tall.png

“Vườn Khám Phá: công viên học tập trung tính, cây, đồi cỏ, suối và đường mòn; không biểu tượng riêng của môn nào, chừa bảy điểm đặt địa điểm.” Ghép khuôn map vùng ngang/dọc.

### Cáo tĩnh — companion-fox-static.png

“Một biểu tượng đầu Cáo nhỏ thân thiện, đơn giản như hình sticker, nét mềm, màu cam dịu và kem, mắt hiền, biểu cảm bình tĩnh. Một hình tĩnh, nền trong suốt, ảnh vuông 512 × 512. Không dựng cơ thể mô hình 3D, không quần áo cầu kỳ, không nhiều tư thế, không sprite sheet, không chữ, không khung huy hiệu.”

Đây là lựa chọn thay emoji, không phải yêu cầu phải làm nhân vật mới.

### Ba trạng thái

Ghép phong cách chung và yêu cầu ảnh tách nền 640 × 480:
- state-empty.png: một cuốn sổ trống mở cạnh hạt mầm, ít chi tiết.
- state-loading.png: một la bàn nhỏ nằm trên mẩu bản đồ trống, ảnh tĩnh, không vạch tiến độ.
- state-connection.png: hai đầu cầu gỗ nhỏ chưa nối qua một con suối, cảm giác nhẹ nhàng, không cảnh báo đỏ hoặc chữ lỗi.

### Năm nền chơi

Cùng phong cách bộ map, kích thước 1920 × 1080. **Khoảng giữa 60% thật trống, màu sáng đều; chi tiết chỉ ở rìa. Không thẻ, từ, câu hỏi, nút, đồng hồ hay nhân vật.**
- game-bg-question.png: rìa đồi cỏ và vài phiến đá.
- game-bg-memory.png: rìa cây rừng rất nhẹ.
- game-bg-sentence.png: sách và góc nhà nhỏ ở rìa.
- game-bg-connect.png: hai bờ xanh xa ở mép ảnh, giữa trống.
- game-bg-sequence.png: vài bậc đá ở rìa dưới, phần giữa trống.

## 9. Prompt concept giao diện — không dùng làm ảnh nền chạy thật

Có thể tạo ba bố cục, mỗi bố cục một bản desktop và một bản điện thoại. Ảnh concept được phép có UI mẫu để minh họa vị trí. Đặt tên đúng nhóm concept trong checklist.

### Bản đồ tổng

“Thiết kế concept màn chính một ứng dụng học tập trẻ em Bảo An, phong cách nhẹ như sổ phiêu lưu thiên nhiên. Bản đồ quần đảo có bốn vùng là nội dung chính; không phải lưới thẻ dashboard. Thanh trên gọn với thương hiệu, học sinh và ví sao. Bốn tên vùng đặt trên địa điểm bằng nhãn dễ đọc. Tiến độ tuần là một khối nhỏ, không lấn bản đồ. Một biểu tượng đầu Cáo nhỏ tĩnh, không nhân vật lớn. UI màu kem/xanh lá và viền dịu; nút chạm lớn.”

Bản desktop 1600 × 1000: map rộng, khối tiến độ bên phải.
Bản điện thoại 390 × 844: map dọc đủ bốn vùng, thanh trên gọn, thanh tác vụ dưới.

### Bản đồ vùng

“Concept màn vùng Toán của Bảo An. Một nền thung lũng hiền hòa với bảy địa điểm trên một lối khám phá. Có chặng hiện tại, chặng đã qua và chặng chưa mở thể hiện bằng nhãn giao diện, không nhân vật đi lại. Thanh trên có trở về và nhóm tuần. Khi chọn địa điểm, hiện bảng tuần/bộ câu. Câu hỏi và game không nằm trực tiếp trong ảnh nền.”

Desktop: bảng chọn bên phải, map vẫn nhìn rõ.
Điện thoại: bảng nổi từ dưới, nút đóng rõ, không che toàn bộ chỉ dẫn trở về.

### Chọn trò

“Concept bảng chọn trò cho một bộ câu đã giao. Phần đầu ghi tuần, tên bộ và tiến độ mẫu; bên dưới là các thẻ trò có ảnh bìa, tên ngắn, một dòng cách chơi và nút bắt đầu. Dùng tối đa vài thẻ, không dashboard nhiều thống kê. Giữ sự liên hệ thị giác với vùng map đang đứng, màu kem/xanh lá và nút lớn.”

Desktop: bảng bên cạnh map hoặc hộp rộng vừa phải.
Điện thoại: thẻ một cột trong bảng cuộn, giữ nút đóng ở đầu bảng.

Chữ trong concept chỉ là bố cục tham khảo. Không dùng số liệu mẫu của concept làm dữ liệu trong ứng dụng.
