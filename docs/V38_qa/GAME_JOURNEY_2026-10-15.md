# Lộ trình ôn qua game — 15/10/2026

Tiếp tục yêu cầu cuối của chat “Đánh giá chuyên sâu dự án”: một bộ ôn có nhiều cách chơi; Tuần 1 → Tuần 2 → nâng cao; ưu tiên thế giới điều khiển bằng Cáo, nhập câu hỏi, phụ huynh và đổi sao.

## Cách dùng

- Vào **Góc phụ huynh → Từng tuần vững hơn → Áp dụng lộ trình** cho hồ sơ muốn dùng. Không tự thay cấu hình của hồ sơ gia đình khi cập nhật.
- Mẫu lớp 3 gồm hai tuần cơ bản và một chặng nâng cao, đủ Toán, Tiếng Việt và Tiếng Anh. Phụ huynh thay từng bộ bằng đúng phiên bản đã nhập, thêm tuần cơ bản hoặc nâng cao rồi lưu. Đây là nội dung ôn mẫu tự biên soạn, chưa phải toàn bộ chương trình năm học.
- Đạt ít nhất 2 sao cho cả ba bộ ở chặng trước mới mở chặng kế. Đạt tất cả tuần cơ bản mới mở nâng cao. “Tuần” chỉ thứ tự chặng, không phải lịch tự động. Số sao thành tích được dùng mở khóa, không phụ thuộc số dư sau đổi thưởng.
- Bé tự chuyển sang bộ chưa đạt tiếp theo; các đảo dùng chung bộ đó khi có cách chơi phù hợp. Phụ huynh chọn “Cho con ôn bộ này” để ôn lại chặng đã mở, hoặc “Tự chuyển bộ theo tiến độ” để tiếp tục tự động.
- Tạm dừng lộ trình vẫn giữ lịch sử/sao và cho dùng lại cấu hình bộ riêng từng đảo.

## Thực hiện

- `game-presentation.ts` tạo view quyết định từ nguồn gốc: cặp → trắc nghiệm khi đủ bốn lựa chọn; trắc nghiệm → cặp khi không trùng đáp án/mặt thẻ và vừa thẻ. Câu sắp xếp dùng hai game thứ tự đang có. Không suy đoán câu từ dạng nghe, đoạn đọc hoặc câu trả lời thiếu ngữ cảnh.
- Session giữ `packId`, phiên bản và ID/mục tiêu từng câu gốc; `presentationVersion:1` ghim đúng quy tắc view. Chấm câu trả lời thật ở host/storage và kiểm lại khi khôi phục. Không lưu bản phái sinh thành bộ mới.
- Sao dùng mức cao nhất của cùng mã bộ ở mọi đảo/phiên bản, tối đa 3 sao. Chỉ có hoàn thành kèm đủ evidence được cấp sao. Không tính lại phiên cũ thiếu đáp án gốc.
- `gameJourney` là cấu hình tùy chọn của hồ sơ; không tăng phiên bản IndexedDB, không xóa/chuyển store. Giao dịch đọc lại hồ sơ/tiến độ khi bắt đầu; tab cũ không mở được bộ của tuần chưa tới. Cấu hình không nhận bộ kiểm tra độc lập, sai lớp/môn hoặc không có trên máy. Form hồ sơ cũ không ghi đè lộ trình/ví mới.
- Màn hình bé giữ cảnh/Cáo, thêm nhãn chặng nhỏ và giới thiệu đảo khi chọn; cách vào bằng chuột/bàn phím và điều khiển DOM dự phòng được giữ. Đã sửa nút Tổng quan chồng nhãn tuần và khoảng sương cố định làm mờ cảnh khi camera lùi trên màn hình dọc.

## Kiểm tra

- Build production đạt, 149 module. `npm test`: 306/306 đạt (44 core, 37 features, 29 content, 70 learning, 33 backup, 85 renderer, 8 release), cùng kiểm tra cú pháp. Bảy ca HTTP cần quyền mở cổng cục bộ và đã chạy lại toàn bộ thành công ngoài sandbox mạng.
- Lượt Edge đầu: 19/22 đạt; ba ca phát hiện nút Tổng quan chồng nhãn tuần đã được sửa bằng selector đủ ưu tiên, giữ assertion về hình học.
- Lượt Edge sau sửa: **53/53 đạt**, gồm nhập 15, backup 17, nhân vật 4, lộ trình 5, mobile/keyboard/reduced motion 12. Ảnh được xem trực tiếp ở 1440×900 và 390×844, có thêm kiểm tra 320×640.
- Trên build đóng gói cuối, **18/18 Edge đạt**: storage 7, lộ trình 5, game/sao/đổi thưởng 6. Bảy unit riêng của lộ trình được chạy lại sau khi siết kiểu level, đều đạt. Đây là lượt targeted cuối, không trình bày thành một lượt chạy toàn bộ browser suite.
- Hai fixture import/backup cũ lấy bộ câu theo vị trí cuối danh sách được sửa để dùng mã `english3-sentences`, giữ nguyên assertion nội dung và số câu khi danh mục có thêm bộ.
- Có kiểm tra giao dịch lộ trình bị quota/rollback, hai tab, form hồ sơ cũ, bộ độc lập bị chặn, bộ chưa mở bị chặn, ghim nguồn và giữ trần sao qua đổi đảo. Luồng UI thật làm đủ sáu bộ cơ bản rồi mở nâng cao; đạt 2 sao cũng đủ chuyển tuần.

## Gói dùng thử

- `releases/bao-an-learning-3.8.0-pilot.2.zip`, build ID `7053ec2d255e908a`, 136 tài nguyên; giữ gói pilot.1 nguyên vẹn.
- ZIP 10.748.231 byte; chạy packager lần hai kiểm lại manifest/hash và entry ZIP, trả `reused:true`. Máy chủ đang có tại cổng 4173 phục vụ đúng script của build cuối (`index-D2pIQpid.js`), không đổi origin hồ sơ.
- Giải nén và chạy `MO_BAO_AN.cmd`; cần Node.js 22 trở lên. Dùng cùng `http://127.0.0.1:4173/` và trình duyệt đã có hồ sơ. Hướng dẫn kèm ZIP đã bổ sung cách cấu hình tuần/nâng cao.
- Vẫn là pilot. Gia đình chưa xác nhận Bảo An dùng thật và đối chiếu bộ sách; không ghi FINAL hoặc coi thử trình duyệt trên Windows là nghiệm thu điện thoại thật.

Ảnh đã xem: [Thế giới trên máy tính](journey-1440.png), [390 px](journey-390.png), [320 px](journey-320.png), [Thiết lập tuần ở phụ huynh](journey-parent-1440.png). Log cuối nằm cùng thư mục: `journey-unit-full.log`, `journey-edge-final.log`, `journey-build-final.log`.
