# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: art-world.spec.ts >> A decoded Math material-name validation failure closes every catalog bitmap exactly once before fallback
- Location: tests\visual\art-world.spec.ts:159:1

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
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":1,"fpsMedian":2.7,"fpsP95FrameMs":366.5,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.040990106263709095,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.029180989642603548,"z":-2.318381852336092,"scale":1},{"id":"sent…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":53,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999955,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":-0.043373050056553265,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.052736120029475184,"z":-2.318381852336092,"scale…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":113,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999955,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":-0.030519477176950142,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.03984982635183962,"z":-2.318381852336092,"scale"…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":173,"fpsMedian":59.9,"fpsP95FrameMs":16.800000000000182,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.057244464623995094,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.03461937163308831,"z":-2.318381852336092,"scale":…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":233,"fpsMedian":59.9,"fpsP95FrameMs":16.800000000000182,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.004498053676409846,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.05558908715098175,"z":-2.318381852336092,"scale"…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":293,"fpsMedian":59.9,"fpsP95FrameMs":16.800000000000182,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":-0.05929005650036581,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.00937012518746432,"z":-2.318381852336092,"scale"…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":353,"fpsMedian":59.9,"fpsP95FrameMs":16.800000000000182,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.022432826850717482,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.059842846002715624,"z":-2.318381852336092,"scale"…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":413,"fpsMedian":59.9,"fpsP95FrameMs":16.800000000000182,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.04909648599962511,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.017822714740961403,"z":-2.318381852336092,"scale"…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":473,"fpsMedian":59.9,"fpsP95FrameMs":16.800000000000182,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":-0.04474247577308677,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.05174412975818802,"z":-2.318381852336092,"scale"…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":533,"fpsMedian":59.9,"fpsP95FrameMs":16.800000000000182,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":-0.028765317564825078,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.041335464079223914,"z":-2.318381852336092,"scale…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":593,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999272,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.05781644459187867,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.03295209679345501,"z":-2.318381852336092,"scale":1…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":653,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999272,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.002494595249937513,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.056313135871282255,"z":-2.318381852336092,"scale…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":713,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999272,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":-0.05894711111596153,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":-0.007372196852983536,"z":-2.318381852336092,"scale…>…</div>
      - unexpected value "ready"
    2 × locator resolved to <div data-state="ready" data-premium="true" class="ba3d-render-host" data-engine="three-webgl" data-diagnostics="{"engine":"three-webgl","frames":773,"fpsMedian":59.9,"fpsP95FrameMs":16.799999999999272,"tier":"balanced","selectedWorld":null,"carouselMoving":false,"rotation":0.6283185307179586,"islands":[{"id":"math-quest","x":2.703812160545376,"y":0.024291218993367586,"z":2.0897651006919444,"scale":1},{"id":"memory-match","x":4.374859974957706,"y":0.059663093006257474,"z":-2.318381852336092,"scale"…>…</div>
      - unexpected value "ready"

```

```yaml
- 'img "Thế giới học tập 3D: Toán học, Trí nhớ và Ngôn từ"'
```

# Test source

```ts
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
  129 |     await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
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
> 189 |   await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
      |                                                   ^ Error: expect(locator).toHaveAttribute(expected) failed
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