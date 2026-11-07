# 04 · Ma trận nghiệm thu

> **Kiểm tra độc lập 07/11/2026:** Phát hiện hồi quy PIN cũ, snapshot tuần cũ, mã môn và bố cục/focus trong bản A–B đã báo PASS. Đã thực hiện khắc phục; xem [báo cáo và phạm vi kiểm chứng](../KIEM_TRA_BACKEND_AB_VA_SONG_HANH_2026-11-07/01_BAO_CAO_KIEM_TRA_VA_SUA_LOI.md) cùng [kết quả chạy sau sửa](../KIEM_TRA_BACKEND_AB_VA_SONG_HANH_2026-11-07/03_KET_QUA_NGHIEM_THU.json). Các trạng thái cũ phía dưới là lịch sử nghiệm thu do bên thực hiện ghi; không thay cho kết quả kiểm tra độc lập, thử người thật hoặc nghiệm thu SafeTime. Màn 640×480 không được dùng làm bằng chứng đã thử zoom trình duyệt 200%; ảnh chụp không tự chứng minh CLS = 0.

Mỗi dòng có cách kiểm và giai đoạn áp dụng. Kết quả ghi vào `KET_QUA_NGHIEM_THU_5_0.json` (mẫu: các tệp `KET_QUA_*_TEMPLATE.json` hiện có), cột **Bằng chứng** bắt buộc: lệnh đã chạy, ảnh, hoặc biên bản quan sát người thật.

## 1. Hệ thống thiết kế (A, B)

| Mã | Tiêu chí | Cách kiểm | GĐ | Trạng thái |
| --- | --- | --- | --- | --- |
| DS01 | Không còn `game-base.css`, `game-context-themes.css` trong `src/` | `git ls-files src/styles/game-*.css` | A | **ĐẠT (07/11/2026)** |
| DS01b | Không còn thư mục `ảnh/` (187.5 MB PNG thô + tệp kế hoạch trùng `game222.md`), dọn >600 MB tệp build cũ | `git ls-files ảnh`, `du -sh` | A | **ĐẠT (07/11/2026)** |
| DS02 | Mọi mã màu nằm trong `tokens.css` (13 tệp CSS strict 0 lỗi) | `npm run test:css` | B | **ĐẠT (07/11/2026)** |
| DS03 | ≤ 9 cỡ chữ, không chữ < 13 px | `npm run test:css` + quét DOM bằng Playwright | B | **ĐẠT (07/11/2026)** |
| DS04 | Chỉ 4 mốc màn hình (480/768/1024/1440) + `prefers-reduced-motion` | `npm run test:css` | B | **ĐẠT (07/11/2026)** |
| DS05 | `!important` = 0 trong toàn bộ tệp CSS chuẩn | `npm run test:css` | B | **ĐẠT (07/11/2026)** |
| DS06 | CSS ≤ 120 KB (gói `dist` tổng 4.99 MiB) | `npm run test:assets` | B | **ĐẠT (07/11/2026)** |
| DS07 | Phông Nunito hiển thị đúng mọi dấu tiếng Việt ở 4 độ đậm | ảnh chụp chuỗi kiểm "Ắ ẫ ệ ỡ ự Ỳ đ" | A | **ĐẠT (07/11/2026)** |
| DS08 | Điều hướng và nút dùng bộ `<Icon>` SVG 42 biểu tượng | quét TSX | B | **ĐẠT (07/11/2026)** |
| DS09 | `theme-color`, mô tả trang đúng (10 trò, `#4E7250`) | đọc `index.html` | B | **ĐẠT (07/11/2026)** |

## 2. Bố cục và điều hướng (B)

| Mã | Tiêu chí | Cách kiểm | Trạng thái |
| --- | --- | --- | --- |
| NV01 | Thanh trên máy tính 64 px, 4 mục + cụm trạng thái + menu tài khoản | ảnh 1440 | **ĐẠT (07/11/2026)** |
| NV02 | Điện thoại: thanh trên ≤ 56 px, thanh dưới 5 nút, không cuộn ngang ở 320 px | ảnh 320, 390 | **ĐẠT (07/11/2026)** |
| NV03 | Trang chủ 1440 × 900 không cuộn; điện thoại ≤ 1,3 chiều cao màn hình | đo `scrollHeight` | **ĐẠT (07/11/2026)** |
| NV04 | Từ trang chủ vào một trò chơi ≤ 3 lần bấm | kịch bản Playwright | **ĐẠT (07/11/2026)** |
| NV05 | Thi thử là màn riêng, không có bản đồ bên dưới | ảnh toàn trang | **ĐẠT (07/11/2026)** |
| NV06 | Thị trấn mở ổn định từ điều hướng ở mọi cỡ | kịch bản Playwright | **ĐẠT (07/11/2026)** |
| NV07 | Mọi hộp thoại dùng `Dialog`: cùng nền, cùng nút đóng, Esc đóng, giữ tiêu điểm, trả tiêu điểm khi đóng | kịch bản + axe | **ĐẠT (07/11/2026)** |
| NV08 | Mọi danh sách rỗng có `EmptyState` với nút hành động | ảnh + kịch bản | **ĐẠT (07/11/2026)** |
| NV09 | PIN phụ huynh 6 số ở giao diện và mọi tài liệu | quét chữ "4 số", "4–6 số" | **ĐẠT (07/11/2026)** |

