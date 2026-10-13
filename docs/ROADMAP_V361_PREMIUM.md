# Lộ trình hoàn thiện 3D — từ V3.6.1 đến release

## Giai đoạn A — ổn định và đo lường (ưu tiên cao)
- Duy trì 2 nhánh React và standalone bằng các bộ test riêng, không chuyển hoặc xóa IndexedDB/localStorage của người học. Chốt một schema và kế hoạch chuyển đổi **chỉ khi thực sự cần**.
- Cài đủ dependency và chạy `npm run build`, `npm run test:core`, `npm run test:guide-animation`, kiểm thử React browser thật; xử lý TypeScript/build lỗi phát hiện được.
- Tạo test lưu và phục hồi điểm trên một HTTPS origin thực, kiểm tra đóng tab, refresh, mất kết nối, 2 lần bấm nhanh, treo trang và `prefers-reduced-motion`.
- Đo trên desktop (1920/1440/1366) và mobile (390/375/320, dọc/ngang): 50th/95th percentile frame time, input response, CPU/memory, peak JS long tasks; ghi model máy, GPU, trình duyệt. Mục tiêu đề xuất: tương tác gameplay không có tác vụ >200 ms, ưu tiên 50–60 FPS trên PC và tối thiểu 30 FPS trên mobile WebGL; phải **đo thực**, không suy đoán.

## Giai đoạn B — mỹ thuật 3D (chưa thực hiện)
- Tạo hoặc sở hữu hợp pháp đủ 5 asset `fox-guide`, `math-world`, `memory-world`, `language-world`, `environment` có texture và giấy phép phù hợp. Concept cần phê duyệt riêng theo bảng màu, tỷ lệ nhân vật, bố cục và nguồn sáng.
- Nạp **PBR + texture + normals + skeleton + animation clips** (idle, cheer, victory). Có thể tích hợp Three.js/GLTFLoader **sau khi đánh giá tương thích bundle/performance**; không thay kiến trúc quản lý học liệu/game SDK.
- Art direction: một thế giới thống nhất về camera, kích thước đảo, chất liệu, lighting, mây/đổ bóng/bloom nhẹ, ranh giới UI/3D rõ ràng; tất cả đều chụp từ bản đang chạy, không dùng poster mockup làm bằng chứng.

## Giai đoạn C — nghiệm thu phát hành
- Full walkthrough tự động và thủ công cả 3 game, mỗi bài hoàn thành 100% câu hỏi; ghi đúng điểm vào đúng phiên, lỗi lưu có thông báo và cho retry; thử thoát giữa chừng, chuyển màn liên tục.
- Test trên ít nhất 1 máy tính Windows thực và 2 điện thoại phổ thông (Android/iOS nếu hướng tới cả hai), Chrome/Edge và Safari iOS; gồm kiểm thử thao tác chạm, GPU WebGL, giảm chuyển động và màn hình nhỏ.
- Checklist release: tài sản GLB đầy đủ; test core và build đều xanh; FPS/CPU có bằng chứng; dữ liệu bền vững; không overflow, không tương tác chết; cảnh chạy thật được duyệt so với concept. Khi tất cả đạt mới gắn nhãn **FINAL/HOÀN THÀNH**.
