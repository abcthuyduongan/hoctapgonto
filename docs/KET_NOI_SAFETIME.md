> Bản sao từ dự án SafeTime (`D:\Phần mềm 2026\quản lý máy tính\docs\ket-noi-bao-an.md`). Khi hai bản khác nhau, bản trong SafeTime là chuẩn. Mã yêu cầu `BAO-01` → `BAO-16` nằm trong `dac-ta-yeu-cau.md` mục 20.2 của SafeTime. Lộ trình phía Bảo An: `KE_HOACH_PHAT_TRIEN_5_0_2026-11-07/03_LO_TRINH_VA_VIEC_CAN_LAM.md` giai đoạn D.

# Kết nối SafeTime ↔ Bảo An Learning – Thiết kế chi tiết

Phiên bản 1.0 · 07/11/2026 · Áp dụng cho SafeTime 1.0 và Bảo An Learning 4.3 trở đi (cổng kết nối), phát hành chung ở Bảo An 5.0. Lộ trình Bảo An: `BAO_AN_LEARNING_lam lại/docs/KE_HOACH_PHAT_TRIEN_5_0_2026-11-07/`

Khi kết nối, **Bảo An Learning trở thành nơi học chính trong chế độ Học tập của SafeTime**:

- Con bấm "Học tập / Thi" → **đăng nhập bằng chính tài khoản học sinh Bảo An** → vào **Bảng nhiệm vụ học tập**.
- Con chọn nhiệm vụ theo môn (Toán, Tiếng Việt, Tiếng Anh, Tin học) hoặc bài thi thử → Bảo An mở ngay đúng chỗ, đã đăng nhập sẵn.
- Thời gian học tính vào **phút học**, không trừ giờ chơi, không trừ lượt bật máy.
- Kết quả thi thử Violympic/IOE trên Bảo An **tự chuyển** sang SafeTime, không cần điền phiếu hay chụp ảnh.
- **Sao chỉ dùng để đổi vật phẩm trên Kệ quà Bảo An. SafeTime không bao giờ đổi sao thành giờ chơi** và không ghi gì vào ví sao.

Yêu cầu có mã nằm trong `dac-ta-yeu-cau.md` mục 20: `LNK-xx` (phía SafeTime), `BAO-xx` (phía Bảo An). Tài liệu này giải thích các yêu cầu đó và là **hợp đồng chung** giữa hai dự án; một bản sao nằm ở `docs/KET_NOI_SAFETIME.md` trong thư mục Bảo An.

---

## 1. Hiện trạng Bảo An liên quan (đã xem mã nguồn 4.0.2)

| Có sẵn | Ở đâu | Dùng cho kết nối |
| --- | --- | --- |
| Máy chủ cục bộ `http://127.0.0.1:4180`, dữ liệu `.online/bao-an.sqlite` (ZIP: `data/`) | `server/run-online.mjs`, `server/online-server.mjs` | SafeTime gọi API cổng kết nối trên địa chỉ này |
| Tài khoản `admin`, `student`, `parent`; phiên cookie `HttpOnly` 12 giờ + CSRF; giới hạn đăng nhập sai | `online-server.mjs` (`login`, `actor`, `rateLimit`) | Đăng nhập học sinh qua SafeTime dùng lại đúng các luật này |
| Hành trình học theo tuần, bộ chưa đạt, nhiệm vụ ngày | `/student/journey`, `/student/daily-missions`, `src/core/weekly-plan.ts` | Nguồn dữ liệu cho Bảng nhiệm vụ |
| Thi thử Violympic và IOE (`contest_sessions`: điểm, điểm tối đa, số câu đúng, giờ bắt đầu, giờ nộp, trạng thái) | `/contest/*`, `server/contest-data.mjs` | Nguồn kết quả thi tự chuyển sang SafeTime |
| Ví sao, kệ quà, duyệt đổi quà, "Đã trao" | `/wallet`, `/gifts`, `/redemptions` | **Chỉ đọc** số sao để hiển thị; không đụng tới |
| Khu phụ huynh có PIN 4 số, giới hạn phút học/ngày, khung giờ | `/parent/*`, `src/core/parent-controls.ts` | Nơi đặt màn hình "Kết nối SafeTime"; hiển thị giới hạn của Bảo An trên thẻ nhiệm vụ |
| Kiểm thử `npm test`, schema SQLite 1 / PostgreSQL | `tests/`, `supabase/migrations/` | Bảo An thêm kiểm thử và migration cho cổng kết nối |