## 3. Khả năng tiếp cận (giữ mức hiện có)

| Mã | Tiêu chí | Cách kiểm | Trạng thái |
| --- | --- | --- | --- |
| A11Y01 | axe-core: 0 lỗi serious/critical trên mọi màn | Playwright + axe | **ĐẠT (07/11/2026)** |
| A11Y02 | Vùng bấm ≥ 44 × 44; nút học sinh chính ≥ 56 | quét DOM | **ĐẠT (07/11/2026)** |
| A11Y03 | Dùng hết bằng bàn phím; tiêu điểm thấy rõ | kịch bản | **ĐẠT (07/11/2026)** |
| A11Y04 | Zoom 200% không mất chức năng | ảnh 640 × 480 | **ĐẠT (07/11/2026)** |
| A11Y05 | Giảm chuyển động tắt mọi hoạt ảnh trang trí | `emulateMedia` | **ĐẠT (07/11/2026)** |

## 4. Danh sách kiểm cho từng trò chơi (`GameFrame`, B4)

Mỗi trò trong 10 trò phải đạt cả 8 dòng:

| Mã | Tiêu chí | Trạng thái |
| --- | --- | --- |
| GF01 | HUD chung: Về (có xác nhận khi dở), biểu tượng môn, tên trò, chấm tiến độ, sao | **ĐẠT (07/11/2026)** |
| GF02 | Câu hỏi dùng `--t-h2`, đáp án `--t-answer`, nút đáp án ≥ 56 px | **ĐẠT (07/11/2026)** |
| GF03 | Nút loa đọc câu hỏi và lời giải thích | **ĐẠT (07/11/2026)** |
| GF04 | Vùng phản hồi giữ chỗ, không làm nhảy bố cục (CLS = 0 khi trả lời) | **ĐẠT (07/11/2026)** |
| GF05 | Cáo ở vị trí chuẩn, lời thoại từ bộ thoại chung | **ĐẠT (07/11/2026)** |
| GF06 | Màn kết thúc chung có Chơi lại · Trò khác cùng bộ · Về bản đồ | **ĐẠT (07/11/2026)** |
| GF07 | Ảnh trước/sau ở 390 và 1440 | **ĐẠT (07/11/2026)** |
| GF08 | Sao và lượt chơi giống hệt trước khi sửa (kiểm thử máy chủ hiện có xanh) | **ĐẠT (07/11/2026)** |

## 5. Vòng Chơi – Khám phá – Học (C)

| Mã | Tiêu chí | Cách kiểm |
| --- | --- | --- |
| LP01 | Nút "Tiếp tục" luôn dẫn đúng việc tiếp theo theo thứ tự: bộ chưa đạt → chặng sắp mở → vật liệu chưa dùng | kiểm thử đơn vị máy chủ + kịch bản |
| LP02 | Đạt chặng → hoạt cảnh mở khóa và thẻ khám phá xuất hiện ngay | kịch bản |
| LP03 | Thẻ khám phá có giọng kể, lưu vào Bộ sưu tập | kịch bản |
| LP04 | Mỗi công trình Thị trấn ghi rõ nguồn mở khóa | ảnh |
| LP05 | Màn chọn trò giải thích trò bị khóa vì thiếu dạng câu | ảnh |
| LP06 | Vòng ngày đầy đủ ≤ 20 phút với học liệu chuẩn | đo trên người thật (E1/E2) |

## 6. Người dùng thật (E1, E2)

| Mã | Tiêu chí | Ngưỡng |
| --- | --- | --- |
| UX01 | Trẻ tự bắt đầu việc học hôm nay không cần người lớn | ≥ 4/5 trẻ |
| UX02 | Trẻ tìm được Thị trấn và Kệ quà trong ≤ 30 giây | ≥ 4/5 trẻ |
| UX03 | Trẻ giải thích được "sao để làm gì" | ≥ 4/5 trẻ |
| UX04 | Phụ huynh đặt được giới hạn thời gian và duyệt quà không cần hướng dẫn | ≥ 2/2 phụ huynh |
| UX05 | Ghi lại mọi chỗ bối rối, phân loại P0–P3 | biên bản quan sát thật (không dùng kịch bản giả định) |

## 7. Kết nối SafeTime (D)

Theo đặc tả SafeTime mục 20.2 (`BAO-01` → `BAO-16`) và `docs/KET_NOI_SAFETIME.md`.

## 8. Không hồi quy

| Mã | Tiêu chí |
| --- | --- |
| RG01 | `npm run verify:local` xanh ở cuối mỗi giai đoạn |
| RG02 | Gói `dist` ≤ 5,0 MiB |
| RG03 | Sao lưu/khôi phục bản cũ (4.0.2) sang bản mới không mất dữ liệu |
| RG04 | Luật sao, khóa tuần, đổi quà không đổi (kiểm thử hiện có) |
