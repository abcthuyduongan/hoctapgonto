# BÁO CÁO TIẾN ĐỘ TUẦN 4: HUY HIỆU, CHUỖI NGÀY VÀ NHIỆM VỤ NGÀY (CỔNG C4)

**Thời gian thực hiện:** 30/11/2026 – 06/12/2026  
**Trạng thái Cổng C4:** **ĐẠT (PASS 100%)**  
**Người thực hiện:** Hệ thống tự động theo kế hoạch tuần và PROMPT 2  

---

## 1. Mục tiêu và Kết quả Tuần 4

| Hạng mục | Mô tả yêu cầu | Trạng thái | Chi tiết triển khai |
| :--- | :--- | :---: | :--- |
| **T4.1 Danh mục 12 Huy hiệu** | 12 huy hiệu với điều kiện, độ khó & tính điều kiện còn thiếu | **ĐẠT** | Triển khai trong `src/core/badges.ts` với đầy đủ 12 huy hiệu (`streak_7`, `fix_10_errors`, `perfect_memory`, `perfect_week`, `explorer_all_games`, `speedy_10_perfect`, `first_lesson`, `persistent_50_questions`, `math_genius_5`, `vietnamese_master_5`, `english_star_5`, `streak_14`). Tính toán câu thông báo còn thiếu trực quan ("Còn thiếu ... để đạt huy hiệu này"). |
| **T4.2 Chuỗi ngày học an toàn múi giờ** | Chuỗi ngày theo múi giờ Việt Nam UTC+7, 1 ngày đóng băng/tuần | **ĐẠT** | Định dạng ngày theo `Asia/Ho_Chi_Minh` (chuyển ngày chuẩn xác tại 00:00:00 UTC+7). Cơ chế 5 câu đúng/ngày để đủ điều kiện chuỗi. 1 ngày đóng băng miễn phí mỗi tuần tự động kích hoạt khi học sinh lỡ 1 ngày; nếu nghỉ $\ge 2$ ngày chuỗi quay về 0. |
| **T4.3 Nhiệm vụ ngày (Daily Missions)** | 3 nhiệm vụ ngày: Bài mới, Sửa sai, Câu đố ngày | **ĐẠT** | Hệ thống 3 nhiệm vụ tự động làm mới mỗi ngày lúc 00:00 UTC+7: `new_lesson` (1 bài mới), `review_error` (1 câu sửa sai), `daily_riddle` (câu đố tương tác nhanh). |
| **T4.4 Bảo toàn Bất biến CC8** | Huy hiệu & nhiệm vụ không gây lạm phát sao ví | **ĐẠT** | Toàn bộ huy hiệu và nhiệm vụ ngày chỉ ghi nhận thành tựu và khích lệ tinh thần; sao ví phục vụ đổi quà vẫn bảo toàn nguyên vẹn từ `question-rewards.ts` (tối đa 3 sao/câu hỏi, chỉ bù sao chênh lệch khi làm lại đạt điểm cao hơn). |
| **T4.5 Sổ huy hiệu & Giao diện học sinh** | Nút Chuỗi ngày, Nhiệm vụ ngày & Sổ huy hiệu | **ĐẠT** | Tích hợp Streak Pill có hoạt họa ngọn lửa, nút Nhiệm vụ ngày hiển thị số lượng hoàn thành, và nút Sổ huy hiệu trên thanh điều hướng học sinh. Các dialog `StreakDialog.tsx`, `DailyMissionDialog.tsx`, `BadgeShowcaseDialog.tsx` đều tuân thủ chế độ giảm chuyển động `data-motion="off"`. |
| **T4.6 Database & Migrations** | Lưu trữ chuỗi ngày, nhiệm vụ và huy hiệu | **ĐẠT** | PostgreSQL migration `supabase/migrations/202611050003_badges.sql` với RLS bật và phân quyền tenant; SQLite schema đồng bộ trong `server/online-store.mjs`. Tối ưu CTE trong PostgreSQL giúp giữ số lượng truy vấn cho `answer` ở đúng 12 truy vấn và `studentSummary` ở 4 truy vấn. |

---

## 2. Minh chứng Kiểm thử & Cổng Chất lượng

### 2.1. Kiểm thử Đơn vị & Tích hợp (`tests/badges-streaks.test.mjs`)
- **8/8 bài test PASS (100%)**:
  1. `Timezone boundary: 23:59 and 00:01 in Vietnam time strictly belong to two different days` - **PASS**
  2. `Streak pure functions: qualification, daily increment, freeze, and reset` - **PASS**
  3. `Streak computation handles inactive gap and displays status messages` - **PASS**
  4. `Badges: 12 catalog badges, missing requirements calculation and auto-award` - **PASS**
  5. `OnlineStore SQLite: Streak advances on 5 correct attempts and updates daily missions` - **PASS**
  6. `OnlineStore SQLite: Badges are awarded automatically upon reaching criteria and are idempotent` - **PASS**
  7. `Regression CC8: Badges and missions preserve star balance strictly` - **PASS**
  8. `PostgresStore: Streak, Missions, Badges, and CC8 Star Preservation` - **PASS**

