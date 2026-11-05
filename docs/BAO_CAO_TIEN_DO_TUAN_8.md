# BÁO CÁO TIẾN ĐỘ TUẦN 8: THỊ TRẤN CỦA CON, PHẦN 1 (CỔNG C8)

**Thời gian thực hiện:** 28/12/2026 – 03/01/2027  
**Trạng thái Cổng C8:** **ĐẠT (PASS 100%)**  
**Người thực hiện:** Hệ thống tự động theo kế hoạch tuần và PROMPT 2  

---

## 1. Mục tiêu và Kết quả Tuần 8

| Hạng mục | Mô tả yêu cầu | Trạng thái | Chi tiết triển khai |
| :--- | :--- | :---: | :--- |
| **T8.1 Bốn Loại Vật Liệu Theo Môn Học** | Toán $\rightarrow$ Đá, Tiếng Việt $\rightarrow$ Gỗ, Tiếng Anh $\rightarrow$ Cá, Tin học $\rightarrow$ Linh kiện. Lưu `materials_ledger`. Idempotency khi gửi lại. | **ĐẠT** | Triển khai hợp đồng `MaterialType` và ánh xạ môn học chuẩn `SUBJECT_MATERIAL_MAP`: Toán học (`math` $\rightarrow$ `stone`), Tiếng Việt (`vietnamese` $\rightarrow$ `wood`), Tiếng Anh (`english` $\rightarrow$ `fish`), Tin học (`computing` $\rightarrow$ `component`). Ghi nhận vật liệu qua sổ cái bất biến `bao_an.materials_ledger` với `requestId` đảm bảo tính lũy thừa (idempotent - gửi lại không sinh thêm vật liệu). Hàm `syncAwardMaterial` tự động đồng bộ vật liệu khi hoàn thành bài tập mà không làm tăng số lượng truy vấn giữa trận (`finishPlay`). |
| **T8.2 Tính Toán Lại Toàn Bộ Vật Liệu Từ Awards** | Xóa sổ cái vật liệu rồi tính lại từ danh sách giải thưởng (`awards`) vẫn ra đúng số hiện có | **ĐẠT** | Triển khai hàm nghiệp vụ chuẩn `recalculateMaterials` (cả trong `src/core/town-materials.ts`, `server/online-store.mjs` và `server/postgres-store.mjs`). Hệ thống quét toàn bộ `awards` của học sinh, suy diễn môn học qua `pack_id`, tính tổng vật liệu kiếm được theo số sao giải thưởng đạt được, trừ đi tổng chi phí của các công trình đã xây trong `town_state`, tái lập chính xác 100% số dư khả dụng ngay cả khi xóa sạch dữ liệu bảng `materials_ledger`. Đã kiểm chứng qua test tự động `TOWN-03` và `TOWN-04`. |
| **T8.3 Thị Trấn Lưới 10 × 10 & Khóa Lạc Quan (Revision)** | Lưu `town_state` có `revision`. Hai tab cùng đặt: một bên được, bên kia nhận thông báo tải lại (409 Conflict), không mất vật liệu | **ĐẠT** | Mô hình dữ liệu thị trấn `bao_an.town_states` chứa lưới tọa độ $10 \times 10$ ($x \in [0, 9], y \in [0, 9]$) và trường số nguyên phiên bản `revision`. Cơ chế khóa lạc quan (optimistic concurrency control) kiểm tra chặt chẽ `expectedRevision === currentRevision`. Khi hai phiên/tab cùng đặt công trình, bên đến sau bị từ chối với mã HTTP `409 Conflict` kèm thông báo *"Thị trấn đã được cập nhật từ thiết bị khác. Vui lòng tải lại!"*, đồng thời giao dịch bị rollback hoàn toàn, giữ nguyên vẹn 100% số vật liệu của học sinh. |
| **T8.4 Danh Mục 12 Công Trình Đầu Tiên** | Giá theo vật liệu. Công trình lớn cần vật liệu từ 2–3 môn học. Máy chủ kiểm tra đủ vật liệu trước khi trừ | **ĐẠT** | Khai báo danh mục chuẩn `TOWN_BUILDING_CATALOG` gồm 12 công trình độc đáo: Nhà tranh nhỏ, Nhà gỗ thông, Cây cổ thụ ước nguyện, Giếng nước thần tiên, Vườn hoa bốn mùa, Cầu gỗ bắc qua suối, Thư viện mi ni, Chợ làng nhộn nhịp, Cối xay gió, Tháp chuông thị trấn, Đèn đường lung linh, Bến thuyền câu cá. Các công trình trọng điểm kết hợp chi phí 2 đến 3 môn (ví dụ: Thư viện mi ni cần 6 Gỗ + 4 Linh kiện; Cối xay gió cần 10 Đá + 8 Gỗ + 4 Linh kiện). Máy chủ thực hiện thẩm định đa lớp qua `canAffordBuilding` trước khi ghi nhận vào lưới và sổ cái. |
| **T8.5 Bảo Vệ Tuyệt Đối Ví Sao (Không Mất Sao Khả Dụng)** | Xây dựng công trình trong thị trấn **không làm thay đổi số sao khả dụng** trong ví học sinh | **ĐẠT** | Nguyên tắc kinh tế học tập độc lập được giữ vững tuyệt đối: việc xây dựng thị trấn tiêu tốn **vật liệu xây dựng** (`wood`, `stone`, `fish`, `component`), hoàn toàn không can thiệp hay trừ bất kỳ ngôi sao nào từ ví đổi quà (`wallet stars balance`). Đã kiểm chứng qua kiểm thử đơn vị, kiểm thử tích hợp cơ sở dữ liệu và kiểm thử giao diện trình duyệt trực quan. |
| **T8.6 Bộ 12 Ảnh Tĩnh Công Trình Trong Suốt (WebP)** | Nền trong suốt (alpha), dung lượng $\le 60\text{ KB}$ mỗi ảnh. Bổ sung mục "Thị trấn" vào `BO_ANH_BAN_DO_PROMPT_TAO_ANH.md` | **ĐẠT** | Đã tạo toàn bộ 12 ảnh công trình WebP chuẩn 2D phong cách anime ấm áp thiếu nhi tại thư mục `public/art/town/` với nền trong suốt (alpha transparency). Dung lượng từ 3.5 KB đến 7.1 KB (rất nhỏ, vượt xa chỉ tiêu $\le 60\text{ KB}$). Bổ sung mục "5b. Khuôn ảnh công trình Thị trấn (12 công trình)" với hướng dẫn prompt chi tiết vào tài liệu chuẩn `docs/BO_ANH_BAN_DO_PROMPT_TAO_ANH.md`. |
| **T8.7 Giao Diện Thị Trấn Của Con (`TownScreen.tsx`)** | Giao diện tương tác trực quan: lưới $10 \times 10$, thanh đếm vật liệu, danh mục công trình, hộp thoại xác nhận đặt và xử lý xung đột 409 | **ĐẠT** | Phát triển thành phần `src/screens/TownScreen.tsx` và stylesheet `src/styles/town.css`. Tích hợp liền mạch vào bản đồ học tập `OnlineStudentWorld.tsx` thông qua nút `"🏡 Thị trấn"` trên thanh điều hướng chính. Giao diện tối ưu cho màn hình cảm ứng lẫn chuột, có xem trước vị trí đặt, báo lỗi khi không đủ vật liệu hoặc ô đã có công trình, hiển thị huy hiệu ví sao an toàn *"⭐ Số sao trong ví đổi quà được bảo vệ nguyên vẹn"*, và nút tái đồng bộ vật liệu khi cần. |

