# Hoàn thiện RC9 — 2026-10-17

H1–H4 trong kế hoạch đã triển khai trên mã cục bộ. Chỉ cung cấp mẫu Excel theo yêu cầu mới. H5–H6 chưa đủ bằng chứng nghiệm thu thực tế; không đánh dấu production-ready.

## Thay đổi

- Tuần mới có 3 hoặc 4 môn, tối đa 12 câu/môn cộng mọi bộ/dạng; giao được ít hơn 12 câu. Mã môn ổn định, tên gần giống có thể xếp lại tại preview; Toán/toan/math dùng cùng mã. SQLite và PostgreSQL cùng kiểm tra, API trực tiếp không vượt trần. Không tự cắt câu.
- Mọi câu có sao riêng; tối đa 3 sao/câu dùng chung các game và phiên bản nguồn. Hoàn thành tuần khi tất cả câu đạt 2 sao; báo số câu 2/3 sao trước xác nhận chuyển. Tuần đã qua khóa ở API, kể cả request cũ/thiết bị khác. Nút tiếp tục chỉ chọn câu dưới 2 sao; game ghép thêm câu đối chiếu khi cần.
- Cột tùy chọn difficulty nhận easy/medium/hard, bỏ trống mặc định medium. Nhãn level giữ nguyên. Bộ mẫu Excel 36 câu/3 môn/10 bộ có 12 câu/môn, gợi ý 4 nền tảng/5 vận dụng/3 nâng cao; gồm 2 PNG, 2 WAV và hướng dẫn. Không tạo mẫu Word mới; bỏ liên kết Word, vẫn đọc tệp Word cũ.
- null/NULL (có thể có khoảng trắng) là thiếu dữ liệu: cột bắt buộc báo dòng/trường và loại câu, cột tùy chọn coi như trống. Ô lỗi Excel #NULL!, #VALUE!, #REF! hoặc t=e báo rõ địa chỉ ô và loại câu. Số 0 và boolean false được giữ. Nhóm còn một câu không được giao và có giải thích.
- Tuần đã có học sinh xác nhận chuyển: chặn đổi nội dung chấm điểm, giữ phiên bản/ID/sao; cho chỉnh lời giải thuần trình bày. Preview và máy chủ đều báo số học sinh đã đóng tuần. Phân biệt lỗi tuần đã khóa với phiên bản vừa được cập nhật.
- Quản trị: metadata 20 mục/trang, tìm học sinh tại SQL, trang mới thay trang cũ; mở một tuần mới tải nội dung tuần đó. Thư viện 20 tệp/trang chỉ tải khi bấm xem. Import tra đúng metadata tên tệp (tối đa 100 tên/lần), kể cả tệp ngoài trang thư viện. Tìm tên tiếng Việt và tên tư liệu chuẩn hóa Unicode, không phân biệt hoa/thường. Preview so trùng chỉ giữ nội dung một tuần liên quan tại một thời điểm.
- Quyền đọc ảnh/âm thanh kiểm bằng SQL EXISTS, không giải mã toàn bộ học liệu vào bộ nhớ cho từng tệp. Giữ quyền theo lớp/đơn vị và lịch sử phiên bản lượt chơi.

## Dữ liệu và phục hồi

Không thay bảng SQL: SQLite 1, PostgreSQL 1. Cấu hình tuần được ghim có version trong audit JSON week.policy, ghi cùng transaction giao tuần; đây là thay đổi dữ liệu có phiên bản, không phải suy đoán giới hạn từ UI. Tuần cũ không có marker giữ cấu hình cũ, không cắt/xóa/đổi ID hoặc đặt lại sao. Fixture tuần cũ 140 câu được kiểm riêng.

Snapshot SQLite RC9 chứa cấu hình tuần; kiểm phục hồi sang thư mục tạm riêng, giữ plan và từ chối cấu hình hỏng. Dùng RC9 để khôi phục bản sao RC9, không hạ bản. Chưa thực hiện phục hồi PostgreSQL + Storage trên môi trường cloud riêng.

Các fixture hồi quy RC8 1–2 môn được seed qua helper nằm trong tests, không có cờ bỏ kiểm tra ở ứng dụng. Ca quy tắc tuần mới gọi store/API thật. Đã kiểm quyền workspace, CSRF, phiên hết hạn, sao dùng chung, cập nhật phiên bản, đọc tư liệu lịch sử và khôi phục liên quan.

## Kiểm tra kỹ thuật