Bảo An hiện **chưa có**: API cho phần mềm khác, cơ chế đăng nhập một lần (SSO) từ ứng dụng ngoài, liên kết sâu tới môn/bài thi, luồng sự kiện. Đó là phần phải bổ sung (mục 6).

---

## 2. Các luồng chính

### 2.1 Ghép đôi (một lần, do phụ huynh làm)

1. Phụ huynh mở Bảo An → Khu phụ huynh (nhập PIN Bảo An) → **Kết nối SafeTime** → chọn học sinh được phép → **Tạo mã ghép đôi**. Bảo An hiện mã 8 ký tự, hiệu lực 10 phút, dùng một lần.
2. Phụ huynh mở SafeTime → Bảng điều khiển (PIN SafeTime) → Cài đặt → **Kết nối Bảo An Learning** → nhập địa chỉ (mặc định `http://127.0.0.1:4180`) và mã ghép đôi → **Kết nối**.
3. SafeTime gửi mã → Bảo An trả **khóa kết nối** (bí mật 32 byte) và danh sách học sinh được phép.
4. Phụ huynh nối từng hồ sơ con trong SafeTime với một học sinh Bảo An (ví dụ: tài khoản Windows "Con" ↔ học sinh "Minh – 3A").
5. Hai bên lưu: Bảo An giữ **băm** của khóa; SafeTime giữ khóa đã bảo vệ bằng DPAPI trong CSDL mã hóa.

### 2.2 Con vào học

```
Con bấm "Học tập / Thi"
  → SafeTime: đã ghép đôi?  không → Bảng nhiệm vụ không có phần Bảo An
                             có ↓
  → Đã ghi nhớ đăng nhập cho hồ sơ con này?  có → lấy vé đăng nhập mới bằng mã làm mới
                                               không ↓
  → Màn hình "Đăng nhập Bảo An": tên đăng nhập + mật khẩu (+ "Ghi nhớ trên máy này")
  → SafeTime gửi cho Bảo An (qua cổng kết nối, kèm khóa kết nối)
  → Bảo An kiểm tra như /login + học sinh phải nằm trong danh sách ghép đôi
       và phải đúng học sinh được nối với hồ sơ con đang dùng máy
  → Bảo An trả: học sinh, vé đăng nhập (dùng 1 lần, 60 giây), mã làm mới (nếu ghi nhớ)
  → SafeTime lấy dữ liệu "hôm nay" → hiện Bảng nhiệm vụ
```

### 2.3 Con chọn nhiệm vụ

1. Con bấm "Làm nhiệm vụ" ở thẻ Toán.
2. Dịch vụ SafeTime bắt đầu phiên Học tập (mục đích: "Bảo An · Toán"), bật lọc web chỉ cho địa chỉ Bảo An, kiểm soát ứng dụng.
3. Trình duyệt học tập của SafeTime (WebView2, hồ sơ trình duyệt riêng cho mỗi con) mở `…/api/integration/safetime/v1/sso?ticket=…&to=hoc/toan`.
4. Bảo An đổi vé thành **phiên học sinh bình thường** (cookie như khi tự đăng nhập), chuyển hướng tới `/?online=1#/hoc/toan`.
5. Con học như bình thường trong Bảo An. Thanh Học tập của SafeTime hiện "Bảo An · Toán" và thời gian học còn lại.
6. Con bấm "Kết thúc" (hoặc hết phút học): SafeTime đăng xuất phiên Bảo An trong trình duyệt học tập, xóa cookie, đồng bộ sự kiện ngay, quay về Bảng nhiệm vụ hoặc thoát.

### 2.4 Thi thử Violympic / IOE trên Bảo An

Như 2.3, đích `thi/{presetId}`. Phiên SafeTime ở chế độ **Thi** (không khóa giữa bài, gia hạn 15 phút). Khi con nộp bài, Bảo An ghi sự kiện `contest_submitted`. SafeTime đồng bộ trong ≤ 60 giây (ngay lập tức khi con bấm Kết thúc), tạo kết quả với nguồn **"Thi thử Bảo An"**, trạng thái **Đã xác nhận** (máy chủ Bảo An chấm, không cần ảnh, không cần phụ huynh duyệt).

### 2.5 Thi thật trên violympic.vn / ioe.vn

Không đổi so với thiết kế SafeTime gốc: con chọn ở mục "Thi thật trên mạng" của Bảng nhiệm vụ, thi trên trang chính thức, rồi nhập phiếu kết quả có ảnh và chờ phụ huynh duyệt.

