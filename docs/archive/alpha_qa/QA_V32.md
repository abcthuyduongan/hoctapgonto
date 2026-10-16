# Bảo An Learning V3.2 — kiểm tra 3D và hiệu năng

## Phạm vi đã thực hiện
- Giữ nguyên 3 trò chơi và cơ chế lưu kết quả của V3.1.
- Mở rộng hình học 3D WebGL: cầu gỗ, thác nước, cờ, đèn, hoa, tinh thể, chi tiết mái nhà, nhân vật cáo phóng lớn.
- Có lớp phong cảnh xa dạng tranh nền 2D (matte painting), **không được coi là mô hình 3D**; ba đảo chính và vật phẩm ở phía trước là hình học 3D thực.
- Tách chất lượng WebGL đầy đủ và Canvas dự phòng để không dùng 34.629 tam giác trên Canvas: giảm xuống 12.453 tam giác, vẽ tối đa xấp xỉ 8 lần/giây.
- Tệp HTML ngoại tuyến chứa mã cảnh và hình nền tự đóng gói, không yêu cầu npm.

## Các kiểm tra đã có bằng chứng
- 44/44 bài kiểm thử V3.1 đạt trong bộ kiểm thử vẫn còn tương thích.
- 3/3 bài kiểm tra tài nguyên 3D mới đạt.
- TypeScript strict (`engine.ts`) đạt; toàn bộ mã TS/TSX vượt kiểm tra cú pháp.
- Chromium Canvas fallback: 1440×900, 390×844, 320×700 hiển thị thành công, không tràn trang và không có lỗi JavaScript.
- Bản ngoại tuyến: hoàn thành 6 cặp Memory Match (có thử sai 2 thẻ), 8 câu Math Quest, 5 câu Sentence Builder, kết quả xuất hiện tại Góc phụ huynh.

## Chưa được kiểm chứng / chưa đạt
- Chưa chạy được build production React/Vite do môi trường thiếu npm dependencies.
- Chưa nghiệm thu GPU WebGL2 thực trên thiết bị của người sử dụng; môi trường chụp ảnh đang dùng Canvas renderer dự phòng.
- Mỹ thuật **chưa bằng hình tham chiếu 3D cao cấp**: mô hình vẫn thiên về stylized low-poly; nhân vật chưa có skeleton và hoạt ảnh rigging; vật liệu chưa đạt chuẩn PBR; hình vẽ xa chỉ là matte painting.
- Chưa đo FPS và bộ nhớ trên thiết bị thực; không tự tuyên bố đạt 60 FPS.

## Tiêu chuẩn cho bước nâng cấp tiếp theo
1. Sử dụng mô hình GLB/glTF hoàn chỉnh cho mascot, ba hòn đảo và công trình, cùng một style sheet chất liệu và ánh sáng.
2. Camera chuyển cảnh có kiểm soát; game loading/lazy loading, điều chỉnh LOD theo thiết bị.
3. Chụp ảnh sản phẩm React build thật ở 1440 và 390px, so sánh trực tiếp với mẫu, không nghiệm thu trên ảnh concept.
4. Kiểm tra tốc độ tải, giật hình, dừng/chơi tiếp, lỗi ngữ cảnh WebGL và lưu/khôi phục kết quả.
