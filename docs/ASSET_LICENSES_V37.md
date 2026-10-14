# Nguồn tài nguyên V3.7 — mẫu PR-02

Hai tệp dưới đây là **candidate tự tạo cho lát cắt PR-02 (cáo + Đảo Toán Học)**. Chúng chưa được chủ dự án duyệt mỹ thuật; việc có texture, rig và clip hoặc vượt kiểm thử cấu trúc không chứng minh đã đạt concept premium. Ba model còn lại chưa được sản xuất trong đợt này, nên cổng phát hành đủ năm model vẫn phải báo chưa sẵn sàng.

## Nguồn và quyền sử dụng

| Tệp | Nguồn hình học, texture, rig và clip | Khai báo manifest |
|---|---|---|
| `public/models/fox-guide.glb` | Tạo riêng trong dự án bằng `tools/generate_v37_slice_assets.mjs`, có hỗ trợ lập trình của Codex. Hình học, UV, texture PNG thủ tục, bộ xương và mọi keyframe đều được định nghĩa trong mã nguồn này. | `OWNED: original project-authored PR02 candidate; docs/ASSET_LICENSES_V37.md` |
| `public/models/math-world.glb` | Tạo riêng trong dự án bằng cùng generator. Lâu đài, đảo đá phân tầng thuôn sâu, vách đá góc cạnh, mép cỏ/khóm cỏ, cửa/cửa sổ vòm, chỉ mái, cờ, đường lát đá/lan can, cây, hoa và các số/ký hiệu là hình học thật. Texture được tính từ các hàm tuần hoàn, không tải ảnh bên ngoài. | `OWNED: original project-authored PR02 candidate; docs/ASSET_LICENSES_V37.md` |
| `public/art/fox-guide-common.webp` | Render trực tiếp từ `fox-guide.glb` bằng Three renderer thật, Idle tại 0,35 giây, nền trong suốt. Dùng cho cảnh dự phòng trong bài test; cùng nhân vật với trang chủ. 640×768 px, 29.358 byte. | Cùng nguồn dự án của model cáo; không tải ảnh ngoài hoặc tạo nhân vật thứ hai. |

`OWNED` là nhãn provenance nội bộ của tài nguyên gốc tạo cho dự án, không phải giấy phép CC0/CC-BY của một kho model. Không sử dụng mesh, rig, texture, phông chữ, ảnh concept hay keyframe của bên thứ ba; không có gói tài nguyên cần mua hoặc nguồn tải ngoài để ghi attribution. Mã generator được bàn giao cùng dự án để sửa, tạo lại và sử dụng trong Bảo An Learning. Generator chỉ sử dụng thư viện chuẩn Node.js (`fs`, `path`, `url`, `zlib`, `crypto`); thư viện runtime Three.js được khai báo riêng trong dependency của ứng dụng.

Metadata `asset.extras` trong mỗi GLB ghi `provenance=ORIGINAL_PROCEDURAL_V37_PR02`, `source=tools/generate_v37_slice_assets.mjs`, `acceptance=candidate-not-art-approved`, `externalAssets=[]`. Không dùng nhãn provenance này để thay thế việc duyệt chất lượng hình ảnh trong ứng dụng thật.

Ảnh cáo dự phòng có SHA-256 `257ca7360cb2d016b1b73a316b6f3c6f320be9458e88fedca1aa52cf9a2d2feb`; dữ liệu xuất và kiểm tra alpha trong `docs/V37_games_qa/fox-portrait-provenance.json`. Lệnh tái xuất: `node tools/capture_v37_games.mjs --fox-only` với preview đang chạy. Phong cảnh trong bài test được dựng bằng geometry/vật liệu thủ tục trong `src/world3d/scenes/gameEnvironments.ts`; dùng chung model đảo và cáo đã tải, không có model thương mại hoặc texture bên ngoài mới.

## Thông số xuất

| Thuộc tính | Cáo | Đảo Toán Học |
|---|---:|---:|
| Kích thước tệp | 1.120.088 byte | 1.839.516 byte |
| Mesh / primitive | 10 / 10 | 16 / 16 |
| Tam giác | 22.116 | 30.668 |
| Vertex có cả phần tách theo UV/normal | 13.891 | 32.180 |
| Material glTF PBR | 10 | 16 |
| PNG nhúng, 256 × 256, RGBA 8-bit | 9 | 18 |
| Skin / xương | 1 / 14 | 0 / 0 |
| Animation clip | `Idle`, `Cheer`, `Victory` | Không yêu cầu |

