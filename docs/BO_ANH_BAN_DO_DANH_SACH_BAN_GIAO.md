# Checklist tạo ảnh và bàn giao bản đồ

Ngày: **05/11/2026**. Dùng cùng [kế hoạch bản đồ hình ảnh](KE_HOACH_BAN_DO_HINH_ANH_2026-11-05.md) và [prompt tạo ảnh](BO_ANH_BAN_DO_PROMPT_TAO_ANH.md).

**Bạn chỉ cần tạo ảnh. Chữ, nút bấm, đường tiến độ, số tuần, sao và trạng thái khóa sẽ được dựng trong ứng dụng.**

## 1. Cấu trúc gói gửi lại

Đặt ảnh vào các thư mục tương ứng, nén cả thư mục thành một ZIP. Không cần tự nén chất lượng hoặc đổi sang WebP.

- 01-backgrounds/ — map ngang/dọc.
- 02-landmarks/ — địa điểm PNG trong suốt.
- 03-game-cards/ — ảnh đại diện trò.
- 04-auth/ — tranh đăng nhập.
- 05-optional/ — ảnh tùy chọn.
- 06-concepts/ — ảnh mẫu bố cục toàn màn, nếu bạn muốn tạo.
- NOTES.md — ghi ảnh chính, phiên bản, công cụ/nguồn và điều cần lưu ý.

Nếu có nhiều biến thể, thêm v01, v02 vào tên, rồi ghi rõ phiên bản chọn dùng trong NOTES. Không cần gửi lại mã dự án hoặc thông tin tài khoản.

## 2. Mười ảnh map nền

Map có nền phủ kín, không trong suốt. Không có chữ, nút, logo, sao, khóa, số tuần hoặc tòa nhà bấm chính. Những địa điểm chính nằm trong nhóm ảnh tách nền.

| Xong | Tên tệp | Kích thước | Cảnh cần tạo | Đợt |
| --- | --- | --- | --- | --- |
| [ ] | map-world-wide.png | 2560 × 1600 | Bốn vùng quanh quảng trường, bố cục ngang | A |
| [ ] | map-world-tall.png | 1536 × 2048 | Cùng thế giới, sắp lại dọc đủ bốn vùng | A |
| [ ] | map-math-wide.png | 2560 × 1600 | Đảo Số: đồi cỏ, suối, vườn ô vuông, 7 khoảng đặt chặng | A |
| [ ] | map-math-tall.png | 1536 × 2048 | Đảo Số bố cục dọc, chặng zích zắc từ dưới lên | A |
| [ ] | map-vietnamese-wide.png | 2560 × 1600 | Rừng Chữ: rừng, hoa, lối mòn, 7 khoảng trống | B |
| [ ] | map-vietnamese-tall.png | 1536 × 2048 | Rừng Chữ bố cục dọc | B |
| [ ] | map-english-wide.png | 2560 × 1600 | Cảng English: bờ biển, bến nước, đảo nhỏ, 7 khoảng trống | B |
| [ ] | map-english-tall.png | 1536 × 2048 | Cảng English bố cục dọc | B |
| [ ] | map-computing-wide.png | 2560 × 1600 | Phố Robot: vườn công nghệ dịu, lối đi, 7 khoảng trống | B |
| [ ] | map-computing-tall.png | 1536 × 2048 | Phố Robot bố cục dọc | B |

Tọa độ khoảng trống và phong cách chi tiết nằm ở mục 3–4 của kế hoạch. Giữ màu và cảnh vật của bản ngang/dọc thống nhất; không cắt mất vùng để ép tỉ lệ.

## 3. Mười hai địa điểm tách nền

Tất cả: **512 × 512 px, PNG trong suốt thật, vật thể ở giữa, lề khoảng 10%, góc nhìn thống nhất**. Không có bảng chữ hoặc nhân vật.

| Xong | Tên tệp | Vật thể | Đợt |
| --- | --- | --- | --- |
| [ ] | place-math-number-house.png | Nhà nhỏ có cửa sổ hình học, thân thiện | A |
| [ ] | place-math-garden.png | Vườn ô vuông, luống cây hình học thấp | A |
| [ ] | place-math-market.png | Quầy chợ nhỏ với giỏ quả; không có giá tiền | A |
| [ ] | place-vietnamese-library.png | Thư viện gỗ nhỏ có mái lá và sách | B |
| [ ] | place-vietnamese-word-tree.png | Cây lớn có vài cuốn sách nhỏ; không có chữ trên lá | B |
| [ ] | place-vietnamese-story-house.png | Nhà kể chuyện nhỏ, hiên có chỗ ngồi | B |
| [ ] | place-english-harbor.png | Bến tàu gỗ nhỏ và thuyền buồm đơn giản | B |
| [ ] | place-english-lighthouse.png | Hải đăng thấp, cửa lớn rõ hình | B |
| [ ] | place-english-cafe.png | Quán ven biển nhỏ, bàn ghế; bảng hiệu để trống | B |
| [ ] | place-computing-workshop.png | Xưởng nhỏ, bánh răng trang trí đơn giản | B |
| [ ] | place-computing-keyboard-garden.png | Vườn có các khối phím trống; không chữ/số | B |
| [ ] | place-computing-info-station.png | Trạm thông tin nhỏ, màn hình trống, cột phát tín hiệu | B |

Mỗi bộ 3 hình được dùng lại trong nhiều chặng. Không cần tạo trạng thái sáng/tối, khóa/mở hoặc 35 phiên bản.

## 4. Năm ảnh trò chơi

Tất cả: **960 × 640 px, nền có cảnh nhẹ, không chữ, không UI, không đáp án thật, không logo**.

