# Đánh giá lại bộ mới — kiểm toán lần 2, 06/11/2026

**Điểm tạm tính: 60/100. Chưa đủ điều kiện “FINAL LOCK” hoặc phát hành chính thức.**

Bộ mới sửa được nhiều đường lỗi đã báo: hết giờ thi giữ đáp án, preview không mất do focus, ôn sai mở được game, setup PIN chịu lockout, map/town cải thiện truy cập. Đồng thời, kiểm tra độc lập tìm thấy đường lộ đáp án mới và các lỗi biên chưa được xử lý đầy đủ. Cổng an toàn chưa đạt dù điểm UX/UI tăng.

## 1. Baseline và phạm vi

| Thuộc tính | Bản được kiểm tra |
| --- | --- |
| Phiên bản | `4.0.1`, chưa đổi số phiên bản từ lần 1 |
| Runtime source ID mới | `5d9b56a43e18706af1f541af5ef12477c679a8d2fa0c0b1e667f45f1b48261a8` |
| Source ID lần 1 | `59d67c93a8c3dd8839db1091c8760329f8d11c63984761ee5fe8342833bdff77` |
| HEAD | `f7c93337669379d768419ae1ab43cbde69f2aabe`, có thay đổi chưa commit |
| Thay đổi từ lần trước | 23 tệp tracked; kiến trúc nền không đổi |
| Công nghệ | React 19/TypeScript/Vite; Node/SQLite hoặc Netlify Functions/PostgreSQL/Supabase Storage |
| Prompt | Tệp yêu cầu kiểm toán do chủ dự án cung cấp, đã đọc lại |
| Mã sản phẩm trong đợt này | Không sửa; chỉ chạy kiểm tra và tạo tài liệu/bằng chứng |

Các phần TKB, GVCN/GVBM, chỗ ngồi, điểm danh trong prompt không có ở Bảo An Learning: **KHÔNG ÁP DỤNG**. Thay vào đó kiểm tra các luồng quản lý học liệu, học sinh, thi thử, quà và phụ huynh của sản phẩm thật. Không thêm các phân hệ đó vào backlog ngầm.

Lưu báo cáo lần 2 riêng để giữ lịch sử. Các bằng chứng mới gắn source ID mới; không tái sử dụng kết quả PASS của lần 1 như thể đã chạy cho bộ này.

## 2. Chấm điểm theo thang yêu cầu

| Nhóm | Lần 1 | Lần 2 | Bằng chứng và hạn chế chính | Tin cậy |
| --- | ---: | ---: | --- | --- |
| Kiến trúc/chất lượng mã | 11/15 | **11/15** | Giữ phân lớp, lazy role/game, server scoring; còn DTO không chặt, policy/truy vấn lặp và transaction thiếu | Cao trong mã/fixture đã kiểm tra |
| UI/đồ họa | 10/15 | **12/15** | Map/town mẫu có dữ liệu đã hết lỗi axe trước; responsive và phong cách giữ tốt; chưa đủ mọi màn/zoom/thiết bị thật | Trung bình |
| UX/liền mạch | 10/20 | **14/20** | Timeout, preview, mở ôn sai đã cải thiện rõ; còn autosave cùng câu, retry/shuffle và quyền gói ôn | Cao ở ca tái hiện, trung bình toàn trải nghiệm |
| Hiệu năng/dữ liệu | 16/30 | **16/30** | Có đo lại 3 lần mỗi profile, query quản trị gọn; CSS game/shell/layout chưa tối ưu và cloud thật chưa đo | Trung bình, lab/SQLite |
| Bảo mật/ổn định/mở rộng | 7/15 | **5/15** | PIN cải thiện; phát sinh lộ đáp án ở reopen, restore/backup vẫn có trạng thái lỗi, review thiếu quyền sở hữu | Cao trong API/fixture; production chưa chứng nhận |
| Bảo trì/triển khai | 3/5 | **2/5** | Node toàn bộ đạt; full E2E chưa đạt, artifact/web chưa khớp source mới, công cụ tải vẫn báo tốt sai | Cao cho các tệp/log/URL đã kiểm tra |
| **Tổng** | **57/100** | **60/100** | Điểm tạm theo phạm vi bằng chứng, không phải phần trăm hoàn thành | Có giới hạn |

Điểm tăng nhờ các sửa UX và truy cập đã xác nhận. Nhóm an toàn bị trừ điểm vì hành vi mới tìm thấy có thể làm lộ đáp án và lệch dữ liệu. Không lấy tổng điểm để bù cho lỗi P0. Không cho điểm tối đa với các mục chưa kiểm chứng hoặc chỉ mô phỏng.

