# RC11: giảm chờ khi đăng nhập, mở tuần và vào trò chơi

Ngày kiểm tra: 18/10/2026. Mốc so sánh: RC10, commit `8633233a517d5d333ba5698cfa1eb83dc333306c`. Vấn đề người dùng xác nhận: đăng nhập / mở tuần / vào trò chơi chậm trên https://gontogontet.netlify.app.

## Chẩn đoán

Website đã chạy RC10, giao thức câu hỏi 1, build `572c8a1ac555136f`. Bốn vòng đọc công khai không dùng tài khoản thật: HTML sau khi cache 55–74 ms; `/me` không có cookie 342–353 ms ở ba vòng sau; `/status` 528–833 ms ở ba vòng sau, lần đầu 2.043 ms. Một lần mở Chrome sạch mất 3.834 ms để thấy nút đăng nhập. `/status` mất 542 ms, xong mới gửi `/me` mất 348 ms. Số này đo từ máy kiểm tra, chưa đại diện mọi mạng hoặc tài khoản.

Mã nguồn cũng thực hiện nhiều truy vấn PostgreSQL nối tiếp cho mỗi thao tác. Khi máy chủ và cơ sở dữ liệu ở xa nhau, mỗi lượt có thêm thời gian mạng. Không đủ bằng chứng kết luận vùng Netlify/Supabase cụ thể đang sai; chưa thay vùng, gói dịch vụ hoặc giới hạn kết nối.

## Đã sửa

- Mở đồng thời yêu cầu trạng thái và phiên đăng nhập; vẫn chờ trạng thái hợp lệ trước khi hiện tài khoản. Máy chủ chưa khởi tạo được mở biểu mẫu thiết lập mà không chờ `/me`. Giới hạn tư liệu 2 MB trên cloud vẫn lấy từ máy chủ.
- Gộp các yêu cầu quản trị cùng bộ lọc đang chạy. Một cụm focus/visibility chỉ gửi một yêu cầu. Sau thao tác ghi phải tải dữ liệu mới và loại phản hồi cũ.
- Gộp hai bộ đếm chống dò mật khẩu trong một UPSERT có thứ tự; lỗi giới hạn vẫn rollback cả hai bộ đếm.
- Gộp đọc trạng thái tài khoản, phiên và học sinh; gộp dữ liệu học sinh/lớp/đơn vị/sao/đổi quà khi lấy tiến độ; gộp đọc lượt chơi với bộ câu hỏi.
- Dùng lại kết quả hành trình vừa tính khi tạo lượt đầu. Thiết lập hai timeout giao dịch trong một truy vấn.

Giữ khóa giao dịch của đơn vị, kiểm tra quyền/phiên, CSRF, khóa tuần, chấm sao máy chủ và giới hạn pool hiện tại. Không thêm cache dữ liệu riêng tư hoặc tải trước câu chưa được mở. SQLite/PostgreSQL giữ schema 1; không cần migration cho bản vá.

## Đo đối chiếu có kiểm soát

PostgreSQL fixture cô lập, cùng học liệu, cùng bộ điều phối HTTP, chèn 40 ms chờ trước mỗi truy vấn. Số lượt bao gồm xác thực HTTP. Thời gian là một lượt đo minh họa có tải máy cục bộ, không phải cam kết độ trễ Netlify.

| Thao tác | Truy vấn RC10 → RC11 | Thời gian RC10 → RC11 |
| --- | --- | --- |
| Đăng nhập | 23 → 16 | 1.373 → 949 ms |
| Đọc tiến độ | 9 → 5 | 429 → 238 ms |
| Mở trò đầu khi chưa ghim hành trình | 23 → 15 | 1.105 → 711 ms |
| Khởi tạo hành trình tuần | 23 → 15 | 1.098 → 737 ms |
| Mở trò sau khi ghim hành trình | 19 → 14 | 939 → 645 ms |
| Mở câu | 16 → 12 | 785 → 578 ms |
| Ghi đáp án đúng | 19 → 15 | 912 → 708 ms |

Chứng cứ cục bộ: `test-results/rc11-latency-comparison.json`. Kiểm thử query budget được giữ trong `tests/postgres-latency.test.mjs` và chạy cùng `npm run test:cloud`; không phụ thuộc thời gian chạy tuyệt đối của máy.

## Kiểm thử và triển khai

Chrome và Edge: 24/24 ca đạt, không bỏ qua hoặc chạy lại. Các ca gồm trạng thái/phiên gửi chồng nhau (cách nhau 0–1 ms), phiên đã đăng nhập, khách chưa đăng nhập, máy chủ chưa thiết lập, lỗi API rồi thử lại, cập nhật quản trị trong khi có phản hồi cũ, vào trò khi cảnh 3D chưa tải xong, gửi lại đáp án an toàn và phục hồi sau lỗi tải mã game.

`npm test`: 325/325 ca đạt (renderer 103, đóng gói 10, online 170, cloud 42), không bỏ qua. TypeScript/syntax và `npm run build` đạt. ZIP chạy độc lập được thử khởi tạo, tài khoản, câu hỏi, sao, sao lưu/phục hồi từ thư mục có dấu; cấu hình phiên bản bộ đóng gói đã đồng bộ RC11. Gói mới: `releases/bao-an-learning-3.8.0-rc.11.zip`, build `8a1501e7bf0605ee`; gói RC10 giữ nguyên. Chứng cứ: `test-results/rc11-node-acceptance.log`, `test-results/rc11-build.log`, `test-results/rc11-ui-browser-final.json`. Phiếu thử thực tế: [RC11](NGHIEM_THU_CUC_BO_RC11.md).

Sau khi GitHub/Netlify cập nhật, kiểm tra `/api/online/status` trả `runtimeVersion:3.8.0-rc.11`, `questionProtocolVersion:1`, và `/sw.js` đổi build. Dùng Chrome sạch đo lại biểu mẫu đăng nhập; số đo có thể biến động do cache/CDN/mạng. Không coi chỉ số `/status` là thời gian đăng nhập có tài khoản.

Nếu thao tác tài khoản thật vẫn chậm, bước tiếp theo là đối chiếu thời gian API và truy vấn cùng vùng Functions/PostgreSQL trong Netlify/Supabase, thử đồng thời nhiều học sinh, rồi chọn giải pháp hạ tầng dựa trên số đo. Netlify cho biết đặt Functions gần dữ liệu có thể giảm round trip; khả năng chọn vùng tùy gói Pro/Enterprise: [tài liệu vùng Functions](https://docs.netlify.com/build/functions/configuration/#region). Chưa có đo tài khoản thật/kiểm tra tải nhiều học sinh trong đợt này nên chưa tuyên bố hết mọi độ trễ hoặc đủ điều kiện production.
