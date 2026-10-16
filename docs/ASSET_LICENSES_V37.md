# Nguồn tài nguyên V3.7 — PR-02 và PR-03

Đã có đủ năm GLB gốc: lát cắt PR-02 (cáo + Đảo Toán Học) và PR-03 (Rừng Trí Nhớ, Xưởng Ngôn Từ, môi trường chung), sau khi chủ dự án chốt tiếp tục thực hiện kế hoạch ngày 14/10/2026. Tất cả còn là **candidate chờ duyệt mỹ thuật**; việc có texture, rig và clip hoặc vượt kiểm thử cấu trúc không chứng minh đã đạt concept premium hay nghiệm thu thiết bị thật.

## Nguồn và quyền sử dụng

| Tệp | Nguồn hình học, texture, rig và clip | Khai báo manifest |
|---|---|---|
| `public/models/fox-guide.glb` | Tạo riêng trong dự án bằng `tools/generate_v37_slice_assets.mjs`, có hỗ trợ lập trình của Codex. Hình học, UV, texture PNG thủ tục, bộ xương và mọi keyframe đều được định nghĩa trong mã nguồn này. | `OWNED: original project-authored PR02 candidate; docs/ASSET_LICENSES_V37.md` |
| `public/models/math-world.glb` | Tạo riêng trong dự án bằng cùng generator. Lâu đài, đảo đá phân tầng thuôn sâu, vách đá góc cạnh, mép cỏ/khóm cỏ, cửa/cửa sổ vòm, chỉ mái, cờ, đường lát đá/lan can, cây, hoa và các số/ký hiệu là hình học thật. Texture được tính từ các hàm tuần hoàn, không tải ảnh bên ngoài. | `OWNED: original project-authored PR02 candidate; docs/ASSET_LICENSES_V37.md` |
| `public/models/memory-world.glb` | `tools/generate_v37_memory_asset.mjs`: vách đá kín nhiều lớp, bốn cây phân nhánh, tán lá điêu khắc, cầu gỗ vòm, hồ nông, đường đá, hai cặp ký hiệu nổi, hoa/nấm. Texture đá/rêu/vỏ cây/lá/nước tự tạo; không có mesh hoặc ảnh ngoài. | `OWNED: original project-authored PR03 candidate; docs/ASSET_LICENSES_V37.md` |
| `public/models/language-world.glb` | `tools/generate_v37_language_asset.mjs`: xưởng sách với mái men teal từng panel, cửa vòm, cửa sổ sâu, kệ sách, ban công, sách mở nhiều lớp trang cong, chữ Aa và bàn bút lông. Các chữ là hình học do generator định nghĩa, không dùng phông chữ ngoài. | `OWNED: original project-authored PR03 candidate; docs/ASSET_LICENSES_V37.md` |
| `public/models/environment.glb` | `tools/generate_v37_environment_asset.mjs`: đảo đá xa với mặt rêu, thác nước có dải bọt và sáu cụm mây hình học. Texture và hình học được định nghĩa trong source, dùng chung giữa trang đảo và bài học. | `OWNED: original project-authored PR03 candidate; docs/ASSET_LICENSES_V37.md` |
| `public/art/fox-guide-common.webp` | Render trực tiếp từ `fox-guide.glb` bằng Three renderer thật, Idle tại 0,35 giây, nền trong suốt. Dùng cho cảnh dự phòng trong bài test; cùng nhân vật với trang chủ. 640×768 px, 29.358 byte. | Cùng nguồn dự án của model cáo; không tải ảnh ngoài hoặc tạo nhân vật thứ hai. |

`OWNED` là nhãn provenance nội bộ của tài nguyên gốc tạo cho dự án, không phải giấy phép CC0/CC-BY của một kho model. Không sử dụng mesh, rig, texture, phông chữ, ảnh concept hay keyframe của bên thứ ba; không có gói tài nguyên cần mua hoặc nguồn tải ngoài để ghi attribution. Mã generator được bàn giao cùng dự án để sửa, tạo lại và sử dụng trong Bảo An Learning. Generator chỉ sử dụng thư viện chuẩn Node.js (`fs`, `path`, `url`, `zlib`, `crypto`); thư viện runtime Three.js được khai báo riêng trong dependency của ứng dụng.

Metadata `asset.extras` ghi `provenance=ORIGINAL_PROCEDURAL_V37_PR02` cho cáo/Toán và `ORIGINAL_PROCEDURAL_V37_PR03` cho ba asset mới, `source` trỏ đúng generator, `acceptance=candidate-not-art-approved`, `externalAssets=[]`. Không dùng nhãn provenance này để thay thế việc duyệt chất lượng hình ảnh trong ứng dụng thật.

