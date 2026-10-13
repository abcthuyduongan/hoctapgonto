# TEST MATRIX — ALPHA 2

Ngày 12/10/2026: 21/21 unit test Node.js đều ĐẠT, typecheck core ĐẠT, TS/TSX syntax parser ĐẠT.

Các phạm vi đã test: validate quiz/pair/sentence; chống trùng câu, token; seed; báo cáo; hợp đồng Game SDK V1; manifest; khóa event idempotent; kiểm tra metadata lượt thử; so khớp sentence với token lặp; chặn sai loại pack/protocol.

Các phạm vi **chưa xác nhận**: Native IndexedDB transaction trên browser, Vite build/TypeScript React/Phaser, giao diện mobile, luồng đăng nhập, backend, phục hồi mạng, đa tab. Xem `QA_ALPHA2.md`.
