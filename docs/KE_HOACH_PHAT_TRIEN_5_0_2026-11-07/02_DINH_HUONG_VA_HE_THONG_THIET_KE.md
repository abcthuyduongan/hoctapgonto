# 02 · Định hướng sản phẩm và hệ thống thiết kế

Mục tiêu của bản 5.0: **vừa chơi, vừa khám phá, vừa học** – mỗi ngày trẻ đi một vòng ngắn (khoảng 20 phút) rõ ràng, và toàn bộ ứng dụng trông như **một thế giới** chứ không phải nhiều trang ghép lại.

---

## 1. Vòng lặp mỗi ngày: Học → Khám phá → Chơi

```
        ┌──────────── 1. HỌC ────────────┐
        │ Làm nhiệm vụ hôm nay qua trò chơi │  (bộ câu hỏi tuần, theo môn)
        └───────────────┬──────────────┘
                        ▼  đạt ≥ 2 sao cả chặng
        ┌────────── 2. KHÁM PHÁ ─────────┐
        │ Sương mù tan, địa danh mở khóa,  │
        │ nhận thẻ khám phá có giọng kể    │
        └───────────────┬──────────────┘
                        ▼  nhận vật liệu + sao
        ┌──────────── 3. CHƠI ────────────┐
        │ Xây Thị trấn, gặp thú hàng xóm,  │
        │ tiến gần món quà trên Kệ quà     │
        └─────────────────────────────────┘
```

**Nguyên tắc**

1. **Một việc chính mỗi lúc**: trang chủ luôn chỉ ra *một* nút lớn "Tiếp tục: [việc tiếp theo]".
2. **Học mở ra khám phá**: khám phá là phần thưởng của học, không phải một mục riêng để vào.
3. **Hai loại thưởng, nghĩa rõ ràng**:
   - **Sao** – đo việc học (tối đa 3 sao mỗi câu), **chỉ đổi vật phẩm thật** trên Kệ quà do bố mẹ duyệt.
   - **Vật liệu** – dùng xây Thị trấn (không làm giảm sao).
   - Huy hiệu, chuỗi ngày là **ghi nhận**, không phải tiền tệ.
4. **Cáo là người dẫn đường** xuyên suốt: chào đầu ngày, gợi ý, khen, an ủi khi sai, chúc mừng khi mở địa danh.
5. **Phụ huynh và giáo viên ở "bàn làm việc"** – giao diện yên tĩnh, rõ ràng, tách khỏi thế giới của trẻ.
6. **Không quảng cáo, không chat tự do, không bảng xếp hạng điểm** (giữ cam kết hiện có).

---

## 2. Sơ đồ màn hình (sau khi sắp xếp lại)

### 2.1 Học sinh – "Thế giới"

| Cấp | Màn | Nội dung chính | Thay cho |
| --- | --- | --- | --- |
| 0 | **Bản đồ thế giới (trang chủ)** | Bản đồ toàn màn hình; thẻ "Hôm nay" (3 bước Học → Khám phá → Chơi với tiến độ); nút lớn "Tiếp tục" | Trang chủ dài 3.000 px |
| 1 | **Vùng môn** (Đảo Số, Rừng Chữ, Cảng English, Phố Robot) | Bản đồ vùng với 7 chặng rõ ràng (chặng hiện tại phát sáng, chặng xong có cờ, chặng sau còn sương mù); ngăn bên/khay dưới: tuần, bộ câu, chọn trò | Bản đồ môn + bảng tuần dưới chân |
| 2 | **Trò chơi** (10 trò, cùng một khung) | HUD trên, vùng câu hỏi, Cáo, phản hồi, màn kết thúc có "Chơi lại" / "Về bản đồ" | 10 bố cục riêng |
| 2 | **Mở khóa địa danh** | Hoạt cảnh sương tan, thẻ khám phá, nút "Nghe kể chuyện" | Thẻ khám phá rời |
| 1 | **Nhiệm vụ** | Nhiệm vụ ngày + ôn câu sai | Hộp thoại xanh đen |
| 1 | **Thị trấn** | Lưới xây dựng, vật liệu, thú hàng xóm, cổ vũ bạn | Màn riêng (giữ, đồng bộ khung) |
| 1 | **Thi thử** | Màn riêng (không chồng lên trang chủ), chủ đề sáng, nghiêm túc | Màn xanh đen + dải đỏ |
| 1 | **Bộ sưu tập** (gộp) | 3 thẻ: Sổ khám phá · Huy hiệu · Tủ kỷ niệm | 3 hộp thoại khác kiểu |
| 1 | **Kệ quà** | Quà vật phẩm, ghim mục tiêu, trạng thái chờ duyệt | Hộp thoại vàng |
| — | **Menu tài khoản** | Âm thanh, Hiệu ứng, Đổi mật khẩu, Phụ huynh (PIN), Đăng xuất | 5 nút trên thanh trên cùng |