| Xong | Tên tệp | Ý tưởng | Đợt |
| --- | --- | --- | --- |
| [ ] | game-card-question-island.png | Đảo nhỏ, vài phiến đá/trạm thử thách; gợi khám phá câu hỏi | A |
| [ ] | game-card-memory-grove.png | Góc rừng có các thẻ hình đơn giản đi thành cặp | B |
| [ ] | game-card-sentence-house.png | Ngôi nhà nhỏ và các khối chữ trống để gợi ghép câu | B |
| [ ] | game-card-word-bridge.png | Hai bờ cây xanh và cây cầu nhỏ gợi nối đôi | B |
| [ ] | game-card-sequence-trail.png | Những bậc đá theo một đường tăng dần, không số | B |

Hình chỉ là ảnh đại diện. Lưới thẻ, từ, đáp án và cách chấm được tạo từ nội dung thực của người dùng.

## 5. Một ảnh đăng nhập

| Xong | Tên tệp | Kích thước | Nội dung | Đợt |
| --- | --- | --- | --- | --- |
| [ ] | auth-welcome.png | 1200 × 900 | Một góc quần đảo hiền hòa, đường mòn, cây và bầu trời; không nhân vật, không chữ | B |

Đợt A **8 tệp**. Đợt B **20 tệp**. Tổng bộ chính **28 tệp**.

## 6. Mười một ảnh tùy chọn

Có thể bỏ qua toàn bộ nhóm này khi gửi bộ chính.

| Xong | Tên tệp | Kích thước/nền | Mục đích |
| --- | --- | --- | --- |
| [ ] | map-discovery-wide.png | 2560 × 1600, có nền | Vùng Khám Phá cho môn tự đặt ngoài bốn môn |
| [ ] | map-discovery-tall.png | 1536 × 2048, có nền | Bản dọc của vùng chung |
| [ ] | companion-fox-static.png | 512 × 512, trong suốt | Biểu tượng Cáo nhỏ đơn giản thay emoji; một hình tĩnh |
| [ ] | state-empty.png | 640 × 480, trong suốt | Cuốn sổ và hạt mầm, trạng thái chờ bài |
| [ ] | state-loading.png | 640 × 480, trong suốt | La bàn nhỏ, trạng thái chờ tải; không cần ảnh động |
| [ ] | state-connection.png | 640 × 480, trong suốt | Cầu nhỏ chưa nối, trạng thái thử kết nối lại |
| [ ] | game-bg-question.png | 1920 × 1080, có nền | Cảnh cực nhẹ ở rìa, giữa trống |
| [ ] | game-bg-memory.png | 1920 × 1080, có nền | Rừng mờ nhẹ ở rìa, không vẽ thẻ |
| [ ] | game-bg-sentence.png | 1920 × 1080, có nền | Góc nhà/sách ở rìa, không vẽ từ hoặc ô |
| [ ] | game-bg-connect.png | 1920 × 1080, có nền | Hai bờ xa, giữa trống cho hai cột |
| [ ] | game-bg-sequence.png | 1920 × 1080, có nền | Đường đá ở rìa, giữa trống cho bộ thẻ |

Cáo tĩnh không cần bộ phận rời, biểu cảm, dáng chạy, xương hay nhiều góc nhìn. Nếu muốn nhân vật nhẹ nhất thì giữ emoji hiện tại.

## 7. Sáu ảnh concept toàn màn — tùy chọn, không phải tài nguyên chạy thật

| Xong | Tên tệp | Kích thước |
| --- | --- | --- |
| [ ] | concept-world-desktop.png | 1600 × 1000 |
| [ ] | concept-world-phone.png | 390 × 844 |
| [ ] | concept-region-desktop.png | 1600 × 1000 |
| [ ] | concept-region-phone.png | 390 × 844 |
| [ ] | concept-game-picker-desktop.png | 1600 × 1000 |
| [ ] | concept-game-picker-phone.png | 390 × 844 |

Các ảnh này để tham khảo vị trí map, thanh đầu, nút và bảng. Nếu công cụ tạo ảnh viết chữ sai, có thể dùng nhãn khối đơn giản; chữ thật sẽ được dựng lại trong mã.

## 8. Kiểm tra trước khi gửi

- [ ] Tên tệp đúng danh sách; không có đuôi PNG nhưng bên trong là JPEG.
- [ ] Ảnh mở được, đúng tỉ lệ, không bị kéo méo.
- [ ] Màu, đường nét, góc nhìn và ánh sáng đồng bộ.
- [ ] Map có đủ chỗ đặt các điểm bấm, không nhét cây/nhà vào chỗ nhãn.
- [ ] Ảnh tách nền có alpha thật, không phải ảnh nền caro.
- [ ] Không có chữ/logo/watermark/đáp án hoặc nút vẽ dính trong tài nguyên chạy thật.
- [ ] Vật thể không bị cắt bóng hoặc cắt mái ở mép.
- [ ] Đã xem thumbnail thu nhỏ: vẫn nhận ra từng nơi.
- [ ] NOTES ghi công cụ/nguồn và quyền sử dụng nếu có; không dùng nhân vật/asset tải lại từ Munworld.
- [ ] Nếu có nhiều biến thể, ghi rõ ảnh nào là bản chọn chính.

## 9. Mẫu NOTES để bạn điền

Tên bộ ảnh: Bảo An — Bản đồ khám phá.
Đợt bàn giao: A / B / C.
Ngày bàn giao:
Người/công cụ tạo:
Phiên bản phong cách:
Các tệp chọn dùng:
Các tệp chưa hoàn thành:
Những ảnh cần chú ý khi ghép:
Nguồn và quyền sử dụng:
