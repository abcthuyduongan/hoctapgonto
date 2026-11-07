# Bàn giao bản đã sửa và bộ quà cho gia đình

## Trạng thái cần đọc trước

Mã nguồn ứng viên: **4.1.0-rc.1**. Kết quả chạy và danh tính bản build trong [03_KET_QUA_NGHIEM_THU.json](03_KET_QUA_NGHIEM_THU.json) là nguồn xác nhận cuối. Bản sửa tại máy chưa được tự đưa lên Netlify. Không dùng báo cáo A–B cũ để kết luận bản đang chạy trên web đã có các thay đổi này.

## Thêm bộ quà vào dữ liệu đang sử dụng

1. Đăng nhập tài khoản quản trị, mở **Kệ quà**.
2. Mở **Bộ 20 món quà dành cho Bảo An**; xem đủ ảnh, giá và số sao rồi bấm **Thêm bộ 20 quà · Đặt 1 sao = 500 đồng**. Bước này chỉ chạy khi quản trị bấm; build hoặc tải trang không tự sửa dữ liệu gia đình.
3. Kiểm tra 20 món trong danh sách. Thêm lại không tạo món trùng và không ghi đè món đã sửa. Có thể sửa số sao, tồn kho hoặc tắt một món theo nhu cầu gia đình.
4. Nếu muốn cho con gửi ước muốn theo số tiền, bật cho phép đổi sao trong phần cấu hình ví. Thêm bộ quà không tự bật lại ví đã tắt.
5. Vào tài khoản học sinh, mở **Kệ quà**, ghim một mục tiêu. Sau khi con có đủ sao, gửi yêu cầu; người lớn vào khu phụ huynh bằng PIN để **duyệt → mua/trao trực tiếp → xác nhận đã trao**.

Giá món được quy đổi theo `làm tròn lên(giá tiền / 500)`, ví dụ 5.400 đồng cần 11 sao. Giá tham khảo và số sao là hai thông tin khác nhau; người lớn có thể chỉnh mức thưởng. Yêu cầu đã gửi giữ nguyên số sao, tỷ lệ và số tiền tại lúc gửi dù sau này đổi cấu hình. Sao được giữ khi chờ, trả lại khi hủy/từ chối theo quy trình, và chỉ được ghi nhận đã đổi một lần.

Danh mục không có ngày tham khảo theo yêu cầu gia đình. Xem [bảng có ảnh](../BO_QUA_BAO_AN_20_MON/DANH_MUC_QUA.html), [bảng chỉnh giá CSV](../BO_QUA_BAO_AN_20_MON/DANH_MUC_QUA.csv) và [nguồn từng món](../BO_QUA_BAO_AN_20_MON/NGUON_GIA.json). Ảnh được lưu trong dự án; tải kệ quà không phụ thuộc website bán hàng.

## Các phần mã cần biết khi bảo trì

| Phần việc | Vị trí chính |
| --- | --- |
| Bộ quà, số sao, ảnh và nguồn giá | `src/core/gift-presets.ts`, `public/art/gifts/bao-an-20/`, `src/components/GiftPresetPanel.tsx` |
| Thêm bộ quà, giữ nguyên lịch sử và hoàn kho một lần | `server/online-store.mjs`, `server/postgres-store.mjs`, API máy chủ tương ứng |
| Duyệt và trao thưởng bằng PIN đúng quyền | API `/parent/redemptions/:id/transition`, `src/screens/ParentPortalScreen.tsx`, `server/parent-data.mjs` |
| Quà không giới hạn tồn kho, ảnh quà | `src/components/GiftShelfDialog.tsx` |
| Đảo đáp án và khóa lựa chọn cũ khi mở lại | Giao thức câu hỏi máy chủ, `src/games/useQuestionClock.ts`, `MathQuest.tsx`, `OnlineExerciseRunner.tsx` |
| Tương thích kế hoạch tuần cũ | `src/core/weekly-plan.ts` và các kiểm thử lưu/khôi phục hai cơ sở dữ liệu |
| Thanh điều hướng, bản đồ, hộp thoại | `StudentHeader.tsx`, `OnlineStudentWorld.tsx`, `src/styles/student-frame.css`, `src/styles/world-map.css`, `src/ui/useModalFocus.ts` |
| Bố cục thẻ nhớ và điều khiển âm thanh | `src/styles/games/memory-match.css`, `src/styles/online.css` |

Tên tệp máy chủ có thể được đối chiếu nhanh bằng tìm `installGiftPreset` và `transitionReward` trong thư mục `server/`. Không lấy cookie, mật khẩu hay PIN thật để đưa vào kiểm thử.

## Đưa bản đã sửa vào sử dụng

1. Đọc kết quả nghiệm thu cuối; chạy lại `npm run verify:local` nếu thay đổi mã hoặc thư viện. Đối chiếu `sourceId` của mã và `dist/build-info.json`.
2. Sao lưu cloud đang dùng; diễn tập khôi phục trên kho thử, theo [hướng dẫn cloud](../NETLIFY_SUPABASE.md) và [biên bản sao lưu/khôi phục](../BIEN_BAN_DIEN_TAP_SAO_LUU_KHOI_PHUC_CLOUD.md). Giữ riêng dữ liệu thật và dữ liệu thử.
3. Dùng bản xem trước để thử đăng nhập, bài học, đảo đáp án, ảnh/âm thanh, PIN, đổi tiền/quà và tải lại còn tiến độ. Kiểm tra API trả JSON và đúng phiên bản; HTTP 200 của trang HTML dự phòng không chứng minh API hoạt động.
4. Ghi mã build sắp phát hành, địa chỉ web và bản deploy trước. Sau cập nhật web, kiểm tra lại build-info/status trùng source ID rồi thực hiện một vòng với tài khoản thử.
5. Phụ huynh và Bảo An thực hiện [biên bản thử thật](04_BIEN_BAN_THU_THAT_VA_PHAT_HANH.md). Theo dõi 48 giờ trước khi kết luận ổn định; không đánh dấu thử người thật bằng kết quả tự động.
6. Nếu phát hiện mất sao, mất tiến độ hoặc vượt quyền: dừng mở rộng sử dụng, giữ bằng chứng và bản sao dữ liệu phát sinh. Quay lại deploy trước khi đã xác nhận tương thích; không khôi phục cơ sở dữ liệu cũ đè mất kết quả mới của con.

Gói ngoại tuyến tạo bằng `npm run package:pilot` là gói thử nghiệm có giám sát. Dữ liệu SQLite của gói này không tự đồng bộ với Supabase trên web. Không cho con học luân phiên hai kho độc lập rồi kỳ vọng sao tự cộng chung.

## Song hành SafeTime

Ưu tiên một kho dữ liệu học tập tại Bảo An và SafeTime thực thi lịch sử dụng máy theo khả năng đã được nghiệm thu. Các bước mở trang học, hợp đồng cloud V2, ghép tài khoản và kiểm thử lỗi nằm trong [kế hoạch song hành](02_CHOT_PHUONG_AN_SONG_HANH.md). Kết nối tự động chưa được triển khai hoặc nghiệm thu trong đợt sửa này; không quy đổi sao thành phút chơi.
