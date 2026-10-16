# Bảo An Learning · 3.8.0-rc.2

Ứng viên phát hành cục bộ cho Windows Edge/Chrome. Giáo viên quản lý nhiều lớp, tự soạn câu hỏi nhiều môn theo tuần; ứng dụng nhận dạng câu và đưa vào trò phù hợp. Chờ nghiệm thu thực tế trước khi công bố production.

## Mở bản cục bộ

Cần Node.js **22.22.2 trở lên**. Trong mã nguồn:

~~~powershell
npm ci
npm run build
npm run online
~~~

Mở [Bảo An tại cổng 4180](http://127.0.0.1:4180/?online=1). Giữ máy chủ chạy trong lúc sử dụng. Lần đầu lấy mã từ tệp riêng .online/bootstrap-token.txt và tự đặt tài khoản quản lý. Trong ZIP đã giải nén, mở **MO_BAO_AN.cmd** hoặc **MO_QUAN_LY.cmd**; không cần npm install.

**Bản cài mới có dữ liệu câu hỏi rỗng.** Giáo viên tạo lớp/học sinh, tải mẫu trắng Word .docx hoặc Excel .xlsx, soạn rồi xem trước và giao tuần. Học sinh chưa được giao bài sẽ chờ giáo viên; không tự nạp chương trình hoặc câu mẫu. Cập nhật ứng dụng giữ nguyên học liệu đã nhập.

Có tám dạng: trắc nghiệm, nối cặp, xếp câu, nhập số, điền từ, đọc chọn đáp án, nghe chọn đáp án, nghe điền từ. Hỗ trợ hình và âm thanh riêng tư. Tên môn/chủ đề do người soạn đặt; đây là dạng luyện tập, không phải mẫu nộp đề chính thức của các kỳ thi.

Mã câu/bộ ổn định khi đảo dòng; nhập lại không tạo sao trùng. Chọn **Cập nhật tuần này** để tăng phiên bản và giữ lịch sử. Sao do máy chủ chấm, tối đa ba sao mỗi bộ nguồn giữa các trò/phiên bản. Đạt hai sao mọi bộ để mở tuần sau. Sổ đổi sao ghi giữ chỗ, duyệt/từ chối và trao quà thực tế.

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

Gói bất biến ở releases/bao-an-learning-3.8.0-rc.2.zip; manifest ghi build ID, hash từng tệp và schema riêng: SQLite 1, PostgreSQL 1. releaseReady:false và humanPilotStatus:UNVERIFIED được giữ tới khi người dùng nghiệm thu. Không ghi đè cùng phiên bản bằng nội dung khác.

## Tài liệu

- [Kế hoạch và điều kiện phát hành](docs/KE_HOACH_HOAN_THIEN_PRODUCTION_2026-10-16.md)
- [Kết quả kiểm tra và gói RC2](docs/V38_qa/RC2_2026-10-16.md)
- [Dùng quản lý cục bộ](docs/QUAN_LY_CUC_BO.md)
- [Soạn Word/Excel](docs/ONLINE_QUESTION_IMPORT.md)
- [Hướng dẫn đi kèm ZIP và phiếu nghiệm thu](tools/release-files/HUONG_DAN_SU_DUNG.html)
- [Netlify/Supabase cho giai đoạn sau](docs/NETLIFY_SUPABASE.md)
- [Đưa mã lên GitHub và triển khai Netlify](docs/DUA_LEN_GITHUB_NETLIFY.md)
- [SQL và kiểm tra Supabase](supabase/README.md)
- [Dự án Supabase đã thiết lập](docs/SUPABASE_DA_THIET_LAP.md)
- [Nguồn và giấy phép tài nguyên 3D](docs/ASSET_LICENSES_V37.md)

Schema và Storage đã thiết lập trên dự án Supabase được chỉ định; xem báo cáo ở trên. Website Netlify, chuyển dữ liệu SQLite lên cloud và thiết bị di động thật vẫn cần cấu hình/nghiệm thu riêng.