## 3. Kết quả kiểm tra mới

| Kiểm tra | Kết quả |
| --- | --- |
| TypeScript | PASS |
| Production build | PASS |
| Assets | PASS theo ngưỡng 8 MiB hiện tại; 113 tệp, 5,08 MiB |
| `npm test` toàn bộ | **Exit 0: 350 ca Node đạt**: release 12, online 263, cloud 47, map 26, curriculum kỹ thuật 1, pilot simulation 1 |
| Full Playwright Chrome/Edge | **152 đạt, 24 thất bại, 2 bỏ qua do thiếu tệp, 4 không chạy do serial bị chặn**, tổng cấu hình 182; 23,0 phút |
| Kiểm tra độc lập server | 14 assert đạt: **11 xác nhận hành vi lỗi**, 3 control xác nhận đường đã sửa; không tính chúng là 14 PASS sản phẩm |
| UI recheck | Timeout, autosave hai câu khác nhau, preview, ôn sai và axe được chạy lại trực tiếp |
| Lab hiệu năng | Cùng phương pháp lần 1: 2 profile × 9 kịch bản × 3 lần; xem đầy đủ raw data/bảng ở báo cáo 04 |

24 ca E2E thất bại thuộc bảy tệp: `online-games`, `online-mapflow`, `online-mapperformance`, `online-media`, `online-regionmap`, `online-studentflow`, `online`. Trace cho thấy locator cũ hoặc kỳ vọng preview cũ; không quy thành 24 lỗi sản phẩm. Tuy nhiên các bài đã dừng trước khi chứng minh nghiệp vụ phía sau, nên cổng fullsuite chưa đạt.

Hai ca bỏ qua là cùng bài dùng Excel riêng của tác giả trên hai trình duyệt. Bốn ca không chạy là phần sau của nhóm tuần tự `online.spec.ts` khi bài đầu thất bại. Không tính hai nhóm này là PASS; JSON Playwright gộp chúng vào `skipped:6`.

## 4. Đối chiếu mười task trong bộ báo cáo mới

| Task được báo đã hoàn tất | Kết luận lần 2 |
| --- | --- |
| Backup/restore A01–A03 | **Sửa một phần.** Có thêm kiểm tra đầu vào và đổi thứ tự; còn N02–N04 đã tái hiện |
| Timeout thi thử | **Đã xác nhận đường lỗi cũ được sửa** trong fixture: giữ đáp án, có điểm; chưa suy ra mọi race/deadline đều đạt |
| Autosave | **Sửa trường hợp hai khóa khác nhau; chưa đóng cùng một câu** đến đảo thứ tự — N06 |
| Xáo/presentation/history | **Sửa một phần.** MathQuest/runner gửi ID, stale ID được chặn; còn N01/N07, lookup dotted ID và đường thiếu ID |
| PIN | **Đường lockout cũ đã đóng** qua API trên cả hai backend trong mẫu kiểm tra |
| Migration SQLite | **Khôi phục sau CREATE tốt hơn; sau DROP vẫn lỗi** — N08; mã chưa có transaction như báo cáo mô tả |
| Ôn sai | **Đã mở được game/quiz**, nhưng quyền gói ôn còn N05 |
| Giữ preview | **Đã xác nhận giữ preview khi focus**, cần giữ kiểm tra class/source/phiên bản riêng |
| Version rollback test | **Đã sửa**, cloud 47/47 trong `npm test` lần này |
| A11y | **Map/town mẫu đầy đủ dữ liệu có cải thiện thật**, axe mặc định rỗng; bài chuẩn vẫn cần sửa scope/contrast/zoom và caller nhãn mới |

Nhận định “không còn rủi ro” hoặc “không có bất kỳ regression nào” trong báo cáo triển khai vượt quá bằng chứng lần 2. Nên thay bằng phạm vi đã thử, kết quả thực tế và các rủi ro còn mở.

## 5. Mười ưu tiên cải tiến

