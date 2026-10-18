# Rà soát trải nghiệm Bảo An Learning — 18/10/2026

Phạm vi: kiểm tra ứng dụng hiện hành, ưu tiên học sinh và chơi bài theo phản hồi của chủ dự án. Các lượt kiểm thử dùng tài khoản và cơ sở dữ liệu tách biệt trong `test-results/`, gồm máy chủ SQLite và bộ kiểm thử cloud PostgreSQL cục bộ.

## Những vấn đề đã sửa

| Vấn đề | Cách tái hiện và ảnh hưởng | Bản sửa |
| --- | --- | --- |
| Trang hành trình không cuộn | Lăn chuột nhưng `window.scrollY` giữ nguyên 0, học liệu phía dưới không tới được. | Giới hạn CSS khóa cuộn cho khung game độc lập. Trang học sinh cuộn bình thường; khi chơi vẫn khóa nền và mở lại sau khi thoát. |
| Phản hồi cũ ghi đè sao mới | Giữ phản hồi làm mới ở thời điểm 0 sao, vào bài và trả lời đúng để nhận 3 sao, rồi cho phản hồi cũ về. Ví trên giao diện trở lại 0 sao dù máy chủ đã lưu 3 sao. | Hủy và vô hiệu hóa các lượt đọc hành trình cũ khi bắt đầu chơi, chọn trò ôn hoặc chuyển trang. Phản hồi cũ không được thay thế tiến độ mới. |
| Thiếu phản hồi khi chờ máy chủ | Trên điện thoại, thông báo mở trò nằm dưới màn hình. Khi lưu hoặc thoát, nút chưa thể hiện rõ trạng thái đang xử lý. | Hiện thông báo trong vùng nhìn thấy khi mở trò, tải trò phù hợp, lưu câu trả lời, lưu hoàn thành và trở về hành trình. Nút làm mới có trạng thái đang làm mới. |
| Có thể bấm thoát lúc đang lưu | Giữ phản hồi chấm đáp án/hoàn thành; nút thoát vẫn bật. Thao tác thoát có thể tranh chấp với yêu cầu lưu hoặc bị bỏ qua mà không giải thích. | Vô hiệu hóa nút thoát trong khi lưu; khi đang thoát có lớp chờ chặn thao tác vào trò. Nếu yêu cầu lỗi, trạng thái chờ được giải phóng để thử lại. |
| Mất vị trí điều khiển bằng bàn phím | Việc ghi nhớ nút mở bài diễn ra sau khi nút đã bị vô hiệu hóa và máy chủ đã trả lời. | Ghi nhớ nút trước lúc gửi yêu cầu. Khi thoát, trả tiêu điểm về nút đó; nếu bài đã hoàn thành và nút biến mất, chuyển về vùng hành trình. |
| Tiêu đề bị bó hẹp trên điện thoại | Nút ví chiếm cùng hàng với phần tiêu đề ở chiều rộng nhỏ, làm thông tin bài xuống nhiều dòng ngắn. | Cho phần tiêu đề dùng toàn bộ chiều rộng và đặt ví ở hàng dưới tại chiều rộng từ 620 px trở xuống. |
| Đọc lại tiến độ không cần thiết sau hoàn thành | Máy chủ đã trả tiến độ mới trong phản hồi hoàn thành nhưng thao tác trở về vẫn gửi thêm yêu cầu đọc. | Dùng ngay tiến độ đã được xác nhận; lượt thoát bài đang dở vẫn làm mới tiến độ. |

Các thay đổi nằm ở `src/screens/OnlineStudentWorld.tsx`, `src/screens/StudentScreen.tsx` và các tệp CSS liên quan. Luật chấm sao và dữ liệu câu hỏi giữ theo hợp đồng hiện hành.

## Kiểm tra đã thực hiện

