# BẢO AN LEARNING V3.6.2 — BÁO CÁO BÀN GIAO NỀN TẢNG NỘI DUNG

Ngày: 13/10/2026. Trạng thái: **RC2 – sẵn sàng chuẩn bị nội dung học tập**, **không phải FINAL 3D PREMIUM**.

## 1. Nguồn và phạm vi thay đổi
- Kế thừa trọn vẹn mã V3.6.1; giữ hai nhánh React/IndexedDB và HTML ngoại tuyến/localStorage, không xóa hoặc chuyển đổi dữ liệu của nhánh nào.
- Cả ba trò chơi tiếp tục có mặt: Math Quest, Memory Match, Sentence Builder. Không thay Game SDK V1, kiểu học liệu nền tảng hay tên cơ sở dữ liệu hiện có.
- React Creator Studio: thêm **biên soạn trắc nghiệm 4 lựa chọn** cho Math Quest; giữ trình biên soạn ghép cặp và ghép câu. Kiểm tra 2–30 câu/cặp, phiên bản bất biến, mục tiêu kiến thức, môn, lớp; có thể tạo phiên bản mới từ bản đã xuất bản.
- Trao đổi học liệu React: xuất 1 bộ JSON, nhập tối đa 40 bộ/tệp, tối đa 1 MB, từ chối JSON sai schema, nội dung không hợp lệ và câu/cặp trùng, bỏ qua phiên bản đã lưu mà không ghi đè. Nhập mới được ghi vào IndexedDB trong một giao dịch.
- Bản HTML ngoại tuyến: có nút **📁 Nhập học liệu**, chọn bộ vừa nhập ở từng đảo; hỗ trợ chung định dạng JSON v1 xuất từ React, lưu độc lập với điểm. Góc phụ huynh có nút xuất **riêng** bộ học liệu và kết quả chơi. Không tự gộp dữ liệu giữa hai nhánh.
- Fix thao tác nhanh React: Math Quest khóa chuyển câu; Memory Match dùng refs cho chọn thẻ/đếm lượt để tránh lật nhanh gây trùng hoặc bỏ qua; Sentence Builder chỉ nhận dữ liệu kéo thả là chỉ số hợp lệ.
- An toàn DOM offline: nội dung học liệu do người dùng nhập được escape HTML khi hiển thị; thêm cảnh báo khi việc lưu kết quả bị chặn.
- Duy trì chế độ dựng WebGL và Canvas 3D dự phòng hiện hữu, độ phân giải Mượt/Sắc nét, giao diện trang chủ một khung hình.

## 2. Bằng chứng kiểm thử
| Hạng mục | Kết quả | Giới hạn |
|---|---|---|
| `npm run test:core` | 44/44 đạt | Kiểm tra lõi/nguồn, không thay React production E2E |
| `npm run test:content` | 4/4 đạt | Chuẩn JSON, không thay thử import thật qua IndexedDB |
| `npm run test:guide-animation` | 13/13 đạt | Kiểm tra parser/logic, không xác minh hoạt ảnh rig trên GPU |
| `npm run verify:offline` | Đạt | Kiểm tra TS core, engine, cú pháp TSX |
| `python tools/build_offline_release.py` | Đạt | Sinh 1 HTML ~397 KB |
| `python tools/browser_qa_v362.py` | Đạt bước chính | 1440×900, 390×844, 320×640; 0 pageerror, nút Bắt đầu trong viewport; test nhập JSON, chọn 3 game và tương tác; Canvas software, localStorage giả lập |
| `python tools/full_flow_qa_v36.py` | **Đạt ở lượt chạy trước khi bổ sung nút xuất học liệu** | Math 8/8, Memory 6/6, Sentence 5/5; 3 kết quả/19 sao; xuất kết quả JSON; lượt chạy lại sau thay đổi cuối bị timeout, chưa tính là test hồi quy cuối đạt |
| `npm run gate:premium-art` | **KHÔNG ĐẠT** | Thiếu 5 asset GLB premium, chưa đạt chuẩn concept |
| `npm run build` (React) | **CHƯA XÁC MINH** | Không cài được dependency vì npm registry không truy cập trong môi trường; `npm install --offline` ENOTCACHED |

Lưu ý kiểm thử trình duyệt dùng `set_content` trên tài liệu in-memory vì môi trường chặn navigation tới localhost/HTTPS thử nghiệm. Thử import qua bộ nhớ giả lập xác minh xử lý UI/JSON, **không** chứng minh tính bền vững sau refresh. Chưa có phép đo FPS WebGL, GPU hay độ trễ cảm ứng trên điện thoại thật.

## 3. Những phần chưa đạt cổng nghiệm thu cuối
1. Bộ asset GLB theo `src/world3d/assets/premium-manifest.json`: cáo có ít nhất 3 animation clip, 4 cảnh/đảo, texture/vật liệu và nguồn gốc/giấy phép hợp lệ. Hiện thiếu cả 5 đường dẫn bắt buộc.
2. Renderer PBR/texture/rig trên GPU cần hiện thực; low-poly shader hiện tại chưa tương đương concept mỹ thuật cao cấp.
3. Build production React & E2E trên HTTPS origin thật, load/sync/persist IndexedDB và localStorage giữa lần reload; test nhiều tab, nhập lại JSON, vượt quota.
4. FPS và tương tác trên máy thật desktop và ít nhất hai điện thoại, 320/390px; đánh giá nguồn nhiệt pin/cảm ứng. Không tuyên bố 60 FPS khi chưa đo.
5. Đồng nhất tiến trình nội dung giữa hai nhánh chỉ nên thực hiện sau khi có phương án migration an toàn; hiện **chỉ chia sẻ được gói câu hỏi JSON**, không chia sẻ điểm số.

## 4. Cách thử ngay, không dùng npm
- Mở `BAO_AN_LEARNING_V3_6_2_PLAYABLE.html` bằng Chrome/Edge.
- Chơi ba bộ có sẵn để kiểm tra màn hình và thao tác.
- Chọn **📁 Nhập học liệu**, tải `MAU_HOC_LIEU_3_GAME.json` hoặc JSON đúng schema có nội dung của giáo viên.
- Trên mỗi đảo, chọn một bộ mới trong danh sách thả xuống → **Bắt đầu**.
- Ở **Góc phụ huynh**, tải sao lưu kết quả và bộ học liệu vào hai tệp riêng.
- Lưu ý: localStorage có thể bị giới hạn ở chế độ riêng tư hoặc chính sách trình duyệt; thử đóng/mở trên thiết bị thật và sao lưu JSON thường xuyên.

## 5. Kế hoạch giai đoạn nội dung
1. Chốt lớp, môn, chủ đề/unit, chuẩn đầu ra và mức độ theo nội dung SGK/CTGDPT. Giữ tài liệu kiểm chứng đáp án độc lập với nội dung game.
2. Mỗi bộ 8–12 câu cho Math Quest; 6–10 cặp cho Memory Match; 5–8 câu cho Sentence Builder; số lượng trên là khuyến nghị xây dựng bài, không phải ràng buộc SDK.
3. Giáo viên duyệt ngôn ngữ, đáp án, lời giải, trùng lặp, mục tiêu học tập. Phát hành bản `id@version` bất biến; sửa bằng version+1.
4. Chạy từng bộ hoàn chỉnh trên desktop/mobile; rà tương tác và độ khó, mới nhân rộng nội dung.

**Quy tắc phát hành:** chưa sử dụng sản phẩm này làm hệ thống dữ liệu học sinh công khai, chưa coi là nền tảng premium final khi art gate và React production chưa đạt.
