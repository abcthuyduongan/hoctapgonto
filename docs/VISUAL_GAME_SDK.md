# BẢO AN LEARNING — VISUAL GAME SDK / Alpha 2.6

## Nguồn chuẩn hiện hành

- `src/styles/game-world.css`: bố cục và các token cơ bản.
- `src/styles/polish26.css`: bối cảnh và hệ UI nâng cấp, responsive và reduced motion.
- `public/art/original-*.svg` và `original-*.webp`: phong cảnh minh họa **không có chữ, không có nút giả**. Sinh lại bằng `python tools/generate_art.py` (cần Python, cairosvg và Pillow).
- `src/core/experience.ts`: âm thanh WebAudio nhỏ, mặc định tắt; người dùng chủ động bật.
- `src/games/MathQuest.tsx`, `MemoryMatch.tsx`, `SentenceBuilder.tsx`: gameplay và sự kiện học tập vẫn là React/DOM thực.
- `tests/visual/visual-alpha26.spec.ts`: chụp màn hình ứng dụng **chạy thật** và kiểm tra overflow trên máy có npm và trình duyệt Playwright.

## Quy tắc không thương lượng

1. Nền game chỉ được minh họa cảnh trí. Không đặt đáp án, nút chơi, chỉ số hoặc báo cáo vào ảnh.
2. Không nhầm lẫn preview HTML với nghiệm thu giao diện React.
3. Bộ asset phải hỗ trợ nhiều môn, nhiều câu hỏi mà không vẽ lại UI.
4. Giữ nhãn nút đọc được ở 320px, chạm và bàn phím, có focus rõ.
5. Âm thanh có thể tắt; hiệu ứng hỗ trợ `prefers-reduced-motion` và tùy chọn thủ công.
6. Không tự tuyên bố tương đương concept khi chưa có ảnh chụp UI React, nhận xét người dùng và kiểm tra mỹ thuật.
7. Các câu hỏi và kết quả vẫn dùng Game SDK V1, không để CSS thay đổi nghiệp vụ.

**Trạng thái:** `docs/VISUAL_ACCEPTANCE_ALPHA26.md` ghi rõ điều gì đã kiểm chứng, nợ mỹ thuật và tiêu chí để chốt. Phiên bản này chưa đạt mục tiêu độ chi tiết cảnh nền của concept AI.
