# Kế hoạch tối ưu tốc độ, bộ nhớ và giao diện học tập

Ngày 18/10/2026 · Mốc đối chiếu: RC11, commit `ecbcb6bf345d1ebddeaf1d6dbe879cdb94819613`.

**Trạng thái: đã triển khai phần mã và kiểm thử cục bộ trong RC12; chưa triển khai lên website.** Xem [báo cáo kết quả và phần còn mở](BAO_CAO_TOI_UU_RC12_2026-10-18.md). Người dùng xác nhận chưa có môi trường thử riêng. Thử tải cloud, ngâm đủ 60 phút, nghiệm thu máy thật và phát hành từng bước vẫn là điều kiện còn mở; không thay bằng kết quả localhost. Tài liệu này cụ thể hóa yêu cầu tiếp tục tối ưu sau khi người dùng phản ánh chậm đăng nhập, mở tuần, vào trò và giật giao diện trên Windows. Không thay luật học, số dư sao hoặc dữ liệu để làm nhanh kết quả đo.

## 1. Phương án được đề xuất

Giữ 3D, nhưng đưa ra khỏi đường tải bắt buộc để học. Mặc định vào **Chế độ nhẹ**: nền minh họa tĩnh, nhân vật nhẹ, đủ năm trò chơi và toàn bộ hình/âm thanh của câu hỏi. Có lựa chọn **Khám phá 3D** ở màn chọn trò; chỉ lúc chọn mới tải và dựng cảnh. Khi bắt đầu học, trở về nền tĩnh và giải phóng cảnh 3D.

Đồng thời tối ưu API, truy vấn và đường tải tư liệu riêng. Chỉ giảm đồ họa sẽ không giải quyết phần chờ máy chủ đã đo được. Không chuyển nền tảng, mua thêm dịch vụ hoặc viết lại toàn bộ ứng dụng ngay từ đầu; chỉ mở các nhánh phức tạp khi số đo chứng minh cần thiết.

| Luồng | Hành vi sau tối ưu |
| --- | --- |
| Mở website, đăng nhập | Chỉ tải giao diện đăng nhập; không tải màn giáo viên, bộ nhập tài liệu, Three.js hay GLB |
| Vào tuần | Lấy tóm tắt, số sao và danh sách bộ theo trang; chỉ một tuần hiện tại được học |
| Chọn trò ở Chế độ nhẹ | Nút chọn rõ ràng; không tạo WebGL, không tải mô hình, không chạy vòng vẽ nền |
| Chọn Khám phá 3D | Tải cảnh đang xem, nhân vật và phần nền cần thiết; không chờ đủ năm mô hình |
| Bắt đầu một trò | Tải mã trò song song với tạo lượt; bỏ cảnh 3D, chỉ giữ trò đang chơi và học liệu cần thiết |
| Đọc, nghe, trả lời | Bố cục tự căn theo nội dung; đồng hồ và sao vẫn do giao thức máy chủ kiểm soát |
| Thoát trò | Dọn audio, timer, request và nội dung lượt; đối chiếu tiến độ bằng dữ liệu nhỏ |
| Lỗi 3D | Trở về Chế độ nhẹ có thể học tiếp; không buộc tải lại toàn bộ trang |

Đây là đề xuất thay đổi cách hiển thị mặc định. Năm trò hiện có được giữ; không biến mỗi trò thành một cảnh 3D riêng.

## 2. Căn cứ thực tế và phần còn chưa biết

Chi tiết và chứng cứ cục bộ: [báo cáo chẩn đoán RC11](CHAN_DOAN_DO_TRE_THUC_TE_2026-10-18.md).

| Đã xác minh | Ý nghĩa với kế hoạch |
| --- | --- |
| Đăng nhập khoảng 4,76–7,08 giây ở các lượt đo ít mẫu | Phải đo riêng xác thực, kết nối và DB; chưa thể kết luận nguyên nhân là mật khẩu hay khởi động Function |
| Tạo lượt khoảng 2,66 giây, mở câu khoảng 2,66 giây | Có nhiều thời gian chờ dù phản hồi chỉ vài KB; tối ưu API phải làm song song với giao diện |
| Ảnh riêng tư 5.269 byte mất 2,162 giây; gần toàn bộ là đợi phản hồi | Thu nhỏ ảnh không đủ; cần tối ưu kiểm tra quyền, truy vấn và Storage |
| Năm GLB tải thực tế 7.271.708 byte, không có Content-Encoding trên Netlify | Chế độ chất lượng thấp hiện vẫn tải đủ tài nguyên; cần tải theo yêu cầu và làm nhẹ tài nguyên từ lúc build |
| Cảnh hiện giải mã đủ năm GLB và chuẩn bị shader trước khi sẵn sàng | Có cả tải mạng, giải mã, biên dịch và cấp phát GPU trên đường vào giao diện |
| Nền 3D tiếp tục vẽ khi đang học; chọn trò bằng nút vẫn dựng WorldCanvas | Phải có Chế độ nhẹ thực sự và vòng đời cảnh rõ ràng |
| Luồng đăng nhập khoảng 399 KB JS + 293 KB CSS chưa nén | Tách màn theo vai trò và tải bộ nhập tài liệu khi mở chức năng đó |
| Lật ô/Nối từ chờ API rồi mới cộng thêm 700 ms nếu ghép sai | Có phần chờ thừa có thể bỏ, vẫn cần giữ biên nhận máy chủ |

Các số API trên là một số quan sát, **không phải p95**. Tổng tạo lượt + ảnh + mở câu khoảng 7,48 giây là suy ra từ các yêu cầu đo riêng theo thứ tự phụ thuộc trong mã, chưa phải thời gian khung hình xuất hiện được đo trực tiếp.

Chưa có trace FPS/cuộn của tài khoản thật trên máy người dùng: công cụ trình duyệt vẫn trả `Local browser use is disabled in Work settings`, dù người dùng đã báo bật. Chưa xác định vùng thực tế của Netlify Functions/DB, thời gian chờ khóa, tải đồng thời và giới hạn gói dịch vụ. Các điểm này là đầu việc cần đo, không coi là nguyên nhân đã được chứng minh.

