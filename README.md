# BẢO AN LEARNING V3.7 RC1 · LÁT CẮT 3D PR-02

Đã thêm renderer Three.js tải riêng, lớp dự phòng WebGL/Canvas, chất lượng tự động/thủ công, model cáo có texture PBR + 14 xương + ba clip và Đảo Toán Học tự tạo. Đây là **bản thử nghiệm chờ duyệt**, chưa phải V3.7 FINAL. Memory/Language trong cảnh mới hiện chỉ là landmark tạm; chưa triển khai PR-03.

- Chạy `MO_V37_PREMIUM_WINDOWS.bat`, rồi mở `http://localhost:5178/?premium3d=1` để xem lát cắt mới. Hoặc dùng `npm ci`, `npm run build`, `npm run preview -- --port 5178`.
- Mặc định giữ renderer cũ; nút **Thử cảnh 3D mới** bật bản xem thử. `?premium3d=0` hoặc `VITE_PREMIUM_3D_ENABLED=false` quay về renderer cũ. Cấu hình này không thay đổi dữ liệu học tập.
- Báo cáo, ảnh trong browser và tình trạng nghiệm thu: [docs/QA_V37_PREMIUM.md](docs/QA_V37_PREMIUM.md). Nguồn model: [docs/ASSET_LICENSES_V37.md](docs/ASSET_LICENSES_V37.md).
- Lần chỉnh sau phản hồi “thiếu chiều sâu”: Math/cáo lớn ở tiền cảnh, hai đảo lùi sau, nền đồi/mây có lớp, vách đá và công trình nhiều chi tiết; giao diện kem/teal gọn hơn. [Ảnh và nhận xét trước/sau](docs/V37_depth_qa/visual-review.md), [kiểm thử lần chỉnh](docs/V37_depth_qa/browser-tests.txt). Vẫn thuộc PR02, chưa phải nghiệm thu premium.
- Kiểm tra code: `npm run typecheck`, `npm run test:core`, `npm run test:content`, `npm run test:guide-animation`, `npm run test:renderer`. Sau build chạy `npm run test:premium` (Edge) và `npm run test:visual` (Chrome).
- `npm run gate:premium-art` **vẫn FAIL** do chưa có ba model còn lại và chưa duyệt mỹ thuật/điện thoại thật. Không giảm gate để gắn nhãn FINAL.
- Hai tệp HTML offline V3.6.2 giữ nguyên renderer/localStorage riêng, không có renderer Three.js mới.
- Preview cổng 5178 có dữ liệu riêng theo origin. Để dùng kết quả React đã lưu ở cổng 5173, chạy `START_WINDOWS.bat` trên đúng hostname cũ rồi bật nút xem thử; dữ liệu không bị xóa hoặc tự chuyển origin.

## Tài liệu và bản HTML V3.6.2 đã bàn giao

**Bắt đầu ở đây:** `docs/QA_V362_HANDOFF.md`, `docs/HUONG_DAN_HOC_LIEU_V362.md`.

- **Chơi ngay:** `BAO_AN_LEARNING_V3_6_2_PLAYABLE.html` (mở trên trình duyệt; không cần npm).
- **Nhập học liệu mới vào bản HTML:** nhấn `📁 Nhập học liệu`, chọn `MAU_HOC_LIEU_3_GAME.json` hoặc JSON xuất từ React Creator Studio; sau đó chọn bộ nội dung dưới tên mỗi trò chơi.
- **Soạn Math Quest / Memory Match / Sentence Builder:** `src/screens/CreatorScreen.tsx` (React + IndexedDB; phải cài dependency bằng npm ở môi trường cho phép tải gói).
- **Xuất kết quả và học liệu:** Góc phụ huynh của bản HTML, hai nút sao lưu độc lập.
- **Kiểm thử:** `npm run verify:offline`, `npm run test:guide-animation`, `python tools/build_offline_release.py`, `python tools/browser_qa_v362.py`.

**V3.6.2 không đạt art gate premium và React build production chưa được xác minh.** Không tuyên bố đây là bản 3D cuối cùng tương đương concept.

---

# BẢO AN LEARNING V3.6 — BẢN CHƠI THỬ 3D + MÃ NGUỒN

## MỞ CHƠI NGAY (KHÔNG CẦN CÀI)
Mở tệp **BAO_AN_LEARNING_V3_6_PLAYABLE.html** bằng Chrome hoặc Edge trên máy tính. Trên Windows có thể chạy `MO_NGAY_GAME_WINDOWS.bat`.

Tệp HTML đã nhúng các tài nguyên cần thiết: bộ dựng WebGL / Canvas, mô hình cáo GLB (bản đầy đủ cho WebGL, bản nhẹ cho Canvas), hình nền xa và ba trò chơi. Không cần Internet hay Node.js. Đây là **ứng dụng mẫu ngoại tuyến có thể sử dụng**, không phải bản React production.

