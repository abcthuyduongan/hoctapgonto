# Kiểm tra độc lập backend, frontend và khắc phục A–B

Ngày: 07/11/2026. Phạm vi: Bảo An Learning tại checkout hiện hành; kiểm tra chỉ đọc phần liên quan kết nối của SafeTime; đọc trạng thái công khai Netlify. Không kiểm tra giả lập được coi là sử dụng bởi trẻ em thật.

## 1. Nguồn và cách xác nhận

- Đọc bộ kế hoạch `docs/KE_HOACH_PHAT_TRIEN_5_0_2026-11-07/`, báo cáo thực hiện và ma trận nghiệm thu. Các dòng PASS trong báo cáo là tuyên bố cần kiểm chứng, không thay cho kết quả chạy mã.
- Mốc Git ban đầu: `e910eaff4f0b9b60a3f4b68cb9206eeaf45c3db8`, nhánh `codex/bao-an-4-0-2`. Checkout có nhiều thay đổi A–B chưa commit trước đợt kiểm tra này; bản đánh giá áp dụng cho cả thay đổi đang có, không chỉ commit HEAD.
- Trước sửa: metadata ứng dụng ghi 4.0.2, lockfile ghi 4.0.0, báo cáo ghi hoàn thành 4.1. Source ID trước sửa: `2ef0419626fcf9093f638ca51609530e0e66813356b4f82c86e14656c1a88bf9`.
- Sau sửa: đồng bộ metadata ứng viên thành **4.1.0-rc.1**. Đây là ứng viên kiểm thử tại máy, không có nghĩa Netlify đã được cập nhật. Danh tính build và kết quả cuối được ghi tại `03_KET_QUA_NGHIEM_THU.json`.
- Dùng SQLite cô lập và PostgreSQL qua PGlite/adapter cloud với giao diện production build. Không dùng dữ liệu hay tài khoản thật để thực hiện ghi, nạp câu hỏi, sửa PIN, khôi phục hoặc tạo tải.

## 2. Lỗi đã tái hiện và thay đổi