---

## 2. Minh chứng Kiểm thử & Cổng Chất lượng (Cổng C8)

### 2.1. Kiểm thử Đơn vị & Tích hợp (`tests/town.test.mjs`)
- **5/5 bài kiểm thử PASS (100%)**:
  1. `TOWN-01: Pure material calculations by subject and catalog pricing`: **PASS**
  2. `TOWN-02: evaluateBuildingPlacement validation and optimistic locking`: **PASS**
  3. `TOWN-03: SQLite OnlineStore full town journey, wallet star safety, and recalculation gate`: **PASS**
  4. `TOWN-04: PostgreSQL Store town state, optimistic concurrency, and recalculation`: **PASS**
  5. `TOWN-05: Cloud API /town endpoints and revision conflict response`: **PASS**

### 2.2. Kiểm thử Trực Quan Đầu Cuối E2E (`tests/visual/online-town.spec.ts`)
- **Chromium (`online-chrome`)**: **PASS (4.1s)**
- **Microsoft Edge (`online-msedge`)**: **PASS (4.8s)**
- Kịch bản kiểm thử trực quan hoàn chỉnh trên trình duyệt thực tế:
  1. Khởi tạo tài khoản học sinh, nạp vật liệu ban đầu vào sổ cái.
  2. Học sinh đăng nhập, nhấp nút `"🏡 Thị trấn"` trên thanh header bản đồ.
  3. Màn hình Thị trấn mở ra: hiển thị đủ 4 loại vật liệu (Đá, Gỗ, Cá, Linh kiện), lưới $10 \times 10$ sẵn sàng, huy hiệu an toàn ví sao.
  4. Mở danh mục công trình (12 loại), chọn "Nhà gỗ thông" (chi phí 3 Gỗ + 2 Đá).
  5. Chọn tọa độ $(3, 3)$ trên lưới, hộp thoại xác nhận hiện ra.
  6. Bấm "Xác nhận xây dựng": công trình xuất hiện trên ô lưới với ảnh sprite WebP trong suốt, số vật liệu tự động trừ chính xác.
  7. Nhấp nút "🔄 Đồng bộ vật liệu": hệ thống quét lại giải thưởng và bảo toàn tính nhất quán.
  8. Nhấp nút "✕ Quay về Bản đồ": đóng giao diện thị trấn an toàn và trở lại giao diện thế giới học tập.

