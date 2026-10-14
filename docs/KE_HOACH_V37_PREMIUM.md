# BẢO AN LEARNING — KẾ HOẠCH LẬP TRÌNH NÂNG CẤP 3D PREMIUM

**Tài liệu triển khai kỹ thuật | Baseline: V3.6.2 RC2 | Đích đề xuất: V3.7 Premium World → V3.8 Content & Gameplay**  
**Ngày lập:** 13/10/2026  
**Trạng thái:** Kế hoạch gốc; đã triển khai PR-00/01 và lát cắt PR-02. Bổ sung ưu tiên hoàn thiện khung cảnh trong bài test ngày 14/10/2026 tại [mục 13](#13-giai-đoạn-kế-tiếp-đồng-bộ-khung-cảnh-trong-các-bài-test). Chưa nghiệm thu V3.7 FINAL.
**Quy tắc:** Kế thừa mã nguồn V3.6.2; không làm lại ứng dụng; không xóa hoặc chuyển đổi dữ liệu cũ khi chưa có kế hoạch migration và backup.

> **Định nghĩa “hoàn thành”:** Người dùng mở **ứng dụng chạy thật** trên máy tính và điện thoại, thấy mô hình 3D hoàn thiện theo concept đã chốt; ba game vận hành ổn định; kết quả lưu được; build, kiểm thử và nghiệm thu mỹ thuật đều đạt. Screenshot concept, ảnh nền đẹp hoặc bộ test unit xanh **không thay thế** kết quả nghiệm thu này.

---

## 1. Đánh giá đúng hiện trạng mã nguồn V3.6.2

Đã đối chiếu trực tiếp với gói `BAO_AN_LEARNING_V3_6_2_NEN_TANG_NOI_DUNG.zip`.

| Thành phần thật | Đường dẫn trong dự án | Kết luận kỹ thuật |
|---|---|---|
| Khung React/Vite, điều hướng, phiên chơi | `src/App.tsx` | Giữ nguyên; đây là nơi khóa phiên, lưu lần trả lời và đóng phiên. |
| Trang ba đảo và nút Bắt đầu | `src/screens/StudentScreen.tsx` | Giữ nút/select HTML độc lập với canvas để học sinh vẫn dùng được nếu không có WebGL. |
| Canvas 3D | `src/world3d/WorldCanvas.tsx` | Điểm tích hợp renderer mới; hiện khởi tạo `LearningWorld3D`. |
| Engine WebGL2 / Canvas dự phòng | `src/world3d/engine.ts` | Đã có 3 đảo hình học, góc nhìn/camera, tạm dừng, chọn đảo, điều chỉnh độ phân giải; **chưa** có pipeline mỹ thuật premium. |
| Bộ nhập GLB | `src/world3d/assets/glb.ts` | Đọc mesh, node, màu; **chưa render PBR texture, skeleton hay glTF animation clips**. Không nên cố chắp thêm từng tính năng cao cấp vào parser hiện tại. |
| Danh sách model bắt buộc | `src/world3d/assets/premium-manifest.json` | 5 model premium chưa đủ điều kiện cổng phát hành. |
| 3 game | `src/games/MathQuest.tsx`, `MemoryMatch.tsx`, `SentenceBuilder.tsx` | Không đụng logic học tập khi nâng renderer; chỉ thêm hiệu ứng qua interface nếu cần. |
| Game SDK, nội dung | `src/core/contracts.ts`, `sdk.ts`, `validation.ts`, `content-io.ts` | Giữ contract, `packId@version`, tính tương thích; không đổi schema tùy tiện. |
| Lưu dữ liệu React | `src/core/storage.ts` | IndexedDB; không xóa DB và không đổi object store trong giai đoạn mỹ thuật. |
| HTML dùng riêng | `BAO_AN_LEARNING_V3_6_2_PLAYABLE.html` / `tools/build_offline_release.py` | Nhánh độc lập dùng `localStorage`; phải báo cáo/kiểm thử riêng. **Không tự coi HTML là bản build của React**. |
| Giao diện khung cố định | `src/styles/unified-frame.css`, `real3d31.css` và các stylesheet đang import | Đã có responsive, nhưng cần rà soát CSS chồng lấn theo viewport thực. |
| Test cũ | `tests/`, `tests/visual/`, `tools/browser_qa_v362.py` | Giữ làm regression suite; bổ sung test renderer, tích hợp, hiệu năng và asset thực. |

**Điểm nghẽn số 1:** V3.6.2 dùng renderer WebGL tự viết cho các khối màu. Dù có GLB nhân vật thử nghiệm, engine hiện không tái hiện đầy đủ texture PBR, rig/animation. Muốn ngang concept phải nâng cấp riêng **tầng hiển thị 3D**, không cần viết lại Game SDK hay ba trò chơi.

**Điểm nghẽn số 2:** `npm run build` của React production, đo FPS trên GPU thực và persistence sau refresh trên origin thật chưa có bằng chứng đạt. Không được suy ra từ việc HTML offline đã chơi được.

## 2. Kiến trúc cần giữ và ranh giới thay đổi

```text
                  src/App.tsx                     [GIỮ]
                      │
           src/screens/StudentScreen.tsx          [GIỮ giao diện, chỉ nối props]
                      │
           src/world3d/WorldCanvas.tsx            [CHỈNH điểm tích hợp]
                      │
                RendererFactory                  [THÊM]
                 /           \
    PremiumWorldRenderer       LegacyWorldRendererAdapter
      [THÊM, Three.js]          [BỌC engine.ts cũ]
           │                         │
     GLB + PBR + rig              WebGL2 cũ / Canvas fallback
           │                         │
       Cùng thao tác chọn đảo / focus / pause / dispose

       Game SDK V1 — ContentPack — IndexedDB     [KHÔNG ĐỔI]
       HTML offline — localStorage               [GIỮ độc lập]
```

**Quyết định thiết kế:** Tích hợp `three` + `GLTFLoader` **chỉ trong tầng 3D premium** sau khi kiểm tra bundle size và tương thích; giữ engine hiện tại làm fallback. Đây là nâng cấp có kiểm soát, không phải tái kiến trúc toàn dự án. Không dùng Phaser cho trang chủ nếu chỉ nhằm dựng phong cảnh.

### 2.1. Các giao diện cần thống nhất

Tạo file **mới** `src/world3d/renderer/types.ts`:

```ts
import type { WorldId } from '../engine';

export type RenderTier = 'low' | 'balanced' | 'high';

export interface RenderStats {
  engine: 'three-webgl' | 'legacy-webgl2' | 'canvas';
  fpsMedian?: number; fpsP95FrameMs?: number;
  drawCalls?: number; triangles?: number;
  textureBytesEstimate?: number;
}

export interface WorldRenderer {
  focusOn(id: WorldId | null): void;
  setPaused(paused: boolean): void;
  setMotion(enabled: boolean): void;
  setQuality(tier: RenderTier): void;
  getDiagnostics(): RenderStats;
  dispose(): void;
}
```

- `LegacyWorldRendererAdapter` ánh xạ `RenderTier` sang `LearningWorld3D.setRenderQuality('balanced'|'sharp')`; không tuyên bố legacy thực sự có đủ ba tier.
- Nếu tạo `PremiumWorldRenderer` thất bại, thử renderer legacy; nếu không có WebGL2, dùng Canvas fallback và vẫn giữ **nút HTML thật**.
- Một canvas chỉ có **một renderer** tại một thời điểm. Khi chuyển renderer phải giải phóng context, texture, geometry, event listeners và vòng lặp RAF. Tôn trọng `webglcontextlost` / `webglcontextrestored`.
- Không import Three.js vào file `src/App.tsx` hoặc game. Chỉ **lazy-load** khi trang 3D cần dùng; game hoạt động khi renderer lỗi.

## 3. Mục tiêu mỹ thuật “nhìn đẹp trong phần mềm thật”

### 3.1. Cố định art direction

- **Phong cách:** hoạt hình 3D giáo dục cao cấp, hình khối mềm, màu tươi nhưng không lóa; vật liệu có độ nhám/bề mặt rõ; cùng một nguồn sáng chính và tone ánh sáng cho tất cả đảo.
- **Ba đảo:** Đảo Toán Học (tháp, đường đá, biểu tượng số), Khu Rừng Trí Nhớ (cây, thẻ ký ức, ánh sáng xanh), Xưởng Ngôn Từ (nhà sách, bút/sách, biểu tượng chữ). Không đổi tên và chức năng ba game.
- **Nhân vật cáo:** silhouette rõ khi nhỏ trên điện thoại; mắt/biểu cảm có chiều sâu; ít nhất `Idle`, `Cheer`, `Victory` (có thể thêm `Point`, `Think`). Hoạt ảnh xương/clip thực, không chỉ di chuyển toàn bộ mesh lên xuống.
- **Chất liệu:** glTF PBR (`baseColor`, `normal`, `roughness`, `metalness` khi hợp lý, `emissive` chọn lọc); texture hợp chuẩn màu. Đá/gỗ/vải có cá tính nhưng không dùng texture dày đặc làm rối màn hình.
- **Camera:** người học nhìn được cùng lúc ba khu, mỗi đảo đủ nhận dạng, không bị tiêu đề hoặc bảng nút che đối tượng quan trọng. Khi focus, chuyển camera êm và có giới hạn; chế độ giảm chuyển động sẽ nhảy trạng thái tức thì.
- **Hiệu ứng:** sương/mây, gợn nước, ánh sáng và hạt bụi nhẹ nếu GPU cho phép; không sử dụng hiệu ứng hậu kỳ đắt đỏ làm mặc định trên điện thoại yếu.
- **Bố cục UI:** điều khiển chính (chọn học liệu / Bắt đầu) nằm trong DOM, luôn đọc được và có vùng chạm đủ lớn. Không đặt chữ học thuật cỡ nhỏ lên mesh 3D.

### 3.2. Năm asset bắt buộc đúng manifest hiện có

| Asset trong `public/models/` | Tiêu chuẩn bàn giao |
|---|---|
| `fox-guide.glb` | Mesh + texture + rig + ít nhất 3 animation clip hoạt động đúng; nguồn/giấy phép ghi rõ. |
| `math-world.glb` | Đảo Toán Học hoàn chỉnh, bối cảnh và điểm nhấn định danh dễ thấy. |
| `memory-world.glb` | Khu rừng có lớp tiền/trung/hậu cảnh, chỗ đặt hiệu ứng thẻ. |
| `language-world.glb` | Xưởng Ngôn Từ có công trình nổi bật và vật dụng liên quan chữ/sách. |
| `environment.glb` | Mây, cụm vật thể dùng chung, yếu tố trang trí/tầng xa, không lặp vô lý. |

**Quy trình asset:** Concept chuẩn → blockout Blender → duyệt bố cục → high-quality stylized model → UV/material → rig/clip cho cáo → xuất GLB/glTF 2.0 → kiểm tra texture/normals/animation → LOD/simplify dành cho mobile → ghi provenance/license → chụp trong browser để duyệt. Không lấy ảnh concept làm texture phủ kín một tấm phẳng để giả 3D.

**Chú ý:** Test `tests/release-3d-assets.mjs` hiện mới kiểm tra file GLB, JSON, có texture/animation và license cơ bản; qua test này **chưa có nghĩa** vật liệu render đúng hoặc đạt concept. Phải thêm runtime test và ảnh chụp so sánh.

## 4. Lộ trình theo đợt lập trình, có thứ tự phụ thuộc

> Đơn vị ước tính: **ngày công** của người có kinh nghiệm tương ứng, **không phải lời hứa về ngày hoàn thành**. Làm một mình bao gồm cả dựng mẫu 3D sẽ tốn hơn đội có 3D artist. Tách rõ coding và sản xuất asset; không chuyển sang giai đoạn sau nếu tiêu chí chặn chưa đạt.

| Mốc / nhánh PR | Công việc code và asset | Ước tính công sức | Điều kiện qua mốc |
|---|---|---:|---|
| **PR-00: Baseline** | Khóa nhánh V3.6.2, lưu hash ZIP, cài dependency, chạy full test/build hiện có, ghi lỗi baseline, chụp ảnh 3 viewport. | 1–2 ngày công dev | Có log baseline; dữ liệu cũ không mất. |
| **PR-01: Renderer abstraction** | `types.ts`, `legacyAdapter.ts`, `rendererFactory.ts`; chuyển `WorldCanvas.tsx` sang factory với fallback và dispose. | 2–4 dev | UI/3 game y nguyên; renderer cũ chạy; test chuyển trang không rò bộ nhớ. |
| **PR-02: Premium vertical slice** | `PremiumWorldRenderer.ts`, loader GLB, tone mapping, lights, camera, AnimationMixer; **một đảo Math + cáo** dựng đẹp thật trong browser. | 5–9 dev **+** 6–12 artist | Trên PC/điện thoại xem được model 3D/texture/clip thật, bấm Math Quest bình thường. |
| **PR-03: Hai đảo còn lại** | Nạp `memory-world.glb`, `language-world.glb`, `environment.glb`; thống nhất scale/camera, bóng, màu và chuyển focus. | 3–6 dev **+** 7–14 artist | Ba đảo đồng nhất bố cục, asset gate đủ 5 model. |
| **PR-04: Giao diện, khung cảnh bài test & motion** | Đồng bộ cảnh Math/Memory/Sentence với trang chọn đảo theo mục 13; responsive, phản hồi đúng/sai, nhân vật và màn hoàn thành dùng chung phong cách. | Ước lượng lại sau lát cắt Math | Không tràn/nhảy ở 320–1920 px; click/touch/keyboard chuẩn; cảnh trong bài và trang chủ cùng hệ mỹ thuật. |
| **PR-05: Performance** | Adaptive quality, DPR cap, on-demand/pause, giảm draw calls, LOD, preload có giới hạn, telemetry phục vụ QA; tối ưu asset mobile. | 4–7 dev + 2–4 artist | Đạt ngân sách hiệu năng **đã đo trên máy thật**. |
| **PR-06: Release gate** | Build React, E2E 3 game, kiểm tra persistence, refresh, lỗi WebGL, mobile Safari/Chrome, backup/rollback; ảnh chụp ứng dụng để duyệt. | 3–6 dev + thời gian nghiệm thu | Tất cả gate P0 đạt; chủ dự án duyệt thẩm mỹ. |
| **V3.8: Gameplay & học liệu** | Mở rộng ngân hàng câu hỏi, level, feedback/pacing, bộ nội dung theo lớp/môn; không trộn vào PR renderer. | Lập kế hoạch riêng | Chỉ bắt đầu mở rộng lớn khi nền V3.7 đã ổn định. |

**Tổng tham khảo trước khi mở rộng nội dung:** khoảng **21–39 ngày công lập trình** và **15–30 ngày công mỹ thuật 3D**, phụ thuộc chất lượng model nguồn, số lần chỉnh concept và phần cứng mục tiêu. Có thể làm song song một phần. Số này không bao gồm hạ tầng tài khoản/cloud.

### Cách ưu tiên nếu nguồn lực có hạn

1. **Chốt một “vertical slice”** gồm *cáo + Đảo Toán Học + Math Quest* đẹp và chạy mượt thật trước, duyệt đúng chất lượng.
2. Tái sử dụng pipeline ánh sáng, vật liệu, camera, animation sang Memory/Sentence; **không** vẽ ba đảo tạm bợ rồi gọi đã đạt concept.
3. Nếu model đẹp gây chậm, giảm chất lượng asset/hiệu ứng theo tier, **không** giảm cỡ nút/chữ hoặc làm khó học sinh.
4. Chỉ quay lại chỉnh lại cấu trúc Game SDK khi phát hiện bug có kiểm chứng; mỹ thuật 3D không phải lý do đủ để thay SDK.

## 5. Danh sách tệp: lập trình vào đâu, không sửa nhầm

### 5.1. Tạo mới (đề xuất)

```text
src/world3d/
  renderer/
    types.ts                # hợp đồng renderer, thống kê
    rendererFactory.ts      # chọn premium/legacy, fallback
    legacyAdapter.ts        # bọc LearningWorld3D từ engine.ts
    PremiumWorldRenderer.ts # Three/WebGLRenderer, scene, camera, RAF
    assetLoader.ts          # GLTFLoader, cache, lỗi mạng, abort policy
    disposeScene.ts         # geometry/material/texture/mixer cleanup
    qualityManager.ts       # low/balanced/high + hysteresis
    performanceMetrics.ts   # frame time P50/P95, draw calls
  scenes/
    buildWorld.ts           # world chung + ánh sáng/mây
    worldLayout.ts          # toạ độ/scale/camera landmarks
    mascotController.ts     # states Idle/Cheer/Victory
  assets/
    premium-manifest.json   # GIỮ schema; điền license THẬT khi có asset

public/models/
  fox-guide.glb
  math-world.glb
  memory-world.glb
  language-world.glb
  environment.glb

# Chỉ khi cần chất lượng thấp riêng và đã đo:
public/models/lod/          # các bản LOD/mobile, không thay file gốc

# Kiểm thử thêm:
tests/renderer-contract.test.mjs
tests/model-asset-runtime.test.mjs
tests/quality-manager.test.mjs
tests/visual/premium-world.spec.ts
tests/visual/mobile-ui-lock.spec.ts
tests/visual/gameplay-regression.spec.ts

docs/QA_V37_PREMIUM.md
docs/ASSET_LICENSES_V37.md
```

### 5.2. Sửa ít, có kiểm soát

- `src/world3d/WorldCanvas.tsx`: dùng factory, trạng thái load/fallback, clean-up, quality option, `visibilitychange` và `prefers-reduced-motion`.
- `src/screens/StudentScreen.tsx`: nếu cần, thêm điều khiển chất lượng; giữ cơ chế chọn game qua DOM và chú thích có thể đọc bằng screen reader.
- `src/styles/unified-frame.css`, `src/styles/real3d31.css`: sửa theo viewport đo được; **không** tiếp tục rải hàng loạt `!important` qua nhiều CSS nếu có thể gom về một nguồn.
- `src/App.tsx`: chỉ thêm state cho chất lượng 3D/tạm dừng; không tác động `recordAttempt`, `completeSession`, IndexedDB.
- `package.json`: bổ sung thư viện 3D tối thiểu, scripts gate và lockfile; phải có kiểm thử bundle sau khi cài.
- `tests/release-3d-assets.mjs`: thêm kiểm tra chi tiết hơn cho manifest và texture/clip; giữ nguyên ý nghĩa cổng nghiệm thu.

### 5.3. Vùng cấm thay đổi trong vòng mỹ thuật

- Không đổi tên ba `ModuleId`: `math-quest`, `memory-match`, `sentence-builder`.
- Không đổi `ContentPack.kind` (`quiz`, `pairs`, `sentences`) hoặc `GAME_SDK_VERSION = 1` chỉ vì muốn đổi giao diện.
- Không xóa `src/core/storage.ts`, không reset IndexedDB, không tự gộp localStorage offline với IndexedDB React.
- Không làm game phụ thuộc việc GLB đã tải xong. GPU không hỗ trợ vẫn phải vào game bằng nút HTML.
- Không đưa khóa API, dữ liệu học sinh thật hoặc thông tin riêng tư vào gói model/JSON.

## 6. Khung code triển khai — theo từng PR

### 6.1. PR-01: Factory, fallback, vòng đời

*Đây là mẫu hợp đồng triển khai, chưa phải bản vá đã được build. Adapter phải được kiểm thử với phương thức thật của `engine.ts`.*

```ts
// src/world3d/renderer/rendererFactory.ts — skeleton
import type { WorldRenderer } from './types';

type InitOpts = {
  canvas: HTMLCanvasElement;
  onSelect: (id: import('../engine').WorldId) => void;
  motionOn: boolean;
};

export async function createWorldRenderer(opts: InitOpts): Promise<WorldRenderer> {
  try {
    // Lazy-load để không bắt game tải engine cao cấp khi không cần.
    const { createPremiumRenderer } = await import('./PremiumWorldRenderer');
    return await createPremiumRenderer(opts);
  } catch (error) {
    console.warn('Premium renderer unavailable; using legacy fallback', error);
    const { createLegacyRenderer } = await import('./legacyAdapter');
    return createLegacyRenderer(opts);
  }
}
```

**Chi tiết dễ mắc lỗi:** Nếu premium đã tạo context trên canvas rồi mới ném lỗi, phải **giải phóng và thay `<canvas>`** trước khi khởi tạo fallback; không cố lấy một context kiểu khác trên canvas đã được dùng. Bọc việc tạo renderer vào React effect có `cancelled` flag và cleanup bất kể promise thành công/trễ; tránh race condition khi điều hướng nhanh.

### 6.2. PR-02: Loader premium, màu và hoạt ảnh thực

**Dependency dự kiến (chỉ chạy sau khi có môi trường npm và kiểm tra tương thích):**

```bash
npm install three
npm install --save-dev @types/three
```

`GLTFLoader` thuộc `three/addons/loaders/GLTFLoader.js`; không bắt buộc thêm package GLTFLoader riêng. GLB dùng compression Draco/Meshopt/KTX2 cần decoder tương ứng; **không bật nén trước khi có loader, MIME, test offline và bản quyền đầy đủ**.

```ts
// Ý tưởng cốt lõi trong assetLoader.ts / mascotController.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const gltf = await loader.loadAsync('/models/fox-guide.glb');
scene.add(gltf.scene);

const mixer = new THREE.AnimationMixer(gltf.scene);
const clips = new Map(gltf.animations.map(clip => [clip.name, clip]));
const idle = clips.get('Idle');
if (!idle) throw new Error('Fox model thiếu clip Idle');
mixer.clipAction(idle).play();

// Render loop: mixer.update(deltaSeconds) chỉ chạy khi motionOn và active.
// UI/game vẫn có thể hoạt động khi model lỗi; ghi lỗi vào chẩn đoán.
```

**Yêu cầu runtime:** không cập nhật `AnimationMixer` bằng delta âm/khổng lồ sau khi tab quay lại; clamp delta; không gọi render một cách không giới hạn khi tab ẩn; ánh sáng, exposure, color-space nhất quán; dọn `AnimationMixer` + clip actions + geometry/texture khi dispose. Không tạo listener mới mỗi lần chọn đảo.

### 6.3. PR-03: Thế giới duy nhất, ba đảo

- Dùng **một** `THREE.Scene`, một camera, một `WebGLRenderer`; mỗi đảo là `THREE.Group` (`math`, `memory`, `language`).
- Cấu hình vị trí và điểm camera ở `worldLayout.ts`, không hard-code rải rác trong JSX/CSS.
- Raycast để chọn đảo chỉ là lối tương tác phụ; nút DOM hiện có là lối chính, chống chọn nhầm khi trên điện thoại người dùng cuộn/chạm.
- `focusOn(id)` chỉ animate camera/outline/nhân vật; **không** tải lại toàn bộ GLB khi đổi đảo.
- Nếu thiếu một GLB, vẫn mở được các game; hiển thị cảnh dự phòng và báo lỗi nội bộ, không trắng màn hình.

### 6.4. PR-05: Quality tiers và tiêu chuẩn FPS

```ts
// src/world3d/renderer/qualityManager.ts — cấu hình ban đầu, phải tune qua đo đạc
export const QUALITY = {
  low:      { maxDpr: 1.0,  shadows: false, particles: false, postFx: false },
  balanced: { maxDpr: 1.5,  shadows: true,  particles: false, postFx: false },
  high:     { maxDpr: 2.0,  shadows: true,  particles: true,  postFx: true  }
} as const;
```

- Auto tier mặc định: mobile phổ thông `balanced` hoặc `low` theo đo thực; PC GPU đủ mạnh mới `high`; có nút thủ công.
- Không đổi quality liên tục sau vài frame chậm. Dùng cửa sổ quan sát ổn định và **hysteresis**, tối thiểu một khoảng cách giữa hai lần điều chỉnh; game giữ focus và nội dung khi đổi tier.
- Giảm draw calls bằng geometry/material reuse, instancing cho cây/cỏ giống nhau; bake ánh sáng cho cảnh tĩnh nếu phù hợp; giới hạn shadow casters; texture mipmaps; cân nhắc LOD riêng.
- Có màn hình/loading rõ ràng khi model chưa sẵn, nhưng không khóa thao tác vào game. Khi mở game overlay, có thể tạm dừng world render để tiết kiệm GPU.

## 7. Performance budget đề xuất (phải đo mới chốt)

Những giá trị dưới đây là **ngưỡng thiết kế ban đầu**, không phải số đo hiện tại của dự án và có thể điều chỉnh nếu concept/thiết bị yêu cầu khác.

| Chỉ số | PC/laptop phổ thông | Điện thoại phổ thông | Cách chứng minh |
|---|---:|---:|---|
| FPS trong cảnh idle/di chuyển | Mục tiêu ~60 | Mục tiêu >=30, ưu tiên 45–60 nếu đạt | FPS theo frame timestamp trên GPU/browser thật; ghi P50 + P95 frame time. |
| Độ trễ tương tác trả lời | Không gây freeze; mục tiêu <100 ms phản hồi thị giác | Không gây freeze; mục tiêu <150 ms | Performance profiler + thao tác tay. |
| Long task | Không có tác vụ liên tục >200 ms khi tương tác | Như PC; ưu tiên thấp hơn 50 ms mỗi task | Browser Performance/Long Tasks. |
| DPR render | Auto tối đa 2.0 | Auto tối đa 1.0–1.5 | Renderer diagnostics, ảnh so sánh. |
| Bố cục | Không có horizontal overflow | Không có horizontal overflow, nút không bị che | `scrollWidth`, bounding boxes, screenshot. |
| Khi lỗi context | Renderer khôi phục hoặc fallback | Renderer khôi phục hoặc fallback | Chủ động mô phỏng context loss. |

**Thiết bị nghiệm thu tối thiểu:** Windows + Chrome/Edge; Android tầm trung + Chrome; iPhone + Safari nếu mục tiêu có iOS. Thử 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 390×844, 375×812, 320×640; thêm landscape mobile. Ghi model CPU/GPU, RAM, OS, browser, chế độ pin và ngày đo. Không lấy Chrome SwiftShader làm đại diện cho GPU điện thoại thật.

## 8. Bộ kiểm thử bắt buộc trước gắn nhãn V3.7 FINAL

### Gate A — Mã nguồn & asset

```bash
npm install
npm run typecheck
npm run test:core
npm run test:content
npm run test:guide-animation
npm run gate:premium-art
npm run build
npm run test:visual
```

- Chạy thành công **trên đúng source tree và lockfile phát hành**.
- Kiểm tra thực tế 5 model đúng `premium-manifest.json`, license có bằng chứng, texture không mất, clip `Idle/Cheer/Victory` phát trong browser.
- Test gate file chỉ là mức tối thiểu: bổ sung test mô hình hiển thị đúng, chứ không chỉ “GLB tồn tại”.
- Thêm regression test đảm bảo Math/Memory/Sentence chạy dù renderer premium trả lỗi.

### Gate B — Gameplay & dữ liệu

- [ ] Math Quest chơi hết 8/8 câu mẫu (và một bộ JSON mới), không nhảy đôi câu, phản hồi không che nội dung.
- [ ] Memory Match ghép đủ 6/6 cặp, spam click không bị kẹt, không có hai lượt ghi nhận cho một hành động.
- [ ] Sentence Builder ghép đủ số câu trong học liệu (seed React hiện có 6 câu; HTML offline có 5), hỗ trợ chạm, không nhận sai chỉ số kéo thả.
- [ ] Các phiên `completed`/`abandoned` và learning events được ghi đúng `sessionId`, `packId`, `contentVersion`.
- [ ] Refresh giữa bài, đóng/mở tab và xuất/khôi phục dữ liệu hoạt động đúng theo giới hạn sản phẩm; lỗi lưu được hiển thị.
- [ ] Test storage trên **origin thật** (localhost hoặc HTTPS được trình duyệt hỗ trợ), không dùng fake localStorage để kết luận độ bền dữ liệu.
- [ ] Bản HTML offline có test độc lập; nếu renderer premium chỉ có trên React phải ghi **rõ** điều đó khi phát hành. Không gắn nhãn “đồng nhất” nếu hai nhánh khác khả năng 3D.

### Gate C — Mỹ thuật và sử dụng trên màn hình thật

- [ ] Ảnh chụp **trong browser đang chạy** thể hiện cáo và đủ ba đảo; đối chiếu với concept đã duyệt ở cùng tỷ lệ khung hình.
- [ ] Cộng tác viên/chủ dự án duyệt: nhân vật, kiến trúc đảo, lighting/PBR, chiều sâu, nhịp animation, tính nhất quán; mỗi mục chấm 0–5, mục tiêu >=4/5 và không có lỗi trọng yếu.
- [ ] Các nút Bắt đầu, chọn học liệu, Góc phụ huynh, Creator Studio vẫn tương tác tốt, không bị canvas chiếm pointer.
- [ ] Không overflow ngang, không trượt/nhảy khung khi trả lời hoặc đóng/mở game; không che đáp án ở điện thoại 320 px.
- [ ] Có `prefers-reduced-motion` và giảm chuyển động trong ứng dụng; giảm hiệu ứng không làm mất khả năng chọn đảo.
- [ ] Đo FPS/cảm ứng/bộ nhớ trên phần cứng thật; trường hợp tụt hiệu năng có tier thấp/fallback hoạt động.

**Quyết định phát hành:** Tất cả Gate A, B, C phải **đạt**. Nếu bất kỳ gate nào chưa đạt, nhãn đúng là **RC / đang phát triển**, không gọi FINAL hoặc “đạt concept”.

## 9. Quy trình thực hiện và quản lý rủi ro

1. **Branch và backup:** tạo branch `feature/v37-premium-world`; sao lưu baseline V3.6.2 và hai nguồn dữ liệu mẫu; không chạy migration dữ liệu trong PR 3D.
2. **PR nhỏ, có demo:** mỗi PR không sửa logic và mỹ thuật lẫn nhau; ghi screenshot/video từ ứng dụng chạy, test log, bundle size và điểm hồi quy.
3. **Một giao diện chung:** theo yêu cầu ngày 14/10/2026, chỉ hiển thị giao diện mới; renderer cũ là dự phòng tải riêng khi lỗi. Không chạy hai phiên bản song song. Rollback bằng checkpoint Git trong thư mục riêng, không thay đổi điểm hay câu hỏi.
4. **Bảo vệ tương tác:** click nút game đi trực tiếp từ DOM; scene chỉ trang trí/chọn focus; không cho scene resize game dialog khi có feedback.
5. **Quản lý asset:** mỗi GLB có `source`, `author`, `license`, `modifiedBy`, `exportSettings`, `textureResolution`, `triangles`, `animationClips` trong `docs/ASSET_LICENSES_V37.md`.
6. **Không thêm server lúc này:** nền tảng hiện dùng dữ liệu cục bộ; cloud auth, tài khoản trẻ em, đồng bộ nhiều thiết bị là công việc riêng, không gộp vào mục tiêu “đẹp như concept”.

### Rủi ro và xử lý

| Rủi ro | Dấu hiệu phát hiện | Biện pháp |
|---|---|---|
| Model 3D quá nặng | Tải trang lâu, long task, GPU memory tăng | Simplify/LOD, texture atlas, texture compression có test, preload một phần. |
| Asset đẹp nhưng khác phong cách | Mỗi đảo một tông màu/scale | Phê duyệt **một** vertical slice trước; dùng chung lighting, material guide. |
| Three.js làm tăng bundle | Tải JS đầu trang tăng mạnh | Lazy import renderer, code split; đo bundle trước/sau và trên mạng chậm. |
| Renderer lỗi trên mobile | WebGL context loss/trắng canvas | Safe factory/fallback, debug logging, 3 nút DOM luôn có. |
| Nhân vật có clip nhưng không phát | GLB có animation, mixer sai tên/scale | Runtime animation test + screenshot/video và kiểm tra clip name. |
| CSS các phiên bản chồng nhau | Tràn/chuyển vị trí chỉ ở một kích thước | Tập trung CSS home stage, snapshot regression nhiều viewport. |
| Dữ liệu điểm mất khi “nâng cấp” | Thay schema/xóa localStorage | Không migration trong PR mỹ thuật; backup + test persistence có thật. |

## 10. Chỉ sau V3.7: bắt đầu V3.8 phát triển game/nội dung theo dữ liệu

**Giữ nguyên cấu trúc hiện tại** (`ContentPack`, `CreatorScreen`, `content-io.ts`), không đưa câu hỏi cố định vào code UI.

| Nhánh game | Nội dung đầu tiên nên phát triển | Hạng mục lập trình kế tiếp |
|---|---|---|
| Math Quest | Mỗi bài 8–12 câu, nhận biết → vận dụng, 4 phương án, giải thích đúng/sai | Map-level + mục tiêu kiến thức, nhịp phản hồi, thưởng sao theo phiên. |
| Memory Match | 6–10 cặp hình/từ/khái niệm có kiểm chứng | Gợi ý có chi phí sao, biến thể lật thẻ và bộ cặp theo mức độ. |
| Sentence Builder | 5–8 câu/chủ đề, hint, vị trí từ dễ nhầm | Hiển thị gợi ý có kiểm soát, nhiều cấp độ độ dài, hỗ trợ thao tác chạm. |

**Cảnh báo kỹ thuật:** Sentence Builder hiện so khớp với **một thứ tự đáp án mẫu** trong `SentenceItem.words`, không tự đánh giá mọi câu đồng nghĩa hoặc biến thể ngữ pháp hợp lệ. Nếu bổ sung nhiều đáp án, cần thay đổi contract có version migration và viết test ngôn ngữ riêng — không sửa âm thầm.

**Pipeline nội dung:** giáo viên tạo bản nháp → người duyệt kiểm tra SGK/đáp án → `validatePack()` → xuất `baoan-learning-content` JSON formatVersion 1 → test chơi trọn bài → xuất bản `id@version` bất biến → quan sát lỗi/độ khó → phát hành phiên bản mới nếu cần. Dữ liệu người học và học liệu là hai luồng khác nhau.

## 11. Việc lập trình đầu tiên cần làm ngay (Backlog ưu tiên cao nhất)

**PR-00**
- [ ] Checkout mã nguồn V3.6.2 đã bàn giao, kiểm tra checksum ZIP và `git status` sạch.
- [ ] `npm install` + baseline scripts; lưu toàn bộ kết quả, kể cả test đang lỗi.
- [ ] Chụp screenshot V3.6.2 PC + mobile và chốt bảng style từ concept đã duyệt.
- [ ] Sao lưu IndexedDB/localStorage của dữ liệu thử nghiệm trước mọi thay đổi.

**PR-01**
- [ ] Tạo 4 file `renderer/types.ts`, `legacyAdapter.ts`, `rendererFactory.ts`, `PremiumWorldRenderer.ts` (premium giai đoạn đầu chỉ render scene thử nghiệm tối thiểu).
- [ ] Chuyển `WorldCanvas.tsx` dùng factory với `dispose` + `cancelled flag`, fallback context-safe.
- [ ] Viết test khi renderer premium thất bại + chuyển màn 20 lần không phát sinh context/listener leak.
- [ ] Chạy ba game và kiểm tra event history **không đổi**.

**PR-02**
- [ ] Dựng hoặc chọn có giấy phép **một** model cáo premium (GLB có rig, texture, `Idle/Cheer/Victory`) và một Math Island đúng concept.
- [ ] Tích hợp GLTFLoader / AnimationMixer, ánh sáng và material từ asset thật; debug clip, normal, scale, shadow.
- [ ] Chụp ảnh/video **từ React runtime** tại 1440×900 và 390×844; đo FPS trên GPU thật.
- [ ] Duyệt vertical slice: chưa đẹp thì **sửa asset/lighting**, không vội sao chép sang hai đảo còn lại.

**Điều kiện để bắt đầu PR-03:** cáo và Math Island đã đạt tiêu chuẩn hình ảnh trên máy thật, không làm giật thao tác vào Math Quest. Khi đó mới nhân rộng pipeline sang hai đảo còn lại.

---

## 12. Mẫu thông tin cần có trong mỗi báo cáo tiến độ

```md
### BẢO AN LEARNING V3.7 — Báo cáo PR-XX
- Nhánh / commit: ...
- Tệp đã sửa: ...
- Thay đổi thực tế: ...
- Asset mới + nguồn/giấy phép: ...
- npm run build: PASS/FAIL (log: ...)
- test:core / test:content / test:guide-animation: ...
- gate:premium-art: PASS/FAIL (vì sao)
- 3 game hoàn thành: Math x/x, Memory x/x, Sentence x/x
- React / HTML offline: trạng thái từng nhánh
- Thiết bị thực + browser: ...
- FPS P50, frame-time P95, GPU/renderer: ...
- Độ phân giải đã kiểm tra, overflow và lỗi chạm: ...
- Screenshot/video **từ ứng dụng chạy thực tế**: ...
- Vấn đề còn mở / blocker: ...
- Quyết định: CONTINUE / FIX / REVERT / READY FOR NEXT GATE
```

### Kết luận điều hành

Lát cắt cáo/đảo Toán và tương tác xoay đảo đã có trong ứng dụng. **Ưu tiên kế tiếp theo yêu cầu chủ dự án:** hoàn thiện khung cảnh bên trong ba bài test, đồng bộ với trang chọn đảo theo mục 13, bắt đầu bằng Math Quest. Việc duyệt mỹ thuật và hoàn thiện hai đảo còn lại vẫn thuộc V3.7; không lấy screenshot hoặc test xanh làm nghiệm thu FINAL. V3.8 phát triển câu hỏi/cấp độ sau khi nền V3.7 ổn định.

## 13. Giai đoạn kế tiếp: đồng bộ khung cảnh trong các bài test

**Bổ sung ngày 14/10/2026 theo yêu cầu chủ dự án. Đã triển khai bản dùng chung renderer và theme cho cả ba bài, kiểm thử production và 36 trạng thái hình ảnh; chưa nghiệm thu mỹ thuật hoặc điện thoại thật.** “Bài test” ở đây là màn học/chơi Math Quest, Memory Match và Sentence Builder, gồm lúc làm bài, phản hồi, hoàn thành và trở về trang đảo. [Bằng chứng và giới hạn kiểm tra](V37_games_qa/verification.md).

### 13.1. Mục tiêu hình ảnh

Khi bấm Bắt đầu, người học có cảm giác bước vào chính hòn đảo vừa chọn. Trang chủ và bài test dùng cùng cáo, màu sắc, chất liệu, ánh sáng, tỷ lệ hình và cách chuyển động; khung câu hỏi vẫn rõ, dễ đọc và dễ thao tác.

Hiện trang chủ dùng cáo/đảo Toán GLB thật, còn màn chơi dùng ảnh nền WebP và `GameMascot` lấy `/art/fox-scene-free.webp`. Khung, HUD và phần thưởng còn chịu nhiều lớp CSS cũ. Đây là các điểm cần đồng bộ, không phải thay lại logic học tập.

| Bài test | Khung cảnh cần hoàn thiện | Vùng tương tác cần đồng bộ |
|---|---|---|
| Math Quest — Đảo Toán Học | Sân hoặc không gian học của lâu đài đang thấy trên đảo; đá, cây và biểu tượng số cùng chất liệu với trang chủ | Bảng câu hỏi và bốn đáp án màu kem/teal; tiến độ, gợi ý và giải thích trong vùng cố định; cáo đứng bên góc |
| Memory Match — Khu Rừng Trí Nhớ | Khoảng rừng có chiều sâu, cây và ánh sáng theo cùng hệ mỹ thuật; vùng giữa đủ thoáng cho thẻ | Mặt trước, mặt sau và trạng thái ghép đúng phân biệt bằng màu/ký hiệu; lật thẻ nhẹ; giữ lưới 4 cột desktop, 3 cột mobile; cáo không che thẻ hoặc phản hồi |
| Sentence Builder — Xưởng Ngôn Từ | Góc học trong xưởng/nhà sách, sách và ký hiệu chữ cùng phong cách với đảo; nền bớt rối phía sau câu | Ô ghép câu, kho từ, gợi ý và nút kiểm tra dùng chung chất liệu; chạm và kéo thả dễ dùng; giữ đủ chỗ cho câu dài |
| Hoàn thành / quay về | Cùng cáo và phong cách phần thưởng; chuyển từ cảnh bài test về đúng đảo đã chọn | Điểm/tóm tắt đọc rõ; nút trở về dễ chạm; khôi phục focus hợp lý |

### 13.2. Cách tổ chức để giữ ứng dụng nhẹ

- Tạo bộ token chung cho nền kem, chữ đậm, màu nhấn, bo góc, khoảng cách, bóng và typography từ giao diện trang chủ. Đồng bộ cả header/Thoát, HUD và tiến độ; mỗi đảo có điểm nhấn riêng trong cùng hệ.
- Một tầng dựng cảnh dùng chung trong `src/world3d/`, chuyển chế độ trang đảo/bài test theo hoạt động. Ưu tiên tái sử dụng renderer, model cáo, vật liệu và tài nguyên đã tải; không tạo ba engine riêng hoặc tải model lại theo từng câu.
- Khi mở bài test, chỉ cảnh bài test được cập nhật/render; khi quay về chỉ cảnh trang đảo hoạt động. Nếu cần thay renderer, dọn renderer/context cũ trước. Kiểm tra cả số RAF và tài nguyên còn giữ, không chỉ nhìn FPS.
- Chất lượng thấp và lỗi WebGL dùng cảnh tĩnh/dự phòng cùng phong cách. Nếu dùng ảnh cáo thay 3D, tạo ảnh từ chính model cáo chung để giữ đúng nhân vật. Thiếu asset không chặn làm bài.
- Nút, thẻ, đáp án, gợi ý và ô ghép câu vẫn là DOM thật trên lớp cảnh. Cảnh trang trí không nhận pointer ở vùng làm bài; phản hồi không đẩy hoặc che nội dung.
- Thu gom CSS màn chơi vào lớp theme rõ ràng, loại bỏ quy tắc cũ trùng nhau trong phạm vi đã kiểm chứng; không tiếp tục chất thêm nhiều lớp `!important`.

### 13.3. Thứ tự thực hiện

1. **Đo và chốt baseline:** chụp ba bài hiện tại ở desktop/390/320 px; liệt kê ảnh, CSS và UI dùng chung; đo tải tài nguyên và độ trễ khi mở bài.
2. **Khung dùng chung:** tạo theme màn chơi, khung câu hỏi/tiến độ, lớp cảnh, vị trí cáo bên góc và phần thưởng thống nhất. Nối chế độ cảnh với game host, giữ nguyên các callback học tập.
3. **Lát cắt Math hoàn chỉnh:** làm đủ vào bài → chờ trả lời → đúng/sai → gợi ý → câu tiếp → hoàn thành → trở về đảo. Kiểm tra chất lượng hình ảnh và thao tác trên máy thật trước khi nhân rộng.
4. **Memory và Sentence:** tái sử dụng khung/renderer; hoàn thiện cảnh rừng, cảnh xưởng, thẻ và ô ghép từ theo đặc điểm từng game. Không sao chép bố cục bốn đáp án của Math sang các game khác.
5. **Nghiệm thu toàn luồng:** chơi trọn ba bài, đổi đảo/bài nhiều lần, giảm chuyển động, chất lượng thấp, lỗi asset/context và dữ liệu sau refresh. Lưu ảnh/video từ build chạy thật.

Các điểm tích hợp: `src/App.tsx` (game host/chuyển màn), `src/games/GameMascot.tsx`, `GameCompletion.tsx`, `FeedbackEffects.tsx`, phần JSX trình bày của ba game, `src/world3d/` và stylesheet màn chơi. Hàm chấm/ghi đáp án, khóa thao tác, `ContentPack`, SDK và schema IndexedDB giữ nguyên; chỉnh phần trình bày phải có regression để chứng minh hành vi học tập không đổi.

### 13.4. Điều kiện hoàn thành giai đoạn

- [x] Đã triển khai ba cảnh cùng cáo, màu, ánh sáng và vật liệu với trang chủ; khung nội dung rõ hơn. Có ảnh đối chiếu từ build thật; phê duyệt mỹ thuật chính thức còn riêng.
- [x] Cáo có vùng bên góc, không che thao tác ở 320 px; nút chạm chính tối thiểu 44 px. Kiểm tra overflow và ổn định khung qua các viewport 320–1920 px.
- [x] Cùng canvas/context/model và RAF; 20 vòng mở/đóng bài giữ số listener/RAF, không tải thêm GLB. Resource sharing/dispose được kiểm tra nguồn và renderer; chưa đo GPU memory peak bằng profiler.
- [x] Giảm chuyển động, bàn phím, chạm và chỉ số kéo thả đã qua regression; lỗi renderer không chặn làm bài.
- [x] Math 8 câu, Memory 6 cặp, Sentence 6 câu và nhập học liệu JSON chạy đúng; history/dữ liệu sau refresh giữ đúng. SDK và logic ghi học tập không đổi.
- [x] Build, kiểm thử renderer/gameplay/responsive đạt qua lượt đầy đủ và lượt xác minh sau sửa; có ảnh/video desktop và viewport mobile giả lập, xem báo cáo để biết từng kết quả.
- [ ] Đo Android/iPhone thật, đối chiếu concept và phê duyệt mỹ thuật. Hai landmark Trí nhớ/Ngôn từ và môi trường vẫn cần asset premium để đủ art gate V3.7 FINAL.

Giai đoạn này hoàn thiện trải nghiệm hình ảnh trong bài test. Thêm câu hỏi, cấp độ, luật tính điểm hoặc đánh giá nhiều đáp án ngôn ngữ tiếp tục là phạm vi nội dung/gameplay riêng.