| Mã | Mức | Vấn đề trước sửa | Thay đổi và kiểm chứng |
| --- | --- | --- | --- |
| AB01 | P1 | Giao diện chỉ cho xác nhận PIN 6 số, khóa lối vào của phụ huynh đã dùng PIN 4–5 số hợp lệ | Xác minh PIN hiện có 4–6 số; tạo PIN mới trên giao diện yêu cầu 6 số. Giữ nguyên kiểm soát quyền, giới hạn thử sai và dữ liệu. Thêm kiểm thử trình duyệt cho cả ba độ dài; kiểm thử quyền máy chủ vẫn chạy. |
| AB02 | P1 | Alias môn mở rộng làm kế hoạch tuần hợp lệ của bản cũ bị từ chối khi sửa/khôi phục | Chấp nhận đúng hash lịch sử của các alias mới khi đọc snapshot; không đổi ID đã lưu. Giao tuần mới vẫn dùng mã mới, 3–4 môn, tối đa 12 câu/môn. Thử sửa lời giải trên cả SQLite/PostgreSQL và sao lưu/khôi phục snapshot cũ. Có trường hợp chống ID giả và vượt 12 câu. |
| AB03 | P2 | Chuẩn hóa `tieng-viet`, `tieng-anh`, `tin-hoc` lại thành hash; gọi lặp làm trôi ID | Giữ mã chuẩn khi gọi lại; ánh xạ hash lịch sử đã biết; giữ ID opaque của môn tự đặt. Bốn mã dùng cho hợp đồng kết nối không đổi qua nhiều lần chuẩn hóa. |
| AB04 | P1 | CSS `.online-header > div` ép nhóm nút mới thành cột, các nút tràn khỏi thanh đầu trang; 320 px và màn 620 px có tên học sinh dài bị tràn ngang | Tách lớp của thanh học sinh khỏi CSS quản trị cũ, chỉnh độ ưu tiên CSS của nút, thu gọn hợp lý ở màn tới 768 px, dùng điều hướng dưới ở màn tới 1024 px. Kiểm tra vị trí toàn bộ nút đầu trang và độ rộng trang ở 320/390/620/768/1024/1440/1920 px. |
| AB05 | P2 | Hai chặng bản đồ chồng nhau; dữ liệu thử cũ chỉ có ba chặng nên bỏ sót chặng 6–7 trên điện thoại | Kích thước địa danh theo vùng bản đồ; nhãn gọn trên màn nhỏ, số câu đầy đủ trong tên truy cập và bảng chi tiết. Kiểm tra đủ bảy chặng, ranh giới, tọa độ và mọi cặp không chồng. |
| AB06 | P2 | Thẻ hành trình nằm trong vùng ảnh có `overflow:hidden`, dễ bị cắt và cạnh tranh chỗ với điểm bấm bản đồ | Đưa thẻ ra khỏi vùng tọa độ của ảnh; dùng cột riêng trên desktop và khối riêng trên điện thoại. Tách số câu trong bộ khỏi số câu đạt của toàn tuần. |
| AB07 | P2 | Hộp thoại tự dựng chưa giữ Tab/Shift+Tab; menu tài khoản chưa trả focus; thanh dưới luôn tô Bản đồ | Thêm quản lý focus dùng chung cho hộp thoại, giữ focus ở hộp thoại đang trên cùng, trả focus khi đóng; menu có focus bàn phím, Escape; trạng thái chọn và `aria-current` theo màn đang mở. |
| AB08 | P2 | Quét trang đã có bài học phát hiện chữ nhạt tương phản khoảng 3.04:1 và tên truy cập nút khác chữ nhìn thấy | Dùng màu chữ phụ đủ tương phản; tên nút chính lấy đúng nội dung hiển thị; đặt tên thanh tiến độ. Quét axe trên trang có bốn môn ở 390 và 1440 px. |
| AB09 | P2 | Bộ kiểm thử nhiều luồng vẫn tìm nút/danh sách ở trang cũ nên dừng trước thao tác cần xác minh | Cập nhật đường đi sang Danh sách hoặc mở menu theo giao diện mới. Giữ các kiểm tra số sao, lịch sử, chống chơi tuần tương lai, nhập học liệu, sao lưu, khôi phục, đăng nhập lại. Thêm kiểm tra riêng trang mặc định có học liệu để không bỏ qua giao diện mới. |
| AB10 | P2 | Phiên bản không thống nhất, manifest phát hành ghi PostgreSQL schema 1 trong khi runtime yêu cầu 8 | Đồng bộ package/lockfile 4.1.0-rc.1; metadata phát hành ghi SQLite 1, PostgreSQL 8. Gói thử nghiệm vẫn phải ghi chưa nghiệm thu người thật. |
| AB11 | P1 | Phụ huynh vào bằng PIN trong phiên học sinh nhưng nút duyệt thưởng gọi API chỉ dành cho quản trị/tài khoản cha mẹ, trả 403 | Thêm đường xử lý thưởng riêng của khu phụ huynh. Kiểm tra PIN token theo đúng học sinh, phiên và hash PIN hiện tại ngay trong giao dịch; giữ nguyên giới hạn API quản trị. Thử thiếu token, sai học sinh, khác phiên, PIN đã đổi và cha mẹ chưa liên kết. |
| AB12 | P1 | Báo cáo lấy nhầm trường số sao nên hiện 0; thiếu tiền/tỷ lệ; yêu cầu đã duyệt mất nút trao, yêu cầu chưa duyệt lại có nút trao | Đọc đúng số sao, tỷ lệ và số tiền đã lưu tại lúc yêu cầu. Giữ yêu cầu đã duyệt trong nhóm cần xử lý; chỉ cho xác nhận đã trao sau duyệt và sau khi cha mẹ xác nhận. Kiểm tra trọn luồng tiền và quà trên trình duyệt. |
| AB13 | P2 | Tồn kho không giới hạn được máy chủ biểu diễn -1 nhưng giao diện coi là hết hàng | Chỉ trạng thái 0 mới là hết; số âm/không giới hạn hiển thị “Bố mẹ chuẩn bị quà”. Quà thêm từ bộ mẫu đổi được khi đủ sao. |
| AB14 | P1 | Gửi lại thao tác từ chối/hủy có thể hoàn kho thêm lần nữa | Trả lại kết quả cũ khi trạng thái đã được xử lý; khóa dòng yêu cầu trong PostgreSQL để tuần tự hóa thao tác đồng thời. Thử hai lệnh hoàn quà đồng thời trên cả hai máy chủ, kho và sao chỉ được hoàn một lần. |
| AB15 | P2 | Dọn CSS game cũ làm mất bố cục thẻ nhớ tự giãn; câu dài kèm ảnh bị cắt. Âm thanh trong lượt ghép thẻ có thể co về bề rộng 0 | Khôi phục phần bố cục cần thiết vào CSS riêng Memory Match; chừa chỗ ảnh và cho nội dung xuống dòng. Giữ bề rộng điều khiển âm thanh trong hàng cuộn. Kiểm tra thẻ dài kèm ảnh trên màn thấp/điện thoại/desktop và hoàn thành đủ lượt có âm thanh ở Memory Match, Nối Từ. |
| AB16 | P2 | Menu tài khoản bị khóa khi dữ liệu hành trình chậm, không vào được đổi mật khẩu để ngắt yêu cầu đang chờ | Cho mở menu, đổi mật khẩu và đăng xuất trong khi tải nền; các mục phụ thuộc dữ liệu vẫn bị khóa khi cần. Kiểm tra yêu cầu đang chờ được hủy và tải lại sau khi đóng hộp thoại. |
| AB17 | P1 | Khi bấm trả lời lại, máy chủ tạo lượt hiển thị đáp án mới nhưng phía giao diện vẫn cho gửi lựa chọn cũ trước phản hồi | Khóa đáp án tới khi nhận đúng phản hồi mở lại. Giữ thời điểm mở ban đầu do máy chủ cung cấp, gợi ý và khóa gửi lại chính xác khi lưu lỗi; không đặt lại giờ để lấy thêm sao. Kiểm tra riêng câu chọn đáp án và câu nhập số với phản hồi bị giữ chậm. |
| AB18 | P2 | CSS tải cùng trang học vượt cổng 20 KiB gzip; giao diện đầu trang còn bị nhập hai lần và kiểu nút nhiệm vụ thay đổi theo thứ tự mở hộp thoại | Tải giao diện quà, chuỗi học, nhiệm vụ và huy hiệu khi mở; bỏ nhập thanh đầu trang trùng ở CSS toàn cục. CSS hộp thoại không còn ghi đè kiểu nút điều hướng. Giữ nguyên cổng dung lượng; kiểm tra tiếp khả năng mở hộp thoại, focus và tương phản sau khi tải chậm. |

