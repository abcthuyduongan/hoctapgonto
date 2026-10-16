# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: art-world.spec.ts >> Missing new memory-world GLB replaces the premium canvas safely while every game still opens
- Location: tests\visual\art-world.spec.ts:126:3

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('.ba3d-render-host')
Expected: "fallback"
Received: "ready"
Timeout:  15000ms

Call log:
  - Expect "toHaveAttribute" locator('.ba3d-render-host') with timeout 15000ms
  - waiting for locator('.ba3d-render-host')
    5 × locator resolved to <div data-premium="true" data-state="loading" class="ba3d-render-host">…</div>
      - unexpected value "loading"
    - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":1,"fpsMedian":10,"fpsP95FrameMs":100.03399999999999,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.05735524947912875,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.03431363102314435,"z":-2.318381852336092,"scale":1},{"…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":28,"fpsMedian":59.9,"fpsP95FrameMs":16.90000000000009,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.05140494065503417,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.013740997968605794,"z":-2.318381852336092,"scale":1…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":88,"fpsMedian":59.9,"fpsP95FrameMs":16.800000000000182,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":-0.04180631999619307,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.05376072514967776,"z":-2.318381852336092,"scale":…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":148,"fpsMedian":59.9,"fpsP95FrameMs":16.800000000000182,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":-0.0324044538531175,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.038167917200773956,"z":-2.318381852336092,"scale":…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":208,"fpsMedian":59.9,"fpsP95FrameMs":16.800000000000182,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.05653878566539507,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.03641226728223799,"z":-2.318381852336092,"scale":1…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":268,"fpsMedian":59.9,"fpsP95FrameMs":16.800000000000182,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.006712992783955031,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.054713803998872025,"z":-2.318381852336092,"scale…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":328,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999727,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":-0.059589197709743386,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.01155008552789654,"z":-2.318381852336092,"scale…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":388,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999272,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.020354429070733242,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.05996259352368482,"z":-2.318381852336092,"scale":…>…</div>
    - unexpected value "ready"
    - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":448,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999272,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.050335443472228646,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.015696994469197076,"z":-2.318381852336092,"scale…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":508,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999272,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":-0.0432447119473476,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.05282431045857558,"z":-2.318381852336092,"scale":…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":568,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999272,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":-0.03067898649539906,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.03971100604502211,"z":-2.318381852336092,"scale":…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":628,"fpsMedian":59.9,"fpsP95FrameMs":16.80000000000109,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.05718210197451842,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.0347882628722512,"z":-2.318381852336092,"scale":1},…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":688,"fpsMedian":59.9,"fpsP95FrameMs":16.80000000000109,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.004704480742393342,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.05551084172132128,"z":-2.318381852336092,"scale":…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":748,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999272,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":-0.05931983773274858,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.009563903837730132,"z":-2.318381852336092,"scale…>…</div>
    2 × unexpected value "ready"
      - locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":808,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999272,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.02225070203707553,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.059856719692072284,"z":-2.318381852336092,"scale":…>…</div>
    - unexpected value "ready"

