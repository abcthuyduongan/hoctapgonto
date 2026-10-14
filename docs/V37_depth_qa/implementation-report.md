# PR02 — chỉnh chất lượng sau phản hồi thiếu chiều sâu

Ngày: 14/10/2026. Phản hồi người dùng: “Tổng thể còn đơn giản, thiếu chiều sâu”. Lần chỉnh tiếp tục PR02, không coi đây là duyệt để bước sang PR03.

Cảnh thay hàng ba đảo cùng cỡ bằng bố cục gần/xa. Math có tỷ lệ lớn và nằm phía trước; Memory/Language lùi xa, thấp chi tiết hơn và vẫn là landmark tạm. Cáo được đặt theo tọa độ local của đảo nên đứng đúng trên mặt cỏ khi đổi viewport. Camera portrait dành nhiều diện tích hơn cho Math và cáo. Đồi xa có thể tích 3D, alpha mờ tại chân/mép; mây theo cụm ở các khoảng cách khác nhau. Instancing tái sử dụng cây, đá và mây để giữ draw calls; cleanup bổ sung dispose instance buffers.

Math GLB thêm vách đá phân tầng sâu xuống -1,51, rêu/cỏ/hoa, lan can, bậc đá, viền cửa sổ, mái nhiều lớp và cờ. 30.668 tam giác, 16 material, 18 PNG PBR, 1.839.516 byte. Cáo giữ nguyên hash/rig/clip; không thay asset chỉ để làm đẹp screenshot. Nguồn và SHA mới nằm trong `../ASSET_LICENSES_V37.md`.

DOM dùng màu kem/teal, giảm bóng/chữ nổi lớn, gọn tiêu đề và bảng tiến độ. Ba thẻ game có màu nhận diện và select/nút riêng. Các nút vẫn giữ ARIA, handlers, pack/version và vùng chạm 44px. CSS mới chỉ áp dụng khi bật cảnh premium; game overlay và legacy giữ nguyên. Không sửa `src/core/` hoặc `src/games/`, đã đối chiếu hash baseline.

## Kiểm chứng

- Typecheck PASS; core 44/44, content 4/4, guide-animation 13/13, renderer 26/26 PASS. Log tại thư mục này.
- Production build PASS. Entry JS 274,83 kB / gzip 85,91 kB; premium lazy 653,89 kB / gzip 168,11 kB; CSS 201,90 kB / gzip 40,98 kB. Cảnh báo chunk >500 kB vẫn được giữ.
- Production Edge 26/26 và Chrome 4/4 PASS: ba game chơi trọn, persistence qua refresh/đóng tab, JSON import, reduced motion, fallback/no WebGL/decode fail/context loss, 20 vòng điều hướng cleanup. Log `browser-tests.txt`, `legacy-browser-tests.txt`.
- Tám ảnh chụp mặc định/focus tại 1440×900, 390×844, 320×640, 844×390. Không overflow, nút bị che hoặc resource lỗi. Đã sửa núi xa quá đặc và nav landscape chồng tiêu đề; ảnh lần lỗi được giữ ở `iteration1/`.
- Quan sát trên Intel Arc/Edge: median 59,9 FPS, P95 khoảng 17 ms. Tam giác tăng khoảng 30–35%; draw calls desktop 88, mobile emulation 46; texture estimate 9 MiB. Chưa có benchmark Android/iPhone thật hoặc profiler bộ nhớ.

Ảnh và nhận xét chi tiết: [visual-review.md](visual-review.md). Viewport điện thoại là giả lập trên GPU máy tính, chưa thay nghiệm thu máy thật. Mỹ thuật vẫn cần đánh giá của chủ dự án; ba model premium còn lại chưa sản xuất và release gate chưa đạt.
