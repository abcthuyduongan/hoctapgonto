# Bảo An Learning V3 — Alpha 2.8.1 / Memory Match

## Mục tiêu sửa lỗi người dùng báo cáo
- Game Memory Match bị khóa sau khi chọn hai thẻ trong bản React/Vite trước.
- Bố cục bảng thẻ chưa đủ rõ và nền cảnh chưa đồng bộ.

## Nguyên nhân kỹ thuật được xác định
`MemoryMatch.tsx` đặt `closed.current=true` trong cleanup của `useEffect` nhưng không trả về false khi effect setup lại. React.StrictMode ở chế độ development có thể chạy chu kỳ setup → cleanup → setup. Khi `onAttempt` hoàn tất, đoạn `if (closed.current) return` thoát quá sớm, giữ `busyRef` và `locked` tại true: bảng thẻ trông như bị đơ.

## Đã sửa
1. Reset `closed.current=false` và `busyRef.current=false` khi effect setup lại; dọn timer khi cleanup.
2. Khi chọn sai hai thẻ: lật lại sau 700 ms và mở khóa; khi đúng: cập nhật cặp đã ghép, không khóa thẻ còn lại.
3. Thông báo riêng "Đang lưu lượt chọn…", "Chưa khớp" và "Ghép đúng"; chỉ phản hồi khi `onAttempt` hoàn tất.
4. Thêm stylesheet chuyên dụng `memory281.css`, nền forest Premium, thiết kế lại viền thẻ, bảng trò chơi, nhân vật, thông báo và responsive.
5. Tạo đồ họa thẻ sau `memory-card-back.svg` ở độ phân giải độc lập.
6. Không thay đổi Game SDK, schema IndexedDB hoặc học liệu mẫu.

## Bằng chứng kiểm tra
- `npm run verify:offline`: **76/76 bài kiểm thử đạt**, cú pháp TS/TSX và TypeScript lõi đạt.
- `tests/memory281.test.mjs`: transpile nguyên thành phần TSX rồi kiểm tra chu kỳ StrictMode setup → cleanup → setup bằng hook harness; chọn sai hai thẻ rồi chọn lại, ghép đúng, mở khóa các thẻ còn lại và hoàn thành đều đạt. Đây là kiểm thử logic thành phần, không phải trình duyệt React production.
- `tools/check_memory281_preview.py`: Chromium hệ thống kiểm tra bản HTML/CSS có tương tác độc lập ở 1440×900, 390×844, 320×700: đủ 12 thẻ, thao tác sau hai lượt bình thường, không tràn ngang, ảnh cáo tải đúng, bảng không dịch chuyển (0px). Xem `docs/memory281/browser-results.json`.
- `preview/memory281.html`: bản tương tác trực tiếp mở từ tệp, **không phải ứng dụng React, không ghi dữ liệu thật**.

## Điều kiện nghiệm thu còn lại
Không cài đặt được npm dependencies trong môi trường tạo mã do không thể truy cập registry.npmjs.org. Chưa chạy build Vite và trình duyệt dùng React 19/IndexedDB thật. Vì vậy, đây là bản **mã nguồn đã sửa và kiểm thử độc lập**, chưa được xác nhận là bản sản xuất Stable.

Trên Windows có Internet, giải nén rồi chạy:

```bash
npm install
npm run build
npm run dev
```

Trong ứng dụng chạy tại localhost, thử Memory Match: chọn 2 thẻ sai (phải tự úp lại và chọn tiếp được), chọn 2 thẻ đúng (phải sáng lên và tiếp tục chọn thẻ khác), ghép hết cặp, tải lại trang xem Góc phụ huynh. Nếu dùng chế độ developer với `<React.StrictMode>`, lỗi khóa 2 thẻ không được xuất hiện.