```

```yaml
- 'img "Thế giới học tập 3D: Toán học, Trí nhớ và Ngôn từ"'
```

# Test source

```ts
  29  |   expect(requests.map(url => new URL(url).pathname).sort()).toEqual(assetIds.map(id => `/models/${id}.glb`));
  30  |   expect(maximum, 'GLB fetching remains bounded to two in flight').toBeLessThanOrEqual(2);
  31  |   expect(maximum).toBeGreaterThan(0);
  32  |   expect([...(await stats(page)).readyAssets].sort()).toEqual(assetIds);
  33  |   const metadata = [];
  34  |   for (let index = 0; index < responses.length; index++) {
  35  |     const bytes = await (await responses[index]).body();
  36  |     expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
  37  |     expect(bytes.readUInt32LE(4)).toBe(2);
  38  |     expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  39  |     const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim());
  40  |     expect(json.buffers.every((buffer: { uri?: string }) => !buffer.uri)).toBe(true);
  41  |     expect(json.images.length).toBeGreaterThanOrEqual(3);
  42  |     expect(json.images.every((image: { bufferView?: number; uri?: string }) => Number.isInteger(image.bufferView) && !image.uri)).toBe(true);
  43  |     expect(json.meshes.length).toBeGreaterThan(0);
  44  |     for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
  45  |       expect(primitive.attributes.POSITION).toBeDefined();
  46  |       expect(primitive.attributes.NORMAL).toBeDefined();
  47  |       expect(primitive.attributes.TEXCOORD_0).toBeDefined();
  48  |       const material = json.materials[primitive.material];
  49  |       expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined();
  50  |       expect(material.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
  51  |       expect(material.normalTexture).toBeDefined();
  52  |     }
  53  |     if (pr03Ids.includes(assetIds[index])) {
  54  |       expect(bytes.length).toBeLessThanOrEqual(2 * 1024 * 1024);
  55  |       expect(json.asset.extras.provenance).toBe('ORIGINAL_PROCEDURAL_V37_PR03');
  56  |       expect(json.asset.extras.acceptance).toBe('candidate-not-art-approved');
  57  |     }
  58  |     metadata.push({ id: assetIds[index], bytes: bytes.length, meshes: json.meshes.length, images: json.images.length, materials: json.materials.length, provenance: json.asset.extras.provenance });
  59  |   }
  60  |   expect(errors).toEqual([]);
  61  |   await testInfo.attach('five-production-GLBs-and-concurrency', { body: JSON.stringify({ maximum, requests, metadata }, null, 2), contentType: 'application/json' });
  62  | });
  63  | 
  64  | test('The real production renderer imports textured Memory, Language and Environment volumes and retains decoded maps in each game', async ({ page }, testInfo) => {
  65  |   let moduleUrl = '';
  66  |   page.on('response', response => { if (/\/assets\/PremiumWorldRenderer-[^/]+\.js$/.test(response.url())) moduleUrl = response.url(); });
  67  |   await page.goto('/'); await ready(page); expect(moduleUrl).not.toBe('');
  68  |   await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  69  |   await expect(page.locator('.ba3d-render-host')).toHaveCount(0);
  70  |   const runtime = await page.evaluate(async productionModule => {
  71  |     const exports = await import(productionModule);
  72  |     const { createPremiumRenderer } = exports.createPremiumRenderer ? exports
  73  |       : Object.values(exports).find((value: any) => typeof value?.createPremiumRenderer === 'function') as any;
  74  |     const canvas = document.createElement('canvas');
  75  |     canvas.style.cssText = 'position:fixed;left:-2000px;top:0;width:800px;height:600px;pointer-events:none'; document.body.append(canvas);
  76  |     const signal = new AbortController();
  77  |     const renderer = await createPremiumRenderer({ canvas, signal: signal.signal, quality: 'low', motionOn: false, paused: false, onSelect() {}, onContextLost() {} });
  78  |     const inspect = (root: any, visibleOnly = false) => {
  79  |       const meshes: { name: string; triangles: number; uvCount: number; pbrTextures: boolean; widths: number[] }[] = [];
  80  |       root.traverse((node: any) => {
  81  |         if (!node.isMesh) return;
  82  |         if (visibleOnly) { let current = node; while (current) { if (!current.visible) return; current = current.parent; } }
  83  |         const materials = Array.isArray(node.material) ? node.material : [node.material];
  84  |         meshes.push({ name: node.name, triangles: (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3,
  85  |           uvCount: node.geometry.attributes.uv?.count ?? 0,
  86  |           pbrTextures: materials.every((material: any) => material.isMeshStandardMaterial && material.map && material.normalMap && material.roughnessMap && material.metalnessMap),
  87  |           widths: materials.flatMap((material: any) => [material.map, material.normalMap, material.roughnessMap, material.metalnessMap].filter(Boolean).map(map => map.image?.width ?? 0)) });
  88  |       });
  89  |       return { meshes, triangles: meshes.reduce((total, mesh) => total + mesh.triangles, 0) };
  90  |     };
  91  |     try {
  92  |       await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  93  |       const home = Object.fromEntries(['math-quest', 'memory-match', 'sentence-builder'].map(id => [id, inspect(renderer.world.worlds.get(id))]));
  94  |       const environment = inspect(renderer.world.scenery);
  95  |       const clouds = inspect(renderer.world.clouds);
  96  |       const games = [];
  97  |       for (const id of ['math-quest', 'memory-match', 'sentence-builder']) {
  98  |         renderer.setGameScene(id); renderer.setGuideMood('happy');
  99  |         await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  100 |         games.push({ id, stats: renderer.getDiagnostics(), visibleWorld: inspect(renderer.world.worlds.get(id), true), environment: inspect(renderer.gameEnvironments.root, true), texturesInGPU: renderer.renderer.info.memory.textures });
  101 |       }
  102 |       return { home, environment, clouds, games };
  103 |     } finally { renderer.dispose(); signal.abort(); canvas.remove(); }
  104 |   }, moduleUrl);
  105 |   for (const id of ['memory-match', 'sentence-builder']) {
  106 |     const volume = runtime.home[id];
  107 |     expect(volume.meshes.length).toBeGreaterThan(10);
  108 |     expect(volume.triangles).toBeGreaterThan(500);
  109 |     expect(volume.triangles).toBeLessThanOrEqual(35_000);
  110 |     expect(volume.meshes.every((mesh: { uvCount: number; pbrTextures: boolean; widths: number[] }) => mesh.uvCount > 0 && mesh.pbrTextures && mesh.widths.every(width => width > 0))).toBe(true);
  111 |   }
  112 |   expect(runtime.environment.meshes.length + runtime.clouds.meshes.length).toBeGreaterThan(5);
  113 |   expect([...runtime.environment.meshes, ...runtime.clouds.meshes].every((mesh: { pbrTextures: boolean }) => mesh.pbrTextures)).toBe(true);
  114 |   for (const game of runtime.games) {
  115 |     expect(game.stats.sceneMode).toBe('game'); expect(game.stats.gameWorld).toBe(game.id);
  116 |     expect([...game.stats.readyAssets].sort()).toEqual(assetIds);
  117 |     expect(game.visibleWorld.meshes.length).toBeGreaterThan(0);
  118 |     expect(game.environment.meshes.some((mesh: { pbrTextures: boolean; widths: number[] }) => mesh.pbrTextures && mesh.widths.every(width => width > 0)), 'Each interior reuses decoded textured environment geometry').toBe(true);
  119 |     expect(game.texturesInGPU).toBeGreaterThan(10);
  120 |     expect(game.stats.drawCalls).toBeGreaterThan(0);
  121 |   }
  122 |   await testInfo.attach('decoded-PR03-scene-textures', { body: JSON.stringify(runtime, null, 2), contentType: 'application/json' });
  123 | });
  124 | 
  125 | for (const id of pr03Ids) {
  126 |   test(`Missing new ${id} GLB replaces the premium canvas safely while every game still opens`, async ({ page }) => {
  127 |     await page.route(`**/models/${id}.glb`, route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'QA required PR03 model unavailable' }));
  128 |     await page.goto('/');
> 129 |     await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
      |                                                     ^ Error: expect(locator).toHaveAttribute(expected) failed
  130 |     await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', /legacy-webgl2|canvas/);
  131 |     await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
  132 |     for (const [world, stage] of [['math-quest', '.quiz-question'], ['memory-match', '.memory-grid'], ['sentence-builder', '.sentence-bank']]) {
  133 |       await page.locator(`.ba3d-${world} .ba3d-play`).click(); await expect(page.locator(stage)).toBeVisible();
  134 |       await expect(page.locator('.ba37-mascot-fallback')).toBeVisible();
  135 |       await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
  136 |     }
  137 |   });
  138 | }
  139 | 
  140 | test('An actual embedded PNG decode failure in the new Memory model falls back safely and still records a Math answer', async ({ page }) => {
  141 |   await page.route('**/models/memory-world.glb', async route => {
  142 |     const response = await route.fetch(), bytes = Buffer.from(await response.body());
  143 |     const jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).trim());
  144 |     const view = json.bufferViews[json.images[0].bufferView];
  145 |     const imageStart = 20 + jsonLength + 8 + (view.byteOffset ?? 0);
  146 |     expect([...bytes.subarray(imageStart, imageStart + 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  147 |     bytes.fill(0, imageStart, imageStart + 8);
  148 |     const headers = { ...response.headers() };
  149 |     delete headers['content-encoding']; delete headers['content-length']; delete headers.etag;
  150 |     await route.fulfill({ response, headers, body: bytes });
  151 |   });
  152 |   await page.goto('/');
  153 |   await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
  154 |   await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
  155 |   await page.locator('.ba3d-math-quest .ba3d-play').click(); await page.locator('.answer-option').first().click();
  156 |   await expect(page.locator('.feedback-win')).toBeVisible();
  157 | });
  158 | 
  159 | test('A decoded Math material-name validation failure closes every catalog bitmap exactly once before fallback', async ({ page }, testInfo) => {
  160 |   await page.addInitScript(() => {
  161 |     const records: { closes: number }[] = [];
  162 |     const known = new WeakMap<ImageBitmap, { closes: number }>();
  163 |     const bitmap = window.createImageBitmap.bind(window), close = ImageBitmap.prototype.close;
  164 |     window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
  165 |       const value = await bitmap(...args);
  166 |       const record = { closes: 0 }; records.push(record); known.set(value, record); return value;
  167 |     }) as typeof createImageBitmap;
  168 |     ImageBitmap.prototype.close = function () {
  169 |       const record = known.get(this); if (record) record.closes++;
  170 |       close.call(this);
  171 |     };
  172 |     (window as unknown as { __artBitmaps: () => { decoded: number; closes: number[] } }).__artBitmaps = () => ({ decoded: records.length, closes: records.map(record => record.closes) });
  173 |   });
  174 |   await page.route('**/models/math-world.glb', async route => {
  175 |     const response = await route.fetch(), bytes = Buffer.from(await response.body());
  176 |     const source = Buffer.from('"name":"Living mint grass"'), replacement = Buffer.from('"name":"Absent mint grass"');
  177 |     expect(replacement.length).toBe(source.length);
  178 |     const offset = bytes.indexOf(source, 20);
  179 |     expect(offset, 'Rename the actual declared Math material without altering any GLB offsets').toBeGreaterThan(20);
  180 |     replacement.copy(bytes, offset);
  181 |     const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim());
  182 |     expect(json.materials.some((material: { name: string }) => material.name === 'Living mint grass')).toBe(false);
  183 |     expect(json.materials.some((material: { name: string }) => material.name === 'Absent mint grass')).toBe(true);
  184 |     const headers = { ...response.headers() };
  185 |     delete headers['content-encoding']; delete headers['content-length']; delete headers.etag;
  186 |     await route.fulfill({ response, headers, body: bytes });
  187 |   });
  188 |   await page.goto('/');
  189 |   await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
  190 |   await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', /legacy-webgl2|canvas/);
  191 |   await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
  192 |   const probe = () => page.evaluate(() => (window as unknown as { __artBitmaps: () => { decoded: number; closes: number[] } }).__artBitmaps());
  193 |   await expect.poll(async () => (await probe()).decoded).toBe(87);
  194 |   await expect.poll(async () => (await probe()).closes.filter(count => count === 1).length).toBe(87);
  195 |   expect((await probe()).closes.every(count => count === 1), 'No decoded bitmap is leaked or closed twice during initialization failure').toBe(true);
  196 |   await page.locator('.ba3d-memory-match .ba3d-play').click();
  197 |   await expect(page.locator('.memory-card')).toHaveCount(12);
  198 |   await testInfo.attach('decoded-catalog-failure-bitmap-cleanup', { body: JSON.stringify(await probe(), null, 2), contentType: 'application/json' });
  199 | });
  200 | 
```