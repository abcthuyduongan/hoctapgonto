# Bảo An Learning · 3.8.0-rc.10

Ứng viên phát hành cục bộ cho Windows Edge/Chrome. Giáo viên quản lý nhiều lớp, tự soạn câu hỏi nhiều môn theo tuần; ứng dụng nhận dạng câu và đưa vào trò phù hợp. Chờ nghiệm thu thực tế trước khi công bố production.

## Mở bản cục bộ

Cần Node.js **22.22.2 trở lên**. Trong mã nguồn:

~~~powershell
npm ci
npm run build
npm run online
~~~

Mở [Bảo An tại cổng 4180](http://127.0.0.1:4180/?online=1). Giữ máy chủ chạy trong lúc sử dụng. Lần đầu lấy mã từ tệp riêng .online/bootstrap-token.txt và tự đặt tài khoản quản lý. Trong ZIP đã giải nén, mở **MO_BAO_AN.cmd** hoặc **MO_QUAN_LY.cmd**; không cần npm install.

**Bản cài mới có dữ liệu câu hỏi rỗng.** Giáo viên tạo lớp/học sinh, chọn tuần, chọn một file câu hỏi cùng ảnh/âm thanh rồi kiểm tra. Câu lỗi được báo vị trí và bị loại; có thể giao các câu hợp lệ trong những nhóm đủ 2–30 câu. Có mẫu trắng Excel và [bộ mẫu đầy đủ](public/question-templates/bo-mau-day-du.zip) gồm Excel 36 câu/3 môn/tám dạng, hai hình, hai âm thanh và hướng dẫn; giải nén trước khi chọn tệp. Học sinh chưa được giao bài sẽ chờ giáo viên; mẫu không tự nạp vào lớp. Cập nhật ứng dụng giữ nguyên học liệu đã nhập.

Có tám dạng: trắc nghiệm, nối cặp, xếp câu, nhập số, điền từ, đọc chọn đáp án, nghe chọn đáp án, nghe điền từ. Hỗ trợ hình và âm thanh riêng tư. Tên môn/chủ đề do người soạn đặt; đây là dạng luyện tập, không phải mẫu nộp đề chính thức của các kỳ thi.

Mã câu/bộ ổn định khi đảo dòng; nhập lại không tạo sao trùng. Chọn **Cập nhật tuần này** để tăng phiên bản và giữ lịch sử. Sao do máy chủ chấm, tối đa ba sao mỗi câu nguồn dùng chung giữa các trò/phiên bản; 1 lên 3 chỉ cộng thêm 2. Mọi câu của tuần phải đạt ít nhất hai sao. Học sinh chọn ôn các câu hai sao hoặc xác nhận sang tuần sau; tuần đã qua sẽ khóa. Sổ đổi sao ghi giữ chỗ, duyệt/từ chối và trao quà thực tế.

Kế hoạch sao từng câu: [luật sao và khóa tuần](docs/KE_HOACH_SAO_TUNG_CAU_VA_KHOA_TUAN_2026-10-17.md). Sao cũ được bảo toàn trong ví, không tự biến thành thành tích từng câu. 140 câu có thể đạt 420 sao; tỷ lệ đổi quà không tự thay đổi.

RC9 bổ sung tuần mới 3–4 môn, tối đa 12 câu/môn, nhãn độ khó và mẫu Excel; nhận diện null/lỗi Excel; phân trang quản trị và bảo vệ nội dung tuần đã đóng. Tiếp tục các câu chưa đạt 2 sao chỉ mở phần cần học. Giữ bộ căn chỉnh chung, cho vào bài khi cảnh 3D đang tải và giảm dữ liệu trang học sinh: danh sách tóm tắt tối đa 20 bộ/lần, chỉ tải nội dung khi mở bài. Trí Nhớ/Nối Từ chia màn tối đa 6 cặp trên máy tính, 4 cặp trên điện thoại. Từng câu có bảng trò phù hợp và cột tùy chọn allowedGameIds để người soạn giới hạn; không tự bỏ câu. Học sinh có thể tự đổi mật khẩu. Đọc câu chọn rõ giọng tiếng Việt, báo khi thiết bị thiếu giọng Việt. Cần nghiệm thu tốc độ và giọng đọc trên website/thiết bị thật sau triển khai.

RC10 chỉ giao câu trắc nghiệm/đọc/nghe/nhập hiện tại khi mở đồng hồ, chưa gửi đáp án hoặc lời giải; gợi ý và thời lượng âm thanh có biên nhận máy chủ. Câu thay đổi nội dung chấm phải dùng ID mới; sửa lời giải giữ sao. Khắc phục tràn tên file/cỡ chữ lớn, thêm kiểm tra UI/API cùng giao thức và mã hỗ trợ lỗi. Không tự sửa ô Excel lỗi hoặc đặt lại sao cũ.

## Dữ liệu và phục hồi

Mã nguồn dùng .online/bao-an.sqlite; ZIP dùng data/bao-an.sqlite. Tư liệu cùng lưu trong SQLite. Dùng mục **Sao lưu & khôi phục** để tải bản sao nhất quán, kiểm tra trước rồi xác nhận phục hồi. Công cụ tự sao lưu trước khi thay, thu hồi phiên cũ và đóng lượt đang dở.

Khôi phục sang thư mục sạch có CLI xem trước và xác nhận bằng SHA-256; xem [hướng dẫn cục bộ](docs/QUAN_LY_CUC_BO.md). Giữ thư mục dữ liệu và bản sao khi cập nhật; không chạy hai máy chủ cùng kho.

Chỉ có một giao diện quản lý và học sinh. Đường dẫn cũ được chuyển về luồng tài khoản mới; không còn Xưởng học liệu, Góc phụ huynh hay mini-app của bản cũ.

## Kiểm tra và đóng gói

~~~powershell
npm run verify:local
npm run package:pilot
~~~

verify:local chạy TypeScript, kiểm thử renderer/học liệu/dữ liệu/khôi phục/cloud cục bộ/ZIP, kiểm tra tài nguyên, build và các ca trình duyệt máy chủ thật. Cần Chrome và Edge cho Playwright; BAO_AN_BROWSER_CHANNEL có thể chọn riêng chrome hoặc msedge. Nhóm hiện hành mặc định chạy cả hai trình duyệt. CI được cấu hình cho Node 22.22.2 và 24 trên Windows; kết quả chạy cục bộ được ghi riêng trong báo cáo bàn giao.

Gói bất biến ở releases/bao-an-learning-3.8.0-rc.10.zip; manifest ghi build ID, hash từng tệp và schema riêng: SQLite 1, PostgreSQL 1. releaseReady:false và humanPilotStatus:UNVERIFIED được giữ tới khi người dùng nghiệm thu. Không ghi đè cùng phiên bản bằng nội dung khác. Dùng RC10 trở lên để khôi phục bản sao RC10, không hạ bản.

## Tài liệu

- [Báo cáo sửa và kiểm tra RC10](docs/BAO_CAO_HOAN_THIEN_RC10_2026-10-18.md)
- [Phạm vi, staging, cảnh báo và khôi phục RC10](docs/PHAM_VI_VA_VAN_HANH_RC10.md)
- [Phiếu nghiệm thu RC10](docs/NGHIEM_THU_CUC_BO_RC10.md)
- [Đưa RC10 lên GitHub/Netlify](docs/CAP_NHAT_NETLIFY_RC10.md)

- [Kế hoạch bổ sung sau RC8: hoàn thiện tồn đọng và tuần học 3–4 môn](docs/KE_HOACH_HOAN_THIEN_CON_TON_DONG_2026-10-17.md) — H1–H4 đã triển khai RC9; H5–H6 cần xác nhận dùng thử và phục hồi cloud trên môi trường riêng.
- [Kế hoạch và điều kiện phát hành](docs/KE_HOACH_HOAN_THIEN_PRODUCTION_2026-10-16.md)
- [Rà soát, kết quả sửa và gói RC8](docs/BAO_CAO_RA_SOAT_2026-10-16.md)
- [Báo cáo hoàn thiện RC9 và số đo tải](docs/BAO_CAO_HOAN_THIEN_RC9_2026-10-17.md)
- [Phiếu nghiệm thu RC9](docs/NGHIEM_THU_CUC_BO_RC9.md)
- [Cập nhật RC9 lên Netlify qua GitHub](docs/CAP_NHAT_NETLIFY_RC9.md)
- [Dùng quản lý cục bộ](docs/QUAN_LY_CUC_BO.md)
- [Soạn Excel](docs/ONLINE_QUESTION_IMPORT.md)
- [Hướng dẫn đi kèm ZIP và phiếu nghiệm thu](tools/release-files/HUONG_DAN_SU_DUNG.html)
- [Netlify/Supabase cho giai đoạn sau](docs/NETLIFY_SUPABASE.md)
- [Đưa mã lên GitHub và triển khai Netlify](docs/DUA_LEN_GITHUB_NETLIFY.md)
- [SQL và kiểm tra Supabase](supabase/README.md)
- [Dự án Supabase đã thiết lập](docs/SUPABASE_DA_THIET_LAP.md)
- [Nguồn và giấy phép tài nguyên 3D](docs/ASSET_LICENSES_V37.md)

Schema và Storage đã thiết lập trên dự án Supabase được chỉ định; xem báo cáo ở trên. Website Netlify, chuyển dữ liệu SQLite lên cloud và thiết bị di động thật vẫn cần cấu hình/nghiệm thu riêng.