- `npm test`: 335 kiểm tra đạt, gồm renderer/tài nguyên, đóng gói, API/học liệu/khôi phục và cloud cục bộ.
- `npm run build`: thành công, gồm kiểm tra TypeScript và tạo bản `dist/`.
- Kiểm tra trình duyệt bao phủ đăng nhập, tài khoản, nhập học liệu, tám dạng câu hỏi, năm trò chơi, gợi ý, đồng hồ, hình/âm thanh, sao từng câu, chuyển tuần, đổi thưởng, khôi phục, 3D tùy chọn và 30 lượt chơi liên tiếp.
- Bổ sung `tests/visual/online-studentflow.spec.ts`: bố cục 320/390/620 px, phản hồi khi mạng chậm, trả tiêu điểm, chặn thoát khi đang lưu, phản hồi cũ và thử lại sau lỗi.
- Bổ sung `tests/visual/online-scrolling.spec.ts`: cuộn chuột và vuốt cảm ứng thật trong trình duyệt, khóa nền khi chơi, khôi phục cuộn sau thoát.
- Sửa cấu hình dựng hai bộ kiểm thử đồng hồ: URL ảnh `/art/*` được giữ là tài nguyên web. Trước đó, lỗi dựng bộ kiểm thử khiến các ca đồng hồ không chạy; đây là lỗi của cấu hình kiểm thử.

Kết quả của Chrome và Edge được ghi trong `test-results/site-audit-browser-final.log` và `test-results/site-audit-final-report.json`. Ảnh chụp và bằng chứng nằm trong `test-results/site-audit-final/`.

### Kết quả cuối

| Nhóm | Đạt | Bỏ qua | Lỗi còn lại |
| --- | ---: | ---: | ---: |
| Logic, tài nguyên, đóng gói và API | 335 | 0 | 0 |
| Chrome | 71 | 1 | 0 |
| Edge | 71 | 1 | 0 |

Tổng cộng 142 ca giao diện đạt sau khi chạy lại một ca Chrome. Ca đó ban đầu kỳ vọng tiêu điểm về vùng `main`, trong khi nút mở bài vẫn còn để học sinh ôn tập; kỳ vọng đúng là trả về nút mở bài. Đã sửa kỳ vọng và chạy lại thành công, không thay đổi mã ứng dụng sau bản build được kiểm tra. Bằng chứng chạy lại ở `test-results/student-completion-focus.log` và `test-results/student-completion-focus-report.json`. Hai lượt bỏ qua là cùng ca nhập Excel/WAV riêng của tác giả trên hai trình duyệt.

Số liệu tổng hợp, gồm kết quả từng lượt chạy và ca kiểm tra lại: [QA_TRAI_NGHIEM_2026-10-18.json](QA_TRAI_NGHIEM_2026-10-18.json).

Trong phép đo 30 lượt chơi liên tiếp ở mỗi trình duyệt, cả năm trò có phân vị 95 thời gian khung hình khoảng 17–17,2 ms, không có tác vụ dài trong các cửa sổ đo. Heap cuối so với mốc sau khởi động tăng khoảng 0,54 MiB trên Chrome và 0,50 MiB trên Edge; sau lượt chơi không còn audio hoặc canvas trong DOM. Đây là số đo trình duyệt tự động cục bộ, chưa phải chứng nhận hiệu năng trên thiết bị thật.

## Giới hạn nghiệm thu

Đây là kiểm tra trên bản dựng cục bộ và trình duyệt tự động. Độ trễ website đã triển khai, giọng đọc và thao tác trên điện thoại vật lý cần đối chiếu trên môi trường đó. Ca nhập bộ Excel/WAV riêng của tác giả chỉ chạy khi có `BAO_AN_REAL_IMPORT_DIR`; các ca nhập tệp mẫu và kiểm tra tám dạng câu vẫn chạy bình thường.

Bản sửa đã được dựng ở `dist/`. Việc triển khai website đang phục vụ người dùng thuộc bước riêng.
