# Khôi phục giao diện năm đảo trên máy chủ quản lý

## Nguyên nhân đã xác minh

Trang `http://127.0.0.1:4180/?online=0` hiển thị ba đảo đơn giản và Cáo bị cắt mép vì renderer chính khởi tạo thất bại rồi chuyển sang renderer dự phòng. Trên chính trình duyệt người dùng, console báo không đọc được texture `blob:` của cả năm mô hình; diagnostics và dòng trạng thái xác nhận đang dùng cảnh dự phòng.

Máy chủ quản lý mới đặt CSP `connect-src 'self'`. Three.js `ImageBitmapLoader` dùng `fetch(blobURL)` để đọc ảnh nhúng trong GLB; quy tắc `img-src blob:` không đủ cho thao tác này. CSP cũng chặn WebAssembly của bộ tối ưu hình học, làm LOD chuyển sang `unavailable`.

## Sửa

- `server/online-server.mjs` và `netlify.toml`: cho phép `connect-src 'self' blob:` và `script-src 'self' 'wasm-unsafe-eval'`.
- Giữ chặn JavaScript `unsafe-eval`, script inline và kết nối tới origin ngoài ứng dụng. Không thay renderer hay dữ liệu học sinh để xử lý lỗi tải.
- Khởi động lại đúng máy chủ cục bộ đã mở, nạp lại trang người dùng và áp dụng bản cập nhật bộ nhớ ngoại tuyến.
- Phát hành `3.8.0-pilot.4`; gói pilot.3 được giữ nguyên để không ghi đè bản đã giao.

## Xác minh

Trên trình duyệt trong ứng dụng ở đúng URL báo lỗi: `data-state=ready`, engine `three-webgl`, đủ 5 đảo, 5 mô hình đã tải, `assetErrors=[]`, 91 texture GPU, Cáo hiện đủ và chọn đảo Trí Nhớ được. LOD đã `ready`, hình học giảm từ 152.320 xuống 84.114 tam giác cho cấu hình cần giảm chi tiết.

Kiểm thử trình duyệt bổ sung chạy qua **máy chủ SQLite thật có CSP**, ở kích thước 545px và 1440px, xác nhận cảnh chính, texture, LOD và chọn đảo; luồng tài khoản học sinh cũng bắt buộc cảnh chính. Trước đây kiểm thử nhập/chấm/sao có thể đạt dù cảnh 3D đang ở dự phòng; điều kiện mới phát hiện được lỗi đó. Kiểm thử worker lịch sử nay sửa trên bản sao dist trong thư mục tạm, không thay tệp phục vụ trang thật.

Build và 52 kiểm thử parser/máy chủ/đóng gói đạt; 3/3 ca trình duyệt đạt. Ca cảnh 3D được chạy thêm với service worker thật và xác nhận “Sẵn sàng học ngoại tuyến”, đạt 1/1. Ảnh PWA và báo cáo ở `test-results/online-premium-pwa-output/` và `test-results/online-premium-pwa-report.json`; báo cáo ba ca ở `test-results/online-browser-report.json`.

Gói đã kiểm tra lại toàn bộ hash: `releases/bao-an-learning-3.8.0-pilot.4.zip`, build `c9795cae7edc4d74`, SHA-256 `dbe9e8f738834e28190fd8eee331ad3289c165eda2eceec224841c9e1cf5db13`.

Tham khảo [MDN về WebAssembly và CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_webassembly_execution); nguyên nhân và kết quả chính được xác minh bằng mã Three.js cài trong dự án và diagnostics trên trình duyệt thực tế.
