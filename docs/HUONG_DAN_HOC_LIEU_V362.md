# Cách biên soạn và tích hợp học liệu vào Bảo An Learning V3.6.2

**Ba mô-đun giữ nguyên:** `math-quest` dùng `quiz`, `memory-match` dùng `pairs`, `sentence-builder` dùng `sentences`. Phần nội dung độc lập với khung 3D và Game SDK V1.

## Quy trình
1. Trong nhánh React (cần cài Node và build được): mở **Xưởng học liệu** → chọn Math Quest / Memory Match / Sentence Builder → nhập **môn, lớp, mục tiêu** → nhập từ 2 đến 30 câu/cặp → **Xuất bản học liệu**.
2. Ở phần **Trao đổi bộ học liệu JSON**, chọn bộ đã xuất bản → **Tải JSON**.
3. Mở HTML offline, dùng **📁 Nhập học liệu** → chọn JSON → kiểm tra thông báo → chọn học liệu dưới tên đảo rồi **Bắt đầu**.
4. Có thể gửi JSON mẫu kèm gói này để kiểm tra ngay luồng nhập; không dùng dữ liệu mẫu làm đề đánh giá chính thức.
5. Sửa học liệu: tạo phiên bản mới bằng **Tạo phiên bản mới từ bộ hiện có**. Không ghi đè `packId@version` đã dùng.

## Định dạng tệp
Đối tượng gốc: `schema: "baoan-learning-content"`, `formatVersion: 1`, `packs` là mảng 1–40 bộ. Mỗi bộ có `id`, `version`, `title`, `subject`, `grade`, `kind`, `source`, `publishedAt`, `items`.

- Trắc nghiệm (`kind=quiz`): item `kind=multiple-choice`, `id`, `objectiveId`, `prompt`, `options` đúng 4 chuỗi không trùng, `correctIndex` 0–3 tương ứng A–D, `explanation`.
- Ghép cặp (`kind=pairs`): item `kind=pair`, `id`, `objectiveId`, `left`, `right` (không trùng các mặt thẻ, tránh cặp mơ hồ).
- Ghép câu (`kind=sentences`): item `kind=sentence`, `id`, `objectiveId`, `prompt`, `words` gồm 3–15 chuỗi không có dấu cách, `hint`. Game ghép từ **theo đúng một đáp án mẫu**, không đánh giá các cách nói tương đương.

**Không đưa vào JSON:** họ tên, STT, tài khoản, PIN, địa chỉ học sinh; đây là bộ nội dung dùng chung, không phải hồ sơ người học.

## Những giới hạn bắt buộc thông báo cho giáo viên
- Bản HTML ngoại tuyến **chỉ nhập/sử dụng/xuất** học liệu JSON, chưa có trình soạn câu hỏi trong HTML; trình soạn đầy đủ ở nhánh React.
- Hai nhánh có lịch sử riêng; nhập JSON **không chuyển điểm hay thành tích**, không nhập đè IndexedDB.
- Dữ liệu của React/HTML chỉ lưu trên thiết bị; muốn triển khai trường học phải xây xác thực, phân quyền, backend và sao lưu phù hợp trước.
- Dữ liệu mẫu cần được kiểm tra với nguồn tài liệu được phép sử dụng trước khi đưa vào dạy học thật.