### 2.3. Ngân Sách Tài Nguyên Đồ Họa (`npm run test:assets`)
- **Tổng số tệp tài sản:** 110 files.
- **Tổng dung lượng toàn bộ tài sản:** 5.05 MiB (nằm an toàn trong ngân sách 8.00 MiB).
- **12 ảnh công trình thị trấn:** Tất cả đều dưới 7.1 KB (tiêu chuẩn yêu cầu $\le 60\text{ KB}$).

### 2.4. Độ Trễ Cơ Sở Dữ Liệu PostgreSQL (`tests/postgres-latency.test.mjs`)
- `firstGame`: 13 queries $\le$ 13 budget.
- `answer`: 12 queries $\le$ 12 budget.
- Đảm bảo việc thêm sổ cái vật liệu không gây phát sinh thêm truy vấn trong quá trình làm bài tập.

### 2.5. Toàn Bộ Hệ Thống Tests
- `npm run typecheck`: **PASS (0 errors)**
- `npm run test:syntax`: **PASS (toàn bộ src/*.ts và src/*.tsx hợp lệ)**
- `npm run test:release`: **PASS (12/12 tests pass)**
- `npm run test:map`: **PASS (26/26 tests pass)**
- `npm run test:cloud`: **PASS (45/45 tests pass)**
- `npm run test:online`: **PASS (243/243 tests pass)**
- `npm run build`: **PASS (biên dịch production hoàn tất trong 1.40s)**

---

## 3. Kết luận và Tự động Chuyển tiếp

- **Cổng C8 (Tuần 8)** đã được kiểm tra, đánh giá đạt 100% tất cả các tiêu chí chất lượng và quy chuẩn kỹ thuật.
- Theo đúng quy định trong chỉ đạo của người dùng:
  *"Thực hiện kế hoạch của tuần tiếp theo mỗi khi xong. thì thực hiện kiểm tra đánh giá nếu đã đạt thì tự động thực hiện kế hoạch của tuần tiếp theo không cần tôi cho phép nữa"*,
  hệ thống **tự động chuyển sang thực hiện Tuần 9 (04/01 – 10/01): Thị trấn phần 2, bảng tin lớp, minigame đợt 2 (Cổng C9)** ngay bây giờ.