## 3. Mục tiêu nghiệm thu ban đầu

Đây là **mục tiêu đề xuất để đo trước/sau**, chưa phải kết quả hoặc cam kết tốc độ trên mọi mạng. Nếu đo cho thấy hạ tầng hiện tại không đáp ứng, phải báo nguyên nhân, lựa chọn và chi phí trước khi đổi dịch vụ; không âm thầm hạ tiêu chí hoặc ghi đã hoàn thành.

Hồ sơ máy chuẩn đề xuất: Windows, RAM 8 GB, GPU tích hợp, Chrome/Edge ổn định, 1366×768 và 1920×1080; mạng kiểm soát 10 Mbps tải xuống, 2 Mbps tải lên, RTT bổ sung 100 ms. Thêm máy RAM 4 GB để kiểm tra Chế độ nhẹ. Lưu CPU/GPU, phiên bản trình duyệt, điều kiện mạng thực tế trong báo cáo. Giả lập viewport/CPU trên máy mạnh chỉ là phép đo bổ sung.

| Chỉ tiêu | Mục tiêu ban đầu | Cách tính |
| --- | --- | --- |
| Phản hồi trực quan sau bấm nút | p95 ≤ 100 ms | Từ bấm đến hiện trạng thái đang xử lý; không đồng nghĩa request đã xong |
| Đăng nhập đến màn tuần dùng được, lượt ấm | p95 ≤ 4 giây | Từ bấm đăng nhập, không tính thời gian gõ |
| Mở tuần/đổi trang danh sách, lượt ấm | p95 ≤ 1,5 giây | Đến nội dung có thể bấm; không dựng toàn kho |
| Bấm vào trò đến câu đầu dùng được, lượt ấm | p95 ≤ 3 giây | Gồm tư liệu bắt buộc và mở đồng hồ; không tính thời lượng nghe bắt buộc |
| Lần đầu vào trò khi mã/tư liệu chưa có cache | Trung vị ≤ 5 giây | Ít nhất 10 lượt, báo cả min/max; tách trạng thái Function nếu quan sát được |
| API ấm: đăng nhập / tóm tắt và chọn trò | p95 ≤ 2,5 giây / ≤ 1 giây | Đo HTTP đầy đủ từ cùng vị trí mạng |
| API ấm: tạo lượt / mở câu, lưu đáp án | p95 ≤ 1,2 giây / ≤ 0,8 giây | Giữ nguyên xác thực, giao dịch và kiểm tra hợp lệ |
| GET ảnh riêng tư nhỏ, lượt ấm | p95 ≤ 0,8 giây | Gồm kiểm tra quyền và nhận hết body |
| Chế độ nhẹ từ lần mở trang mới | 0 GLB, 0 Three.js, 0 WebGL | Theo Network và context thực tạo; không chỉ ẩn canvas bằng CSS |
| Độ mượt tương tác trong Chế độ nhẹ | p95 frame-time ≤ 33 ms trên máy 8 GB, ≤ 50 ms trên máy 4 GB | Trace 10–20 giây cuộn/chọn đáp án/ghép thẻ từng trò sau warm-up; không tính khoảng đứng yên; không có long task > 100 ms do ứng dụng lặp lại |
| Nền khi đọc/trả lời | 0 khung hình 3D liên tục | Sau khi chuyển cảnh xong, đo ít nhất 5 giây; vẫn có timer chữ mỗi giây |
| Khám phá 3D ở mức thấp | 30 FPS ổn định khi chuyển động | Báo frame-time, giật dài, CPU/GPU; không dùng FPS để đánh giá màn tĩnh |
| Kiểm tra & xem trước Excel 140 câu | p95 ≤ 5 giây | Từ bấm đến bảng lỗi/câu hợp lệ; không gồm tải tư liệu lên mạng |
| 16 tệp âm thanh tổng dưới 1 MiB | Mục tiêu ≤ 20 giây ở lượt ấm | Đo đủ xác minh, tải và ACK; ghi rõ số byte, batch, mạng và giới hạn gói |

Mỗi luồng ấm cần ít nhất 50 mẫu để báo p50/p95 và số mẫu; lỗi phải báo riêng, không bỏ mẫu chậm/lỗi khỏi báo cáo. Lượt ấm phải ghi trạng thái mã giao diện, Function/kết nối quan sát được; không mặc định bỏ qua GET media riêng tư hoặc biên nhận nghe. Đo ít nhất 10 lượt đầu sau thời gian nghỉ, báo trung vị và khoảng; xóa cache trình duyệt không chứng minh Function đã khởi động lạnh. Tách thời gian nghe bắt buộc khỏi độ trễ kỹ thuật và vẫn báo tổng thời gian người dùng thực sự trải qua.

Benchmark đăng nhập dùng tài khoản giả và nhịp phù hợp giới hạn đăng nhập; không tắt rate limit hoặc đo lặp dồn trên tài khoản thật. Tách preview parse mới với đọc kết quả đã kiểm tra, upload tệp mới với đối chiếu tư liệu đã có; không lấy cache/dedup làm bằng chứng tốc độ lần nhập mới. Chốt các ngưỡng độ mượt theo cấu hình thực tại M0, rồi giữ nguyên khi so sánh trước/sau; dùng trace của trình duyệt độc lập với renderer để đo cả UI 2D.

## 4. Trình tự thực hiện và cổng hoàn thành

Các mốc là thứ tự phụ thuộc, không phải cam kết số ngày khi chưa có trace. Sau M0, giao diện và API có thể làm song song trên phạm vi tệp riêng; nghiệm thu chung trước phát hành.

