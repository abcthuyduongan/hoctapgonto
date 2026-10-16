# BẢO AN LEARNING V3.0 — TIÊU CHUẨN CHỐNG GIẬT MÀN HÌNH (ALPHA 2.7)

## Nguyên nhân ở Alpha 2.6

1. Math Quest thay hoàn toàn khối gợi ý bằng khối kết quả, chiều cao nội dung thay đổi và gây reflow trong khung đối thoại đang cuộn.
2. Sentence Builder thêm/xóa các khối thông báo, nút thử lại và nút chuyển câu không có vùng chiều cao dự phòng.
3. Kết thúc game thay toàn bộ cảnh chơi bằng một card phần thưởng, tạo cảm giác chuyển màn đột ngột.
4. Trình duyệt cho phép cuộn nền phía sau dialog; khi chiều cao game biến đổi, vị trí thị giác dễ mất ổn định.
5. Mỗi lần bấm kết quả App lại đọc cả học liệu, sessions và events từ IndexedDB, không cần thiết cho một sự kiện đơn lẻ.

## Sửa chữa

- `MathQuest`: vùng `.stable-response-zone` tồn tại xuyên suốt, chiều cao cố định theo breakpoint; chỉ nội dung bên trong đổi; lời giải dài cuộn bên trong vùng.
- `SentenceBuilder`: `.sentence-result-reserve` luôn chiếm chỗ, `.stable-sentence-actions` có chiều cao ổn định; trên điện thoại có cơ chế sticky cho nhóm nút.
- `MemoryMatch`: `.memory-feedback-slot` luôn chiếm chỗ; xử lý lỗi ghi lượt chơi không giữ bảng thẻ ở trạng thái locked; hỗ trợ thử ghi hoàn thành lại.
- Cả 3 game: bảng thưởng `GameCompletion` phủ nổi phía trên cảnh chơi nguyên trạng, không tháo cây DOM game cũ.
- `App`: khóa cuộn nền theo vòng đời game dialog, sử dụng `scrollbar-gutter: stable`, focus `preventScroll`, trả focus về nút mở game khi thoát.
- `App`: `recordAttempt` chỉ ghi một sự kiện và cập nhật danh sách trong React; không `refresh()` toàn bộ ba kho dữ liệu sau mỗi câu.
- `Game SDK` giữ nguyên hợp đồng V1; chỉ cập nhật module version thành `0.2.7`. Không thay schema DB IndexedDB.

## Tiêu chí nghiệm thu trước khi tuyên bố hết lỗi

1. Trước/sau khi kết quả xuất hiện, vị trí vùng câu hỏi và khối đáp án không dịch quá 2 px trên desktop và mobile (bỏ qua chuyển câu do nội dung khác nhau).
2. Chiều cao khu kết quả không đổi khi chuyển từ chờ đáp án sang đúng/sai; lời giải dài có vùng cuộn riêng, không gây kéo giãn đột ngột cả dialog.
3. Thanh cuộn trang phía sau dialog không hoạt động; đóng game quay về gần đúng vị trí đang xem ở Game Center.
4. Khi nhận thưởng, cảnh game vẫn giữ nguyên phía sau màn thưởng, không giật về đầu/cuối trang.
5. Memory Match không bị kẹt vĩnh viễn nếu giao dịch IndexedDB thất bại khi lưu lượt hoặc hoàn tất.
6. Khi mở trên 320/390/1440 px không tràn ngang; thao tác chạm vẫn thuận tiện.
7. Không mất sự kiện, không ghi hai lần do thao tác quá nhanh; Parent Dashboard vẫn phản ánh đúng số liệu.
8. Tắt chuyển động (Motion Off) phải giảm các animation không cần thiết.

## Bằng chứng hiện có

- `node --experimental-strip-types --test tests/*.test.mjs`: **36/36 đạt**.
- `node tests/check-tsx.mjs`: parse toàn bộ TS/TSX đạt.
- `tsc --noEmit -p tsconfig.core.json`: phần lõi TypeScript đạt.
- `tools/check_stability27.py` cùng `preview/qa/stability27.html`: kiểm tra giao diện HTML/CSS theo cùng lớp style production bằng Chromium, kích thước **1440, 390, 320 px**.
- Báo cáo `docs/ux27/browser-layout-results.json`: khu trả lời Math, vùng kết quả Sentence và nhóm hành động đều dịch **0 px** trong phép thử thay đổi kết quả; không có overflow ngang.

**Ranh giới kết quả:** bài kiểm thử giao diện trên là fixture HTML/CSS, không phải ứng dụng React thực tế. npm không truy cập được registry trong môi trường thực hiện tại đây nên chưa chạy `npm run build` và Playwright E2E cho app Vite. Những kiểm thử này vẫn là điều kiện nghiệm thu Alpha 2.7 trên máy của người dùng.

## Cách nghiệm thu trên Windows

```bash
npm install
npm run build
npm run test:core
npx playwright install chromium
npm run test:stability
npm run test:visual
npm run dev
```

Kiểm tra thủ công theo trình tự: vào Math Quest → chọn đáp án → theo dõi vị trí câu hỏi/đáp án → bấm câu sau → hoàn tất 8 câu → xem bảng thưởng; lặp lại với Memory Match/Sentence Builder, nhất là điện thoại.

Không xóa dữ liệu website khi nâng từ Alpha 2.6; cấu trúc IndexedDB được giữ lại. Vẫn không nên dùng dữ liệu học sinh thật khi chưa có đăng nhập và phân quyền.