Chính sách PIN máy chủ vẫn tương thích 4–6 số để phục vụ tài khoản/client cũ. Không tuyên bố đã ép toàn bộ API cũ sang chính sách 6 số. Khi thêm phiên bản API chính sách PIN mới, cần chuyển đổi riêng, có kiểm thử tương thích và không tự thay PIN của phụ huynh.

## 3. Bằng chứng và cách đọc kết quả

- `evidence/backend-probes-before.json`: snapshot cũ hợp lệ trên mã cũ nhưng không hợp lệ trên A–B trước sửa; mã môn chuẩn bị trôi.
- `evidence/regression-before.log`: hai kiểm tra hồi quy đều lỗi trước sửa.
- `evidence/pin-before.json` và `.log`: nút xác nhận bị vô hiệu hóa với PIN 4 số hợp lệ trước sửa.
- `evidence/verify-local-full.log`: lần chạy ban đầu đã qua phần Node/build/assets; dừng chủ động sau khi tìm được lỗi trình duyệt để sửa. **Không được ghi lần chạy này là toàn bộ PASS.**
- `evidence/focused-*.json`, `evidence/responsive-*.json`: các lần kiểm tra trung gian, có thể còn lỗi ở thời điểm đó; giữ lại để thấy quá trình xác nhận.
- Không lấy kết quả từ bản build khác hoặc đếm các ca bị bỏ qua là đạt.

**Cập nhật phạm vi:** các lượt `verify-local-after.log`, `verify-local-final.log` đã dừng để tiếp tục sửa và bổ sung phần đổi thưởng. `browser-repairs.json` ghi nhận ba lỗi tiếp theo về dung lượng CSS, màn 620 px và màu nút sau tải hộp thoại. Những lượt này là bằng chứng trung gian, không phải toàn bộ PASS. Lượt nghiệm thu đầy đủ sau sửa dùng **`evidence/verify-local-complete.log`** và **`evidence/browser-complete.json`**. Xem trạng thái hoàn tất tại `03_KET_QUA_NGHIEM_THU.json`.

## 3b. Bộ quà bổ sung theo yêu cầu gia đình

- Bộ **20 món**, ảnh sản phẩm lưu tại dự án, tổng 117.648 byte; không tải ảnh từ nhà bán lẻ khi học sinh mở kệ. Có đồ ăn/uống quen thuộc, sáp màu, Doraemon, Rubik, Hot Wheels và hai bộ LEGO.
- Tỷ lệ tạm **1 sao = 500 đồng**; sao của món quà là `ceil(giá tham khảo / 500)`. Cả giá tham khảo và số sao đều hiện rõ. Không hiển thị ngày tham khảo theo yêu cầu gia đình.
- Nút thêm bộ quà trong Quản trị → Kệ quà; thêm lại không tạo món trùng, không ghi đè tên/giá/tồn kho do gia đình đã sửa. Chỉ thay tỷ lệ cho yêu cầu mới; yêu cầu tiền/quà đã gửi giữ ảnh chụp tỷ lệ cũ. Không tự bật lại ví tiền nếu phụ huynh đã tắt.
- Muốn cho phép gửi ước muốn bằng tiền: bật mục cho phép đổi sao trong tab cấu hình đổi sao. Phụ huynh trực tiếp mua/trao tiền hoặc quà rồi xác nhận trong ứng dụng.
- [Danh mục có ảnh](../BO_QUA_BAO_AN_20_MON/DANH_MUC_QUA.html), [bảng Markdown](../BO_QUA_BAO_AN_20_MON/DANH_MUC_QUA.md), [CSV chỉnh giá](../BO_QUA_BAO_AN_20_MON/DANH_MUC_QUA.csv), [nguồn giá và ảnh](../BO_QUA_BAO_AN_20_MON/NGUON_GIA.json).
- Bổ sung ảnh quà làm tăng dung lượng bản build so với mốc A–B 4,99 MiB. Giữ nguyên cổng tài sản tự động đang có ≤5,5 MiB; không tuyên bố còn đạt mục tiêu cũ ≤5,0 MiB nếu số đo cuối lớn hơn. Ảnh kệ tải khi cần và có `loading="lazy"`.

