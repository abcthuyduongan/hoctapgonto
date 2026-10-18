# RC12 — tối ưu giao diện, nhập học liệu và đường xử lý dữ liệu

Ngày 18/10/2026 · Phiên bản `3.8.0-rc.12` · Build `de06e2fc1718f734`.

Đã hoàn thiện phần mã và kiểm thử cục bộ của đợt tối ưu. RC12 là **ứng viên dùng thử cục bộ**, chưa cập nhật Netlify. Chưa đủ bằng chứng để công bố hết lag hoặc hỗ trợ 30–100 học sinh đồng thời. Người dùng xác nhận chưa có Netlify/Supabase thử nghiệm riêng; không thử tải hay phục hồi lên dữ liệu thật.

## Thay đổi đã có

- Học sinh mặc định vào **Chế độ nhẹ**, dùng nền WebP tĩnh và nhân vật nhẹ. Đăng nhập không tải quản trị, importer, màn học sinh hoặc Three.js. Màn học sinh nhẹ không tải GLB, không tạo WebGL. Năm trò vẫn hoạt động theo bộ được giao và điều kiện tương thích.
- **Khám phá 3D** là tùy chọn ở màn chọn trò. Chỉ tải nhân vật, nền và một đảo đang chọn; thay đảo thì nhả tài nguyên cũ. Vào học, chuyển nhẹ hoặc rời màn thì dọn cảnh, texture, geometry và context. Cảnh đứng yên không duy trì RAF; lỗi cảnh trở về chế độ nhẹ. Không thêm nền 3D trong câu hỏi.
- Tài nguyên 3D được sinh từ bản gốc ở bước build, có hash và cache công khai bất biến. Giữ rig, skin và clip hoạt hình; giới hạn texture và số mặt. Bản gốc được giữ để tái tạo. Không dùng dung lượng GLB để suy ra toàn bộ RAM/VRAM.
- Luồng nhập giữ kết quả đọc workbook cho phiên nhập hiện tại; chỉ kiểm tra và tải ảnh/âm thanh được câu hợp lệ tham chiếu. Giải mã tối đa ba tệp đồng thời, gửi từng batch có giới hạn, hỗ trợ hủy và phân trang xem trước. Không giữ thêm bản base64 của toàn bộ kho.
- Sửa lỗi hash tạm giống nhau trong bước tiền kiểm khiến một số câu nghe khác nhau bị báo trùng sai. Tiền kiểm dùng định danh tạm riêng; kiểm tra cuối vẫn dựa trên hash tư liệu thật.
- Lật sai ở Trí Nhớ/Nối Từ tính 700 ms từ lần chọn thứ hai, chồng khoảng này lên thời gian chờ máy chủ. Vẫn khóa thao tác đến khi có ACK, giữ attempt khi gửi lại. Thoát trò dừng TTS/audio ngay cả khi yêu cầu đóng lượt còn chờ.
- Gộp truy vấn và tái dùng dữ liệu trong cùng request/giao dịch ở PostgreSQL. Giữ kiểm tra tài khoản đang hoạt động, phiên, quyền và khóa trước khi ghi. Kiểm tra metadata/quyền media được gộp; bucket vẫn riêng tư và phản hồi không cache.
- Có bộ đo tùy chọn `BAO_AN_PERFORMANCE_LOGS=1`, lấy mẫu mỗi 10 request và tối đa 30 dòng/phút/instance. Chỉ ghi số đo và nhóm route cố định, không ghi SQL, tham số, cookie, nội dung hay ID học sinh. Thời gian locking SQL bao gồm thực thi/mạng, không phải số đo thuần lock wait.

Luật sao từng câu, tối đa ba sao dùng chung giữa các trò, khóa tuần, đổi mật khẩu, biên nhận nghe, đồng hồ máy chủ và chống ghi lặp được giữ nguyên. Schema SQLite/PostgreSQL và protocol đều vẫn là 1. Không đổi vùng, gói phí, pool, mô hình khóa hay dữ liệu production.

