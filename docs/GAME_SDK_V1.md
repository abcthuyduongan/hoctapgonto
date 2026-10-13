# BẢO AN LEARNING — Game SDK V1 (Alpha 2)

## Ranh giới module

```text
App (host)
 ├── GAME_REGISTRY (manifest: id, sdkVersion, runtime, contentKind)
 ├── GAME_COMPONENTS (lazy import: trò chơi không tải khi chưa mở)
 ├── ContentPack (bất biến sau khi xuất bản)
 ├── PlaySession (active → completed | abandoned)
 └── GameHostProps
       pack → trò chơi
       onAttempt(attemptKey,itemId,objectiveId,correct,hintsUsed,elapsedMs) → host
       onComplete() → host
       onExit() → host
```

- `contracts.ts`: giao diện dữ liệu chung; `GAME_SDK_VERSION = 1`.
- `registry.ts`: metadata của Math Quest, Memory Match, Sentence Builder; không nhập React hoặc Phaser.
- `games/loaders.ts`: ánh xạ `ModuleId` → `React.lazy` cho từng game; `App.tsx` không cần câu lệnh điều kiện cố định cho mỗi game.
- `sdk.ts`: kiểm tra protocol, kiểm tra ID câu và metadata phiên, tạo `eventId = sessionId:attemptKey` có tính tất định.
- `storage.ts`: ghi `LearningEvent` trong cùng một giao dịch `sessions + events` của IndexedDB; từ chối khi phiên không active; cùng `eventId` và payload kết quả giống nhau được xử lý như thử lưu lại, không ghi thêm. Payload kết quả khác cùng khóa bị từ chối.
- `ContentPack.id@version` bất biến sau xuất bản; các phiên cũ tham chiếu đúng version.

## Cách thêm game thứ tư

1. Khai báo `ModuleId` và loại dữ liệu (nếu mới) trong `core/contracts.ts`.
2. Thêm manifest có `sdkVersion:1` vào `core/registry.ts`.
3. Viết game nhận `GameHostProps` ở `src/games/NewGame.tsx`. Không import `storage.ts`.
4. Thêm bộ tải động tại `src/games/loaders.ts`.
5. Khai báo xác định tương thích `moduleKinds` trong `validation.ts` và thêm validation riêng nếu có loại câu hỏi mới.
6. Tạo seed kiểm thử, thêm ca unit SDK và kiểm thử trên trình duyệt thực.

## Quy tắc sự kiện và độ tin cậy

```ts
await onAttempt({
  attemptKey: `${item.id}:try:${attemptNumber}`, // không đổi nếu RETRY cùng lượt
  itemId: item.id,
  objectiveId: item.objectiveId,
  correct,
  hintsUsed,
  elapsedMs
});
await onComplete(); // chỉ gọi sau khi đã lưu toàn bộ lượt cần chấm
```

**Lưu ý:** SDK Alpha 2 chỉ bảo vệ nhất quán dữ liệu phía client. `correct` vẫn do game tính và có thể bị sửa bởi người làm chủ trình duyệt; không sử dụng để cấp chứng chỉ hoặc tính điểm chính thức. Để triển khai đa thiết bị cần xác thực và xác minh kết quả ở backend cùng RLS.

## Sentence Builder

- `kind:'sentences'`, mỗi `SentenceItem` có `prompt`, `words` ở thứ tự mẫu, `hint` và `objectiveId`.
- Game xáo trộn **chỉ số từ**, giữ nguyên từ lặp lại, hỗ trợ thao tác chạm và bàn phím.
- Phản hồi: đúng so với câu mẫu / chưa khớp mẫu; có nút thử lại và gợi ý. Mỗi lần bấm kiểm tra là một `attemptKey` riêng.
- **Giới hạn sư phạm:** hiện chấm theo một cách sắp xếp mẫu; câu khác có thể vẫn đúng ngữ pháp nhưng không được công nhận. Chọn học liệu có thứ tự đích ít mơ hồ; không dùng công cụ này làm bài thi chính thức.