Chạy lại trong thư mục dự án:

```powershell
npm run verify:local
```

Chạy nhanh các hồi quy quan trọng:

```powershell
node --experimental-strip-types --test tests/weekly-plan.test.mjs tests/parent-authorization-matrix.test.mjs tests/question-shuffling.test.mjs
npx playwright test tests/visual/online-upgrade.spec.ts tests/visual/online-mapgeometry.spec.ts tests/visual/online-hints.spec.ts tests/visual/online-journey.spec.ts tests/visual/online-management.spec.ts --config=playwright.online.config.ts
```

Nếu môi trường chặn mở cổng thử nghiệm hoặc ghi thư mục build, kết quả đó là lỗi môi trường. Không sửa quyền xác thực hay làm yếu kiểm tra sản phẩm để bỏ qua.

## 4. Điều kiện dùng cho Bảo An

1. Chỉ cân nhắc thử có giám sát cho 1–2 người khi tất cả cổng tự động sau sửa đạt trên cùng build. Phụ huynh thử một vòng thật: đăng nhập → bài học → thoát → mở lại còn sao → PIN → duyệt quà → học lại, trên máy/điện thoại thực tế.
2. Netlify đang chạy **4.0.2**, commit `3ff86b5cf5ba85cdcd7ddde402546828acb83d22`, source ID `556aba824efa09aa0766549a2ed91c02349cca5150f7e6c05b21e7d3f3bd89c0` lúc kiểm tra. `/status` trả hoạt động, `/me` khi chưa đăng nhập trả 401 đúng dự kiến. Xem `evidence/live-readonly.json`. Kết quả này không chứng nhận build A–B mới đã triển khai.
3. Trước cập nhật web: xuất bản sao cloud và kiểm tra khôi phục trên kho thử; ghi site ID, branch và source ID sắp phát hành; giữ bản deploy cũ. Sau cập nhật kiểm tra build-info/status trùng source ID, đăng nhập thật bằng tài khoản thử được phụ huynh cho phép. Không khôi phục bản SQLite cục bộ đè lên dữ liệu Supabase.
4. Theo dõi 48 giờ thử: không mất sao, không nhân đôi thưởng, không mở tuần khóa, phụ huynh vào được, ảnh/âm thanh có đường thử lại. Dừng nâng cấp khi có một lỗi mất dữ liệu/quyền truy cập; giữ dữ liệu phát sinh, xác định tương thích trước khi rollback.
5. Kiểm thử thật với trẻ, zoom trình duyệt 200%, thiết bị yếu/mạng thật, độ dễ hiểu và CLS trong cả mười trò vẫn cần biên bản riêng. Ảnh chụp, đổi viewport hoặc một lần Tab không thay cho các phép đo đó. Không ghi A–B/C/D/E toàn bộ 100% chỉ từ kết quả máy.

## 5. Kết nối SafeTime

**Chưa có căn cứ cho phép bật kết nối tự động hai phần mềm.** `SafeTime.BaoAn/Class1.cs` còn lớp rỗng; `SafeTime.BaoAnHost/Program.cs` còn chương trình mẫu. Kiểm tra chỉ đọc không phải nghiệm thu khóa máy Windows hay các chức năng còn lại của SafeTime.

Đường `/api/integration/safetime/v1/status` trên web hiện trả HTML do đường dự phòng của ứng dụng, dù HTTP 200. Không coi đó là API kết nối hoạt động. Phải kiểm tra JSON, phiên bản giao thức và quyền tương ứng khi triển khai cầu nối.

Phương án dùng song hành, công việc bàn giao và các cổng nghiệm thu: [02_CHOT_PHUONG_AN_SONG_HANH.md](02_CHOT_PHUONG_AN_SONG_HANH.md).
