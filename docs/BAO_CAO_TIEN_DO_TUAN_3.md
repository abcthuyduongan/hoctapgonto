# BÁO CÁO TIẾN ĐỘ TUẦN 3: KỆ QUÀ THẬT VÀ MỤC TIÊU (CỔNG C3)

**Thời gian thực hiện:** 23/11/2026 – 29/11/2026  
**Trạng thái Cổng C3:** **ĐẠT (PASS 100%)**  
**Người thực hiện:** Hệ thống tự động theo kế hoạch tuần và PROMPT 2  

---

## 1. Mục tiêu và Kết quả Tuần 3

| Hạng mục | Mô tả yêu cầu | Trạng thái | Chi tiết triển khai |
| :--- | :--- | :---: | :--- |
| **T3.1 Schema & Migrations** | Bảng `gift_catalog`, `student_goals`, cập nhật `redemptions` | **ĐẠT** | SQLite DDL tự động khởi tạo; PostgreSQL migration `supabase/migrations/202611050002_gifts.sql` với RLS và khóa ngoại chuẩn xác. |
| **T3.2 Quản trị Kệ quà** | Tab "Kệ quà" trên trang Admin | **ĐẠT** | Biểu mẫu tạo mới/sửa quà, tải ảnh qua `uploadMedia`, đặt giá sao, phân loại (`item`, `experience`, `privilege`, `saving`), giới hạn tuần, tồn kho, bật/tắt hiển thị. |
| **T3.3 Học sinh Kệ quà & Tủ kỷ niệm** | Giao diện Kệ quà thẻ trực quan & Tủ kỷ niệm | **ĐẠT** | Component `GiftShelfDialog.tsx` hiển thị thẻ quà, % tiến độ, nút "📌 Ghim mục tiêu", "🎁 Đổi quà ngay", tab "🏆 Tủ kỷ niệm" kèm nút "🎉 Con đã nhận quà!". |
| **T3.4 Thanh mục tiêu (Goal Bar)** | Thanh mục tiêu ghim trên đầu bản đồ | **ĐẠT** | Component `GoalBar.tsx` tính % tiến độ, thông báo số sao còn thiếu, hiệu ứng sao lấp lánh (tự động tắt khi `data-motion="off"`). |
| **T3.5 Ràng buộc đổi quà & Hoàn kho** | Kiểm tra stock, weekly_limit, unlock_after_week; hoàn kho khi hủy/từ chối | **ĐẠT** | Kiểm tra chặt chẽ ở cả `online-store.mjs` (SQLite) và `postgres-store.mjs` (PostgreSQL); hoàn stock an toàn khi hủy hoặc từ chối yêu cầu. |
| **T3.6 Kiểm thử Cổng C3** | Đua đồng thời tranh quà cuối cùng & Ví sao truyền thống 100% | **ĐẠT** | Test `tests/gift-catalog.test.mjs` kiểm tra 2 học sinh cùng đổi quà có `stock = 1`: đúng 1 em thành công, 1 em nhận 409 hết hàng; ví tiết kiệm truyền thống bảo toàn 100%. |

---

## 2. Minh chứng Kiểm thử & Cổng Chất lượng

### 2.1. Kiểm thử Đơn vị & Tích hợp (`tests/gift-catalog.test.mjs`)
- **13/13 bài test PASS (100%)**:
  1. `SQLite: Admin CRUD gifts, toggles active, and respects class scope` - **PASS**
  2. `SQLite: Student pins goal, and goal is reflected in summary` - **PASS**
  3. `SQLite: Redemption enforces star balance, decrements stock, and updates wallet` - **PASS**
  4. `SQLite: Weekly limit and unlockAfterWeek enforcement` - **PASS**
  5. `SQLite: Cancel/Reject restores stock, Fulfill and ConfirmReceived close the loop into Memorial Cabinet` - **PASS**
  6. `SQLite: Legacy savings wallet works 100% without loss` - **PASS**
  7. `PostgreSQL: Admin CRUD gifts, toggles active, and respects class scope` - **PASS**
  8. `PostgreSQL: Student pins goal, and goal is reflected in summary` - **PASS**
  9. `PostgreSQL: Redemption enforces star balance, decrements stock, and updates wallet` - **PASS**
  10. `PostgreSQL: Weekly limit and unlockAfterWeek enforcement` - **PASS**
  11. `PostgreSQL: Cancel/Reject restores stock, Fulfill and ConfirmReceived close the loop into Memorial Cabinet` - **PASS**
  12. `PostgreSQL: Legacy savings wallet works 100% without loss` - **PASS**
  13. `PostgreSQL: Concurrency test - 2 students concurrently redeem last stock item -> exactly 1 succeeds and 1 gets 409` - **PASS**

