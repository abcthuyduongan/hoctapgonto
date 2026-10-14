# Bàn giao V3.7 PR03 — 14/10/2026

Đã thay hai landmark tạm bằng GLB Rừng Trí Nhớ/Xưởng Ngôn Từ có PBR và thêm môi trường chung. Trang đảo giữ hàng ngang ban đầu, cáo chờ ở góc trái; chọn đảo làm vòng đảo quay, đảo được chọn nổi ra trước và cáo nhảy vào vùng trống. Cảnh bài học dùng lại cùng model, vật liệu và renderer. Chủ dự án đã chốt triển khai tiếp; bản này vẫn là **RC, chờ duyệt mỹ thuật và thiết bị thật**.

Build production được kiểm tra: `index-BHrJLZ4s.js`, `PremiumWorldRenderer-DOoUfGEj.js`, `index-CqsJkXTY.css`. Entry 277,43 kB/gzip 86,69 kB; Three renderer lazy 670,96 kB/gzip 173,63 kB. Vite vẫn cảnh báo chunk >500 kB; không thay ngưỡng để giấu cảnh báo.

## Thay đổi và tài nguyên

- Rừng có bốn cây phân nhánh, tán lá điêu khắc, đá nhiều lớp, cầu gỗ, hồ, đường đá và cặp biểu tượng ghi nhớ.
- Xưởng có mái men teal từng panel, cửa vòm/cửa sổ sâu, kệ sách, sách mở nhiều lớp và bàn bút lông. Texture giấy bổ sung grain sau khi test decode phát hiện quá phẳng.
- Nền có đảo xa, sống đồi bất quy tắc, thác nước/đường bọt và mây. Khối đồi hình cầu đã thay sau khi xem ảnh production.
- Tiền cảnh bài học dùng instancing cho cây/nhánh/rễ/đường/sách, mượn vật liệu PBR từ model đảo. Chỉ hill tint clone material; không clone model/texture hoặc đổi màu nguồn.
- Catalog tải/giải mã tối đa hai GLB đồng thời; năm GLB tự chứa, tổng 7.271.708 byte/6,93 MiB, một lần mỗi vòng đời renderer. Chọn đảo hoặc mở/đóng game không tải lại. Network evidence không có model cáo prototype/mobile hoặc chunk legacy trên đường chạy premium thành công.
- Một canvas/context/renderer RAF. Cloud chuyển động cùng RAF, dừng khi giảm chuyển động/tab ẩn. Shadow camera game chứa đầy đủ landmark bên trái và khôi phục khi về trang đảo.
- Mọi root decode được nhận quyền sở hữu trước validation. GameEnvironments hủy geometry/instance/material sở hữu trước Scene; material/texture mượn do Scene hủy một lần. Lỗi model/texture vẫn cho phép vào game bằng DOM qua dự phòng.

Nguồn/hash tại [ASSET_LICENSES_V37.md](../ASSET_LICENSES_V37.md). Byte cáo/Toán giữ nguyên; không hạ yêu cầu file gate.

## Kiểm tra

| Kiểm tra | Kết quả | Log |
|---|---|---|
| TypeScript / syntax / build | PASS | `typecheck.txt`, `test-syntax.txt`, `build.txt` |
| Renderer/catalog/asset/game-environment | 67/67 PASS | `test-renderer.txt` |
| Core / content / guide animation | 44/44, 4/4, 13/13 PASS | `test-core.txt`, `test-content.txt`, `test-guide-animation.txt` |
| Model thật qua GLTFLoader/decode PNG | 12/12 PASS | `model-runtime-tests.txt` |
| File gate đủ năm GLB/PBR/provenance | PASS | `gate-premium-art.txt` |
| Edge production toàn suite | 54 PASS, 1 lỗi cách tạo fixture | `browser-tests.txt` |
| Fixture đã sửa, cùng build | 1/1 PASS | `catalog-cleanup-retest.txt` |
| Chrome production | 4/4 PASS | `chrome-tests.txt` |
| 19 phần logic game/SDK/storage bảo vệ | 0 thay đổi | `../V37_games_qa/game-logic-audit.json` |

Lượt Edge đầu đổi nhầm tên node GLB, nên không tạo lỗi material như dự định; ứng dụng ready đúng. Đã sửa fixture chọn đúng material và kiểm tra JSON trước response. Không sửa implementation sau full suite; targeted retest xác nhận **87 ImageBitmap decode đều đóng đúng một lần**, một canvas dự phòng và Memory vẫn chơi được. Không ghi lượt đầu thành 55/55 hoặc tuyên bố đã chạy lại toàn suite với fixture sửa.

Suite chơi đủ Math 8 câu, Memory 6 cặp, Sentence 6 câu; thử thao tác sai/spam/drag, completion, IndexedDB qua refresh/đóng tab, nhập học liệu, cùng canvas/context/GLB qua game, giảm chuyển động, tab ẩn, quality, mất WebGL, thiếu từng GLB, PNG thật hỏng và 20 vòng home/parent dọn RAF/listener. Viewport từ 1920×1080 đến 320×640, tablet và landscape. Dùng profile QA riêng, không đổi dữ liệu hồ sơ của chủ dự án.

## Hình ảnh và phép đo

21 ảnh cuối + video canvas ở đây, 21 ảnh trước sửa + video trong `baseline/`: tổng quan, ba lựa chọn đảo, ba màn học trên 1440×900/390×844/320×640. Build/request trong `art-browser-evidence.json`, từng cảnh tại [capture-summary.md](capture-summary.md). Không có lỗi runtime/tài nguyên, tràn ngang, nút ngoài viewport/bị che hoặc nút chạm chính dưới 44 px. Đây là QA bố cục, chưa duyệt concept chính thức.

Máy đo: Windows 10.0.26300, Core Ultra 5 125H, ANGLE Intel Arc D3D11, Edge 155.0.4283.45. Median FPS trong 21 snapshot **56,5–57,5**, P95 frame **18,1–18,2 ms**, bản trước khoảng 59,9 FPS. Home desktop balanced có 123–129 draw calls / 220.080–221.328 tam giác gồm shadow pass; mobile emulation bắt đầu low có 66–69 calls / 118.008–118.632 tam giác. Game desktop 61–65 calls, mobile 25–27. Texture estimate có mipmaps **27,25 MiB**, không phải số đo GPU/RAM peak. Video `art-world-demo.webm` 4.132.591 byte, chỉ canvas; DOM ở screenshot.

## Nghiệm thu còn lại

Chưa có Android/iPhone thật kết nối, chưa benchmark mạng chậm/long-task/nhiệt/chế độ pin hoặc LOD riêng được nghiệm thu. Mobile emulation dùng GPU desktop. Chưa tự đánh dấu mỹ thuật >=4/5 hoặc FINAL. [Checklist điện thoại](phone-acceptance.md), [ảnh đối chiếu](visual-review.md) sẵn sàng cho bước tiếp theo.

Mở `/` ở preview đang chạy hoặc `MO_V37_PREMIUM_WINDOWS.bat` để build/chạy cổng 5178. Giữ đúng hostname/cổng đang lưu hồ sơ cũ; origin khác có IndexedDB riêng. Không cần reset storage để xem cảnh mới.