### 2.6 Sao và phần thưởng

| Loại | Ở đâu | Đổi được gì | Ai quyết |
| --- | --- | --- | --- |
| Sao | Bảo An | **Chỉ vật phẩm** trên Kệ quà Bảo An (truyện, đồ chơi, chuyến đi…), theo luồng duyệt "Đã trao" sẵn có của Bảo An | Phụ huynh trong Bảo An |
| Phút chơi thưởng | SafeTime | Thời gian dùng máy | Phụ huynh trong SafeTime: mã thưởng, cộng trực tiếp, quy tắc thưởng theo kết quả thi |

- SafeTime **chỉ đọc** số sao để hiển thị trên Bảng nhiệm vụ, kèm dòng "Sao dùng để đổi quà trên Kệ quà Bảo An".
- SafeTime không có lệnh nào ghi vào ví sao, không đọc kệ quà để đổi thời gian.
- Phía Bảo An: cổng kết nối **không có** API ghi sao, tạo/duyệt đổi quà.
- Quy tắc thưởng theo kết quả của SafeTime có thêm trường **Nguồn**: Thi thật · Thi thử Bảo An · Mọi nguồn. Quy tắc mặc định chỉ áp dụng cho **Thi thật**; phụ huynh tự bật cho thi thử nếu muốn.

### 2.7 Bảo An không chạy

- Nếu phụ huynh chọn **"SafeTime tự chạy Bảo An"** (mục 4): dịch vụ phụ "SafeTime Bao An Host" khởi động Bảo An cùng Windows, kiểm tra sức khỏe mỗi 30 giây, tự mở lại khi lỗi.
- Nếu không: Bảng nhiệm vụ hiện thẻ "Bảo An chưa mở trên máy này" (kèm hướng dẫn cho phụ huynh), các nhiệm vụ khác (thi thật, phần mềm học tập khác) vẫn dùng được.

---

## 3. Bảng nhiệm vụ học tập (nội dung)

| Khu vực | Nội dung | Nguồn dữ liệu |
| --- | --- | --- |
| Đầu trang | Tên con (từ Bảo An), số sao (chỉ hiển thị), chuỗi ngày học, phút học SafeTime còn lại hôm nay, nút Đăng xuất / Thoát | `today` + SafeTime |
| Nhiệm vụ hôm nay | 4 thẻ môn Toán · Tiếng Việt · Tiếng Anh · Tin học: tuần hiện tại, số bộ đạt / tổng, thanh tiến độ, nút "Làm nhiệm vụ"; trạng thái "Đã xong hôm nay" khi hết bộ cần làm; "Chưa có bài" khi giáo viên chưa giao | `today.subjects[]` |
| Nhiệm vụ ngày | Danh sách ngắn nhiệm vụ ngày của Bảo An (ví dụ: "Trả lời đúng 10 câu", "Giải câu đố hôm nay") với dấu hoàn thành | `today.dailyMissions[]` |
| Luyện thi | Các đề thi thử của Bảo An (Violympic Toán, IOE Tiếng Anh…): thời gian làm bài, lần thi gần nhất và điểm | `today.contests[]` |
| Thi thật trên mạng | Violympic, IOE (trang chính thức) – "Nhập kết quả sau khi thi" | Cấu hình SafeTime |
| Phần mềm học tập khác | Ứng dụng phụ huynh đã thêm | Cấu hình SafeTime |
| Giới hạn của Bảo An | Nếu Bảo An đặt giới hạn phút học riêng: "Bảo An: còn 10 phút hôm nay"; hết thì thẻ môn hiện "Bảo An đã đủ giờ hôm nay" và không bấm được | `today.baoAnLimit` |

Thứ tự gợi ý: môn có nhiều bộ chưa đạt nhất đứng đầu và được đánh dấu "Nên làm trước".

---

## 4. Chạy Bảo An cùng máy (tùy chọn)