## CÁC CHỨC NĂNG DÙNG ĐƯỢC
- Thế giới ba đảo trong không gian 3D, camera thay đổi theo lựa chọn; chế độ WebGL2 hoặc Canvas dự phòng.
- Math Quest: 8 câu Toán, có phản hồi đúng/sai.
- Memory Match: ghép 6 cặp từ; không bị kẹt sau khi chọn hai thẻ.
- Sentence Builder: ghép 5 câu Tiếng Anh.
- Bảng cửu chương tương tác và Góc phụ huynh xem lịch sử lượt chơi.
- Xuất/khôi phục kết quả JSON bằng Góc phụ huynh. Kết quả được lưu cục bộ khi trình duyệt cho phép localStorage.
- Tùy chọn giảm chuyển động; bố cục trang chủ không tràn ở các màn hình đã thử.

## MÃ NGUỒN REACT (PHÁT TRIỂN TIẾP)
Cần Node.js và Internet để cài thư viện vào lần đầu:

```bash
npm install
npm run build
npm run dev
```

Các trò chơi React dùng Game SDK và IndexedDB từ nhánh trước. **Không chuyển dữ liệu tự động** giữa bản HTML ngoại tuyến và nhánh React. Bản React chưa được build production trong môi trường tạo tệp vì registry npm không truy cập được.

## GIỚI HẠN THẬT SỰ
- Mô hình cáo đã là lưới GLB 3D, có chuyển động shader đơn giản và vật liệu màu. **Chưa có rig xương, texture PBR hoặc animation clip chuyên nghiệp**.
- Ba đảo là hình học 3D procedural chất lượng low-poly, **chưa đạt mức mỹ thuật concept cao cấp** và không được gọi là bản mỹ thuật cuối cùng.
- Chế độ WebGL trên GPU thật chưa được kiểm thử trong môi trường bàn giao; Chromium thử nghiệm chạy Canvas software renderer.
- Kiểm tra tự động trên môi trường này không thể chứng minh lưu localStorage qua tải lại trang vì chính sách chặn mở URL nội bộ. Người dùng nên xuất JSON dự phòng và thử khôi phục trên thiết bị sử dụng.
- Chưa có đăng nhập, đồng bộ cloud hay quyền truy cập theo học sinh trên bản HTML ngoại tuyến.
- Không nên đưa lên Internet công khai hoặc dùng lưu dữ liệu cá nhân của học sinh thật trước khi bổ sung bảo mật và kiểm tra riêng tư.

## KIỂM THỬ
Xem `docs/V36_qa/README_QA.md` và các tệp JSON; test logic React bằng `npm run test:core`, nhập GLB bằng `npm run test:guide-animation`, kiểm tra lập trình `npm run test:syntax`.

Cảnh GLB và gói HTML do dự án tự tạo; không phụ thuộc asset tải từ bên ngoài. Các ảnh phong cảnh của nhánh cũ được tái sử dụng làm lớp hậu cảnh bổ trợ.


## NHẬT KÝ PHÁT TRIỂN V3.6.1 (CHƯA NGHIỆM THU)

- **Giữ nguyên** kiến trúc React/SDK/IndexedDB, ba game và các học liệu hiện có.
- Trên bản HTML chơi thử: Memory Match không tạo lại toàn bộ bộ nút sau mỗi lượt lật; giữ focus tốt hơn và giảm layout shift; tăng ổn định kích thước màn chơi; điều khiển độ phân giải 3D `◈ Mượt / ◈ Sắc nét`.
- Engine 3D dùng chung: thêm chi tiết vách đảo, giản lược lưới cho Canvas, cùng API chẩn đoán renderer và số tam giác. Canvas dự phòng vẽ theo sự kiện để không chiếm CPU liên tục; WebGL tiếp tục chạy hoạt ảnh thời gian thực. Khi thoát game không vẽ lại Canvas vô ích.
- Kiểm tra `npm run test:core` cập nhật tham chiếu đúng tệp HTML bàn giao (44/44). Kiểm tra `npm run test:guide-animation` đạt 13/13. `npm run gate:premium-art` vẫn **KHÔNG ĐẠT** vì chưa có các mô hình GLB cao cấp.
- Browser smoke trước lần cập nhật Canvas cuối đã xác nhận giao diện 1440×900, 390×844, chức năng cơ bản và GLB trong Chromium **Canvas software**. Chưa xác minh được runtime trên GPU thật, production React, FPS thiết bị phổ thông và khôi phục sao lưu trên origin thật.
- Đọc **`docs/QA_V361_WORKING.md`** và **`docs/ROADMAP_V361_PREMIUM.md`** trước khi coi đây là bản bàn giao hoàn chỉnh. Đây là bản **đang phát triển**, không phải bản đạt art gate.