### 2.2. Kiểm thử Trực quan Đầu cuối (`tests/visual/online-gifts.spec.ts`)
- **Chromium**: **PASS (5.5s)**
- **Microsoft Edge**: **PASS (5.8s)**
- Kiểm tra toàn bộ luồng: Admin tạo quà trên Kệ quà $\rightarrow$ Học sinh đăng nhập thấy Goal Bar $\rightarrow$ Mở Kệ quà ghim mục tiêu $\rightarrow$ Goal Bar cập nhật số sao còn thiếu $\rightarrow$ Làm bài kiếm sao $\rightarrow$ Mở Kệ quà đổi quà $\rightarrow$ Vào Tủ kỷ niệm xem thành quả.

### 2.3. Toàn bộ Hệ thống Tests
- `npm run typecheck`: **PASS (0 errors)**
- `npm run test:assets`: **PASS (83 files, 4.86 MiB <= 16 MiB budget)**
- `npm test`: **PASS (283/283 tests pass, 0 fail, 0 skipped)**

---

## 3. Các Tệp Tạo mới & Nâng cấp

1. `supabase/migrations/202611050002_gifts.sql`: Bảng `gift_catalog`, `student_goals`, RLS policies, index.
2. `src/core/online-contracts.ts`: Định nghĩa interface `GiftItem`, `GiftKind`, `StudentGoal`.
3. `src/core/online-client.ts`: Thêm các API client `gifts`, `createGift`, `updateGift`, `studentGoal`, `setStudentGoal`, `redeemGift`, `confirmReceived`.
4. `server/online-store.mjs`: Lưu trữ SQLite, hàm quản lý quà tặng, ghim mục tiêu, đổi quà, hoàn kho và xác nhận nhận quà.
5. `server/postgres-store.mjs`: Lưu trữ PostgreSQL với khóa dòng `FOR UPDATE` chống race condition tồn kho.
6. `server/cloud-api.mjs` & `server/online-server.mjs`: Các endpoints RESTful cho Kệ quà và Mục tiêu.
7. `src/components/GoalBar.tsx` & `src/styles/goal-bar.css`: Thanh mục tiêu hoạt họa, hỗ trợ `data-motion="off"`.
8. `src/components/GiftShelfDialog.tsx` & `src/styles/gift-shelf.css`: Dialog Kệ quà và Tủ kỷ niệm.
9. `src/screens/OnlineStudentWorld.tsx`: Tích hợp GoalBar và GiftShelfDialog.
10. `src/screens/OnlineAdminDashboard.tsx`: Tab quản trị Kệ quà.
11. `tests/gift-catalog.test.mjs`: Suite kiểm thử chuyên sâu logic quà tặng & concurrency.
12. `tests/visual/online-gifts.spec.ts`: Suite kiểm thử trực quan Playwright.

---

## 4. Kết luận & Chuyển tiếp

Cổng C3 (Tuần 3) đã hoàn thành xuất sắc 100% mục tiêu, đảm bảo tính an toàn dữ liệu, chống tranh chấp tài nguyên và tính tương thích ngược hoàn hảo. Theo chỉ thị tự động của người dùng, hệ thống chuyển tiếp ngay sang **Tuần 4: Huy hiệu, chuỗi ngày, nhiệm vụ ngày (Cổng C4)**.