### 2.2 Điều hướng học sinh

- **Máy tính / máy tính bảng ngang (≥ 1024 px)**: thanh trên cao 64 px
  - trái: logo;
  - giữa: 4 mục **Bản đồ · Nhiệm vụ · Thị trấn · Thi thử**;
  - phải: cụm trạng thái **⏱ phút hôm nay · chuỗi ngày · ★ sao**, nút Kệ quà, ảnh đại diện mở menu tài khoản.
- **Điện thoại / máy tính bảng dọc (< 1024 px)**:
  - thanh trên 56 px: logo, cụm trạng thái gọn;
  - **thanh dưới 64 px** gồm 5 nút: Bản đồ · Nhiệm vụ · Thị trấn · Thi thử · Thêm.
- Bộ sưu tập, Kệ quà và menu tài khoản nằm trong "Thêm" (điện thoại) hoặc cụm phải (máy tính).

### 2.3 Phụ huynh và giáo viên – "Bàn làm việc"

- Giữ cấu trúc màn quản lý hiện có (đã gọn), chuyển sang token chung.
- Khu phụ huynh: Tổng quan tuần · Giới hạn thời gian · Kệ quà và duyệt đổi quà · Báo cáo · **Kết nối SafeTime** (theo `docs/KET_NOI_SAFETIME.md`).
- PIN phụ huynh **chốt 6 số**: sửa hướng dẫn đang ghi 4 số và giao diện đang ghi "4–6 số".

---

## 3. Hệ thống thiết kế "Thế giới Bảo An"

Một tệp token duy nhất `src/styles/tokens.css`. Mọi tệp CSS khác **chỉ** dùng `var(--…)`. Hai chủ đề dùng chung nền tảng: `[data-theme="world"]` (học sinh) và `[data-theme="desk"]` (phụ huynh, giáo viên).

### 3.1 Màu

Màu lấy từ tranh bản đồ (cỏ, nước, cát, gỗ) để giao diện và tranh là một. Tỉ lệ tương phản đo trên nền trắng.

| Token | Mã | Tương phản | Dùng cho |
| --- | --- | --- | --- |
| `--c-leaf` (chính) | `#4E7250` | 5,5:1 | Nút chính, liên kết, mục đang chọn |
| `--c-leaf-deep` | `#2F6F3A` | 6,1:1 | Chữ trên nền lá nhạt, nhấn |
| `--c-leaf-soft` | `#E7EFE3` | — | Nền mục chọn, khối thông tin |
| `--c-ink` | `#183449` | 12,9:1 | Chữ chính |
| `--c-ink-2` | `#5B6B5A` | 5,7:1 | Chữ phụ |
| `--c-cream` | `#FFFDF7` | — | Nền trang |
| `--c-paper` | `#F8F7EF` | — | Nền khối, thẻ |
| `--c-line` | `#DCE3D5` | — | Viền |
| `--c-water` | `#1F7A7A` | 5,1:1 | Thông tin, trạng thái đang làm |
| `--c-star` | `#E5A93C` (tô) / `#8A5A00` (chữ) | chữ 5,9:1 | Sao, phần thưởng |
| `--c-success` | `#2F6F3A` | 6,1:1 | Đúng, hoàn thành |
| `--c-danger` | `#B3261E` | 6,5:1 | Sai (dùng nhẹ nhàng), lỗi |
| `--c-night` | `#183449` | — | Nền tối duy nhất (hoạt cảnh mở khóa, thi thử chế độ tập trung nếu cần) |

**Màu môn học** – dùng chung với SafeTime (Bảng nhiệm vụ):

| Môn | Vùng | Token | Mã | Tương phản |
| --- | --- | --- | --- | --- |
| Toán | Đảo Số | `--c-math` | `#B45309` | 5,0:1 |
| Tiếng Việt | Rừng Chữ | `--c-viet` | `#3F7D3A` | 5,0:1 |
| Tiếng Anh | Cảng English | `--c-eng` | `#0E7490` | 5,4:1 |
| Tin học | Phố Robot | `--c-tech` | `#6D28D9` | 7,1:1 |