- Typecheck/build và kiểm tra tài sản 3D: PASS. Mã ứng dụng build 119 module.
- Node: 304/304 PASS (103 renderer, 9 release, 152 online, 40 cloud); kiểm tra cú pháp TSX PASS.
- Công cụ biên soạn mẫu trên runtime Windows hiện thoát mã 1 sau khi đã xuất/render xong, không có thông báo lỗi thêm trong log. Không ép mã thoát 0; các tệp được kiểm độc lập bằng parser ứng dụng và trình duyệt. npm run build của ứng dụng PASS.
- Excel: strict và partial import đều nhận 36/36 câu, 10 bộ, không lỗi. Có kiểm Unicode tên Việt/tên tư liệu, null bắt buộc/tùy chọn, t=e, boolean false, số 0, schema 33 cột và nhận mẫu cũ.
- Trình duyệt: 96/96 PASS trên Chrome/Edge; có kiểm mẫu 36 câu, tệp cũ 140 câu + 16 audio, preview không tải dashboard, chỉ giao câu hợp lệ, giới hạn môn/câu, trò phù hợp, chia màn, giọng Việt giả lập, mật khẩu và 20 vòng vào/thoát. Sau sửa Unicode đã chạy thêm 39/39 ca import/quy tắc/đóng gói máy chủ; 12/12 ca Chrome/Edge trên build cuối cũng PASS, gồm ảnh tên hoa/thường và 20 vòng vào/thoát. Chưa coi giọng giả lập là xác nhận giọng thật.

## Đo tải trong môi trường thử

Số liệu cùng máy, SQLite tạm, 30 tài khoản giả lập; so endpoint dashboard cũ với danh sách quản trị mới trên cùng dữ liệu. Đây là dung lượng/thời gian HTTP và máy chủ trong fixture, không phải năng lực Netlify.

| Dữ liệu | Dashboard cũ | Danh sách tuần mới | Chi tiết một tuần |
|---|---:|---:|---:|
| 52 tuần × 3 môn × 12 câu + 140 câu cũ | 521.169 byte / 995 ms | 20.915 byte / 2,40 ms | 9.193 byte / 0,87 ms |
| 52 tuần × 4 môn × 12 câu + 140 câu cũ | 680.878 byte / 1.952 ms | 27.428 byte / 2,55 ms | 12.242 byte / 1,11 ms |

Danh sách giảm khoảng 96% byte. 10 phiên HTTP đồng thời: tổng 112/128 ms; 30 phiên: 240/302 ms, 0 lỗi trong phép thử. Sau warm-up 5 vòng và vòng 20, Node heap sau GC lần lượt 15,54→15,43 MB (3 môn), 16,62→16,43 MB (4 môn); không còn play active. Đây chưa chứng minh không có mọi loại rò rỉ. Log tái lập: test-results/rc9-load-benchmark.json, công cụ tools/benchmark_weekly_load.mjs chạy với --expose-gc.

## Website thật và phần còn cần xác nhận

Kiểm tra chỉ đọc ngày 2026-10-17: trang chủ và /api/online/status HTTP 200; API available/configured true, mediaMaxBytes 2 MB. Build online 2bb9c2c7dbb008a8, khác RC9 cục bộ. Ba lần gọi từ máy kiểm thử: trang chủ 2.797 / 378 / 325 ms; status 3.504 / 836 / 570 ms. Lần gọi đầu gồm mạng/DNS/TLS/đường xử lý; không kết luận riêng thời gian cold start hoặc thời gian vào game. Chưa đăng nhập tài khoản thật, chưa ghi học liệu, chưa triển khai.

H5 cần giáo viên kiểm đáp án/gợi ý, độ vừa sức và mốc thời gian câu khó; nghe giọng Việt thật trên thiết bị, xác nhận không có câu kẹt vì đáp án. H6 cần người dùng đẩy đúng Production branch, UI và Function cùng commit, đo lại tải/trả lời với tài khoản thử trên website và kiểm phục hồi PostgreSQL + Storage ở môi trường riêng. Chưa có bằng chứng thì giữ humanPilotStatus UNVERIFIED và releaseReady false.

## Gói và cập nhật

RC9 có gói cục bộ và gói mã cập nhật GitHub riêng; giữ RC8 bất biến. Xem CAP_NHAT_NETLIFY_RC9.md và NGHIEM_THU_CUC_BO_RC9.md. Chưa commit/push/deploy và không sửa kho dữ liệu thật. Gói cục bộ: releases/bao-an-learning-3.8.0-rc.9.zip; build 19fa3bb921d42cad; 67 tệp, 57 app assets, 6143086 byte. SHA-256: e29512b4d35713310440bbe74f4ed8e185a7720950adcbd432d0ce442deb4c3d. Bộ mẫu ZIP 172284 byte, SHA-256 9b6f19b0975dd4a8c7cfaea5a8101cb6b7078c23e0ae8d079a62d4ddd11d773f. Đã kiểm hash từng tệp, tải ZIP mẫu qua máy chủ cục bộ và xác nhận hai ZIP RC8 không đổi. Gói mã GitHub có manifest/hash riêng bên trong; hash ZIP được ghi ở releases/bao-an-learning-rc9-checksums.json.
