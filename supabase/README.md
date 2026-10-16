# Cơ sở dữ liệu Supabase của Bảo An

Hướng dẫn triển khai toàn bộ: [GitHub, Supabase và Netlify](../docs/NETLIFY_SUPABASE.md).

Thư mục này chứa:

- `migrations/202610150001_online.sql`: tạo schema riêng `bao_an`, 16 bảng, khóa ngoại, chỉ mục và phân quyền. Chạy lại giữ nguyên dữ liệu. Schema khởi đầu chỉ có một dòng phiên bản; tài khoản, lớp, học sinh, câu hỏi, tư liệu và sao đều rỗng.
- `verify.sql`: kiểm tra chỉ đọc sau cài đặt; không trả mật khẩu, token hay nội dung của học sinh.

## Cách áp dụng

Cách được hỗ trợ là khai báo biến riêng trên máy quản trị rồi chạy `npm run cloud:setup`. Lệnh áp dụng SQL trong giao dịch và chuẩn bị Storage riêng tư. Không chạy migration trong `npm run build` hay mỗi lần học sinh truy cập.

Cũng có thể mở **SQL Editor** của đúng dự án Supabase, chọn vai trò `postgres`, dán toàn bộ `migrations/202610150001_online.sql` và chạy. Sau đó vẫn phải chuẩn bị bucket theo hướng dẫn triển khai; SQL này không sửa bảng hệ thống Storage. Không cần dùng Supabase CLI cho cách này.

Sau khi thiết lập, chạy `verify.sql`. Tất cả giá trị `passed` phải là `true`. Với dự án mới, các `row_count` phải bằng `0`. Sau khi quản lý tạo tài khoản/lớp và nhập câu hỏi, số dòng tăng là bình thường; không xóa dữ liệu để đưa chúng về `0`.

## Mô hình quyền đang dùng

Trình duyệt gọi `/api/online` của Netlify Functions. Máy chủ kiểm tra phiên đăng nhập, CSRF, vai trò quản lý/học sinh, lớp được giao và từng workspace trước khi truy vấn PostgreSQL. Tài khoản ứng dụng nằm trong `bao_an.users`, được tạo từ màn hình thiết lập; không tạo quản lý mẫu hay học sinh trong Supabase Authentication.

Kết nối PostgreSQL phía máy chủ dùng vai trò chủ sở hữu các bảng, thông thường `postgres`. RLS được bật nhưng không có policy cho trình duyệt. Chủ sở hữu vẫn làm việc qua máy chủ; không thêm `FORCE ROW LEVEL SECURITY` vì nó sẽ chặn luồng này. Các vai trò `anon`, `authenticated` và `service_role` không được quyền đọc/ghi schema. Khóa secret/service role chỉ phục vụ Storage qua máy chủ.

Trong phần **Data API / Exposed schemas**, giữ `bao_an` ngoài danh sách. Không thêm grant `USAGE`, policy `USING (true)` hay hàm RPC công khai để truy cập các bảng này. Không cần bật Realtime cho schema. Đây là mô hình kết nối trực tiếp từ máy chủ tin cậy theo [hướng dẫn bảo vệ dữ liệu của Supabase](https://supabase.com/docs/guides/database/secure-data), kết hợp [schema riêng](https://supabase.com/docs/guides/api/using-custom-schemas) và [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Migration thu hồi các grant trên đối tượng hiện có và các grant mặc định *riêng schema* của vai trò chạy SQL. Nó không thay đổi quyền toàn cục của những ứng dụng khác trong cùng dự án. PostgreSQL không cho một lệnh thu hồi quyền mặc định riêng schema ghi đè grant mặc định toàn cục; vì vậy cần chạy lại kiểm tra quyền sau khi tự thêm bảng/hàm. Xem [ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html). Không sửa schema thủ công trong lúc hệ thống đang phục vụ học sinh.

## Dữ liệu và sao lưu

Schema lưu tài khoản/phiên, lớp/học sinh, gói câu hỏi theo phiên bản, tuần được giao, lượt chơi/câu trả lời, sổ sao, yêu cầu đổi thưởng, nhật ký và metadata tư liệu. Ảnh/âm thanh nằm trong bucket riêng tư; `bao_an.media` chỉ giữ đường dẫn, MIME, dung lượng và SHA-256. Cần sao lưu cả PostgreSQL và các tệp Storage.

Không có dữ liệu môn học cố định. Người soạn tự đặt nhãn môn, nhập Word/Excel theo tuần. Không tự động sao chép dữ liệu SQLite cục bộ lên cloud; hãy bắt đầu cloud rỗng hoặc thực hiện phương án chuyển dữ liệu riêng đã được kiểm tra.

`verify.sql` kiểm tra cấu trúc và quyền SQL; nó không thể xác nhận cài đặt Exposed schemas, chứng chỉ kết nối, biến Netlify, bucket hay khả năng chạy thật trên Supabase. Sau khi cấu hình dự án thật cần thử đủ: tạo quản lý, lớp/học sinh, nhập Word/Excel có ảnh/âm thanh, giao tuần, đăng nhập học sinh và lưu sao.