Bản nhạt làm nền: `--c-math-soft` `#FDF1E4`, `--c-viet-soft` `#E9F3E6`, `--c-eng-soft` `#E3F3F6`, `--c-tech-soft` `#F1ECFD`. Luôn đi kèm tên môn và biểu tượng, không dựa vào màu. SafeTime dùng đúng các màu này trên Bảng nhiệm vụ (`quy-chuan-giao-dien.md` mục 2).

**Bỏ**: bảng màu Tailwind trộn lẫn, nền xanh đen cho hộp thoại, dải đỏ cảnh báo ở thi thử, `theme-color #1cb099` (đổi sang `#4E7250`).

### 3.2 Chữ

- Phông **Nunito** (có đủ dấu tiếng Việt, nét tròn thân thiện), tự lưu trữ tệp WOFF2 trong `public/fonts/` (CSP hiện tại chỉ cho `self`). Gồm 4 độ đậm 400, 600, 700, 800, tổng ≤ 160 KB. Phông dự phòng: `system-ui`.
- Thang cỡ chữ (9 bậc):

| Token | Cỡ / dòng | Dùng |
| --- | --- | --- |
| `--t-hero` | 40 / 48, 800 | Tiêu đề hoạt cảnh mở khóa |
| `--t-h1` | 32 / 40, 800 | Tiêu đề màn |
| `--t-h2` | 24 / 32, 700 | Tiêu đề khối, câu hỏi trong trò chơi |
| `--t-h3` | 20 / 28, 700 | Tiêu đề thẻ |
| `--t-answer` | 20 / 28, 700 | Lựa chọn đáp án |
| `--t-body-kid` | 18 / 28, 400 | Chữ thường của học sinh |
| `--t-body` | 16 / 24, 400 | Chữ thường phụ huynh/giáo viên |
| `--t-small` | 14 / 20, 600 | Nhãn, chú thích |
| `--t-tiny` | 13 / 18, 600 | **Nhỏ nhất được phép** (chỉ cho số liệu phụ) |

### 3.3 Khoảng cách, bo góc, bóng, lớp

