# KIỂM THỬ ALPHA 2 — 12/10/2026

## Phạm vi đã xác minh trong môi trường tạo mã

| Kiểm tra | Kết quả | Diễn giải |
|---|---|---|
| 21 ca unit core/SDK/học liệu | ĐẠT | Node 22, kiểm thử thực thi logic `.ts` độc lập |
| TypeScript core (contracts, registry, sdk, validation, storage...) | ĐẠT | `tsc --noEmit -p tsconfig.core.json` |
| Phân tích cú pháp tất cả file TS/TSX trong src | ĐẠT | TypeScript parser, **không** thay thế typecheck và build |
| Cài npm dependencies | CHƯA | `npm install` bị `EAI_AGAIN` do không truy cập registry |
| Typecheck toàn bộ React/Phaser | CHƯA | Chưa có React, Vite, Phaser, typings ở môi trường này |
| Vite build/bundle | CHƯA | Chưa cài dependencies |
| Test UI thực tế / viewport mobile | CHƯA | Trình duyệt môi trường bị chặn điều hướng tới local/file URL |
| IndexedDB transactional browser E2E | CHƯA | Đã viết logic, chưa xác minh thông qua phiên trình duyệt thật |
| Auth, cloud, RLS, kiểm thử bảo mật sản phẩm | CHƯA XÂY | Không triển khai bản Alpha trên mạng công khai |

## Ma trận nghiệm thu thực tế cần chạy trên máy Windows

1. `npm install`, `npm run typecheck`, `npm run build`, `npm run test:core`, `npm run preview`.
2. Mở trên Edge/Chrome desktop; kiểm tra ba game, bảng cửu chương và Creator Studio.
3. Với Sentence Builder: chọn sai → lưu lượt sai → thử lại → đúng → tiếp tục → hoàn thành; kiểm tra phụ huynh hiển thị đúng số lượt và hoàn thành.
4. Với Memory Match: chọn hai thẻ rất nhanh, lặp nhiều lần, sau đó thoát; đảm bảo không ghi hai event cho một động tác.
5. Với Math Quest: thoát trước khi hết câu, sau đó mở lại; không đánh dấu phiên cũ completed.
6. Xuất bản bộ cặp và bộ ghép câu; chơi, sửa phiên bản mới, kiểm tra phiên cũ vẫn có tham chiếu đúng.
7. Ngắt Internet sau khi đã tải ứng dụng: kiểm tra chức năng đã tải và lưu được IndexedDB (Alpha chưa tuyên bố hỗ trợ PWA/offline hoàn chỉnh).
8. Mở hai tab cùng phiên: không cho ghi dữ liệu sau khi phiên ở tab khác đã đóng; kiểm tra duplicate eventId và consistency.
9. Kiểm tra bàn phím, focus, 320px, 375px, 768px, 1024px, cảm ứng iOS/Android.
10. Xóa dữ liệu trình duyệt: xác nhận lịch sử mất; giải thích cho người thử nghiệm chưa có backup/cloud.

## Tiêu chí chuyển giai đoạn

**Chưa đạt release gate Alpha 2 cho sử dụng thật:** phải vượt qua build + browser E2E, sửa lỗi P0/P1 và có xác thực khi dùng nhiều trẻ. Trạng thái code `alpha.2` chỉ thể hiện tiến độ phát triển, không phải nghiệm thu.
