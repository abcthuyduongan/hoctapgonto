# Cập nhật 04/11/2026: tốc độ câu có hình và xuất câu hỏi, đáp án

Không đổi schema SQLite/PostgreSQL, **không cần chạy SQL** trên Supabase. Đưa lên GitHub rồi để Netlify build lại như mọi lần.

## 1. Tốc độ câu có hình

| Thay đổi | Tệp | Tác dụng |
|---|---|---|
| Ảnh được trình duyệt của chính học sinh lưu cache (`private, max-age=1 năm, immutable`), có `ETag` theo SHA-256 và trả `304` khi đã có | `server/cloud-api.mjs`, `server/online-server.mjs` | Chơi lại bài không tải lại ảnh; khi trình duyệt hỏi lại, máy chủ không đọc Storage. Âm thanh giữ `no-store` để vẫn có biên nhận nghe từng câu. CDN Netlify vẫn không lưu (`Netlify-CDN-Cache-Control: no-store`). |
| Bộ tải ảnh dùng cache trình duyệt, tải song song 4 ảnh (trước là 2) | `src/core/question-image-loader.ts` | Bàn thẻ nhiều hình đầy nhanh hơn. |
| Tải sẵn tối đa 12 ảnh của bàn thẻ ngay khi mở game ghép cặp | `src/screens/OnlineStudentWorld.tsx` | Ảnh tải song song với mã game. Trắc nghiệm giữ nguyên luật: chỉ chuẩn bị ảnh câu kế sau khi trả lời đúng, đồng hồ không mở sớm. |
| Tự thu nhỏ ảnh lớn khi giáo viên tải lên: cạnh dài tối đa 1024 px, WebP chất lượng 0,82; chỉ áp dụng ảnh > 250 KB hoặc > 1024 px | `src/core/online-media-check.ts`, `src/screens/OnlineAdminDashboard.tsx` | Ảnh điện thoại 2–3 MB thường còn khoảng 60–150 KB. Có ô tắt/bật. Tên tệp đã có trong thư viện giữ nguyên bản cũ để nhập lại tuần cũ không bị báo trùng tên. Muốn nén ảnh cũ thì đổi tên tệp rồi tải lại. |
| Học sinh dùng khóa CSDL chia sẻ (`FOR SHARE`) thay cho khóa độc quyền toàn đơn vị; quản trị vẫn khóa độc quyền | `server/postgres-store.mjs` | Học sinh cùng lớp không còn phải xếp hàng chờ nhau khi mở câu, nộp đáp án, đăng nhập. Mỗi học sinh vẫn bị khóa riêng theo tài khoản; thao tác của quản trị (khóa tài khoản, đặt lại mật khẩu, giao tuần) vẫn chờ và chặn đúng như trước. |
| Header `Server-Timing` trên mọi API: `pool`, `sql` (kèm số truy vấn), `lock`, `storage`, `total` | `server/api-diagnostics.mjs` | Mở DevTools → Network → chọn một request → tab Timing để thấy thời gian nằm ở đâu. Chỉ có số, không có dữ liệu học sinh. |

### Việc bạn cần làm trên hạ tầng (mã không làm thay được)

Đo ngày 04/11: tệp tĩnh 53–61 ms nhưng một lần gọi Function trống tốn 305–386 ms, mỗi truy vấn CSDL cộng thêm khoảng 200 ms. Như vậy Function và CSDL rất có thể đang ở hai vùng khác nhau.

1. Supabase → **Project Settings → General**: xem vùng của dự án (ví dụ `Southeast Asia (Singapore)`).
2. Netlify → cài đặt site → mục **Functions** → **Region**: nếu gói của bạn cho chọn, đặt trùng vùng với Supabase (Singapore). Deploy lại.
3. Sau khi deploy, mở một câu có hình, xem `Server-Timing`: `sql` nên còn vài ms mỗi truy vấn thay vì khoảng 200 ms.

Chưa làm: URL ký sẵn để trình duyệt lấy ảnh thẳng từ Supabase Storage. Nên đo bằng `Server-Timing` sau bước 2 rồi mới quyết định, vì cần đổi CSP và chưa thử được trên Supabase thật.

## 2. Xuất câu hỏi và đáp án

Trong **Học liệu tuần → Hành trình đã giao**:

- Mỗi tuần: **Xuất câu hỏi & đáp án (.xlsx)** hoặc **Xuất kèm hình, âm thanh (.zip)**.
- Cả lớp: **Xuất mọi tuần của lớp (.zip)**, mỗi tuần một file Excel.

File Excel gồm các sheet:

- **Câu hỏi**: đúng 33 cột của mẫu nhập. Sửa xong nhập lại được ngay. Giữ `itemId` để học sinh không mất sao.
- **Thống kê**: mỗi câu có số học sinh đã làm, tỉ lệ đúng ngay lần đầu, số lượt sai, thời gian đúng trung vị, phân bố 0–3 sao, đáp án sai hay gặp, nhận xét dễ/khó.
- **Gợi ý bộ sau**: tổng hợp theo chủ đề.
- **Hướng dẫn**.

Tệp không chứa tên hay tài khoản học sinh. Mỗi lần xuất được ghi một dòng `questions.export` vào nhật ký.

API mới, chỉ cho quản trị: `GET /api/online/admin/export/weeks/:weekId`, có ở cả bản local và cloud.

## Kiểm thử đã chạy

- `npm run typecheck`, `npm run build`, `npm run test:assets`: đạt.
- `npm test`: **251/251 đạt** (12 release + 194 online + 45 cloud), gồm 9 kiểm thử mới: nén ảnh, cache theo hash, trả 304, kiểu khóa của học sinh và quản trị, xuất rồi nhập lại đủ 8 dạng câu, thống kê, phân quyền xuất trên SQLite và PostgreSQL.
- Playwright Chromium, đủ 25 tệp spec: tất cả đạt, 1 bài bỏ qua như trước (cần bộ học liệu thật 140 câu). Chưa chạy trên Microsoft Edge.
- Chưa đo tải nhiều kết nối PostgreSQL thật. Khóa chia sẻ cần được xác nhận bằng một lần thử 30 học sinh trên staging.

Bản gốc của các tệp đã sửa được lưu ở `test-results/claude-backup-20261104/`.
