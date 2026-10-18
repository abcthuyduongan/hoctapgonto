# Kiểm tra tài khoản thật: chậm dữ liệu và giao diện RC11

Ngày 18/10/2026, website `https://gontogontet.netlify.app`, API `3.8.0-rc.11`. Người dùng xác nhận gặp cả giật khi thao tác và chờ tải trên Windows; cho phép đăng nhập tài khoản học sinh để kiểm tra. Báo cáo không ghi tên đăng nhập, mật khẩu, cookie, mã tài khoản hoặc nội dung câu hỏi.

## Đã thực hiện

Đăng nhập qua API, đọc phiên/tiến độ/lựa chọn trò, mở một lượt chơi thử và câu đầu, thoát lượt thử rồi đăng xuất. Không gửi đáp án, hoàn thành bài, chuyển tuần hoặc đổi mật khẩu. Phiên kiểm tra đã đăng xuất thành công. Không thay mã nguồn ứng dụng trong đợt chẩn đoán này.

| Thao tác thật | Thời gian đo | Dữ liệu trả về |
| --- | --- | --- |
| Đăng nhập | 5.030 ms | 328 byte |
| Đọc phiên, ba lần | 682–806 ms | 328 byte/lần |
| Đọc tiến độ, ba lần | 1.200–1.266 ms | 15.825 byte/lần |
| Lựa chọn trò, ba lần | 1.370–1.462 ms | 250 byte/lần |
| Tạo lượt chơi | 2.716 ms | 2.615 byte |
| Mở câu đầu | 2.759 ms | 527 byte |
| Thoát lượt thử | 2.040 ms | 2 byte |

Hai yêu cầu mở lượt và mở câu cộng khoảng 5,48 giây trước khi tính tải/dựng cảnh; đây là phép đo API từ máy kiểm tra, không phải thời gian nhìn thấy khung hình trên máy người dùng. Dữ liệu nhỏ vẫn có thời gian đợi lớn, vì vậy giảm dung lượng hình ảnh không xử lý hết độ trễ.

Chứng cứ cục bộ đã lược thông tin cá nhân: `test-results/rc11-live-account-performance.json`.

### Kiểm tra tiếp từng trò trong tuần đang mở

Hai lượt đo tiếp theo chỉ tìm trò từ các bộ hợp lệ của tuần hiện tại. Có ba trò tương thích: Đảo Câu Hỏi, Trí Nhớ và Nối Từ. Không tìm thấy bộ phù hợp Ghép Câu/Bậc Thang Quy Luật trong các bộ đang được giao; không vượt khóa tuần hoặc thay quyền tương thích để thử hai trò này.

| Trò / thao tác | Lượt đo mở rộng |
| --- | ---: |
| Đảo Câu Hỏi: tạo lượt | 2.662 ms |
| Đảo Câu Hỏi: mở câu đầu | 2.655 ms |
| Ảnh minh họa của câu đầu, GET thật 5.269 byte | 2.162 ms |
| Trí Nhớ: tạo lượt | 2.666 ms |
| Nối Từ: tạo lượt | 2.664 ms |
| Thoát từng trò | 1.990–1.993 ms |

Theo mã MathQuest, ảnh phải sẵn sàng trước khi yêu cầu mở đồng hồ/nội dung câu. Cộng ba yêu cầu riêng của câu đầu khoảng 7,48 giây trong trường hợp ảnh cần tải mới; đây là suy ra từ số đo API, chưa phải đo thời điểm khung hình xuất hiện. Không nên gọi toàn bộ thời gian này là lỗi dựng hình. Ảnh trả về rất nhỏ nhưng phần lớn thời gian là đợi phản hồi (2.161 ms tới header, 2.162 ms tới hết body).

Ở Lật ô/Nối từ, bảng khóa khi chờ API lưu lựa chọn, sau đó nếu ghép sai còn có timer 700 ms. Có thể giảm phần chờ thừa bằng cách tính 700 ms từ khi lật/chọn ô thứ hai; vẫn chỉ mở khóa sau biên nhận máy chủ và giữ cơ chế gửi lại khi lỗi. Các lần trả lời chưa được gửi trong phép đo tài khoản thật này nên không có số đo API attempt thực tế ở đây.

Các lượt thử đã thoát và phiên đã đăng xuất. Đối chiếu số dư sao trước/sau bằng nhau. Chứng cứ: `test-results/rc11-live-games-performance.json` và `test-results/rc11-live-games-performance-expanded.json`; không chứa ID tài khoản hoặc nội dung câu hỏi. Chưa đo cuộn/FPS trên tài khoản thật vì công cụ trình duyệt vẫn bị chặn.

## Giao diện nặng đã xác minh

