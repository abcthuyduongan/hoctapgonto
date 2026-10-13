# KIẾN TRÚC V3.0 — BẢN THỰC THI ĐẦU TIÊN

## Vấn đề cần giải quyết

V2 tổ chức quanh màn hình luyện đề. V3 coi trò chơi là **module** có thể thay thế và nội dung học tập là **dữ liệu** có quản lý phiên bản. Dự án không sao chép mã V2.

## Luồng tối thiểu đã có

```text
Creator Studio
  -> ContentPack (kind=quiz | pairs)
  -> validatePack()
  -> IndexedDB packs (key=id@version, add-only)
  -> Góc học sinh
  -> Module registry kiểm tra compatible()
  -> App/Host tạo PlaySession
  -> Math Quest hoặc Memory Match
  -> onAttempt({itemId, objectiveId, correct, hintsUsed, elapsedMs})
  -> Host gắn sessionId, packId, contentVersion, moduleVersion, eventId
  -> IndexedDB events
  -> reports.ts
  -> Góc phụ huynh
```

Mô hình dành cho **dùng thử trên một thiết bị**. **Chưa có server đáng tin cậy** và không được sử dụng như công cụ quản lý kết quả chính thức.

## Runtime

- Vỏ React/Vite điều phối màn hình và tương tác có thể truy cập bằng bàn phím.
- Ở Alpha 2.6, Math Quest được chạy bằng React/CSS và không tải Phaser chỉ để vẽ nền trang trí. Game SDK vẫn hỗ trợ viết các module Phaser thực sự khi có gameplay đủ phức tạp.
- Game Memory Match không cần Phaser: dùng HTML button để giữ hỗ trợ bàn phím và thao tác cảm ứng.
- `GameHostProps` là giao diện ổn định để thêm game. Trong giai đoạn tiếp theo, module registration có thể chuyển sang loader phân tách theo package.

## Mô hình dữ liệu

```text
ContentPack {
  id, version, kind, title, grade, subject, publishedAt,
  items: Array<QuizItem | PairItem>
}
PlaySession {
  sessionId, packId, contentVersion, moduleId, moduleVersion,
  startedAt, endedAt?, status
}
LearningEvent {
  eventId, sessionId, packId, contentVersion, moduleId, moduleVersion,
  itemId, objectiveId, correct, hintsUsed, elapsedMs, occurredAt
}
```

`IndexedDB.add` ngăn ghi đè với cùng khóa. Khi có cloud, server cần UNIQUE constraint, foreign keys, Row Level Security, kiểm tra integrity và idempotency; bản local hiện chưa thay được chúng.

## Ranh giới an toàn

- Hiện tại Parent/Creator chỉ là nhãn giao diện, không phải phân quyền. Cần auth backend trước khi triển khai thực tế.
- Không lưu tên, tuổi, điện thoại, địa chỉ hay giọng nói trẻ em trong bản Alpha.
- Không cho nhập HTML/JavaScript để thực thi trong game; nội dung hiển thị bằng React text.
- Không có thu thập analytics hoặc gọi dịch vụ bên ngoài.
- Chưa có đồng bộ đa thiết bị, chưa có bảo đảm backup khi xóa dữ liệu trình duyệt.

## Phân ranh các giai đoạn

- Alpha 1: một ứng dụng nhỏ, code được chia `core`, `games`, `screens` thay vì mở monorepo quá sớm.
- Alpha 2: ổn định API module, có thể tách `core` thành `packages/contracts`, `learning-engine`, `storage` theo tài liệu V3 ban đầu. Không tách package chỉ để phô trương kiến trúc.
- Alpha 3: thêm `game-instance` + `assignment`, hệ thống hồ sơ, parent auth, cloud RLS và sync queue.
