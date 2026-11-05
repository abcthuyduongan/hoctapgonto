# Kế hoạch giao diện và tiến độ triển khai

> **Kế hoạch hiện hành từ 05/11/2026:** [Kế hoạch hoàn thiện theo từng tuần](KE_HOACH_HOAN_THIEN_THEO_TUAN_2026-11-05.md), gồm 13 tuần và cổng chuyển tuần C0–C12. Tài liệu này giữ nhật ký các đợt giao diện trước. Lưu ý khi đối chiếu ngày 05/11: kệ quà, huy hiệu, nhiệm vụ ngày, thị trấn và khu phụ huynh **chưa có trong mã**. Các phần này đã được xếp vào Tuần 3–9 của kế hoạch mới.

Cập nhật: **05/11/2026**. Đây là kế hoạch hiện hành và nhật ký. Giai đoạn tiếp theo là **bản đồ có hình ảnh do người dùng tạo**, theo bộ hướng dẫn mới bên dưới; hai bản đề xuất nguồn chỉ lưu để tham khảo lịch sử.

## Phạm vi đã được người dùng chốt

- Tập trung phát triển **giao diện của dự án**.
- Hướng trải nghiệm được chốt tiếp ngày 05/11: tham khảo [Munworld](https://munworld-explorer.vercel.app/) về khám phá địa điểm và vào trò chơi, dùng nội dung và thương hiệu riêng của Bảo An.
- Nhân vật thật nhẹ: một biểu tượng tĩnh nhỏ; không dựng mô hình, canvas, sprite sheet hay hoạt cảnh nhân vật. Theo yêu cầu bổ sung ngày 05/11, bản đồ sẽ có ảnh minh họa tĩnh do người dùng tạo; nút, chữ, chặng và tiến độ ghép bằng HTML/CSS. Phần này thay cho giới hạn chỉ dùng nền màu của đợt giao diện trước.
- Câu hỏi và học liệu do phía người dùng biên soạn, tải lên. Không triển khai danh mục kỹ năng, `skillId`, bộ sinh câu, ngân hàng nội dung hay yêu cầu chốt SGK trong đợt giao diện này.
- Người dùng xác nhận phần kế hoạch tốc độ ảnh và xuất đáp án đã hoàn thành. Phần đổi thưởng mở rộng (kệ quà, quà vật lý) và thế giới game tương tác có bối cảnh chưa có trong mã, được xếp vào Tuần 2 và Tuần 3 của kế hoạch hoàn thiện 13 tuần. Không tự đưa các đầu việc trong bản kế hoạch cũ vào phạm vi mới.
- Giữ luồng giao học liệu, quyền truy cập, chấm sao, khóa tuần và đổi thưởng hiện có khi phát triển giao diện.
- Sau mỗi đợt triển khai, **lưu kế hoạch và những việc đã triển khai ngay trong dự án**, kèm tệp thay đổi, kết quả kiểm tra thực tế và việc còn lại.

## Tài liệu nguồn

- [Đề xuất phát triển game học tập lớp 3, ngày 04/11](DE_XUAT_GAME_LOP_3_NGUON_2026-11-04.md).
- [Kế hoạch tốc độ ảnh, xuất đáp án, đổi thưởng và thế giới game, ngày 04/11](KE_HOACH_ANH_XUAT_DAP_AN_THE_GIOI_NGUON_2026-11-04.md). Trạng thái hoàn thành ghi nhận phần tốc độ ảnh và xuất đáp án; phần đổi thưởng và thế giới game được triển khai theo kế hoạch 13 tuần.
- [Báo cáo đã lưu về tốc độ ảnh và xuất đáp án](CAP_NHAT_TOC_DO_ANH_VA_XUAT_DAP_AN_2026-11-04.md).
- Tệp người dùng gửi bổ sung có hậu tố `game222.md` đã được đối chiếu SHA-256: nội dung trùng hoàn toàn bản kế hoạch tốc độ ảnh phía trên, dùng cùng bản lưu để không tạo hai bản tiến độ khác nhau.

## Giai đoạn tiếp theo — Bản đồ hình ảnh

Người dùng yêu cầu lập kế hoạch đầy đủ trước để tự tạo ảnh rồi bàn giao. Đã lưu:

- [Kế hoạch map, bố cục từng màn và cách tích hợp](KE_HOACH_BAN_DO_HINH_ANH_2026-11-05.md).
- [Checklist tên, kích thước và nội dung từng ảnh](BO_ANH_BAN_DO_DANH_SACH_BAN_GIAO.md).
- [Bộ prompt tạo ảnh và concept giao diện](BO_ANH_BAN_DO_PROMPT_TAO_ANH.md).

Đề xuất 5 map chính với bản ngang/dọc, 12 địa điểm tách nền, 5 ảnh trò và 1 ảnh đăng nhập: **28 ảnh chính**. Có 11 ảnh tùy chọn và 6 concept giao diện riêng. Bắt đầu với **8 ảnh đợt A** để thử map tổng và vùng Toán.

Trạng thái: **đã lập kế hoạch và gói hướng dẫn; chờ người dùng tạo ảnh**. Chưa ghép bản đồ hình ảnh, chưa tạo tranh, không ghi phần bố cục thẻ đã làm thành map phong cảnh hoàn chỉnh. Câu hỏi vẫn do người dùng cung cấp.

## Bộ bàn giao cho người hoặc AI triển khai tiếp

Theo yêu cầu bổ sung ngày 05/11, đã lưu [bộ kế hoạch thực thi](BAN_GIAO_NANG_CAP_2026-11-05/00_DOC_TRUOC.md), gồm UP00–UP16, cổng G0–G5, hợp đồng API/dữ liệu, [80 ca kiểm thử chi tiết](BAN_GIAO_NANG_CAP_2026-11-05/03_MA_TRAN_KIEM_THU.md), lệnh kiểm tra, script hỗ trợ Windows, template báo cáo và [prompt giao AI](BAN_GIAO_NANG_CAP_2026-11-05/05_PROMPT_GIAO_CHO_AI.md).

[Manifest baseline](BAN_GIAO_NANG_CAP_2026-11-05/07_BASELINE_MA_NGUON.json) ghi dấu vết runtime và hash 42 tệp mã nguồn, vì checkout có nhiều thay đổi chưa commit. Đây không phải gói mã nguồn. Các ca kiểm mới đều bắt đầu CHUA_CHAY; đợt lập tài liệu không chạy lại test ứng dụng hoặc sửa runtime.

## Đợt giao diện nhẹ ngày 05/11 — Nền đã triển khai

| Việc | Mục tiêu | Trạng thái |
| --- | --- | --- |
| Màn chính học sinh | Bản đồ địa điểm HTML/CSS, lời chào, bài đang học, tiến độ thật và ví sao dễ tìm | Hoàn thành, đã kiểm tra local |
| Chọn trò chơi | Thẻ trò dùng ký hiệu nhẹ, hướng dẫn ngắn, chỉ mở trò phù hợp học liệu đã giao | Hoàn thành, đã kiểm tra local |
| Hành trình tuần | Thấy rõ tuần hiện tại, câu đạt yêu cầu, tuần đã qua và tuần chưa mở | Hoàn thành, đã kiểm tra local |
| Đăng nhập | Đồng bộ màu sắc, nhân vật dạng emoji tĩnh nhỏ, thao tác rõ trên điện thoại | Hoàn thành, đã kiểm tra local |
| Quản trị | Làm rõ thống kê, các nhóm công việc và biểu mẫu, giữ luồng nhập câu hiện tại | Hoàn thành, đã kiểm tra local |
| Kiểm tra và bàn giao | Kiểm tra kiểu, build, các luồng trình duyệt liên quan; xem ảnh desktop và mobile | Đạt; kết quả chi tiết bên dưới |

## Nhật ký triển khai

### 05/11/2026 — Lưu kế hoạch và điều chỉnh phạm vi

- Đã lưu hai tài liệu nguồn vào `docs/`.
- Đã ghi nhận quyết định ưu tiên giao diện; bỏ hướng triển khai danh mục kỹ năng và soạn nội dung khỏi kế hoạch hiện hành.
- Các thay đổi có sẵn trong checkout thuộc công việc trước đó, không tính thành phần triển khai mới của đợt giao diện này.
- Kết quả triển khai giao diện và kiểm tra được ghi ở mục tiếp theo.

### 05/11/2026 — Hoàn thành giao diện khám phá nhẹ

| Đã triển khai | Mã liên quan |
| --- | --- |
| Màn chính có lời chào, bản đồ theo các môn thực sự được giao, mỗi bộ câu là một địa điểm. Chỉ hiện vùng có học liệu, hỗ trợ cả tên môn do người dùng tự đặt. Màu và tên gợi nhớ cho Toán, Tiếng Việt, Tiếng Anh, Tin học chỉ là cách trình bày. | [StudentScreen.tsx](../src/screens/StudentScreen.tsx), [student-assigned-games.css](../src/styles/student-assigned-games.css) |
| Chọn địa điểm để xem và mở đúng các trò tương thích với bộ đó. Giữ lựa chọn và nút đang dùng khi thoát trò/làm mới tiến độ; lưu danh sách trò theo mã bộ và phiên bản trong phiên giao diện. Máy chủ vẫn kiểm quyền khi bắt đầu chơi. | [StudentScreen.tsx](../src/screens/StudentScreen.tsx), [OnlineStudentWorld.tsx](../src/screens/OnlineStudentWorld.tsx) |
| Hành trang hiển thị tiến độ tuần từ số câu đạt ít nhất 2 sao, sao khả dụng và sao tích lũy từ máy chủ. Đường dẫn tới hành trình tuần, xem từng câu và ví đổi sao dùng các chức năng hiện có. | [OnlineStudentWorld.tsx](../src/screens/OnlineStudentWorld.tsx), [student-shell.css](../src/styles/student-shell.css) |
| Cáo đồng hành là emoji tĩnh nhỏ ở màn chính, đăng nhập và trong trò chơi; bỏ tải ảnh nhân vật. Bề mặt game đơn giản, không dựng cảnh mới, không thêm ảnh minh họa hoặc thư viện đồ họa. | [GameMascot.tsx](../src/games/GameMascot.tsx), [student-shell.css](../src/styles/student-shell.css) |
| Đăng nhập có bố cục giới thiệu và biểu mẫu, cùng màu kem/xanh lá với học sinh. Quản trị có thống kê, điều hướng và biểu mẫu đồng bộ; phần tên không gian trên điện thoại xuống dòng riêng để dễ đọc. | [OnlineScreen.tsx](../src/screens/OnlineScreen.tsx), [learning-interface.css](../src/styles/learning-interface.css) |
| Kiểm thử responsive, mở ví bằng bàn phím, chọn địa điểm khác và mở đúng câu của địa điểm; xem/chọn địa điểm không tạo lượt trả lời hoặc sao. Giữ các kiểm thử lưu câu, chống thao tác lặp, mạng lỗi và trả tiêu điểm sau khi thoát. | [online-studentflow.spec.ts](../tests/visual/online-studentflow.spec.ts) |

#### Kết quả kiểm tra thực tế

- `npm run typecheck`: đạt.
- `npm run build`: đạt, gồm TypeScript và bản web production.
- `npm run test:syntax`: đạt.
- `npm run test:assets`: đạt; artifact 54 tệp, khoảng 2,56 MiB. Không thêm thư viện hoặc ảnh nhân vật/cảnh mới; các tài nguyên cũ của dự án vẫn được giữ.
- `npx playwright test --config=playwright.online.config.ts tests/visual/online-studentflow.spec.ts tests/visual/online-games.spec.ts --output=test-results/interface-final --reporter=list,json`: **16/16 đạt** trên Chrome và Edge. Báo cáo `test-results/interface-final-report.json`.
- `npx playwright test --config=playwright.online.config.ts tests/visual/online.spec.ts --output=test-results/interface-account --reporter=list,json`: **6/6 đạt** trên Chrome và Edge, gồm nhập học liệu, đáp án/nghe, ví sao, chuyển tuần, quản trị, đăng nhập và quyền riêng tư. Báo cáo `test-results/interface-account-report.json`.
- Đợt rà soát rộng trên Chrome trước đó cũng đạt các luồng quản lý, cập nhật/khôi phục, khởi động và học liệu theo tuần. Kiểm thử mới đã phát hiện lỗi mất danh sách trò khi quay lại địa điểm; lỗi đã được sửa và kiểm tra lại trong 16 ca phía trên.
- Đã xem ảnh giao diện ở 320, 390, 620 và 1440 px; sửa bố cục tên môn/tiến độ trên điện thoại và phần tên không gian ở đầu trang quản trị.
- Lượt chạy đầu trong sandbox bị `EACCES` với localhost; các lượt thành công chạy lại bằng quyền kết nối localhost và dữ liệu kiểm thử riêng.

#### Ảnh và trạng thái bàn giao

- Ảnh desktop: [student-desktop.png](../outputs/interface-exploration-2026-11-05/student-desktop.png).
- Ảnh điện thoại: [student-phone.png](../outputs/interface-exploration-2026-11-05/student-phone.png).
- Ảnh đăng nhập: [login-phone.png](../outputs/interface-exploration-2026-11-05/login-phone.png).
- Ảnh quản trị: [admin-phone.png](../outputs/interface-exploration-2026-11-05/admin-phone.png).

Ảnh dùng học liệu/tài khoản kiểm thử. `outputs/` và `test-results/` là đầu ra local được Git bỏ qua; mã và nhật ký này nằm trong dự án. Bản cập nhật hiện ở mã nguồn local, chưa push hoặc deploy website. Các số đo cloud và kế hoạch tính năng cũ không được nghiệm thu lại trong đợt giao diện này.

## Cách cập nhật ở các đợt sau

Mỗi mục hoàn thành phải ghi: hành vi đã thay đổi, đường dẫn mã liên quan, lệnh kiểm tra và kết quả thực tế. Phân biệt hoàn thành mã, kiểm tra local và triển khai website. Không lấy số đo hoặc kết quả kiểm thử cũ để ghi thành kết quả mới.
