# Kiểm tra giao diện game 3D dùng chung

Bản đối chiếu trước nâng cấp nằm trong `baseline/`: 36 ảnh của Toán, Trí nhớ và Ngôn từ ở trạng thái chờ, thử lại, đúng và hoàn thành; viewport 1440×900, 390×844, 320×640. Bản cũ có lỗi tại Ngôn từ chờ ở 320 px: từ thứ tư xuống hàng và bị bảng hành động che.

Đã capture và xem trực tiếp đủ 36 ảnh của build cuối `index-CWcVMOt_.js` / `PremiumWorldRenderer-DmB5MhIG.js`, bắt đầu lúc 11:43 ngày 14/10/2026 (Asia/Saigon), Edge 155. Cả ba game dùng cùng hình cáo có rig như trang chọn đảo, màu kem và bảng chữ/nút rõ hơn. Desktop chia nhân vật và bảng trò chơi thành hai vùng; mobile đưa nhân vật nhỏ và lời hướng dẫn lên đầu. Lâu đài, rừng và nhà của từng đảo được dùng làm cảnh nền.

- Toán: các lựa chọn, lời giải và nút tiếp theo hiện rõ trong cả ba viewport. Bản đầu có nút tiếp theo vượt 640 px; bản ứng viên đã thu gọn khối phản hồi, ảnh chờ/thử lại/đúng đều vừa màn hình.
- Trí nhớ: đủ 12 thẻ và các nhãn đã lật đọc được. Tại 320 px, hàng cuối sát mép dưới nhưng các tâm nút còn nằm trong màn hình và nhận được thao tác.
- Ngôn từ: từ nằm cùng hàng, không bị nút hành động che. Bản cuối đã đưa nút “Kiểm tra câu” vào đủ màn hình 320 px. Hai nút phụ “Gợi ý” và “Xếp lại” ở hàng trên rộng bằng nhau, chữ không còn xuống nhiều hàng trên 390 px.
- Phần thưởng: cùng kiểu bảng kem, dấu sao, màu theo game và một nút trở về rõ ràng. Toàn bộ tiêu đề và nút nằm trong màn hình ở cả ba kích thước.
- Số liệu bản cuối: 36/36 trạng thái không có lỗi trang/tài nguyên, tràn ngang, điều khiển ngoài viewport hoặc bị che. Các nút chạm chính trên hai viewport nhỏ đều cao ít nhất 44 px. Tất cả trạng thái có đúng một canvas nằm trong game-slot, đúng gameWorld và guideMood chờ/thử lại/đúng/hoàn thành. FPS median khoảng 59.9 trên GPU desktop Windows; đây là mô phỏng mobile, chưa đo điện thoại thật.
- Draw call desktop Toán/Trí nhớ/Ngôn từ lần lượt 49/32/39; hai viewport nhỏ lần lượt 17/16/17. Mỗi hồ sơ viewport tải hai GLB và một ảnh cáo dự phòng, không tải thêm GLB khi chuyển game hoặc trả lời.

Video cuối `shared-games-demo.webm` đã ghi cùng canvas qua trang đảo, ba game và quay lại trang đảo; 3,768,578 byte, WebM VP9. Video chỉ chứa môi trường/nhân vật 3D, các bảng thao tác và phần thưởng HTML được thể hiện trong 36 ảnh. `game-browser-evidence.json` ghi các JS bundle thực tế được tải, phản ứng cáo, khung guide, tài nguyên và bounds nút; `capture-summary.md` tổng hợp từng trạng thái. Công cụ capture kết thúc với mã 0.

Ảnh cáo dự phòng `public/art/fox-guide-common.webp` được render trực tiếp từ `public/models/fox-guide.glb`, không dùng ảnh nhân vật khác. Ảnh 640×768, nền trong suốt, 29,358 byte; SHA256 model gốc và ảnh, bounding box alpha, clip Idle và chunk renderer được lưu trong `fox-portrait-provenance.json`.

Kiểm thử `game-scene.spec.ts` có 9 trường hợp cho dùng lại canvas/context/GLB qua ba game, phản ứng chờ-thử lại-đúng-hoàn thành, cue lặp, guide viewport, pause khi tài liệu ẩn, giảm chuyển động và cáo dự phòng. Trường hợp đầu thêm 20 lượt mở/thoát luân phiên ba game, kiểm tra canvas/context giữ nguyên, không tải lại GLB, RAF và listener không tăng, game mới bắt đầu với cáo ở trạng thái chờ. Test tải model chậm trong `premium-world.spec.ts` cũng chuyển sang xác minh cùng canvas bắt đầu vẽ cảnh game sau khi tải xong.

Lượt toàn bộ Edge gần cuối đạt 47/48; một kiểm thử chẩn đoán ở chế độ giảm chuyển động còn đọc drawCalls cũ. Sau khi sửa publish diagnostics khi vẽ tĩnh, lượt tập trung cuối đạt 11/11 (9 game-scene và 2 giảm chuyển động), Chrome đạt 4/4. Log tương ứng: `browser-tests-before-static-diagnostics.txt`, `browser-tests-final-targeted.txt`, `chrome-tests.txt`. Không ghi nhận lại toàn bộ 48 test trên build cuối vì thay đổi cuối chỉ cập nhật metadata khi RAF không chạy.

Chưa nghiệm thu asset premium cuối: Toán và cáo là GLB có texture/rig; Trí nhớ, Ngôn từ và đồ trang trí game vẫn có phần hình học tạm. QA này xác nhận bố cục, tương tác và dùng chung renderer trong phạm vi trên.