| Mục | Thiết kế |
| --- | --- |
| Thành phần | `SafeTime.BaoAnHost`: Windows Service nhỏ tên "SafeTime Bao An", chạy bằng tài khoản **LocalService** (quyền thấp, không phải SYSTEM) |
| Cấu hình | Phụ huynh chọn thư mục Bảo An (bản ZIP có `MO_BAO_AN.cmd`, hoặc thư mục mã nguồn đã `npm run build`); SafeTime tìm `node.exe` ≥ 22.22.2 |
| Chạy | `node --experimental-strip-types server/run-online.mjs` (mã nguồn) hoặc lệnh tương đương của bản ZIP; biến `BAO_AN_HOST=127.0.0.1`, `BAO_AN_PORT=4180`, `BAO_AN_DATA_DIR` = thư mục dữ liệu hiện có |
| Quyền | Bộ cài cấp cho LocalService quyền đọc thư mục Bảo An và đọc/ghi thư mục dữ liệu |
| Theo dõi | Gọi `GET /api/online/status` mỗi 30 giây; 3 lần liền không trả lời → khởi động lại; ghi nhật ký |
| Xung đột | Nếu cổng 4180 đã có Bảo An do người khác mở: không mở thêm (Bảo An cấm hai máy chủ cùng kho), chỉ kết nối |

---

## 5. Cổng kết nối – hợp đồng API (Bảo An cung cấp)

Tiền tố: `/api/integration/safetime/v1`. JSON UTF-8. Thời gian ISO 8601 UTC. Mọi lỗi trả `{ "error": { "code": "…", "message": "câu tiếng Việt" } }`.

**Xác thực**: header `Authorization: Bearer <khóa kết nối>` cho mọi lệnh trừ `pair` và `sso`. Bảo An so băm SHA-256 của khóa. **Chỉ nhận yêu cầu từ 127.0.0.1 / ::1** (trừ khi bật chế độ cloud ở phiên bản sau). Giới hạn 120 yêu cầu/phút mỗi khóa.

| # | Lệnh | Vào | Ra | Ghi chú |
| --- | --- | --- | --- | --- |
| 1 | `GET /status` | — | `{ version, integrationVersion: 1, paired: bool }` | Kiểm tra sức khỏe và phiên bản |
| 2 | `POST /pair` | `{ code, deviceName, deviceId }` | `{ token, workspace: {id,name}, students: [{id, displayName, className}] }` | Mã ghép đôi dùng một lần; sai 5 lần → khóa tạo mã 15 phút |
| 3 | `DELETE /pair` | — | `204` | SafeTime hủy kết nối; thu hồi mọi mã làm mới |
| 4 | `GET /students` | — | `[{id, displayName, className}]` | Học sinh được phép (phụ huynh có thể đổi trong Bảo An) |
| 5 | `POST /student-login` | `{ username, password, studentId, remember }` | `{ student: {id, displayName}, ticket, refreshToken? }` | Dùng **cùng** kiểm tra mật khẩu và `rateLimit` như `/login`; `studentId` là học sinh SafeTime đã nối với hồ sơ con – tài khoản khác bị từ chối `wrong_student` |
| 6 | `POST /student-refresh` | `{ refreshToken, studentId }` | `{ ticket, refreshToken }` | Mã làm mới 30 ngày, xoay vòng mỗi lần dùng |
| 7 | `POST /student-logout` | `{ refreshToken? }` | `204` | Thu hồi mã làm mới (khi con bấm Đăng xuất) |
| 8 | `GET /sso?ticket=…&to=…` | (trình duyệt học tập gọi) | `302` + `Set-Cookie` phiên học sinh | Vé dùng một lần, 60 giây; `to` chỉ nhận đích trong danh sách (mục 5.1) |
| 9 | `GET /students/{id}/today` | — | Dữ liệu Bảng nhiệm vụ (mục 5.2) | Chỉ đọc |
| 10 | `GET /events?after={cursor}&limit=100` | — | `{ events: [...], cursor }` | Chỉ đọc; giữ sự kiện 30 ngày |

### 5.1 Đích liên kết sâu (`to`)

| `to` | Mở trong Bảo An |
| --- | --- |
| `hoc/toan`, `hoc/tieng-viet`, `hoc/tieng-anh`, `hoc/tin-hoc` | Hành trình tuần hiện tại, lọc theo môn |
| `nhiem-vu` | Nhiệm vụ ngày |
| `thi/{presetId}` | Màn chuẩn bị thi của đề thi thử đó |
| `ban-do` | Bản đồ thế giới học tập |
| `qua` | Kệ quà (xem, đổi vật phẩm theo luồng sẵn có) |

Bảo An chuyển hướng tới `/?online=1#/<to>`; giao diện Bảo An cần đọc phần `#/…` để mở đúng màn.

### 5.2 Dữ liệu `today`