Ảnh cáo dự phòng có SHA-256 `257ca7360cb2d016b1b73a316b6f3c6f320be9458e88fedca1aa52cf9a2d2feb`; dữ liệu xuất và kiểm tra alpha trong `docs/V37_games_qa/fox-portrait-provenance.json`. Phong cảnh trong bài test được dựng bằng geometry instancing trong `src/world3d/scenes/gameEnvironments.ts`, dùng chung vật liệu PBR/texture từ các đảo đã tải. Không có model thương mại hoặc texture bên ngoài.

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
memory-world.glb 8e13532de90cbfb5353e2aae22cf56da1a8bad859db2363de6dd5c2be8805a56
language-world.glb 2556c2fa14a60608622dea42e52165da6e3d5821a345d39ce4aaac84a82e317a
environment.glb 66379fb5ec01f7905f52744f973446b9b52f4842501236407b203a658128f45c
```

Ba asset PR-03 dùng lại writer GLB gốc qua import không có tác dụng phụ. `npm run assets:build` tạo lại riêng ba file này, không ghi lại cáo/Toán.

| Thuộc tính PR-03 | Rừng Trí Nhớ | Xưởng Ngôn Từ | Môi trường chung |
|---|---:|---:|---:|
| Byte | 1.855.024 | 1.744.044 | 713.036 |
| Tam giác | 23.768 | 25.520 | 8.976 |
| Mesh / material batch | 15 / 15 | 16 / 16 | 6 / 6 |
| PNG nhúng | 24 | 24 | 12 |
| Xương / clip | 0 / 0 | 0 / 0 | 0 / 0 |

Ba file có POSITION/NORMAL/UV và baseColor/normal/roughness PBR, không có URI phụ. Tổng năm GLB là 7.271.708 byte (6,93 MiB), tải/giải mã tối đa hai file đồng thời, một lần trong mỗi vòng đời renderer; chuyển đảo hoặc vào bài học không tải lại. Có duy nhất một canvas/renderer hoạt động. Dự phòng được dựng sau khi renderer lỗi đã dọn tài nguyên. Địa hình nền có sống đồi/đường viền bất quy tắc, thay khối cầu sau khi xem ảnh production.

## Giới hạn nghiệm thu

**Cập nhật PR-05:** `src/world3d/scenes/geometryLod.ts` tạo geometry thấp khi lần đầu cần quality low, bằng meshoptimizer có sẵn trong Three.js. Bản gốc trên đĩa, rig cáo, material/texture giữ nguyên; geometry thấp được cache và hủy theo vòng đời renderer. Bộ đảo 79.956 → 43.198 tam giác (giảm 46%), cả đảo/môi trường 88.932 → 48.774 (giảm 45,2%). Bản thường/cao khôi phục đúng geometry gốc; không dựng hai cảnh hoạt động cùng lúc. Đây là LOD runtime, chưa xuất tệp mobile riêng hoặc giảm byte GLB giải nén.

`tools/modelTransport.mjs` phục vụ đúng năm URL model qua gzip/Brotli trong Vite dev/preview, không thay file. Tổng nguyên bản 7.271.708 byte → 3.428.044 byte Brotli quality 5 / 3.791.705 byte gzip level 6; kiểm thử HTTP giải nén trả lại đúng byte. Có Vary/ETag theo representation, cache tối đa năm file, nén bất đồng bộ tối đa hai tác vụ. Khi đưa lên host tĩnh khác cần cấu hình HTTP tương đương; không tự gán tính năng server local cho mọi nơi phát hành. Các kiểm tra model/renderer và HTTP được giữ trong bộ kiểm thử hiện tại.

- Đã có model/texture/rig/clip và nguồn có thể truy vết cho PR-02/03. Chưa ghi nhận artist phê duyệt hoặc chủ dự án duyệt concept cuối cùng.
- Manifest chỉ khai báo nguồn cho năm tài nguyên thực tế có trong dự án; file gate không thay thế nghiệm thu hình ảnh và thiết bị.
- Chưa xuất tệp LOD/mobile riêng hoặc đo điện thoại thật; có đo GPU Windows, LOD runtime và transport nén trong PR-05. Số tam giác/dung lượng không thay thế nghiệm thu thiết bị mục tiêu.
- Cần xem texture, skin và clip qua `GLTFLoader`/`AnimationMixer` trong browser, chụp desktop/mobile, duyệt bố cục và màu trước khi xác nhận mỹ thuật. Báo cáo runtime/QA của dự án là bằng chứng tách biệt với provenance này.