| Mốc | Việc chính | Điều kiện hoàn thành |
| --- | --- | --- |
| M0 — Đo và cố định mốc so sánh | Instrument trình duyệt/API/DB/Storage; chuẩn bị dữ liệu staging, kịch bản và số dư đối chiếu | Có baseline cùng commit, máy, mạng, fixture và từng đoạn thời gian; log không lộ dữ liệu cá nhân |
| M1 — Giảm tải mặc định | Tách đăng nhập/quản trị/học sinh/importer; Chế độ nhẹ thực sự; sửa chờ thừa của game ghép cặp | Lần mở mới Chế độ nhẹ không tải 3D; đủ năm trò; không đổi sao/đồng hồ |
| M2 — Giảm độ trễ máy chủ | Gộp truy vấn cùng thao tác, phân trang ở SQL, tối ưu đọc media có quyền | Trace giảm thời gian/round-trip; kiểm thử quyền và race không suy giảm; so sánh cùng dữ liệu |
| M3 — Hoàn thiện 3D tùy chọn | Asset nhẹ khi build, tải cảnh đang xem, vẽ theo nhu cầu, dọn GPU | Không chờ đủ năm GLB; vào bài không còn renderer nền; đổi chế độ nhiều lần không tích lũy tài nguyên |
| M4 — Nhập liệu và bố cục | Đo/sửa preview Excel, media theo batch, bảng lỗi, căn nội dung từng trò | File ví dụ có báo vị trí lỗi; chỉ câu hợp lệ được nạp; đo thời gian/heap; không tràn thẻ |
| M5 — Đồng thời/hạ tầng nếu còn nghẽn | Thử tải staging; tối ưu khóa có thiết kế hoặc vị trí dịch vụ khi trace chứng minh | Qua race/deadlock/load test; có phương án tương thích và quay lui; không tăng phí chưa được chấp thuận |
| M6 — Nghiệm thu và phát hành | Máy Windows thật, đủ năm trò/loại nội dung, ngâm bộ nhớ, thử giới hạn rồi mở rộng | Báo cáo trước/sau, dữ liệu bảo toàn, cổng kiểm thử đạt, gói bàn giao và hướng dẫn rollback |

Nếu M1–M4 đã đạt mục tiêu và tải dự kiến, giữ thiết kế đơn giản; không thêm cache riêng, migration lớn hoặc thay hạ tầng chỉ để hoàn thành danh sách kỹ thuật.

## 5. Công việc giao diện và vòng đời 3D

### 5.1. Màn đăng nhập và chọn tuần

- Tách `OnlineScreen.tsx` thành ranh giới tải theo vai trò. Giao diện giáo viên, học sinh và bộ nhập tài liệu chỉ tải sau khi cần. CSS cũng đi theo màn; tránh tệp CSS chung kéo cả trang quản trị vào đăng nhập.
- Giữ `/status` và `/me` chạy song song như RC11; không thêm vòng gọi kiểm tra trùng hoặc polling. Không tải game, toàn ngân hàng hoặc media ở bước xác thực.
- Tóm tắt tuần trả metadata/số đếm; danh sách bộ tối đa 20 bộ/trang. Chi tiết sao từng câu chỉ mở khi chọn bộ. Gộp request giống nhau đang chạy nhưng làm mới sau ghi dữ liệu thành công.
- Đặt ngân sách tải đăng nhập đề xuất: tổng JS gzip ≤ 100 KiB, CSS gzip ≤ 20 KiB; minh họa nếu có ≤ 150 KiB. Kiểm tra cả phụ thuộc tải gián tiếp, không chỉ kích thước tệp entry.

### 5.2. Chế độ nhẹ

- Tại `StudentScreen.tsx` / `OnlineStudentWorld.tsx`, nhánh nhẹ không import renderer theo đường chạy, không mount `WorldCanvas`. Dùng nền/nhân vật tĩnh có kích thước hợp lý, không video nền hoặc nhiều lớp blur/shadow liên tục.
- Hai lựa chọn đơn giản: Chế độ nhẹ và Khám phá 3D. Ghi nhớ lựa chọn hiển thị theo thiết bị; chỉ lưu sở thích, không lưu học liệu hoặc thông tin đăng nhập. Tôn trọng giảm chuyển động; không tự ép trở lại 3D sau khi người dùng chọn nhẹ.
- Giữ preload mã trò song song với `playCompact`. Dừng tải cảnh không cần khi vào bài; không tải sẵn tất cả trò, tuần hoặc hình câu tiếp theo.
- Nếu đã mở 3D rồi chuyển về nhẹ, JS đã nạp có thể còn trong bộ nhớ module của trình duyệt; điều cần bảo đảm là không còn cảnh/context/tài nguyên đang sở hữu. Tiêu chí 0 request Three.js áp dụng cho lần mở mới chạy hoàn toàn ở chế độ nhẹ.

### 5.3. Cảnh 3D khi người dùng chủ động mở

