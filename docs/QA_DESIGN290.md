# Báo cáo kỹ thuật — Bảo An Learning Alpha 2.9.0 Design Match

## Phạm vi
Nâng cấp giao diện thực thi trên nền Alpha 2.8.1; không thay đổi schema IndexedDB hay Game SDK.

## Hạng mục đã sửa
1. Trang chủ — bố cục ngang ba đảo, giảm cảm giác website thẻ nội dung; cảnh, nhân vật, nhãn và nút ở các lớp riêng.
2. Math Quest — bề mặt câu hỏi/đáp án đồng nhất với theme phiêu lưu, vẫn cố định kích thước vùng phản hồi.
3. Memory Match — bảng gỗ viền vàng, 12 thẻ có họa tiết lá xanh, mặt trước nền giấy, nhãn và kết quả rõ ràng. Bản sửa lỗi React.StrictMode Alpha 2.8.1 được giữ nguyên.
4. Sentence Builder — bảng parchment, thẻ từ nổi, màu đồng bộ.
5. Parent/Creator — phong cách dashboard riêng, tránh quá nhiều vật liệu game trong biểu mẫu.
6. Điều khiển bàn phím, nút trên điện thoại và reduced motion.

## Các phép thử đã thực hiện trong môi trường
- `npm run verify:offline`: 76/76 kiểm thử Node đạt; TS/TSX syntax và TS core đạt.
- Chromium nội bộ dựng từ **HTML/CSS + ảnh thực** có cùng CSS với ứng dụng React: 11 trường hợp màn hình ở 1440×900, 1920×1080, 768×1024, 390×844, 320×700 và ba màn chơi trên desktop/điện thoại; 11/11 không tràn ngang, ảnh được tải thành công.
- Ảnh tại `docs/design290/*.png`; kết quả máy trong `docs/design290/browser-results.json`.

## Còn phải nghiệm thu trên máy người dùng
- `npm run build` bằng Vite/React thật: chưa chạy được ở môi trường tạo mã (npm registry không truy cập được).
- `npx playwright test tests/visual/design-match290.spec.ts`: đã viết, chưa thực thi được vì không có phụ thuộc dự án.
- Đối chiếu hình thực tế với concept 2.5D tham chiếu: **chưa chứng nhận đạt tuyệt đối**; asset scenery hiện vẫn mềm hơn hình concept AI.
- Đồng bộ đa thiết bị và phân quyền phụ huynh: chưa nằm trong phiên bản Alpha này.

## Quy tắc nghiệm thu
Không lấy ảnh concept được tạo bằng AI làm bằng chứng tính năng đã hoạt động. Chỉ công nhận khi đã build ứng dụng React và kiểm tra các điều khiển có dữ liệu thật, không giật màn hình và không khóa thao tác.
