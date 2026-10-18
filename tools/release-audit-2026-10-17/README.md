# Kiểm toán phát hành ngày 2026-10-17

RC10: hai lỗi API đã có regression từ chối tại `tests/online-question-protocol.test.mjs`; không chạy lại công cụ chẩn đoán cũ như một cổng an toàn. Ca Excel được bổ sung 320/360/390px và cỡ chữ gốc 200%; đặt `BAO_AN_STATIC_ROOT` trỏ bản dựng mới và `BAO_AN_AUDIT_OUTPUT_ROOT` trỏ thư mục mới để giữ nguyên bằng chứng kiểm toán ban đầu. Kết quả sửa được ghi riêng trong báo cáo hoàn thiện RC10.

Các công cụ dùng dữ liệu thử riêng, không đăng nhập hoặc ghi website thật. Báo cáo nằm ở `docs/BAO_CAO_KIEM_TRA_CHUYEN_SAU_PHAT_HANH_2026-10-17.md`; đầu ra nằm trong `test-results/deep-release-audit/`.

Chạy tại gốc dự án sau `npm ci`, cần Node 22.22.2+, Chrome và Edge:

```powershell
npm run typecheck
npx vite build --outDir test-results/deep-release-audit/dist
node --experimental-strip-types tools/release-audit-2026-10-17/adversarial-api.mjs
npx playwright test --config=tools/release-audit-2026-10-17/playwright.config.ts
node tools/release-audit-2026-10-17/verify-artifacts.mjs
```

`adversarial-api.mjs` là công cụ chẩn đoán tái hiện hai lỗi hiện tại, không phải cổng PASS bảo mật: thoát 0 nghĩa là hoàn tất tái hiện và lưu JSON. Sau khi sửa luật/API phải cập nhật công cụ thành các assertion kỳ vọng từ chối gian lận và không giữ mastery cho câu đã đổi nghĩa. Không thêm công cụ này vào CI dưới dạng bài kiểm tra chứng minh an toàn.

Ca Playwright dùng đúng Excel 140 câu và 16 WAV ở Downloads của chủ dự án, không sửa tệp gốc. Nó đang thất bại đúng tại kiểm tra tràn ngang trên màn 390px. Chỉ thay đường dẫn nếu dùng bản sao dữ liệu thử tương đương; đầu ra lưu thời gian, dòng lỗi, trạng thái giao bài, ảnh và trace.

`verify-artifacts.mjs` chỉ đọc gói RC9 bất biến, so hash từng tệp, ZIP và mã ứng dụng trong build kiểm toán. Không đóng gói hoặc ghi đè bản phát hành.

`public-site-check.mjs` thực hiện bốn GET công khai tới Netlify, không tạo tải đồng thời. Kết quả chỉ là quan sát HTTP tại thời điểm chạy, không xác nhận khả năng chịu tải hoặc hiệu năng thao tác có đăng nhập.

`read-workbook.py SOURCE.xlsx OUTPUT.json` đọc bằng openpyxl với `read_only=True`, không gọi save. `crosswalk.mjs` tạo đối chiếu đủ 280 ID từ JSON nguồn tại vị trí mặc định. Các dòng trong đối chiếu chưa được nghiệm thu đầy đủ trên môi trường ghi trong workbook; không phải 280 ca đã chạy.

Không chạy khôi phục, benchmark hoặc mutation vào cơ sở dữ liệu thật từ các công cụ này. Sau sửa sản phẩm, dùng phiên bản mới và giữ nguyên RC9 để truy vết.