```json
{
  "student": { "id": "st_01", "displayName": "Minh", "className": "3A" },
  "date": "2026-11-07",
  "stars": { "available": 128, "note": "Chỉ đổi vật phẩm trên Kệ quà" },
  "streakDays": 5,
  "baoAnLimit": { "maxMinutesPerDay": 30, "usedMinutes": 18, "allowedStartHour": 7, "allowedEndHour": 21 },
  "subjects": [
    { "key": "toan", "label": "Toán", "week": 5, "packsPassed": 2, "packsTotal": 4, "state": "todo" },
    { "key": "tieng-viet", "label": "Tiếng Việt", "week": 5, "packsPassed": 3, "packsTotal": 3, "state": "done" },
    { "key": "tieng-anh", "label": "Tiếng Anh", "week": 5, "packsPassed": 0, "packsTotal": 3, "state": "todo" },
    { "key": "tin-hoc", "label": "Tin học", "week": 0, "packsPassed": 0, "packsTotal": 0, "state": "none" }
  ],
  "dailyMissions": [ { "id": "m1", "title": "Trả lời đúng 10 câu", "done": true } ],
  "contests": [
    { "presetId": "violympic-toan-3", "title": "Thi thử Violympic Toán lớp 3", "subject": "toan", "durationMinutes": 30,
      "last": { "score": 280, "maxScore": 300, "submittedAt": "2026-11-06T12:30:00Z" } }
  ]
}
```

`state`: `todo` (còn bộ chưa đạt) · `done` (đã đạt hết bộ tuần) · `none` (chưa được giao bài) · `locked` (Bảo An đã hết giờ hoặc ngoài khung giờ).

Các số trong ví dụ chỉ minh họa.

### 5.3 Sự kiện

| `type` | `data` | SafeTime làm gì |
| --- | --- | --- |
| `contest_submitted` | `sessionId, presetId, title, subject, score, maxScore, correctCount, totalItems, startedAt, submittedAt, status (submitted/timeout)` | Tạo kết quả nguồn "Thi thử Bảo An", Đã xác nhận; áp quy tắc thưởng nếu phụ huynh bật cho nguồn này |
| `week_completed` | `subject, week` | Ghi nhật ký; hiện trong Hôm nay |
| `badge_unlocked` | `badgeId, title` | Ghi nhật ký; hiện trong Hôm nay |
| `daily_study` | `date, minutes` | Hiện "phút học trong Bảo An" trên báo cáo tuần |
| `gift_delivered` | `giftTitle` (không có số sao) | Chỉ ghi nhật ký để phụ huynh tiện theo dõi; **không** cộng gì |

Mỗi sự kiện có `id` duy nhất; SafeTime bỏ qua sự kiện đã nhận (chống cộng lặp). Không có đáp án, câu sai, mật khẩu hay dữ liệu của học sinh khác.

---

## 6. Phần Bảo An phải bổ sung

| # | Việc | Tệp chính (dự kiến) |
| --- | --- | --- |
| B1 | Bảng `integration_clients` (khóa băm, thiết bị, học sinh được phép, ngày tạo, ngày dùng cuối, thu hồi), `integration_pair_codes`, `integration_tickets`, `integration_refresh_tokens`, `integration_events`; migration SQLite và PostgreSQL, tăng phiên bản schema | `server/online-store.mjs`, `server/postgres-store.mjs`, `supabase/migrations/2026111xxxxx_safetime.sql` |
| B2 | Module `server/safetime-integration.mjs`: định tuyến 10 lệnh, chỉ nhận loopback, kiểm tra khóa, giới hạn tần suất | mới |
| B3 | Đăng nhập học sinh qua cổng: dùng lại `verifyPassword`, `rateLimit`, kiểm tra học sinh được phép và đúng học sinh được nối | `online-server.mjs` (tách hàm dùng chung) |
| B4 | Vé SSO và mã làm mới: tạo, dùng một lần, hết hạn, xoay vòng, thu hồi | `safetime-integration.mjs` |
| B5 | Ghi sự kiện tại các điểm sẵn có: nộp bài thi, hoàn thành tuần, mở huy hiệu, chốt phút học cuối ngày, "Đã trao" | `contest-data.mjs`, `online-store.mjs` |
| B6 | Dữ liệu `today` gom từ hành trình, nhiệm vụ ngày, ví sao (chỉ đọc số dư), giới hạn phụ huynh, đề thi thử | `safetime-integration.mjs` |
| B7 | Liên kết sâu `#/hoc/{môn}`, `#/nhiem-vu`, `#/thi/{presetId}`, `#/ban-do`, `#/qua` trong giao diện học sinh | `src/screens/…`, `src/main.tsx` |
| B8 | Khu phụ huynh: thẻ **Kết nối SafeTime** – tạo mã ghép đôi, chọn học sinh, danh sách thiết bị đã kết nối, nút Ngắt kết nối | `src/screens/…` (khu phụ huynh) |
| B9 | Kiểm thử: `tests/safetime-integration.test.mjs` (ghép đôi, khóa sai, loopback, đăng nhập sai/khóa, sai học sinh, vé dùng lại, hết hạn, đích không hợp lệ, sự kiện không lặp, không lộ đáp án, không ghi sao) và thêm vào `npm test` | mới |
| B10 | Tài liệu: `docs/KET_NOI_SAFETIME.md` (bản sao tài liệu này), mục mới trong `HUONG_DAN_PHU_HUYNH.md` | docs |

