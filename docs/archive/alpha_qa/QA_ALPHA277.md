# Nghiệm thu kỹ thuật — Bảo An Learning Alpha 2.7.7

Ngày: 13/10/2026. Phát triển tiếp trực tiếp từ Alpha 2.7.6; không đổi schema IndexedDB, giao thức Game SDK hoặc dữ liệu học liệu.

## Thay đổi đã đưa vào mã nguồn
- Thêm `src/styles/world277.css` được import **cuối** trong `src/main.tsx`: giao diện đảo game hòa vào cảnh, bảng điều khiển xanh có tương phản cao, chuyển động đảo nổi chỉ dùng `transform` để tránh reflow, hiệu ứng chọn đáp án đúng/sai; tắt được khi `data-motion=off` hoặc hệ điều hành chọn giảm chuyển động.
- Tạo `premium-world-clarity.webp` từ tranh nền dự án và các `premium-island-{math,memory,sentence}-soft.webp` bằng mask alpha mềm: không chứa nút HTML giả.
- Tạo `premium-fox-optimized.webp`; kích thước từ 502.553 bytes PNG xuống 65.712 bytes WebP, vẫn giữ nền trong suốt.
- Trang chủ dùng component `GameMascot` có fallback khi tải ảnh lỗi, giống ba game.
- Khắc phục thanh điều hướng tràn ngang ở kích thước 768–900px.
- Không đổi thao tác người dùng, cơ chế ghi kết quả, hồ sơ, mini-app hay Creator Studio.

## Kiểm chứng độc lập đã thực hiện
- `npm run test:core`: **61/61 đạt**.
- `npm run test:syntax`: đạt.
- `tsc --noEmit -p tsconfig.core.json`: đạt.
- Chromium chạy bản xem trước HTML/CSS được nhúng asset từ mã nguồn dự án ở 1920×1080, 1440×900, 1024×768, 768×900, 390×844 và 320×700: không tràn ngang, cả ba đảo và mascot được tải. Dữ liệu: `docs/visual277/layout-results.json`.
- Chromium Math Quest bản kiểm tra bố cục trước/sau khi thay vùng kết quả ở 1440, 390, 320px: **độ dịch chuyển top của vùng đáp án và bảng câu hỏi = 0px**. Dữ liệu: `docs/visual277/math-results.json`.

## Giới hạn / bắt buộc nghiệm thu trên máy có npm
- Chưa chạy được `npm run build` đầy đủ: môi trường hiện tại không có cache npm của React/Vite/Playwright và việc tải từ registry chưa khả dụng.
- Ảnh `docs/visual277/*.png` là ảnh chụp **HTML/CSS xem trước**, không phải ứng dụng React thật; không được coi là bằng chứng nghiệm thu toàn bộ luồng game.
- Kiểm thử Playwright thật `tests/visual/visual277.spec.ts` đã được bổ sung nhưng chưa được chạy trong môi trường này.
- Mức mỹ thuật vẫn chưa thể coi tương đương hoàn toàn concept 2.5D cao cấp. Ảnh gốc của một số lớp phong cảnh vẫn có giới hạn độ chi tiết; muốn cải thiện hơn nữa phải có bộ asset được vẽ riêng cho game.

## Chạy trên Windows
Giải nén sang thư mục riêng (không ghi đè phiên bản cũ). Mở terminal trong thư mục chứa `package.json`:

```powershell
npm install
npm run test:core
npm run build
npm run dev
```

Trong cửa sổ Terminal khác, khi Vite đã chạy:

```powershell
npx playwright install chromium
npx playwright test tests/visual/visual277.spec.ts
npm run test:stability
```

Kiểm tra thêm: Math Quest, Memory Match, Sentence Builder hoạt động; đóng/mở và tải lại trang giữ kết quả; khi tắt hiệu ứng thì đảo ngừng chuyển động; nút đáp án không nhảy khi phản hồi. Hãy sao lưu dữ liệu cục bộ trước khi thay phiên bản alpha, đặc biệt nếu đổi tên miền/cổng chạy.
