# Kiểm tra BẢO AN LEARNING V3.1 — Real 3D

**Ngày kiểm tra:** 13/10/2026. **Phạm vi:** bản ngoại tuyến có thể chạy hoàn toàn không dùng CDN/npm, kiểm thử lõi dự án React. Không suy rộng kết quả này thành nghiệm thu bản build React.

## Giao diện thật, không phải concept

Engine `src/world3d/engine.ts` xây dựng **tam giác 3D** bằng tọa độ XYZ và vector pháp tuyến. Camera có phép chiếu phối cảnh, đèn hướng, sương theo độ sâu; đảo, cây, công trình, con cáo, bộ thẻ, sách đều là mesh trong thế giới 3D. Nếu WebGL2 bị chặn, thuật toán chuyển sang Canvas2D để chiếu và tô các tam giác cùng hình học 3D. Các nút và bộ chọn học liệu dùng DOM, tách khỏi cảnh vẽ.

## Kiểm thử đã đạt

- **44/44** kiểm thử hiện hành đạt: Game SDK, học liệu mẫu, kiểm tra dữ liệu, báo cáo, Memory Match trong React.StrictMode và các điều kiện của bộ 3D.
- **7/7 kích thước** dựng cảnh không tràn ngang/không phải cuộn: 1920×1080, 1440×900, 1366×768, 1024×768, 768×900, 390×844, 320×700.
- **3 nút Bắt đầu thực** tồn tại ở mọi độ phân giải.
- **Math Quest độc lập**: chơi đủ 8 câu, lưu trạng thái hoàn thành.
- **Memory Match độc lập**: lật hai thẻ không khớp tự mở khóa, sau đó ghép đúng 6 cặp và hoàn thành.
- **Sentence Builder độc lập**: ghép chính xác 5 câu bằng thẻ từ và hoàn thành.
- **Góc phụ huynh trong bản ngoại tuyến** hiển thị đủ 3 kết quả đã hoàn thành.
- **0 JavaScript page errors** trong các lượt QA đã kiểm tra.
- **DPR=3** trên màn hình 390px: Canvas dự phòng tự co giãn tỉ lệ điểm ảnh, không chỉ tô một góc.

Tệp dữ liệu: `preview/QA_REAL3D_RESULTS.json`. Có thể chạy lại bằng `python qa_real3d.py` khi đã cài Playwright và Chromium.

## Những gì CHƯA đạt/không được khẳng định

1. Không có kết quả `npm run build` từ môi trường tạo gói vì không tải được React, Vite hoặc các thư viện npm cần thiết. Người dùng cần chạy lại build React trên máy Windows.
2. Chromium QA cấm WebGL2, nên ảnh QA chỉ xác minh **chế độ dự phòng dựng 3D bằng Canvas2D**, không phải kết quả GPU/WebGL2. Cần kiểm tra WebGL2 trên máy thật.
3. Các mô hình thủ tục đang dùng phong cách **3D low-poly**, chưa đạt độ tinh xảo nhân vật, vật liệu và ánh sáng như hình mẫu game 3D cao cấp. Đây là hạn chế mỹ thuật có thật, không được mô tả là đã giống concept.
4. Bản ngoại tuyến chỉ dùng học liệu mẫu; bảng cửu chương và báo cáo demo dựa trên localStorage, không phải cùng hệ IndexedDB của ứng dụng React.
5. Các phần phân quyền, bảo mật hồ sơ nhiều gia đình và sao lưu đám mây chưa thuộc phạm vi V3.1 này.

## Cách tự nghiệm thu

1. Mở `preview/BAO_AN_3D_OFFLINE.html` để xem cảnh 3D và chơi thử trực tiếp bằng trình duyệt. Không cần cài đặt, không gửi dữ liệu lên Internet.
2. Kiểm tra ba đảo, bấm chọn vùng đất, thử cả ba game; lật hai thẻ sai trong Memory Match và chờ hai thẻ đóng lại.
3. Để nghiệm thu **ứng dụng chính React**, chạy `npm install`, `npm run build`, `npm run dev`, sau đó `npm run test:visual` trong thư mục dự án.
4. Chỉ công bố Stable khi build Vite, kiểm tra tích hợp React, kiểm thử tốc độ trên điện thoại phổ thông và phê duyệt mỹ thuật đều đạt.