## Số đo cục bộ

[Số liệu đã làm gọn](QA_RC12_SUMMARY.json) ghi cấu hình và phạm vi. Đây là kiểm thử fixture HTTP cục bộ/PGlite trên Windows Chrome và Edge; không phải Netlify/Supabase thật.

| Hạng mục | Kết quả |
| --- | --- |
| Tài nguyên đăng nhập | JS gzip 75.765 byte; CSS gzip 5.499 byte; gzip tính từ nội dung response cục bộ, không phải wire bytes Netlify |
| Chế độ nhẹ và vào bài | 0 request GLB, 0 WebGL context |
| GLB RC11 | Năm tệp 7.271.708 byte tải bắt buộc ở đường cũ |
| GLB RC12 | Tổng quan 1.084.520 byte; nhân vật + nền + đảo lớn nhất 2.000.688 byte; tổng năm bản sinh 3.355.224 byte |
| Ước lượng texture + geometry cảnh Trí Nhớ | 5.497.056 byte; chưa gồm toàn bộ heap, driver và VRAM |
| 30 lượt hoàn chỉnh qua năm trò, mỗi trình duyệt | Sau lượt 5 → 30: heap tăng Chrome 626.712 byte, Edge 499.520 byte; audio/canvas sau thoát đều 0; không còn lượt active; 8 câu vẫn chỉ có tổng 24 sao |
| 20 lần đổi nhẹ/3D | Sau mẫu 5 → 10: heap tăng Chrome 476.096 byte, Edge 440.432 byte; quay về nhẹ không còn canvas |
| Probe cuộn trong năm trò | Mỗi trò 1,2 giây: p95 khoảng 24,9–49,5 ms; vẫn có frame đơn lẻ 246–477 ms trong headless. Không dùng probe ngắn này để chứng nhận độ mượt máy RAM 4/8 GB hoặc thay trace 10–20 giây/máy thật |

File tác giả `BAO_AN_LOP3_TUAN01_MOT_FILE_140_CAU.xlsx` + 16 WAV: 17 tệp, tổng 1.039.466 byte. Xem trước gồm tải tư liệu mất **524 ms Chrome, 497 ms Edge** trong hai lượt fixture cục bộ. Nhận đúng **139/140 câu hợp lệ**, báo lỗi Excel **F122 — #NAME?**, tải 16 âm thanh trong một batch. Không sửa file tác giả hoặc xuất bản thử dữ liệu này. File có 10 môn, vượt quy định tuần mới 3–4 môn, tối đa 12 câu/môn; không tự cắt hay giao 139 câu như một tuần hợp lệ.

Benchmark helper 50 mẫu: đường đọc lặp cũ p50 34 ms/p95 40,17 ms; đường chuẩn bị mới gồm tiền kiểm và kiểm cuối p50 19,65 ms/p95 25,64 ms. Đây chỉ là parse/kiểm tra trong Node, không gồm mạng/DOM. Nút thắt gần năm phút không thể được quy toàn bộ cho parser.

Số truy vấn fixture tính cả actor HTTP:

| Luồng | RC11 | RC12 |
| --- | ---: | ---: |
| Đăng nhập | 16 | 13 |
| Tóm tắt | 5 | 4 |
| Tạo lượt đầu | 15 | 13 |
| Mở câu | 12 | 9 |
| Trả lời | 15 | 12 |
| Gửi lại đáp án | 12 | 10 |
| Chơi lại | 13 | 9 |

Media HTTP hiện hai truy vấn gồm actor và metadata có kiểm tra quyền. Số truy vấn giảm không tự chứng minh p95 cloud giảm tương ứng; cần đo vùng dịch vụ, kết nối, khóa và Storage thật.

## Kiểm thử đã đạt