Đọc trực tiếp năm mô hình từ Netlify, có gửi `Accept-Encoding: br, gzip`: máy chủ trả `Content-Encoding` không có, tức `identity`, `application/octet-stream`. Tổng thực nhận **7.271.708 byte**, khớp SHA-256 với mô hình trong mã nguồn.

| Mô hình | Byte thực tải |
| --- | ---: |
| math-world | 1.839.516 |
| fox-guide | 1.120.088 |
| memory-world | 1.855.024 |
| language-world | 1.744.044 |
| environment | 713.036 |

Đây là byte thân HTTP thực tế, không phải số ước tính sau giải nén. Cơ chế nén trong `tools/modelTransport.mjs` hiện dùng ở Vite dev/preview và máy chủ cục bộ; Netlify phục vụ tệp tĩnh không chạy middleware đó. Chứng cứ: `test-results/rc11-public-ui-weight.json`.

Ngoài tải mạng, mã hiện tại luôn giải mã đủ năm mô hình, chuẩn bị shader có và không có bóng, rồi mới đánh dấu cảnh sẵn sàng. Nền 3D vẫn vẽ liên tục khi hiệu ứng bật. “Nhẹ” giảm chất lượng dựng hình nhưng vẫn tải đủ mô hình; “Chọn trò bằng nút” đổi điều khiển nhưng vẫn dựng WorldCanvas. Desktop tự động bắt đầu chất lượng cân bằng dựa trên chiều rộng, chưa xét cấu hình thiết bị.

Trang đăng nhập chưa tải Three.js/GLB nhưng vẫn nhập tĩnh cả giao diện giáo viên, bộ đọc Excel/Word và màn học sinh. Bản build hiện tại có khoảng 399 KB JavaScript và 293 KB CSS chưa nén ở luồng đăng nhập. Cần tách các thành phần này theo vai trò và thời điểm sử dụng.

## Hạn chế kiểm tra giao diện trực tiếp

Công cụ trình duyệt trả lỗi `Local browser use is disabled in Work settings`. Người dùng đã báo bật quyền; thử lại inventory, nạp lại kết nối và mở trình duyệt tích hợp vẫn bị cùng lỗi. Vì vậy chưa đo được cuộn/FPS trong phiên tài khoản thật. Không dùng kết quả API hoặc FPS ở các bản kiểm thử cũ để khẳng định giao diện hiện tại mượt trên máy người dùng.

## Thứ tự đề xuất sửa tiếp

1. Thêm chế độ học nhẹ thực sự: không tạo WebGL, không tải GLB; vẫn đủ trò chơi, câu hỏi, âm thanh/hình của tác giả và bảng sao. Giữ lựa chọn mở cảnh 3D; tạm dừng hoặc dùng nền tĩnh khi đọc/trả lời. Kiểm thử phải xác nhận chế độ nhẹ có 0 yêu cầu GLB và 0 canvas WebGL.
2. Tách màn đăng nhập, quản trị, học sinh và bộ nhập tài liệu thành các chunk riêng; CSS theo màn. Đăng nhập không cần tải bộ Excel/Word hoặc màn trò chơi.
3. Chuẩn bị tài nguyên 3D nhẹ ngay lúc build, chỉ tải khi được yêu cầu. Nếu thử transport nén, phải xác minh byte/header/hash thực trên Netlify; không coi thêm Content-Encoding trong cấu hình header là đủ vì Netlify thường bỏ qua custom header này ([giới hạn chính thức](https://docs.netlify.com/manage/routing/headers/)). Chưa được dùng thẳng fox-guide-mobile cho Premium nếu chưa đảm bảo các animation cần thiết. Bản nén không tự giảm bộ nhớ GPU của texture đã giải mã.
4. Gắn số đo thời gian máy chủ/truy vấn không chứa dữ liệu cá nhân, đối chiếu vùng Functions và PostgreSQL thực tế. Giảm thêm các truy vấn nối tiếp trên thao tác mở lượt/mở câu, giữ kiểm tra phiên, khóa tuần và chấm sao phía máy chủ. Không mở trước đồng hồ câu hỏi khi học sinh chưa xem được câu.
5. Lặp lại cùng phép đo tài khoản thật và kiểm tra cuộn/khung hình sau khi công cụ trình duyệt nhận quyền. Phải đo lại cả tải đầu, tải lại, vào/thoát nhiều trò và độ tăng bộ nhớ; không chỉ dựa vào số ca kiểm thử chức năng.

Kết luận hiện tại: có bằng chứng cho cả tải/render giao diện nặng và độ trễ API. RC11 giảm số truy vấn nhưng hai phần vẫn cần xử lý tiếp. Chưa thay vùng dịch vụ, gói trả phí, dữ liệu hay mã ứng dụng trong đợt đo này.
