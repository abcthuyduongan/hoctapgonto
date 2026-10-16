# Bảo An Learning — Alpha 2.7.6 · Premium UX pass

## Đã thực hiện trong mã nguồn

1. Nền trang chủ `premium-world-cinematic.webp` biên tập lại từ asset có sẵn: bố cục rõ hơn, không sử dụng ảnh concept có chữ hoặc nút giả.
2. Các đảo game dùng ảnh PNG RGBA được làm mềm viền, được đặt trong không gian chung; phần lựa chọn bài/nút `Bắt đầu` vẫn là DOM thật.
3. Tái bố cục desktop (3 đảo), tablet (3 đảo không co về 0px), mobile (2 hàng điều hướng, đảo xếp dọc). Thay đổi nằm trong `src/styles/world276.css` và được nhập **cuối** trong `src/main.tsx`.
4. Cảnh Math Quest, Memory Match, Sentence Builder sử dụng các nền đồng bộ `premium-*-cinematic.webp`, giảm lớp phủ xám; giữ vùng phản hồi cố định chống nhảy màn hình.
5. Thanh tiến trình trong Math Quest và Sentence Builder chỉ tăng sau khi câu trả lời được xác nhận, thay vì tăng ngay khi vừa vào câu mới.
6. Cập nhật bộ kiểm thử Playwright: thay các selector `.world-card .game-play` đã lỗi thời bằng `.portal273-start`, bổ sung chụp ứng dụng React và kiểm tra chống tràn ngang/nhảy khi trả lời.

## Đã kiểm chứng trong môi trường thực hiện

- `npm run test:core`: **57/57 đạt**; `npm run test:syntax`: đạt.
- `tsc --noEmit -p tsconfig.core.json`: đạt.
- Chạy Chromium `/usr/bin/chromium` với HTML/CSS tự chứa (không truy cập website cục bộ do môi trường chặn). Tài nguyên hình ảnh được nhúng vào trang kiểm thử từ **cùng file CSS và asset** của dự án.
- Trang chủ: 1920×1080, 1440×900, 1024×768, 390×844, 320×700. Không có tràn ngang; ba đảo đều có kích thước thực; ảnh nạp được.
- Math Quest: 1440×900, 390×844, 320×700. Khu lựa chọn câu trả lời vẫn hiển thị; nhân vật nạp được; không tràn ngang.
- `docs/visual276/layout-results.json` và `math-results.json` chứa số liệu thực tế.

## Chưa nghiệm thu / hạn chế

- **Chưa chạy `npm run build` với thư viện npm thật**: môi trường hiện tại không truy cập registry.npmjs.org (EAI_AGAIN). Vì vậy chưa thể xác nhận build của phiên bản này.
- Ảnh minh họa `docs/visual276/` là bản kiểm tra **HTML/CSS**, không phải React chạy đầy đủ, nên không thay thế kiểm thử Playwright trên ứng dụng thật.
- Chưa chốt hoàn toàn đạt chất lượng concept 2.5D ban đầu: art source cũ bị mềm ở vùng xa, các thành phần nội dung cần tiếp tục tinh chỉnh bằng ảnh chụp React thật.
- Chưa kiểm thử đa thiết bị, khả năng truy cập toàn diện và khôi phục dữ liệu khi đổi trình duyệt.

## Chạy nghiệm thu trên Windows

```powershell
npm install
npm run test:core
npm run build
npm run dev
```

Ứng dụng (thường) ở `http://localhost:5173`. Mở cả ba game và kiểm tra ảnh/nút. Sau đó chạy:

```powershell
npx playwright install chromium
npm run test:visual
npm run test:stability
```

Ảnh chụp React thật được ghi tại `visual-output/` để so với concept. Không ghi đè thư mục bản cũ; sao lưu IndexedDB trước khi đổi origin/tên miền.

## Các điểm nghiệm thu tối thiểu

- Không còn tên nút/giả lập UI in sẵn vào nền.
- Desktop nhìn thấy ba đảo và ba nút chơi trong màn hình đầu tiên ở 1440×900.
- Mobile 320px và 390px: thanh điều hướng không đứng chữ, không tràn ngang, nút chọn bài rõ.
- Math Quest không có ảnh hỏng; thông báo đúng/sai không làm nhảy vị trí đáp án.
- Creator Studio và Góc phụ huynh vẫn hoạt động, dữ liệu vẫn còn sau reload.
