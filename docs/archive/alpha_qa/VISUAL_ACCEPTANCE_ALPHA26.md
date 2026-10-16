# BẢO AN LEARNING V3 — ALPHA 2.6: VISUAL ACCEPTANCE

## Nguyên tắc thiết kế không thương lượng

- **Không ảnh chụp giao diện làm nền gameplay**: phông cảnh SVG/WebP mới chỉ chứa minh họa, không có chữ, điểm số hoặc nút tĩnh. Cảnh bìa là tranh cắt riêng, không có nút chơi.
- **Một hệ thống UI thống nhất**: `src/styles/game-world.css` chứa phần cấu trúc; `src/styles/polish26.css` chứa lớp mỹ thuật Alpha 2.6. Các nút, khung câu hỏi, trạng thái đúng/sai đều là DOM từ React.
- **Nhiệm vụ hiện trước hiệu ứng**: câu hỏi không bị phong cảnh che, font chữ đọc được, có hướng dẫn và phản hồi sau trả lời.
- **Không loại bỏ khả năng sử dụng**: điều khiển chạm và bàn phím, mục tiêu chạm tối thiểu 44px khi nghiệm thu thực; hỗ trợ thiết lập chuyển động và âm thanh.
- **Không khẳng định “đẹp như concept” khi chưa kiểm chứng**: đánh giá cuối cùng bằng screenshot **app React chạy thật**, không bằng ảnh concept hoặc snapshot preview HTML độc lập.

## Trạng thái những gì đã kiểm chứng

| Hạng mục | Trạng thái |
|---|---|
| 31 ca kiểm thử lõi + tài nguyên | ĐẠT (node --test, môi trường phát triển) |
| Kiểm tra TS/TSX cú pháp | ĐẠT |
| Kiểm tra type phần lõi | ĐẠT |
| 18 ảnh preview HTML trong Chromium với CSS thực, 1440px / 390px / 320px | ĐẠT **bố cục tham khảo**, không ghi nhận tràn ngang |
| Vite production build ứng dụng React V3 Alpha 2.6 | **CHƯA XÁC MINH** (môi trường không tải npm) |
| Playwright chạy trên React thật, 1440/390/320 | **CHƯA XÁC MINH**, script đã có |
| Đánh giá mỹ thuật ≥ concept AI | **CHƯA ĐẠT CHUẨN CÔNG NHẬN**, chờ đánh giá ảnh chụp app và bộ họa tiết minh họa chuyên nghiệp hơn |

## Điểm cần tiếp tục cải thiện có chủ đích

1. Tranh nền SVG mới **sạch và cực nhẹ**, nhưng phong cách minh họa hiện vẫn đơn giản hơn concept AI 2.5D nhiều chi tiết. Không nên tự đánh giá đã đạt mức thương mại cao chỉ vì CSS và UI đã mượt.
2. Bộ mascot hiện là hình cắt từ nguồn concept và chưa có animation riêng (idle, cheer, think, try-again).
3. Gameplay Math Quest vẫn là thử thách đáp án theo từng câu, **chưa có điều khiển phiêu lưu theo bản đồ**; đây là công việc riêng của giai đoạn làm sâu gameplay.
4. Chưa chụp thực tế app React ở các trạng thái đúng, sai, gợi ý, hoàn thành và lỗi lưu trữ trên nhiều thiết bị.
5. Chưa có tài liệu thiết kế Figma hoặc file sprite atlas tinh chỉnh bởi họa sĩ 2.5D.

## Các bước nghiệm thu bắt buộc trên máy người dùng

Chạy trong thư mục dự án sau khi giải nén:

```bash
npm install
npm run build
npx playwright install chromium
npm run test:visual
```

Kiểm tra các PNG ở `visual-output/`; đặc biệt xem UI thật ở 390px/320px và không tràn ngang. Trên Chrome/Edge, thử thao tác nhanh hai lần ở Math Quest, ghép thẻ ở Memory Match, chạm từ và kéo thả ở Sentence Builder; xác nhận không ghi điểm trùng và kết quả vẫn chính xác sau F5.

### Thang duyệt (mỗi tiêu chí 0–5, phải ≥4 điểm, có ảnh minh chứng)

1. Độ hấp dẫn và chiều sâu hình minh họa
2. Tính thống nhất font, màu, nút, khung và mascot
3. Tính dễ đọc của câu hỏi và phản hồi
4. Cảm giác chuyển động, âm thanh và phần thưởng (không gây xao nhãng)
5. Responsive, vùng chạm và dùng bàn phím
6. Đúng chức năng và dữ liệu sau thao tác

**Chốt Alpha 2.6 kỹ thuật ≠ chốt mỹ thuật cuối cùng**. Không triển khai công khai cho học sinh thật trước khi xử lý bảo vệ hồ sơ và quyền truy cập phụ huynh.
