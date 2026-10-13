# BẢO AN LEARNING V3.6.1 — QA & tình trạng thực tế

**Tình trạng: ĐANG PHÁT TRIỂN — KHÔNG ĐẠT CỔNG NGHIỆM THU CUỐI.** Đây là nhánh sửa gia tăng từ ZIP V3.6, không làm mới hệ thống hoặc xoá dữ liệu.

## Đã kiểm tra được

- `npm run test:core`: **44/44** sau khi sửa đường dẫn test đã lỗi ngay trong ZIP gốc (`tests/real3d31.test.mjs` trỏ tới `preview/BAO_AN_3D_OFFLINE.html` không tồn tại). Đây là unit/source test, **không phải** nghiệm thu React production.
- `npm run test:guide-animation`: **13/13**. Đây là kiểm tra parser, nhập model và runtime theo mock, không xác minh animation rig trên GPU.
- `tsc src/world3d/engine.ts --allowImportingTsExtensions --noEmit --target ES2022 --module ESNext --lib ES2022,DOM --strict --skipLibCheck --noUnusedLocals --noUnusedParameters`: đạt.
- `python tools/build_offline_release.py`: tạo tệp HTML với nguồn engine, hai GLB embedded và logic game. `node --check` cho mã JavaScript bundle: đạt.
- `python tools/browser_qa_v36.py`: **đạt**, Chromium Canvas dự phòng tại 1440×900 và 390×844, không có pageerror. Đạt các bước: hai thẻ Memory không khoá, mở lại game, Math sang câu, chọn từ Sentence, bảng phụ huynh và công tắc hiệu ứng. Cảnh screenshot cập nhật nằm trong `docs/V36_qa/`.
- Bộ kiểm tra viewport riêng `tools/qa_v361_browser.py` đã ghi nhận 6 viewport (1920, 1440, 1024, 768, 390, 320) có cả 3 nút Bắt đầu không vượt ngoài màn hình trong lần chạy; lần chạy tổng hợp **bị timeout**, vì thế không tính đó là kiểm thử hồi quy end-to-end đã hoàn thành.

## Chưa được xác minh và rào cản

- `npm run build` và test React/Vite trên trình duyệt thực: `npm install` không hoàn thành do registry npm không truy cập được trong môi trường làm việc. Chưa thể công nhận production React.
- Chromium thử nghiệm dùng renderer `canvas`, **không phải GPU WebGL2**. Không có số liệu FPS WebGL, nhiệt độ, pin, thời gian phản hồi trên điện thoại/PC thật. Không được lấy số liệu Canvas software làm số FPS GPU.
- Navigation `file://` và `http://127.0.0.1` bị chặn trong trình duyệt sandbox. Do đó **chưa xác minh** lưu `localStorage` sau reload và quá trình nhập JSON ngoài môi trường sandbox, dù logic lưu và khôi phục hiện có.
- Tập GLB cao cấp trong `premium-manifest.json` chưa đủ. `npm run gate:premium-art`: **FAIL 5 tài sản**, bao gồm cáo và bốn môi trường/đảo. Cáo prototype có màu mesh, không phải rig/clip/PBR được kết xuất đầy đủ.
- Đối chiếu mỹ thuật phải dùng ảnh chụp sản phẩm runtime và bộ concept chuẩn được chủ dự án duyệt; không chấm dựa trên ảnh 2D trang trí.

## Điều chỉnh kỹ thuật V3.6.1

1. Memory Match ở HTML: chỉ cập nhật thuộc tính từng thẻ, thay vì render lại cả lưới sau mỗi click. Giảm mất focus bàn phím và việc thay nút ngoài ý muốn.
2. Thêm lựa chọn độ phân giải 3D `◈ Mượt / ◈ Sắc nét`; cấu hình lưu trong key mới `baoan.3d.renderQuality`, **không thay đổi** key kết quả `baoan.real3d.offline1`.
3. Bổ sung nhánh dựng Canvas dự phòng giản lược hình học và render theo sự kiện; bản WebGL giữ shader animation. Chế độ Canvas không có animation liên tục — đây là sự đánh đổi có chủ đích để tránh giật do CPU.
4. Khung trò chơi có chiều cao cố định theo viewport; danh sách nội dung dài cuộn bên trong modal, không đẩy trang nền hoặc nút.
5. Tăng chi tiết hình học địa hình ở renderer hiện có, không thêm phụ thuộc runtime hoặc thay kiến trúc.

## Nguyên tắc nghiệm thu

Chỉ chốt phát hành sau khi có **bản React build được**, kiểm thử ba game trên cả máy tính/điện thoại, dữ liệu bền vững qua refresh, số đo FPS và thao tác trực tiếp trên thiết bị, tài sản 3D chất lượng cao được tích hợp đủ animation/PBR, cùng phê duyệt mỹ thuật đối chiếu concept.