Bảo An **không** cần đổi giao diện học, luật sao hay luồng đổi quà.

---

## 7. Phần SafeTime phải bổ sung

| # | Việc |
| --- | --- |
| S1 | `BaoAnClient` (Service): gọi cổng kết nối, thử lại có giãn cách, đo thời gian chờ ≤ 5 giây |
| S2 | Lưu cấu hình kết nối: địa chỉ, khóa (DPAPI), nối hồ sơ con ↔ học sinh, mã làm mới theo hồ sơ (DPAPI) |
| S3 | Màn hình phụ huynh **Cài đặt › Kết nối Bảo An**: nhập địa chỉ, mã ghép đôi, nối học sinh, trạng thái, đồng bộ lần cuối, chạy Bảo An cùng máy, ngắt kết nối |
| S4 | Màn hình **Đăng nhập Bảo An** (con) |
| S5 | **Bảng nhiệm vụ học tập** thay cho hộp chọn mục đích cũ |
| S6 | Trình duyệt học tập: hồ sơ WebView2 riêng mỗi con, mở `sso`, xóa phiên khi kết thúc |
| S7 | `BaoAnSync`: đồng bộ sự kiện mỗi 60 giây và khi kết thúc phiên học; nhập kết quả thi thử; ghi nhật ký |
| S8 | Quy tắc thưởng có trường Nguồn; mặc định chỉ Thi thật |
| S9 | Thẻ Hôm nay và Nhật ký hiện số liệu Bảo An |
| S10 | `SafeTime.BaoAnHost` (tùy chọn) và phần bộ cài tương ứng |

---

## 8. Bảo mật

| Rủi ro | Biện pháp |
| --- | --- |
| Phần mềm lạ trên máy gọi cổng kết nối | Cần khóa kết nối; khóa chỉ dịch vụ SafeTime giải mã được (DPAPI + quyền thư mục) |
| Truy cập cổng từ máy khác trong mạng | Bảo An chỉ nhận loopback; mặc định Bảo An đã chỉ nghe `127.0.0.1` |
| Con dùng tài khoản Bảo An của anh chị/bạn | Đăng nhập chỉ chấp nhận đúng học sinh đã nối với hồ sơ con đang dùng máy (`wrong_student`) |
| Lộ mật khẩu học sinh | Mật khẩu gõ trong cửa sổ SafeTime, gửi một lần qua loopback, **không lưu**; lưu mã làm mới thay vì mật khẩu |
| Vé SSO bị dùng lại | Vé một lần, 60 giây, gắn với học sinh |
| Con ra khỏi Bảo An sang trang khác | Lọc web chế độ Học tập chỉ cho địa chỉ Bảo An (và danh sách trắng khác) |
| Cộng giờ hoặc sao gian | Cổng không có lệnh ghi sao/quà; sự kiện chỉ đọc, có `id` chống lặp; kết quả thi do máy chủ Bảo An chấm |
| Phụ huynh muốn ngắt | Ngắt ở bất kỳ bên nào: Bảo An thu hồi khóa, SafeTime xóa khóa và mã làm mới |

---

## 9. Ngoài phạm vi phiên bản này

- Bảo An chạy trên Netlify/Supabase (cloud): cùng hợp đồng API nhưng cần HTTPS, bỏ ràng buộc loopback, xác thực mạnh hơn → phiên bản 2.
- Đồng bộ cài đặt giới hạn giữa hai bên (mỗi bên giữ cài đặt riêng).
- Gộp PIN hai bên (giữ riêng: Bảo An 4 số, SafeTime 6 số).
- Đổi sao lấy thời gian: **không làm** (quyết định của phụ huynh ngày 07/11/2026).
