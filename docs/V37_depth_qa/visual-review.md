# V3.7 PR02 — kiểm tra lần chỉnh chiều sâu

Ngày kiểm tra: **14/10/2026**, giờ Việt Nam. Kiểm tra bản React production ở `http://127.0.0.1:5180/?premium3d=1`, Edge headless, profile QA riêng.

## Nhận xét trực tiếp từ ảnh ứng dụng

Phản hồi “tổng thể còn đơn giản, thiếu chiều sâu” có cơ sở trong bản trước: ba đảo gần như nằm trên một hàng, cùng tỷ lệ; đảo và cáo rất nhỏ ở điện thoại; vùng trời trống lớn; ba khối điều khiển xanh/vàng nổi mạnh hơn cảnh 3D. Các kiểm thử vận hành xanh trước đó không chứng minh được chất lượng hình ảnh này.

Lần chỉnh này tạo điểm nhìn rõ vào Đảo Toán: lâu đài và cáo ở tiền cảnh, đảo Trí Nhớ và Ngôn Từ lùi sau; mặt đất có mép đá nhiều tầng, đường bậc, vật liệu và cây cỏ rõ hơn. Cáo đọc được khuôn mặt và dáng đứng trên cả hai màn hình dọc. Giao diện kem/teal dịu hơn để cảnh 3D giữ vai trò chính; ba khu vẫn có màu nút riêng để nhận diện.

So sánh kích thước dưới đây là **ước lượng từ ảnh PNG đã xem**, không phải bounding box của mesh hoặc kết quả tự động chấm mỹ thuật. Kích thước được làm tròn vì chuyển động Idle/Cheer và camera có thể làm thay đổi biên vài pixel.

| Màn hình | Bản trước: chiều cao đảo Toán/cáo | Bản mới: chiều cao đảo Toán/cáo | Điều nhìn thấy |
|---|---|---|---|
| 1440×900 | khoảng 230/110 px | khoảng 405/205 px | Math thành tiền cảnh rõ; cáo không còn như biểu tượng phụ |
| 390×844 | khoảng 90/45 px | khoảng 240/115 px | Lâu đài, đường đi, vách đảo và biểu cảm cáo nhận diện được |
| 320×640 | khoảng 70/30 px | khoảng 145/70 px | Ba đảo vẫn nhìn thấy; không cắt cáo hoặc mặt đảo quan trọng |

Nguồn trước: `../V37_qa/premium-1440x900.png`, `premium-390x844.png`, `premium-320x640.png`. Nguồn sau: các ảnh `depth-default-*` trong thư mục này. Chế độ Math có ảnh `depth-math-*`; cả biên tay trong Cheer cũng nằm trong khung ở các ảnh dọc đã xem.

## Lỗi đã phát hiện và sửa trong lần kiểm tra

- Lần chụp đầu, nền núi thành một dải tường xanh đặc, có cạnh dưới thẳng, che cảm giác khoảng cách. Lần chụp sau đã có độ trong và chuyển alpha về 0 tại biên; dải tường và cạnh dưới rõ đã biến mất. Nền hiện là lớp đồi mờ phía sau các đảo.
- 844×390 ban đầu có hàng điều hướng lớn đè lên tiêu đề và cài đặt cảnh. Bản chụp sau dùng một hàng điều hướng; tiêu đề đọc được, vùng điều khiển không chồng nhau.
- Các nút xem đảo ở landscape ban đầu chỉ cao 28 px. Sau sửa, cả ba nút xem đảo, chọn học liệu và Bắt đầu đều cao ít nhất 44 px. Bản chụp đầu cùng dữ liệu được giữ trong `iteration1/` để đối chiếu.

## Bằng chứng vận hành trong lần chụp cuối

Có tám ảnh: bốn viewport **1440×900, 390×844, 320×640, 844×390**, mỗi viewport chụp mặc định và focus Math. Script `tools/capture_v37_depth.mjs` kết thúc thành công. Không có lỗi JavaScript, resource lỗi HTTP, overflow ngang, nút ngoài viewport hoặc lớp khác che tâm nút. Mỗi màn hình có đủ ba nút xem đảo, ba select học liệu và ba nút Bắt đầu.

| Quan sát | Bản trước | Bản mới |
|---|---:|---:|
| Desktop balanced: draw calls / triangles | 87 / 94.200 | 88 / 122.732 |
| 390×844 low: draw calls / triangles | 52 / 48.528 | 46 / 64.852 |
| 320×640 low: draw calls / triangles | 49 / 48.024 | 46 / 64.852 |
| Texture GPU ước tính | 8 MiB | 9 MiB |
| Median FPS ghi nhận | 59,9 | 59,9 |
| P95 thời gian frame | khoảng 16,8 ms | khoảng 16,9–17,0 ms |

Máy đo: Windows 10.0.26300, Intel Core Ultra 5 125H, Intel Arc qua ANGLE/D3D11, Edge 155.0.4283.45. Median/P95 là cửa sổ lăn của renderer, được lấy bốn lần cho mỗi viewport mặc định sau khi tải; đây là quan sát ngắn, chưa phải benchmark dài hạn hay đo GPU memory từ profiler. Số tam giác đã tăng; FPS tương đương trong lần chụp trên máy này không chứng minh hiệu năng trên điện thoại yếu.

**Hai viewport dọc và landscape là giả lập trên cùng GPU desktop**, không phải kiểm tra Android/iPhone thật. Test gameplay/regression được root chạy riêng sau khi browser chụp này đã đóng; báo cáo này không thay thế kết quả các test đó.

Dữ liệu chi tiết: `depth-browser-evidence.json`, `capture-summary.md`. DOM rectangles, tỷ lệ pixel, renderer, 44px touch targets, các mẫu runtime và lỗi đều được lưu; không đọc hoặc sửa hồ sơ IndexedDB của người dùng.

## Những giới hạn còn thật

Bố cục và tỷ lệ đã cải thiện rõ ở trạng thái mặc định lẫn focus, nhưng hai đảo Trí Nhớ/Ngôn Từ vẫn là landmark thủ tục. Cây và căn nhà nhận diện được hướng khu; mức chi tiết, chất liệu và đạo cụ học tập còn thấp hơn đảo Toán. Cần asset thật theo kế hoạch để ba đảo đồng nhất; không coi lần chỉnh này là hoàn tất PR03 hoặc vượt cổng đủ năm model premium.

Landscape 844×390 ưu tiên giữ đủ đường vào game: stage thực chỉ cao 119 px, nên cảnh/nhân vật nhỏ hơn rõ so với màn hình dọc. 320×640 cũng có stage 190 px để giữ đủ vùng chạm. Đây là giới hạn không gian quan sát được, không phải lỗi crop. Đánh giá độ đọc và thao tác trên điện thoại thật vẫn chưa có bằng chứng trong lần QA này.

Các ảnh cho thấy chiều sâu và ưu tiên thị giác đã tốt hơn bản trước. Đây là nhận xét QA về thay đổi cụ thể; **không tự chấm điểm mỹ thuật hoặc thay chủ dự án nghiệm thu FINAL**.
