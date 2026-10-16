# Kiểm thử giao diện cũ được giữ theo yêu cầu

Quyết định ngày 16/10/2026: chủ dự án chọn giữ nhóm kiểm thử cũ. Danh sách này không phải danh sách chờ xóa.

34 tệp, 444114 byte. Các tệp này dùng giao diện App/IndexedDB, trang soạn và điều hướng đã gỡ. Cấu hình đang dùng chỉ chạy online*.spec.ts với API/SQLite thật; kiểm thử đồ họa và năm game của luồng mới được giữ.

- tests/visual/art-world.spec.ts
- tests/visual/b0-content.spec.ts
- tests/visual/b0-offline.spec.ts
- tests/visual/b0-session.spec.ts
- tests/visual/b0-ui.spec.ts
- tests/visual/ba08-backup.spec.ts
- tests/visual/ba08-storage.spec.ts
- tests/visual/ba09-attempt.spec.ts
- tests/visual/ba10-finalizer.spec.ts
- tests/visual/ba11-self-study.spec.ts
- tests/visual/ba12-assessment.spec.ts
- tests/visual/ba13-pilot.spec.ts
- tests/visual/ba14-parent-review.spec.ts
- tests/visual/ba15-rich.spec.ts
- tests/visual/ba16-contest.spec.ts
- tests/visual/ba19-import.spec.ts
- tests/visual/ba20-game-storage.spec.ts
- tests/visual/ba20-wallet.spec.ts
- tests/visual/backup-profile.spec.ts
- tests/visual/character-entry.spec.ts
- tests/visual/design-match290.spec.ts
- tests/visual/game-journey.spec.ts
- tests/visual/game-rewards.spec.ts
- tests/visual/game-scene.spec.ts
- tests/visual/gameplay-regression.spec.ts
- tests/visual/island-carousel.spec.ts
- tests/visual/mobile-ui-lock.spec.ts
- tests/visual/performance-world.spec.ts
- tests/visual/premium-world.spec.ts
- tests/visual/premium280.spec.ts
- tests/visual/real3d31.spec.ts
- tests/visual/stability-alpha27.spec.ts
- tests/visual/visual-alpha26.spec.ts
- tests/visual/visual277.spec.ts

Giữ: online.spec.ts, online-routing.spec.ts, online-management.spec.ts, online-games.spec.ts; cùng toàn bộ kiểm thử core/renderer/server/cloud đang dùng.

Chủ dự án đã chọn GIỮ nhóm kiểm thử cũ ngày 16/10/2026. Không xóa nhóm này. Đây là mã tham chiếu cho giao diện đã gỡ; quy trình npm/CI hiện hành chạy bộ kiểm thử tài khoản mới.
