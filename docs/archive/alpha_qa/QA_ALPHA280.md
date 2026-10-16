# Báo cáo Alpha 2.8 — Premium Game Experience

## Đã kiểm chứng

- Bộ test qua Node: **74/74** thành công (`npm run test:core`).
- Phân tích cú pháp mã TypeScript/TSX: thành công (`npm run test:syntax`).
- Kiểm tra kiểu dữ liệu phần core: thành công (`tsc --noEmit -p tsconfig.core.json`).
- CSS/browser preview (không phải runtime React) được kiểm tra với Chromium headless và dữ liệu minh họa cố định.

| Kích thước | Lưới đáp án trước/sau kết quả | Câu hỏi trước/sau kết quả | Tràn ngang | Nhân vật |
|---|---:|---:|---|---|
| 1440×900 | 0 px | 0 px | Không | Tải được |
| 390×844 | 0 px | 0 px | Không | Tải được |
| 320×700 | 0 px | 0 px | Không | Tải được |

Đường dẫn ảnh: `docs/visual280/math-waiting-*.png`, `math-feedback-*.png` và `math-reward-*.png`. Số liệu chính xác: `docs/visual280/layout-results.json`.

- Giảm chuyển động theo hệ điều hành và theo nút ứng dụng: phản ứng đồ họa ẩn như dự kiến trong Chromium preview.
- Hiệu ứng dùng opacity/transform trên phần tử overlay; không tạo thêm chiều cao/kích thước trong khung phản hồi cố định.
- Kiểm tra mã xác nhận cả Math, Memory, Sentence chỉ phát âm thanh sau `onAttempt` thành công.

## Chưa kiểm chứng

- **Chưa thực hiện được `npm install`, `npm run build` hoặc bài test React end-to-end** trong môi trường này vì npm cache không chứa toàn bộ thư viện cần thiết. `npm install --offline` trả về `ENOTCACHED`.
- Ảnh preview chỉ là HTML/CSS giả lập các trạng thái bằng script, **không phải bằng chứng** về tốc độ FPS, tính ổn định thao tác/touch và lưu IndexedDB trong ứng dụng React thật.
- Chưa có kiểm thử đủ các thiết bị Android/iOS thực tế, chưa đo tốc độ tải chậm hoặc thời lượng pin.
- Phần phong cảnh vẫn chưa hoàn toàn đạt concept game 2.5D cao cấp đã chốt; bản 2.8 tập trung vào chuyển động/feedback, không thay thế toàn bộ asset.

## Checklist bắt buộc trên máy Windows

1. Chạy `npm install && npm run build` thành công.
2. Chạy `npm run dev`, kiểm tra từng game: đúng/sai và khi lưu thất bại không phát âm thanh thắng.
3. Chạy `npx playwright install chromium && npx playwright test tests/visual/premium280.spec.ts`.
4. Test ở 1440px và 390px, trước/sau phản hồi; không mất vị trí câu hỏi.
5. Test tắt/bật âm thanh, tắt hiệu ứng, dùng thiết lập reduced-motion.
6. Hoàn thành cả ba game: bảng nhận thưởng phủ nổi lên scene, nút quay về hoạt động, kết quả góc phụ huynh vẫn đúng.
7. Sao lưu học liệu/bản ghi trước khi chuyển origin/port/thiết bị; chưa có cloud sync.