- TypeScript, build production và kiểm tra tài nguyên đạt.
- **335/335** kiểm thử Node: renderer 110, release 10, online 173, cloud fixture 42.
- **130/130 ca duy nhất** trên Chrome/Edge: tổng hợp kết quả mới nhất theo tên ca từ lượt hồi quy đầu, lượt chạy lại 34 ca chịu ảnh hưởng và lượt xác minh cuối 6 ca. Không gọi đây là một lượt chạy sạch duy nhất. Các lỗi phát hiện trong lượt đầu đã được sửa và ca liên quan chạy lại đạt.
- Bao gồm năm trò, số vòng/cặp, tám dạng học liệu, giới hạn trò phù hợp, sao/khóa tuần, mật khẩu, media/clock/ACK, lỗi mạng, bố cục, nhập liệu/phân trang, dự phòng tải, vòng đời 3D và 30 lượt hoàn chỉnh. Mẫu Excel ZIP 36 câu đã thử giao đúng cấu hình tuần.
- Gói chạy độc lập và gói nguồn có SHA-256 riêng trong `releases/RC12_SHA256.txt`. Gói nguồn loại trừ cấu hình bí mật, dữ liệu tài khoản, kết quả chạy, node_modules và Git. Phiếu thao tác: [nghiệm thu RC12](NGHIEM_THU_CUC_BO_RC12.md).
- Kiểm tra chính ZIP RC12 sau đóng gói: đối chiếu hash 99 tệp, giải nén vào thư mục tạm ngoài workspace, chạy máy chủ không có node_modules của dự án. Khởi tạo DB rỗng, tạo lớp/học sinh giả, giải mã và tải WAV, mở trang/mẫu Excel đầy đủ, đăng xuất và kiểm tra phiên bị từ chối đều đạt. ZIP này không kèm học sinh hay câu hỏi thật.

Ảnh kiểm tra từ dữ liệu giả: [màn nhẹ](RC12_UI_QA/lite-hub.png), [trắc nghiệm nền tĩnh](RC12_UI_QA/lite-quiz.png), [3D tùy chọn](RC12_UI_QA/optional-3d.png). Hướng dẫn chuyển tiếp: [GitHub và staging RC12](CAP_NHAT_RC12.md).

## Những cổng còn mở trước production

1. Tạo Netlify/Supabase staging tách DB/Storage và dùng dữ liệu giả. Đo ít nhất 50 mẫu ấm/luồng, 10 lần tải đầu; xác minh build/runtime/protocol, region và bảng trước/sau cùng điều kiện. Không lấy tốc độ 0,5 giây cục bộ làm cam kết trên website.
2. Thử 30 học sinh giả trong ít nhất 20 phút; đạt mới thử 100 trong ít nhất 30 phút. Đo p50/p95, lỗi, lock wait, pool và Storage; công bố công suất theo mức thực sự đạt. Mô hình khóa workspace chưa thay đổi, có thể còn giới hạn đồng thời.
3. Ngâm hỗn hợp đủ 60 phút, trace tương tác dài hơn và nghiệm thu trên Windows RAM 4/8 GB thật, Chrome/Edge, zoom 100/125/150%. Bài 30 lượt nhanh và 20 đổi chế độ không thay thế bước này.
4. Phục hồi PostgreSQL + Storage vào môi trường cách ly, đo RPO/RTO; sau đó giáo viên/học sinh dùng thử và mới rollout từng nhóm có theo dõi/rollback.
5. Đo tóm tắt với dữ liệu 52 tuần và EXPLAIN trên PostgreSQL thật. RC12 giảm truy vấn lặp/marker, giữ phản hồi metadata tối đa 20 bộ/trang; **chưa chuyển toàn bộ tính hành trình lịch sử sang phân trang/aggregate SQL**. Chỉ thiết kế tiếp khi trace đủ, giữ tổng sao và điều kiện hoàn thành đúng trên toàn tuần.

Không thêm cache byte tư liệu riêng, không đổi chữ ký URL hoặc mô hình khóa khi chưa có trace. Manifest giữ `releaseReady:false`, `humanPilotStatus:UNVERIFIED`. Gói RC11 được giữ nguyên; rollback ứng dụng không đi kèm reset sao hay restore DB cũ.