- Lưới 4 px: `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 24 · `--s-6` 32 · `--s-7` 48 · `--s-8` 64.
- Bo góc: `--r-sm` 8 (nút nhỏ, ô nhập) · `--r-md` 14 (nút, thẻ nhỏ) · `--r-lg` 20 (thẻ, hộp thoại) · `--r-xl` 28 (khung lớn) · `--r-pill`.
- Bóng: `--shadow-1` (thẻ nổi nhẹ) · `--shadow-2` (hộp thoại). Không dùng bóng màu.
- Lớp: `--z-map` 0 · `--z-hud` 100 · `--z-nav` 200 · `--z-dialog` 1000 · `--z-toast` 1100. Không dùng giá trị z khác.
- Mốc màn hình: **480 · 768 · 1024 · 1440** (chỉ 4 mốc) + `prefers-reduced-motion`.

### 3.4 Biểu tượng

- Bộ biểu tượng SVG nét tròn, cùng độ dày 2 px, lưới 24, khoảng 40 biểu tượng (bản đồ, nhiệm vụ, thị trấn, cúp, sao, lửa chuỗi ngày, đồng hồ, quà, sách, huy hiệu, loa, cài đặt, khóa, đúng, sai, gợi ý, chơi lại, về…).
- Thành phần `<Icon name="…">`; màu theo `currentColor`.
- **Emoji chỉ dùng trong nội dung kể chuyện / lời Cáo**, không dùng làm biểu tượng nút điều hướng.

### 3.5 Thành phần dùng chung (`src/ui/`)

| Thành phần | Quy định chính |
| --- | --- |
| `Button` | Kiểu: chính (lá), phụ (viền), nhẹ (chữ), nguy hiểm; cỡ: 44 (thường), 56 (học sinh, nút lớn), 64 (nút "Tiếp tục"); luôn có vùng bấm ≥ 44 × 44 |
| `IconButton` | 44 × 44, bắt buộc `aria-label` |
| `Card` | Nền `--c-paper`, viền `--c-line`, bo `--r-lg`, đệm 16–24 |
| `Dialog` | **Một khung duy nhất** cho mọi hộp thoại: lớp phủ mờ, khung trắng kem bo `--r-lg`, tiêu đề + biểu tượng bên trái, nút đóng `IconButton` bên phải, thân cuộn được, chân có nút; trên điện thoại trượt từ dưới lên (bottom sheet) |
| `Tabs` | Dạng viên thuốc, mục chọn nền `--c-leaf-soft` |
| `StatChip` | Chip trạng thái: biểu tượng + số (phút, chuỗi ngày, sao) |
| `ProgressBar` / `StarMeter` | Thanh tiến độ, đồng hồ sao 0–3 |
| `SubjectBadge` | Màu và biểu tượng môn |
| `EmptyState` | Hình minh họa nhỏ + 1 câu + 1 nút hành động |
| `PinPad` | Bàn phím số 3 × 4 nút 64 × 64, 6 ô chấm, nút xóa, thông báo khóa khi sai nhiều lần |
| `Toast` | Thông báo góc dưới, tự ẩn 4 giây |
| `MascotBubble` | Cáo + bong bóng thoại, vị trí cố định theo màn (góc dưới trái trên máy tính, trên khay ở điện thoại) |
| `GameFrame` | Khung chung 10 trò (mục 3.6) |

### 3.6 Khung trò chơi `GameFrame`

```
┌─────────────────────────────────────────────────────────────┐
│ [← Về]  [Biểu tượng môn] Tên trò · Tên bộ      ●●●○○  ★ 2   │  HUD 64 px
├─────────────────────────────────────────────────────────────┤
│                                                             │
│         Bối cảnh trò chơi (tranh, chiếm toàn khung)          │
│   ┌────────────────────────────────────────────────┐        │
│   │ Câu 3/10 · Câu hỏi (--t-h2)            [🔊]    │        │
│   │ Vùng trả lời (đáp án --t-answer, ≥ 56 px)      │        │
│   │ Vùng phản hồi giữ chỗ cố định                  │        │
│   └────────────────────────────────────────────────┘        │
│ [Cáo + bong bóng]                       [Gợi ý] [Tiếp →]    │  vùng thao tác
└─────────────────────────────────────────────────────────────┘
```

- HUD giống nhau ở 10 trò: nút Về (xác nhận nếu đang dở), biểu tượng môn, tên trò, chấm tiến độ câu, sao đã đạt.
- Vùng phản hồi không làm nhảy bố cục (giữ nguyên quy tắc hiện có).
- Màn kết thúc chung: số sao, câu đúng, lời Cáo, **Chơi lại** · **Trò khác cùng bộ** · **Về bản đồ**; nếu mở khóa chặng → chuyển sang hoạt cảnh mở khóa.
- Mỗi trò chỉ được đổi phần "bối cảnh" và "vùng trả lời", không đổi HUD, phản hồi, kết thúc.

### 3.7 Chuyển động và âm thanh

- Thời lượng: nhanh 150 ms (bấm), vừa 250 ms (mở hộp thoại), chậm 400–800 ms (mở khóa, sao bay).
- Bộ âm thanh chung: bấm, đúng, sai (nhẹ), mở khóa, 3 sao; một nút tắt âm thanh trong menu tài khoản; phụ huynh có thể tắt hẳn.
- Tôn trọng `prefers-reduced-motion` (đã có) và nút "Hiệu ứng" của trẻ.

### 3.8 Lời văn

- Nói với trẻ: xưng **"con"** (đúng với văn phong hiện có của Bảo An), câu ngắn ≤ 15 từ, khen cụ thể ("Con làm đúng 3 câu liền!"), khi sai thì hướng dẫn ("Thử nhìn lại số hàng chục nhé").
- Nói với phụ huynh/giáo viên: trung tính, đủ ý.
- Không viết hoa toàn bộ trừ nhãn rất ngắn; không dùng "!!!".

---

## 4. Chỉ số đo được (dùng làm cổng nghiệm thu)

| Chỉ số | Hiện tại | Mục tiêu 5.0 |
| --- | --- | --- |
| CSS trong mã nguồn | 197 KB đang chạy + 295 KB chết | ≤ 120 KB, 0 KB chết |
| Mã màu ngoài `tokens.css` | 657 | 0 |
| Cỡ chữ khác nhau | 111 | 9 (token) |
| Mốc màn hình | 40+ | 4 |
| `!important` | 130 (+1.545 trong tệp chết) | ≤ 10 |
| Kiểu hộp thoại | ≥ 4 | 1 |
| Chiều cao trang chủ học sinh (1440 × 900) | 3.000 px | ≤ 900 px (một màn, không cuộn) |
| Thanh trên trên điện thoại | ≈ 170 px | 56 px + thanh dưới 64 px |
| Trò chơi theo `GameFrame` | 0/10 | 10/10 |
| Chữ nhỏ hơn 13 px | nhiều | 0 |
| axe-core lỗi nghiêm trọng | 0 | 0 (giữ) |