### 2.2. Kiểm thử Hiệu năng & Giới hạn Truy vấn (`tests/postgres-latency.test.mjs`)
- **2/2 bài test PASS (100%)**:
  - `summary`: đúng 4 truy vấn (ngân sách $\le 4$)
  - `answer`: đúng 12 truy vấn (ngân sách $\le 12$) nhờ kỹ thuật CTE ghi nhận `attempts` và `student_streaks` trong 1 round-trip.
  - Toàn bộ latency và tenant isolation đạt 100%.

### 2.3. Kiểm thử Trực quan Đầu cuối (`tests/visual/online-badges.spec.ts`)
- **Chromium (`online-chrome`)**: **PASS (4.6s)**
- **Microsoft Edge (`online-msedge`)**: **PASS (4.3s)**
- Kiểm tra toàn diện luồng người dùng:
  - Học sinh đăng nhập thấy Streak Pill với thông tin chuỗi ngày học hiện tại.
  - Click mở `StreakDialog`: hiển thị lịch tuần, số ngày đóng băng còn lại (1 ngày), mục tiêu 5 câu đúng.
  - Click mở `DailyMissionDialog`: 3 nhiệm vụ ngày hiển thị đầy đủ thanh tiến độ và câu đố ngày.
  - Trả lời câu đố ngày tương tác: nhận diện đáp án đúng, tự động đánh dấu hoàn thành nhiệm vụ.
  - Click mở `BadgeShowcaseDialog`: album 12 huy hiệu hiển thị rõ ràng, huy hiệu chưa mở hiển thị điều kiện còn thiếu, bộ lọc tab hoạt động chính xác.

### 2.4. Toàn bộ Hệ thống Tests
- `npm run typecheck`: **PASS (0 errors)**
- `tests/check-tsx.mjs`: **PASS (tất cả file ts/tsx chuẩn cú pháp)**
- `npm run test:assets`: **PASS (83 files, 4.87 MiB <= 16 MiB budget)**
- `npm test`: **PASS (293/293 tests pass, 0 fail, 0 skipped)**
  - `test:syntax`: PASS
  - `test:release`: 12/12 PASS
  - `test:online`: 218/218 PASS
  - `test:cloud`: 37/37 PASS
  - `test:map`: 26/26 PASS

---

## 3. Các Tệp Tạo mới & Nâng cấp

1. `supabase/migrations/202611050003_badges.sql`: Schema PostgreSQL cho `badge_awards`, `student_streaks`, `daily_missions` với RLS và indexes.
2. `src/core/badges.ts`: Logic thuần túy danh mục 12 huy hiệu, múi giờ Việt Nam UTC+7, tính chuỗi ngày, đóng băng, nhiệm vụ ngày và yêu cầu còn thiếu.
3. `src/core/online-contracts.ts`: Cập nhật interface `OnlineStudentSummary`, `BadgeInfo`, `StreakInfo`, `DailyMissionInfo`, `DailyRiddleQuestion`.
4. `src/core/online-client.ts`: Thêm các SDK client methods: `badges`, `streak`, `dailyMissions`, `answerDailyRiddle`.
5. `server/online-store.mjs`: Phương thức SQLite quản lý streak, missions, daily riddle, badge awards; tối ưu hóa không gọi legacy full-content traversal.
6. `server/postgres-store.mjs`: Phương thức PostgreSQL đồng bộ với CTE ghi nhận streak và attempt trong 1 round-trip.
7. `server/online-server.mjs` & `server/cloud-api.mjs`: API endpoints RESTful cho `/student/badges`, `/student/streak`, `/student/daily-missions`, `/student/daily-riddle/answer`.
8. `src/components/StreakDialog.tsx` & `src/styles/streak.css`: Dialog chuỗi ngày học và lịch tuần.
9. `src/components/DailyMissionDialog.tsx` & `src/styles/daily-missions.css`: Dialog 3 nhiệm vụ ngày và tương tác câu đố ngày.
10. `src/components/BadgeShowcaseDialog.tsx` & `src/styles/badges.css`: Dialog Sổ huy hiệu 12 thành tựu với bộ lọc và điều kiện còn thiếu.
11. `src/screens/OnlineStudentWorld.tsx`: Tích hợp các nút Streak pill, Daily Missions và Badges vào header học sinh.
12. `tests/badges-streaks.test.mjs`: Suite kiểm thử chuyên sâu cho múi giờ UTC+7, streak, auto-award huy hiệu, CC8 star preservation.
13. `tests/visual/online-badges.spec.ts`: Suite kiểm thử giao diện Playwright trên Chromium và Edge.

---

## 4. Kết luận & Chuyển tiếp

Cổng C4 đã được đánh giá kỹ lưỡng và **ĐẠT 100%**.  
Theo chỉ đạo của người dùng: "nếu đã đạt thì tự động thực hiện kế hoạch của tuần tiếp theo không cần tôi cho phép nữa", hệ thống tự động tiến hành **Tuần 5 (07/12 – 13/12): Minigame có bối cảnh (đợt 1) (Cổng C5)**.
