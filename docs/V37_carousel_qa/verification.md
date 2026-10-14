# Xác minh tương tác đảo và giao diện chung V3.7

Ngày 14/10/2026. Build cuối: `index-BmNCNoVt.js`, `PremiumWorldRenderer-jEhZ5ih1.js`.

Trang chủ dùng một giao diện 3D mới, bỏ nút chuyển cũ/mới và các nhánh giao diện theo flag. Renderer dự phòng vẫn tải riêng, chỉ được khởi tạo sau khi cảnh mới lỗi hoặc mất context. Kiểm thử mạng xác nhận khi premium thành công không tải chunk `legacyAdapter`; mỗi host có đúng một canvas.

Ban đầu các đảo cùng độ cao, chiều sâu, kích thước và khoảng cách; cáo chờ trên bục riêng ở góc trái. Chọn đảo quay theo cung ngắn đưa đảo đó lên trước, tăng tỷ lệ của đảo và làm cáo nhảy tới điểm đáp. Chuyển nhanh bắt đầu từ vị trí đang chạy và kết thúc ở lựa chọn mới nhất. Tổng quan trả đảo về hàng ngang và cáo về góc chờ. Một controller dùng RAF sẵn có; không thêm vòng hoạt ảnh riêng. Số đảo quyết định góc và bán kính; kiểm thử mô phỏng tối đa 12 đảo có khoảng cách phù hợp.

Camera tính cả vùng chờ phía trước để tránh cắt cáo ở điện thoại và máy tính bảng dọc. Reset bằng bàn phím giữ focus ở nhóm tổng quan. Giảm chuyển động đặt trực tiếp trạng thái cuối và không giữ RAF liên tục. Chất lượng, đổi viewport, pause và dispose được kiểm tra.

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| TypeScript / cú pháp | PASS | `typecheck.txt`, `test-syntax.txt` |
| Build production | PASS | `build.txt` |
| Renderer, asset và controller | 46/46 PASS | `test-renderer.txt` |
| Edge production | 39/39 PASS | `browser-tests.txt` |
| Chrome production | 4/4 PASS | `legacy-browser-tests.txt` (tên file lịch sử; hiện kiểm tra giao diện mới mặc định) |
| Hash core và game | 17 tệp, 0 thay đổi | `protected-source-check.json` |
| Ảnh 3 viewport × 4 trạng thái | 12/12 đã kiểm tra trực tiếp | `visual-review.md`, `carousel-*.png` |
| Tải model khi chọn đảo | Không tải thêm | `carousel-browser-evidence.json` |

Bộ Edge hoàn thành 8 câu Toán, 6 cặp Trí nhớ, 6 câu Ngôn từ và kiểm tra lưu/đọc lại dữ liệu, nhập học liệu, nút chạm, bàn phím, mất context, model lỗi, decode texture lỗi và 20 lần unmount. Bốn trường hợp chiếu bounding box thật của cáo/bục qua camera xác nhận không cắt ở 1440×900, 768×1024, 390×844 và 320×640.

Capture đo khoảng 59,9–60,2 FPS trên Intel Arc/Windows; viewport nhỏ là giả lập, chưa đại diện thiết bị điện thoại thật. Mỗi hồ sơ tải đúng hai GLB khác nhau: đảo Toán và cáo. Memory/Language vẫn là landmark tạm, chưa nghiệm thu mỹ thuật premium hoặc PR03/FINAL. Bundle premium 660,90 kB (gzip 170,33 kB) vẫn có cảnh báo kích thước Vite; legacy 30,42 kB (gzip 12,65 kB) không tải trong đường chạy bình thường.

Ảnh và video: [bố cục ban đầu](carousel-initial-1440x900.png), [đảo Toán được chọn](carousel-math-1440x900.png), [video chuyển đảo](carousel-demo.webm).