| # | Ưu tiên | Vì sao |
| --- | --- | --- |
| 1 | DTO session theo allowlist, đóng N01 | P0: reopen compact play lộ chỉ số đúng/hoán vị trước khi trả lời trên cả hai API |
| 2 | Restore staging/commit/compensation, đóng N02 | P0: SQL rollback nhưng media đã bị ghi đè và lệch metadata |
| 3 | Autosave revision thật, N06 | Chọn sửa cùng một câu vẫn có thể mất cập nhật |
| 4 | Quyền sở hữu gói ôn, N05 | Học sinh B đang mở được gói ôn của A chỉ nhờ prefix |
| 5 | Hợp đồng presentation và lịch sử literal key, N07 | Yêu cầu đổi vị trí khi gọi lại chưa hoàn tất, còn game/ID/schema phiên chưa đồng bộ |
| 6 | Migration SQLite nguyên tử, N08 | Cửa sổ sau DROP có thể làm mất tài khoản ở bảng đang dùng |
| 7 | Snapshot backup và media inventory, N03/N04 | Backup có checksum đúng vẫn có thể không restore được hoặc thiếu media |
| 8 | Cập nhật E2E/hợp đồng caller và negative cases, N09 | Cần cổng nghiệm thu kiểm tra đúng hành vi mới, không chỉ nhóm con |
| 9 | Tách CSS game, shell/ảnh ưu tiên và CLS, N10 | Bộ sửa hiện tại chưa giải quyết đường tải lớn được đo lần trước |
| 10 | Runner/staging/artifact/deploy/evidence, N11/N12 | Công cụ còn nhận HTTP lỗi như thành công; gói/web chưa chứa bộ mã hiện tại |

Chi tiết file, độ khó, rủi ro, thứ tự và 32 ca nghiệm thu mới nằm ở [kế hoạch 05](05_KE_HOACH_TOI_UU.md).

## 6. Trạng thái phát hành và dữ liệu thật

`dist/build-info.json` khớp source ID mới `5d9b56…`. Gói `releases/bao-an-learning-4.0.1/app/build-info.json` vẫn `59d67c…`; manifest còn `pilot:true`, `releaseReady:false`, `humanPilotStatus:UNVERIFIED`. Gói cùng nhãn 4.0.1 hiện có chưa chứa bộ sửa vừa kiểm tra; không ghi đè artifact immutable cũ.

[Website build-info](https://gontogontet.netlify.app/build-info.json) và [API status](https://gontogontet.netlify.app/api/online/status) đọc lại ngày 06/11 vẫn trả **3.9.0-rc.1**. Đây là kết quả cho URL đã biết; không suy đoán các deploy khác.

Đủ nội dung và dùng thử người thật vẫn cần bằng chứng riêng. Kiểm thử curriculum là kiểm tra kỹ thuật; pilot trong Node là mô phỏng. Supabase thật, tải đồng thời 30/100, INP field, thiết bị vật lý và nghiệm thu chuyên môn: **CHƯA KIỂM CHỨNG** trong đợt này, kèm phương pháp kiểm tra tiếp ở báo cáo 04/05.

## 7. Trả lời sáu câu hỏi của prompt

1. **Kiến trúc đã hợp lý chưa?** Nền tảng hợp lý và giữ được; cần siết DTO, policy, giao dịch/khôi phục và hợp đồng phiên.
2. **UI thống nhất và phù hợp điện thoại chưa?** Đã tốt hơn ở map/town, màu và accessible name; chưa đủ mọi màn/zoom/thiết bị thật và mật độ thao tác.
3. **Thao tác liền mạch chưa?** Timeout/preview/ôn sai đã nối được; còn autosave cùng câu, retry/shuffle và quyền gói ôn cần hoàn thiện.
4. **Nguyên nhân chậm chính?** Trong lab là CSS game/tranh nền/chuỗi tài nguyên và shell/layout; không có bằng chứng Supabase chậm vì chưa đo deployment mới.
5. **Tăng tốc mà không viết lại được không?** Có: tách CSS/tải theo nhu cầu, shell nhẹ, ổn định layout và giữ phân trang; mức cải thiện phải đo trước/sau.
6. **Nếu chỉ làm mười cải tiến?** Làm theo mục 5: hai lỗi P0 trước, tiếp theo tính đúng/quyền/migration, rồi cổng kiểm thử, hiệu năng và phát hành có bằng chứng.

## 8. Các báo cáo và bằng chứng

- [Kiến trúc/bảo mật](02_KIEN_TRUC_VA_BAO_MAT.md)
- [UI/UX/luồng](03_UI_UX_VA_LUONG_THAO_TAC.md)
- [Hiệu năng và so sánh lần 1](04_HIEU_NANG_VA_TRUY_XUAT_DU_LIEU.md)
- [Kế hoạch bốn giai đoạn](05_KE_HOACH_TOI_UU.md)
- [Nội dung giao thực hiện](06_NOI_DUNG_GIAO_THUC_HIEN.md)
- [Chứng cứ và cách chạy lại](evidence/INDEX.md)

Các kết luận có giới hạn theo baseline và môi trường. Đợt này hoàn thành đánh giá/lập phương án; chưa thực hiện các công việc sửa đề xuất.