Các bộ texture gồm baseColor, tangent-space normal và metallicRoughness. Kênh G chứa độ nhám biến thiên, kênh B bằng 0 vì bề mặt dùng kim loại sơn/màu hoạt hình thay vì kim loại trần. Swatch hex sRGB được đổi sang linear-light trước khi ghi `baseColorFactor` theo glTF; PNG base color dùng sRGB, các map normal/roughness dùng dữ liệu tuyến tính. Base color được tint bằng material; texture fur, vải dệt, đá xây, sa thạch tự nhiên, cỏ, gỗ và satin tạo biến thiên bề mặt. Texture sa thạch dùng đường trầm tích/hạt đá riêng, không dùng đường mạch gạch của lâu đài. Không dùng tấm ảnh concept phủ lên mặt phẳng để giả mô hình.

Cáo dùng `JOINTS_0`, `WEIGHTS_0` và inverse bind matrices glTF, với trọng số trộn tại thân, tay và đuôi. Các clip tác động đến xương đầu, thân, tay, bàn tay hoặc đuôi; `Victory` có thêm nhún root. Không chỉ dịch chuyển toàn bộ scene. Xương: `Root`, `Spine`, `Chest`, `Head`, `Arm.L`, `Forearm.L`, `Paw.L`, `Leg.L`, `Arm.R`, `Forearm.R`, `Paw.R`, `Leg.R`, `Tail`, `TailTip`.

Hệ tọa độ: Y lên trên, đơn vị theo world của renderer. Cáo nhìn về +Z, chân chạm Y=0; chiều cao bind pose 2,3014. Đảo có mặt cỏ gần Y=0, bán kính khoảng 2,1; đá dưới đảo thuôn xuống Y=-1,51; đỉnh lâu đài Y=3. Bounds bản đảo hiện tại: X [-2,0671; 2,1109], Y [-1,51; 3], Z [-2,0503; 2,0503]. Không dùng Draco/Meshopt/KTX2 hay tài nguyên mạng phụ.

Lượt tăng chiều sâu PR-02 bổ sung sáu tầng vách đá với silhouette bất quy tắc, 26 cụm đá góc cạnh, mép cỏ có khóm/lớp rêu, tám cụm hoa/cỏ, đường cong bằng phiến đá riêng và lan can ngắn dẫn đến bậc cửa. Lâu đài thêm chỉ/phân tầng đá, đường gân và lớp men mái, khung/bậu/thanh chia cửa sổ, kính màu hổ phách, cờ vải có ký hiệu nổi và chi tiết cửa gỗ/đồng. Hình học bổ sung nằm trong `mathWorld()` và helper cục bộ của nó; nhánh texture `rock` mới chỉ phục vụ vách đảo. Hàm xuất GLB, hình học/bộ xương/clip của cáo giữ nguyên. Dung lượng và số tam giác nằm dưới mục tiêu riêng của lát cắt (2 MB / 35.000 tam giác), chưa thay thế nghiệm thu hình ảnh và thiết bị thật.

## Tạo lại và xác định phiên bản

Chạy tại thư mục dự án:

```powershell
node tools/generate_v37_slice_assets.mjs
```

Generator chỉ ghi `public/models/fox-guide.glb` và `public/models/math-world.glb`, đồng thời in thống kê và SHA-256. Không sửa `fox-guide-prototype.glb` hay `fox-guide-mobile.glb`. Kết quả xác định với cùng source và phiên bản Node/zlib; nếu đổi Node/zlib, phần nén PNG có thể đổi byte dù nội dung không đổi.

SHA-256 bản bàn giao:

```text
fox-guide.glb  398382e919be69af9502cb103e3d1359147157e76ac852a30ad07cd60a23e9fc
math-world.glb dd7cacdfb62d86b0dc287b264d6cc71df5822a2b6943c48d73c5c84b3091d6cb
```

## Giới hạn nghiệm thu

- Đây là bước tạo model có texture/rig/clip và nguồn có thể truy vết cho PR-02. Chưa ghi nhận artist phê duyệt hoặc chủ dự án duyệt concept.
- Chưa có model `memory-world.glb`, `language-world.glb`, `environment.glb` trong đợt này; không điền giấy phép cho tài nguyên chưa có.
- Chưa xuất LOD/mobile riêng, chưa đo FPS trên GPU/điện thoại thực. Số tam giác và dung lượng không thay thế phép đo hiệu năng.
- Cần xem texture, skin và clip qua `GLTFLoader`/`AnimationMixer` trong browser, chụp desktop/mobile, duyệt bố cục và màu trước khi xác nhận mỹ thuật. Báo cáo runtime/QA của dự án là bằng chứng tách biệt với provenance này.
