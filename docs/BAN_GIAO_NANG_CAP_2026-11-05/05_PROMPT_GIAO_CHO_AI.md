# Prompt bàn giao để AI khác thực hiện

Sao chép phần dưới, kèm repo hiện tại, toàn bộ bộ kế hoạch và bộ ảnh đã có.

---

Bạn tiếp nhận dự án Bảo An Learning. Hãy thực hiện nâng cấp giao diện khám phá có bản đồ hình ảnh theo bộ tài liệu được giao, bắt đầu bằng việc đối chiếu working tree và hướng dẫn áp dụng trong repo.

Mục tiêu: đăng nhập → map tổng → vùng → tuần → bộ câu/trò → chơi/lưu → về đúng địa điểm với tiến độ mới. Câu hỏi do người dùng đưa lên, không xây danh mục kỹ năng hay bộ sinh câu. Nhân vật chỉ là emoji/hình tĩnh nhỏ; không dựng engine 3D, canvas scene hoặc sprite animation.

Đọc theo thứ tự:
1. 00_DOC_TRUOC.md.
2. 01_KE_HOACH_TRIEN_KHAI.md.
3. 02_HOP_DONG_DU_LIEU_VA_GIAO_DIEN.md.
4. 03_MA_TRAN_KIEM_THU.md.
5. 04_LENH_CHAY_VA_BAO_CAO.md.
6. 06_BACKLOG_VA_NHAT_KY.md.
7. Ba tài liệu ảnh được liên kết và baseline JSON.

Quy tắc làm việc:
- Đây là repo có thay đổi chưa commit; không reset/clean/ghi đè hoặc quay về commit nền để làm lại. Kiểm tra snapshot/hash trước; chỉ chạm các tệp thuộc công việc.
- Phân biệt thành phần hiện có và đề xuất chưa triển khai. API student/map, WorldMap/RegionMap và test:map trong kế hoạch là mới.
- Tiếp tục dùng OnlineStudentWorld và giao thức máy chủ cho quyền, tuần, sao, media và ví. Không chấm bằng browser, không tạo sao khi mở map.
- Triển khai theo các cổng G0→G4; G5 chỉ khi có môi trường/quyền phù hợp.
- Trước tiên làm lát cắt map tổng + vùng Toán + bộ/trò + trở về bằng 8 ảnh đợt A.
- Ảnh chưa có: hoàn thành logic/test và ghi rõ phần hình ảnh chờ; dùng fixture/nền đơn giản để kiểm luồng, không báo placeholder là map hoàn chỉnh.
- Giữ public/dist gọn: PNG gốc ngoài public, manifest và biến thể tối ưu dùng chung layout wide/tall; gate hiện có là5MiB.
- Đối chiếu thông báo của người dùng về phần quà/thị trấn/huy hiệu đã làm; nếu thiếu bản mã đó thì ghi rõ và tiếp tục phần map độc lập, không tự viết lại hệ thống thưởng.
- Không yêu cầu người dùng chọn SGK, nhập lại dữ liệu hoặc xác nhận lại các quyết định đã chốt chỉ để bắt đầu code.
- Những lựa chọn triển khai thường lệ trong phạm vi được giao do bạn tự xử lý. Nếu thật sự thiếu ảnh/quyền/cấu hình, làm hết phần không phụ thuộc rồi nêu chính xác đầu vào còn thiếu.
- Không tự bỏ qua quy định quyền của môi trường hoặc hành động ngoài phạm vi như phát hành production, thay credentials, xóa dữ liệu. Khi có yêu cầu xác nhận từ môi trường, trình bày hành động và lý do cụ thể.

Kiểm thử:
- Dùng ma trận80ca như đặc tả; không sao chép “đã pass” từ tài liệu cũ.
- Triển khai test thuần, hợp đồng SQLite/PostgreSQL, API quyền/readonly/leak, E2E Chrome/Edge và asset/performance phù hợp.
- Đăng ký test mới vào package scripts và bảo đảm Playwright thực sự discover được spec.
- Chạy baseline trước. Sau từng thay đổi chạy test ảnh hưởng; khi hoàn tất chạy các cổng hiện có và map mới.
- Không xóa/nới assert nghiệp vụ để phù hợp giao diện mới. Chỉ đổi selector/layout expectation khi hành vi đó chủ động thay đổi và vẫn giữ kiểm quyền/sao.
- Nếu localhost bị chặn, ghi lỗi môi trường và xin/chạy quyền theo cơ chế công cụ khi cần; không giả test đã đạt.
- Phân biệt fixture/PGlite/local với cloud thật. Không tạo tải lên production.
- Giữ log, ảnh/trace, lệnh, exitcode, sourceId và kết quả từng case; ca chưa chạy giữ đúng trạng thái.

Sau mỗi đầu việc:
- Cập nhật 06_BACKLOG_VA_NHAT_KY.md và hồ sơ dự án docs/KE_HOACH_GIAO_DIEN_VA_TIEN_DO.md.
- Ghi thay đổi, tệp, ca kiểm đã chạy, kết quả, ảnh/bằng chứng và việc kế tiếp.
- Nếu phát hiện thiết kế hợp đồng chưa phù hợp dữ liệu thực, ghi đề xuất sửa cụ thể rồi cập nhật đồng bộ code, test và tài liệu; không để hai backend khác nhau.

Bàn giao cuối:
- Mã đã triển khai với đầy đủ ảnh được nhận trong phạm vi phát hành.
- Báo cáo ca kiểm có bằng chứng, không còn P0/P1 áp dụng chưa xử lý.
- Build/gói có version/sourceId đồng nhất, không dữ liệu riêng, có đường quay lại presentation cũ.
- Ghi rõ phần hoàn thành mã, localtest, humanpilot và deploy; không gộp các trạng thái này.
- Tóm tắt kết quả để chủ dự án review, kèm link kế hoạch/nhật ký và ảnh giao diện mới.

Bắt đầu bằng việc kiểm tra checkout và đầu vào, báo lại phạm vi thực tế, sau đó thực hiện UP00 và các đầu việc tiếp theo phù hợp. Đây là yêu cầu triển khai, không chỉ viết thêm một bản kế hoạch.