- `PremiumWorldRenderer.ts` tải manifest nhỏ trước, sau đó chỉ đảo đang xem + nhân vật + nền chung cần thiết; tối đa hai công việc tải/giải mã mô hình đồng thời. Cảnh kế tiếp chỉ tải khi người dùng chuyển tới, có hủy/bỏ kết quả cũ khi chuyển nhanh.
- Tạo tài nguyên mức thấp lúc build: giảm mesh, kích thước/độ trùng texture, atlas nếu có lợi; đo cả byte mạng và chi phí giải mã. Đánh giá định dạng nén chuyên dụng bằng thử nghiệm nhỏ trước khi thêm decoder/phụ thuộc.
- Mục tiêu cảnh 3D đầu ở mức thấp ≤ 2 MiB byte tải thực. Tổng texture đã giải mã, mipmap và buffer hình học của cảnh hoạt động mục tiêu ≤ 32 MiB theo bộ đếm ước lượng; đây không phải tổng RAM/VRAM của ứng dụng.
- Giữ rig/animation nhân vật cần thiết như Idle/Cheer/Victory. Không thay thẳng bằng `fox-guide-mobile.glb` nếu hợp đồng animation chưa đáp ứng.
- Chỉ biên dịch shader cho chất lượng đang dùng; không chờ cả cấu hình có/không bóng trước khi dùng được. Ưu tiên bản mô hình nhẹ khi build thay vì tính LOD nặng trên luồng chính sau khung hình đầu.
- Mức thấp giới hạn DPR 1 và 30 FPS khi cần chuyển động; bóng thời gian thực tắt. Mức cân bằng được nâng sau phép đo thiết bị; không xem chiều rộng cửa sổ là bằng chứng máy mạnh. Tín hiệu cấu hình chỉ hỗ trợ lựa chọn, không thay nghiệm thu thiết bị thật.
- Cảnh đứng yên chỉ vẽ khi camera, nội dung, kích thước hoặc phản ứng ngắn thay đổi; chỉ một RAF chờ. Tab ẩn dừng chuyển động. Cách này theo hướng dẫn [Three.js về vẽ khi cần](https://threejs.org/manual/pages/rendering-on-demand.html).

**Quyết định vòng đời:** chỉ một renderer/context khi đang khám phá. Khi vào bài hoặc chọn nhẹ, chụp/dùng nền tĩnh đã chuẩn bị rồi dừng animation, hủy tác vụ, tháo listener và giải phóng tài nguyên 3D. Quay lại khám phá thì khởi tạo lại từ tài nguyên công khai có cache trình duyệt. Tạm dừng không được mô tả là đã giải phóng GPU.

Phải có chủ sở hữu/ref-count cho texture, geometry, skeleton dùng chung để không giải phóng hai lần hoặc giữ vô hạn; dọn material, texture, render target, renderer, ImageBitmap khi hết người dùng. Chỉ xóa mesh khỏi scene không đủ theo [hướng dẫn giải phóng của Three.js](https://threejs.org/manual/pages/how-to-dispose-of-objects.html). Ngăn kết quả tải cũ gắn lại vào cảnh đã đóng.

### 5.4. Phục vụ tài nguyên trên Netlify

- Đặt tên/hash phiên bản cho tài nguyên công khai bất biến và cache đúng loại. Không áp dụng cache đó cho API hoặc media học sinh có quyền.
- Luồng online hiện gỡ service worker thuộc ứng dụng và dọn cache ứng dụng trước xác thực; giữ hành vi này trong phạm vi tối ưu. Không bật lại precache mọi mô hình/tuần để làm nhanh lượt sau. Worker của gói cục bộ/offline là luồng khác, cần nghiệm thu riêng nếu bị thay đổi.
- Không coi việc thêm `Content-Encoding: br` vào `netlify.toml` là lời giải: Netlify cho biết custom header này thường bị bỏ qua. Xem [giới hạn custom headers](https://docs.netlify.com/manage/routing/headers/).
- Ưu tiên giảm tài nguyên thật tại build. Nếu thử transport nén, dùng cách nhà cung cấp hỗ trợ, đo header/byte thực trên URL đã deploy và kiểm tra hash sau giải mã cùng fallback. Middleware local không chứng minh Netlify hoạt động tương tự.
- Không đưa GLB qua Function chỉ để nén khi chưa chứng minh có lợi; có thể thêm một chặng chờ và chi phí vận hành.

## 6. Công việc API, DB và tư liệu riêng tư

### 6.1. Đo trước khi đổi cấu trúc

Gắn mã request không mang danh tính và thời gian tổng/đợi pool/SQL/xác minh mật khẩu/Storage/serialize. Đo riêng truy vấn có khóa; chỉ gọi là thời gian đợi khóa khi đã đối chiếu PostgreSQL wait events/khóa, không gán toàn bộ thời gian `FOR UPDATE` cho lock wait. Ghi số truy vấn, byte và trạng thái Function khởi tạo nếu quan sát được; tổng hợp mẫu có giới hạn và thời hạn lưu. Không ghi mật khẩu, cookie, token, prompt, đáp án, URL có chữ ký hoặc ID học sinh nguyên dạng. Thông tin chẩn đoán chi tiết không công khai ra client.

Mốc so sánh PostgreSQL fixture RC11 gồm cả actor HTTP: đăng nhập 16 truy vấn; tóm tắt 5; tạo lượt sau hành trình 14; mở câu 12; trả lời 15. Đây là đếm fixture, không phải trace SQL production. Không tối ưu chỉ bằng số query nếu tổng thời gian/độ đúng không cải thiện.

### 6.2. Giảm số lượt đi về máy chủ

- Tại `postgres-store.mjs`, gộp đọc play/student/journey/assignment/content-version qua truy vấn tham số hóa phù hợp; tái dùng dữ liệu chỉ trong cùng request/giao dịch. Giữ tái kiểm tra phiên và trạng thái học sinh trong giao dịch ghi.
- Đăng nhập: loại đọc tài khoản lặp nếu trace xác nhận; giữ giới hạn thử mật khẩu, hash an toàn và xử lý tranh chấp đổi/reset mật khẩu. Không giảm độ mạnh hash để đạt chỉ tiêu. Dọn phiên hết hạn có thể chuyển thành tác vụ bảo trì hữu hạn, nhưng mỗi lần đọc vẫn kiểm tra hạn phiên.
- Tóm tắt: lọc/phân trang ở SQL và dùng aggregate tuần hiện tại. Hiện server đã cắt trang phản hồi nhưng vẫn tính toàn bộ lịch sử trước đó; cần giảm cả công việc này, không chỉ giảm JSON gửi về. Điều kiện hoàn thành tuần vẫn tổng hợp đúng mọi câu, không chỉ trang đang xem. Đo với dữ liệu 52 tuần và nhiều lượt, dùng EXPLAIN trên staging.
- Với marker hành trình đang đọc/sắp xếp log trong JS, ưu tiên truy vấn/chỉ mục có ích. Chỉ thêm bảng hành trình nếu trace cho thấy cần; migration thêm mới, backfill đối chiếu và đường quay lui tương thích.
- Không bỏ bước mở câu hoặc mở sẵn đồng hồ từ lúc tạo lượt để giảm một request. Nếu cần thay giao thức, thiết kế và nghiệm thu riêng với phiên bản rõ ràng.

### 6.3. Media

- Gộp kiểm tra quyền và metadata thay cho truy vấn tồn tại rồi đọc lại cùng tệp; bảo toàn quyền theo workspace, lớp, tuần và lượt chơi được phép. Một ảnh nhỏ vẫn phải qua kiểm tra quyền mới cho mỗi lần phục vụ.
- Đo riêng đoạn Netlify → DB và Netlify → Supabase Storage; giảm round-trip chứ không chỉ nén JSON. Bucket tiếp tục riêng tư, qua đường có xác thực và `no-store`.
- Nếu trace xác nhận ảnh lớn/giải mã là vấn đề, ảnh mới có thể sinh biến thể 256/512/1024 theo nhu cầu hiển thị, giữ bản gốc, tỷ lệ, alt và hash phiên bản. Không sinh hàng loạt mọi biến thể cho kho cũ ở bước đầu. Ảnh trong câu được ưu tiên hơn đồ họa trang trí. Đây là tối ưu tải, không tự từ chối mọi ảnh vượt một ngưỡng nén mới.
- Âm thanh tải khi cần, một player hoạt động; dừng và nhả decoder khi thoát. Giữ biên nhận tải/độ dài bắt buộc của giao thức nghe. Không thêm cache audio Blob làm bỏ qua biên nhận mới.
- Chưa thêm cache byte riêng ở giai đoạn đầu. Không public bucket, không cache quyền, không cache API đăng nhập/đáp án, không đưa bí mật vào trình duyệt. URL ký sẵn chỉ xem xét bằng thiết kế quyền/thu hồi/biên nhận riêng nếu proxy vẫn là nút thắt sau tối ưu.

### 6.4. Đồng thời và vị trí dịch vụ — chỉ làm khi có bằng chứng

Hiện mọi thao tác mutate khóa workspace `FOR UPDATE`; nhiều học sinh có thể phải chờ nhau. Pool đang nhỏ, nhưng tăng pool không tự giải quyết khóa toàn workspace.

Nếu trace xác nhận nghẽn khóa, thiết kế khóa theo phạm vi: thao tác học sinh có guard workspace dùng chung và khóa riêng học sinh/người dùng; thao tác quản trị ảnh hưởng chung cần khóa độc quyền thích hợp. Lập thứ tự khóa duy nhất cho ghi đáp án, đổi/reset mật khẩu, đăng xuất, khóa tài khoản, chuyển lớp, xuất bản tuần, chuyển tuần và đổi quà. Không đổi một dòng `FOR UPDATE` thành `FOR SHARE` rồi coi là hoàn tất.

Phải có kiểm thử PostgreSQL thật về race/deadlock, cùng requestId khác requestId, cùng câu nhiều thiết bị và quản trị đồng thời. Đưa thay đổi vào cờ riêng, migration tương thích nếu có. Chỉ chỉnh pool theo số Function đồng thời và ngân sách connection thực của DB.

Xác minh vùng thực của Function/DB/Storage và gói đang dùng trước khi đề nghị đặt gần nhau. Khả năng đổi vùng phụ thuộc dịch vụ/gói; đối chiếu [cấu hình Netlify Functions](https://docs.netlify.com/build/functions/configuration/?fn-language=js) và [kết nối PostgreSQL Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres). Mọi đổi vùng, gói phí, chuyển dữ liệu hoặc thay kết nối phải có đánh giá chi phí, tương thích driver/pooler, kế hoạch thử và quay lui riêng.

## 7. Ngân sách dữ liệu và bộ nhớ

KiB/MiB trong bảng là đơn vị 1024. Byte tải mạng, heap JS, ảnh giải mã và GPU là các số khác nhau; không suy RAM từ dung lượng GLB/ZIP. Giới hạn hiện hữu giữ nguyên trừ khi có đề xuất thay đổi được chốt riêng.

| Thành phần | Giới hạn/vòng đời đề xuất |
| --- | --- |
| Danh sách bộ câu hỏi | Metadata, tối đa 20 bộ/trang; chi tiết theo bộ đang mở, không dựng 52 tuần nội dung |
| Lượt chơi | Chỉ một lượt hiển thị; câu hiện tại hoặc vòng ghép cặp hiện tại; không tải nền toàn bộ ngân hàng |
| Bảng ghép cặp | Tối đa 4 cặp/màn nhỏ, 6 cặp/màn lớn; chia vòng cân bằng, không mất câu hoặc đổi ID |
| API tiến độ | Số đếm và delta nhỏ; không đọc lại toàn bộ ví/hành trình sau mỗi đáp án |
| Cảnh 3D | Một cảnh/context hoạt động khi khám phá; vào học/nhẹ thì giải phóng; không giữ nhiều cảnh đã giải mã |
| Cache riêng tư mới | Ban đầu tắt. Nếu thật sự cần: chỉ ảnh, tối đa 8 MiB byte Blob và 8 mục/phiên, TTL tối đa 5 phút, LRU; tệp quá lớn bỏ qua cache |
| Phạm vi cache ảnh nếu được thêm | Account + workspace + media hash/version; xóa khi logout/đổi tài khoản/phiên hết hạn và đồng bộ sự kiện qua tab; không cache quyền, audio hoặc đáp án |
| Cache ảnh trên server nếu được thêm | Ban đầu tắt; trần 8 MiB và 8 mục mỗi instance, TTL tối đa 60 giây, chỉ byte hash bất biến sau xác thực mới; kiểm tra lại quyền mỗi request; tính tổng theo số instance |
| Chọn tư liệu nhập | Tối đa 100 tệp, tổng 32 MiB; giữ File gốc thay vì nhân bản base64 toàn bộ |
| Kiểm tra/tải tư liệu | Giải mã tối đa 3 tệp đồng thời; cloud giữ 2 MiB/tệp và mỗi batch, SQLite 8 MiB/tệp; chỉ tạo base64 cho batch đang gửi |
| Request, audio, timer | Hủy phần không còn dùng; một audio; dừng TTS/timer/observer/listener và revoke Object URL khi hết chủ sở hữu |

Nếu thêm cache Blob, trần byte Blob không bao gồm bộ nhớ ảnh đã giải mã; cần đo và nhả phần giải mã riêng. Chỉ tái dùng sau khi thao tác màn học được xác thực thành công; nhận 401/403/logout/đổi tài khoản thì dọn ngay tư liệu hiển thị và cache. Không hứa thu hồi tức thì ảnh đã nhận khi client chưa nhận tín hiệu; không coi TTL cache là kiểm tra quyền. Trình duyệt cache tệp công khai có hash khác với cache tư liệu học sinh.

Thử 30 lượt vào/thoát game, 20 lần đổi nhẹ/3D và 60 phút học hỗn hợp. So sánh retained heap sau cùng điều kiện GC từ lượt 5 đến 30: mục tiêu tăng ≤ 10 MiB, không tăng đều theo lượt. Đối chiếu DOM, listener, audio, RAF, context, geometry/texture; một số đo heap ổn định không chứng minh tuyệt đối không rò hoặc phản ánh đủ VRAM. Không cần nút “dọn RAM” cho học sinh.

## 8. Nhập Excel, âm thanh/hình ảnh và căn nội dung trò chơi

### 8.1. Luồng nhập một lần, báo lỗi rõ ràng

1. Chọn lớp/tuần từ danh sách; chọn Excel và toàn bộ hình/âm thanh cùng khu vực nhập. Đối chiếu tên/hash tư liệu một lần, hiển thị trạng thái đã ghép, thiếu, trùng hoặc hỏng.
2. Đọc/chuẩn hóa workbook một lần. Cache kết quả chỉ cho phiên nhập hiện tại theo file + lựa chọn + phiên bản parser; sửa lựa chọn phải vô hiệu đúng phần. Không parse lại toàn bộ khi mở một hàng xem trước.
3. Kiểm tra `null`, chuỗi đánh dấu `null` và ô trống theo từng trường, kiểu dữ liệu, đáp án, nội dung và media. Trường bắt buộc thiếu/null là lỗi; trường tùy chọn không dữ liệu thì bỏ trường, không hiện chữ `null`. Không coi số 0 hoặc `false` hợp lệ là thiếu; không xóa từ nằm trong một câu văn chỉ vì chứa các ký tự đó.
4. Bảng lỗi có sheet, hàng, cột, mã câu nếu có và cách sửa; tổng hợp số hợp lệ/lỗi. Không tải câu lỗi hoặc media chỉ phục vụ câu bị loại. Chỉ nạp tập câu hợp lệ sau thao tác rõ ràng; nếu tập đó chưa đủ quy định tuần thì báo cần bổ sung, không âm thầm cắt câu hay tự xuất bản tuần thiếu.
5. Preview danh sách phân trang, chi tiết chỉ dựng khi mở; ảnh thu nhỏ, audio không tự phát/tải hàng loạt. Có tiến trình và hủy thật, không phần trăm giả hoặc spinner vô hạn.
6. Đo main-thread task; nếu parse/validate chiếm tác vụ > 50 ms lặp lại, đưa phần xử lý dữ liệu sang worker hoặc chia lô. Chỉ thêm worker khi trace cho thấy có lợi; không đưa DOM/audio API không tương thích vào worker.
7. Upload batch hữu hạn, không gửi lại tệp hash đã xác nhận nếu còn quyền/hợp lệ; khi retry media đối chiếu tên + SHA-256 và metadata được phép đọc, không giả định endpoint upload hiện có requestId. Giao/xuất bản tuần dùng requestId để tránh ghi lặp. Chỉ tạo base64 batch hiện tại; phân biệt “đã kiểm tra”, “đã tải tệp” và “đã giao tuần”.

File ví dụ 140 câu dùng để nghiệm thu preview và chỉ rõ lỗi; không tự coi toàn bộ file đủ cấu hình tuần mới. Tuần mới vẫn 3–4 môn, tối đa 12 câu/môn. Giữ ID và lịch sử bộ cũ, không cắt/gộp/xóa tự động. Mẫu mới chỉ Excel; gói ZIP đầy đủ gồm workbook, hình, âm thanh và hướng dẫn, đồng thời cho tải Excel riêng. Không tạo thêm mẫu Word.

### 8.2. Căn nội dung theo trò và màn hình

- Dùng chung quy tắc khoảng trống, chiều cao vùng chơi, cỡ chữ tối thiểu và tỷ lệ ảnh; từng trò có cấu hình phù hợp. Đo vùng còn lại sau header/thanh công cụ thay vì chỉ theo chiều rộng.
- Trắc nghiệm: giới hạn ảnh bằng `object-fit: contain`, giảm cỡ chữ/ảnh trong phạm vi đọc được, bố trí đáp án theo không gian. Mục tiêu câu thông thường thấy đầy đủ câu/ảnh/đáp án trên 1366×768; câu rất dài được cuộn có kiểm soát, không thu chữ đến mức khó đọc hoặc cắt nội dung.
- Trí Nhớ/Nối Từ: nội dung nằm trong thẻ, ảnh có trần chiều cao, text wrap đúng; bảng theo số cặp và diện tích. Đo dài/ngắn, tiếng Việt có dấu, ảnh dọc/ngang, zoom 125–150%; không dùng tràn ẩn để che mất ý chính.
- Ghép Câu/Quy Luật: chỉ token/câu hiện tại, nút và vùng kéo/bấm không chồng lấn; vẫn có thao tác bằng bấm/phím, không phụ thuộc hiệu ứng.
- Với ghép sai, 700 ms bắt đầu từ lần chọn thứ hai; khi máy chủ xác nhận chỉ chờ `max(0, 700 ms - thời gian đã trôi)`. Không mở bảng trước ACK, không gửi lỗi lặp; mất mạng giữ trạng thái và cho gửi lại đúng attempt.
- Âm thanh Việt: chỉ chọn giọng `vi` thực có; không tự đọc bằng giọng ngoại ngữ. Thiếu giọng thì thông báo hoặc dùng audio tác giả nếu có. Dừng đọc khi đổi câu/thoát, không phát chồng.

## 9. Các luật học và dữ liệu phải được bảo toàn

- Một câu nguồn tối đa 3 sao, dùng chung mọi trò và phiên bản cùng nguồn. Từ 1 lên 3 chỉ cộng 2; gửi lại, nhiều thiết bị hoặc hoàn tất lượt không phát thêm lần nữa. Không gộp tự động hai câu chỉ vì chữ giống nhau.
- Mọi câu của tuần đạt ít nhất 2 sao mới đủ điều kiện chuyển. Báo số câu 2 sao để chọn ôn; chỉ sang tuần sau khi xác nhận rõ tuần cũ bị khóa. Không chuyển tự động, vượt tuần hoặc vào tuần rỗng.
- Bộ chỉ mở trò tương thích với toàn bộ câu và `allowedGameIds`. Preview giải thích câu nào không phù hợp; đề nghị người soạn chia nhóm. Không âm thầm bỏ câu để cho một trò chạy, không tạo nguồn sao mới khi chia màn.
- Giữ giới hạn tuần mới và dữ liệu cũ, số dư/ledger/đổi quà/lịch sử; chỉnh lời giải không reset sao, đổi nội dung học phải dùng quy tắc ID hiện có. Không cân lại ngân sách đổi quà trong bản tối ưu hiệu năng.
- Giữ HttpOnly session, Origin/CSRF, kiểm tra quyền trong giao dịch, thu hồi sau đổi mật khẩu/khóa tài khoản, phân cách workspace và media riêng tư. Học sinh tự đổi mật khẩu vẫn hoạt động.
- Ảnh phải sẵn sàng trước mở đồng hồ; nghe bắt buộc vẫn cần biên nhận và thời lượng hợp lệ. Không prefetch nội dung/đáp án câu tương lai để “nhanh giả”; không tin `elapsedMs` do client tự khai.
- Đo ảnh hưởng mạng tới sao tốc độ. Nếu sau tối ưu vẫn bất công đáng kể, báo thiết kế đồng hồ riêng có mốc máy chủ, giới hạn và chống phát lại; không tự đổi ngưỡng sao hoặc cho client quyết định thời gian.
- Giữ tương thích cả SQLite cục bộ và PostgreSQL cloud. Không dùng kết quả PGlite/localhost để khẳng định Netlify hoặc PostgreSQL thật chịu tải tốt.

## 10. Ma trận kiểm thử và cách xử lý lỗi

| Nhóm | Trường hợp bắt buộc / bằng chứng |
| --- | --- |
| Chức năng học | Đủ 5 trò; bộ 2/4/6/7/13 câu/cặp và bộ lớn được phép; chia vòng không mất/nhân câu, không còn màn một cặp cuối bất hợp lý |
| Nội dung | Text ngắn/dài, số/điền, đọc/nghe, ảnh dọc/ngang, WAV/MP3/OGG, null/thiếu/hỏng, câu chỉ hợp 1–2 trò |
| Bố cục | Windows Chrome và Edge, 1366×768/1920×1080, zoom 100/125/150%, màn nhỏ; thao tác chuột/phím, không tràn chữ/thẻ |
| Tốc độ/độ mượt | Tải đầu/tải lại, đăng nhập, mở tuần, vào câu, tải ảnh/audio, lưu đáp án, thoát; trace cuộn/chọn/lật thẻ 10–20 giây từng trò ở Chế độ nhẹ, Network + trace từng tầng và bảng trước/sau |
| Lỗi mạng | Chậm, offline giữa request, timeout, media 403/404/hỏng, bấm lặp, đổi tuần khi request cũ đang chạy, deploy khi tab cũ mở |
| Nhất quán | Sai→sửa, hint, nghe, retry mất ACK, hai thiết bị cùng câu, đổi/reset mật khẩu, khóa tài khoản, chuyển tuần đồng thời |
| Bộ nhớ | 30 lượt game, 20 đổi chế độ, 60 phút hỗn hợp; heap/DOM/listener/audio/RAF/context/GPU theo cùng kịch bản |
| Nhập liệu | Excel mẫu đầy đủ; file thật 140 câu + 16 audio; báo đúng ô lỗi, không tải câu lỗi, không mất câu hợp lệ, peak heap/batch hữu hạn |
| Triển khai | UI/API đúng build và protocol, cache cũ/tab cũ, local ZIP giải nén chạy độc lập; không lẫn tài khoản/dữ liệu staging và production |

Tài khoản thật hiện có học liệu phù hợp ba trò: Đảo Câu Hỏi, Trí Nhớ, Nối Từ. Hai trò còn lại dùng fixture staging đúng quyền/tuần, không vượt khóa để test. Bộ test renderer cũ đang mặc định tải năm GLB phải đổi hợp đồng: nhẹ = không GLB/context; 3D = tải đúng phần cần, tối đa một context.

Đưa test nhẹ/3D/lifecycle và ngân sách hiệu năng vào **suite thực sự chạy khi phát hành**. Hiện `test:online:browser` chọn tên bằng regex `online(?:-[a-z]+)?\.spec\.ts$`; `tests/visual/performance-world.spec.ts` không tự được chạy bởi lệnh đó. Cần tên test phù hợp cấu hình hoặc script/config riêng được nối vào release gate, và kiểm tra báo cáo có các ca mới; không chỉ sửa một test nằm ngoài suite rồi coi đã nghiệm thu.

Thử tải trên staging với học sinh giả: 30 học sinh trong ít nhất 20 phút; chỉ khi đạt mới thử 100 trong ít nhất 30 phút. Bổ sung kịch bản hỗn hợp 60 phút theo quy hoạch nghiệm thu hiện có. Có think-time thực tế và burst đầu giờ; đo p50/p95, lỗi, lock wait, pool, kết nối DB, Function và Storage. Không stress test tài khoản thật/website đang học. Mức công bố hỗ trợ bằng mức thực sự đạt, không mặc định 100.

Trong bài tải kiểm soát: không mất/nhân sao, không deadlock/timeout/5xx; mục tiêu độ trễ không quá 2 lần chỉ tiêu đơn người dùng ở mức tải được công bố. Nếu chưa đạt thì dừng tăng tải, xác định điểm nghẽn và công suất an toàn; không kéo dài timeout hoặc retry dồn để che lỗi.

Trạng thái chờ phải hiện ngay, cho hủy/thoát khi phù hợp. Hủy fetch ở client không đồng nghĩa giao dịch server bị hủy: trước khi gửi lại phải đối chiếu khóa chống lặp/receipt theo endpoint — requestId cho mở lượt/chuyển tuần/xuất bản, attemptKey cho đáp án, tên + hash cho media. Retry có giới hạn và backoff cho lỗi tạm thời; lỗi quyền/validation phải báo đúng nguyên nhân. Không mở nhiều lượt, lặp request vô hạn hoặc tự cộng sao khi mất mạng. Khi thoát có thể đổi màn trước lúc đối chiếu xong chỉ nếu thiết kế đã khóa gửi thêm, giữ receipt và có xử lý xung đột; không coi đây là cách xóa thời gian backend.

## 11. Phát hành, theo dõi và quay lui

1. Mỗi nhóm thay đổi có diff và bằng chứng riêng. Cờ hiển thị nhẹ/3D độc lập với cờ tối ưu DB/khóa; giá trị mặc định an toàn. Thay đổi protocol không tương thích phải tăng phiên bản, xử lý tab cũ bằng thông báo tải lại và không mất attempt đang chờ.
2. Giữ nguyên các ZIP RC11 để đối chiếu. Kiểm tra backup hiện tại và thử restore trên môi trường tách biệt trước migration; không ghi đè DB đang học để thử khôi phục. Không đưa bí mật/dữ liệu học sinh vào gói nguồn.
3. Chạy kiểm thử liên quan sau từng nhóm sửa; chạy typecheck, test chức năng/cloud, kiểm tài nguyên, build và browser regression đầy đủ trước gói bàn giao. Lấy lệnh chính xác từ `package.json`, cập nhật test phản ánh kiến trúc mới thay vì giữ yêu cầu cũ sai mục tiêu.
4. Deploy staging có DB/Storage tách biệt; xác nhận commit/build/runtime/protocol thống nhất và đo URL thực. Đạt staging mới cho một nhóm nhỏ dùng thử, mặc định nhẹ; mở rộng sau khi đủ bằng chứng Windows thật và tải dự kiến.
5. Mốc theo dõi sau phát hành: chậm p95 tăng trên 20% so với bản nghiệm thu qua hai cửa sổ có đủ mẫu thì điều tra; lỗi 5xx trên 1%/5 phút khi có ít nhất 100 request, hoặc ít nhất 5 lỗi/5 phút ở lớp nhỏ thì dừng mở rộng. Bất kỳ mất/nhân sao, lộ quyền, bỏ khóa tuần hoặc crash lặp lại đều dừng ngay.
6. Quay lui bằng tắt cờ/thay bản ứng dụng tương thích đã kiểm tra. Không reset ví, xóa lượt hoặc restore DB cũ như thao tác rollback thông thường. Nếu migration không còn tương thích với RC11, phải ghi rõ giới hạn rollback và chuẩn bị bản sửa tương thích trước rollout.
7. Bàn giao phiên bản mới riêng: ZIP chạy cục bộ, ZIP mã nguồn, hash SHA-256, commit, ghi chú phát hành, hướng dẫn GitHub/Netlify, gói Excel mẫu đầy đủ và báo cáo trước/sau. Không ghi đè gói cũ hoặc dùng số build khác để chứng minh cho bản đang phát hành.

Các thay đổi phát sinh chi phí, chuyển vùng/dữ liệu hoặc thay luật học cần phương án cụ thể và quyết định của chủ dự án trước khi thực hiện phần đó. Công việc đo/chuẩn bị/staging và sửa trong phạm vi đã được chốt không cần hỏi lại từng thao tác thường lệ. Tài liệu kế hoạch hiện tại không tự triển khai hoặc tạo tác vụ chạy định kỳ.

## 12. Định nghĩa hoàn thành và thứ tự ưu tiên chốt

- [ ] Có bảng baseline và sau tối ưu cùng điều kiện, đủ mẫu, liên kết chứng cứ và commit.
- [x] Đăng nhập/mở tuần không kéo theo quản trị, importer hoặc 3D; Chế độ nhẹ có đủ năm trò (đã kiểm thử cục bộ).
- [x] Khi học không còn nền 3D chạy liên tục; cảnh tùy chọn tải theo nhu cầu và được giải phóng đúng (đã kiểm thử cục bộ).
- [ ] Đạt mục tiêu tốc độ đã thống nhất trên Windows thật; phần chưa đạt có nguyên nhân và phương án rõ ràng.
- [x] Nhập file ví dụ báo chính xác lỗi và cho nạp câu hợp lệ; không mất câu, không tạo base64/audio/ảnh hàng loạt vô hạn. File 140 câu chỉ nghiệm thu xem trước vì vượt giới hạn tuần mới; mẫu 36 câu đã thử giao hợp lệ.
- [ ] Đủ test sao/khóa tuần/tương thích game/đổi mật khẩu/media/clock/retry, cả SQLite và PostgreSQL thật ở nơi cần.
- [ ] Bài tải staging và bài ngâm bộ nhớ đạt ở quy mô được công bố; không suy rộng từ test local.
- [ ] Có pilot, rollback tương thích, gói mới, mẫu Excel và báo cáo nghiệm thu; không ghi “hết mọi lỗi”.

**Ưu tiên thực hiện:** đo và chuẩn bị staging → Chế độ nhẹ/tách tải + tối ưu API song song → 3D tùy chọn và dọn tài nguyên → nhập liệu/bố cục → tải đồng thời và xử lý hạ tầng nếu còn cần → nghiệm thu máy thật và phát hành từng bước. Không coi bỏ 3D, tăng pool, cache mọi dữ liệu, giảm bảo mật hay tăng timeout là phương án thay thế cho các bước này.

Kế hoạch này bổ sung phần hiệu năng cho [phạm vi vận hành RC10](PHAM_VI_VA_VAN_HANH_RC10.md) và [báo cáo tối ưu RC11](DO_TRE_VA_TOI_UU_RC11_2026-10-18.md). Nếu tài liệu kế hoạch cũ còn phương án sao/tuần khác, áp dụng luật đã chốt ở mục 9 và phạm vi hiện hành; không khôi phục đề xuất cũ.
