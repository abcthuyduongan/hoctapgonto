# V3.7 production throttled performance evidence

Captured 2026-10-14T06:37:23.539Z, Edge 155.0.4283.45. CPU: Intel(R) Core(TM) Ultra 5 125H. GPU: ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11).

Production Edge; fresh isolated context per viewport; deviceScaleFactor 1. Mobile viewport/touch uses the same desktop CPU/GPU. FPS and P95 come from the actual renderer rolling 180-frame window after warmup. Long tasks are observed only inside the isolated app page; browser attribution can be unknown. Feedback latency begins at the actual click event and ends two RAF callbacks after the expected feedback enters the DOM, approximating a renderable frame, not a physical display paint measurement. No fixed FPS acceptance threshold is asserted. Stress mode applies CDP Fast 3G (1.6 Mbps download, 0.75 Mbps upload, 150 ms latency) and CPU 4× slowdown on the same desktop GPU. It verifies a real persisted Math answer while the 3D scene is still loading; this is emulation, not a phone or live-network acceptance run.

Each cold-load figure is one local-server sample, not a statistically significant speed comparison. Triangle counts are GPU render passes and include shadows; actual LOD geometry reductions are validated separately in performance-world.spec.ts. A zero long-task count in a warmed phase does not establish zero long tasks during loading or the first quality switch; both are reported below.

| Viewport | Phase | Median reported FPS | Worst reported P95 frame ms | GPU triangles range | Geometry detail | Long tasks >50ms |
|---|---|---:|---:|---:|---|---:|
| 390×844 | home-balanced | 59.9 | 33.4 | 118632–221328 | full | 2 |
| 390×844 | home-low | 59.9 | 16.8 | 75074–75074 | reduced | 0 |
| 390×844 | home-high | 59.9 | 16.8 | 221328–221328 | full | 0 |

| Width | Initial long tasks | Worst initial task ms | First-low long tasks | Worst first-low task ms | LOD CPU prep ms | Largest mesh prep ms |
|---|---:|---:|---:|---:|---:|---:|
| 390 | 7 | 233.0 | 1 | 107.0 | 1155.4 | 96.8 |

| Width | Correct answer | Click to renderable frame ms | WebGL contexts | Active canvases |
|---|---|---:|---:|---:|
| 390 | math-quest | 40.1 | 1 | 1 |
| 390 | memory-match | 56.6 | 1 | 1 |
| 390 | sentence-builder | 55.6 | 1 | 1 |

| Width | Baseline ready ms | Current ready ms | Decoded GLB bytes | Encoded GLB bytes | Max GLBs in flight | Bitmaps closed once / decoded | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|
| 390 | 981.8 | 21333.7 | 7271708 | 3428044 | 2 | 87/87 | 0 |

Under the stated throttle, the Math game controls became usable at 2336.4 ms while the scene state was loading. A real correct-answer feedback reached a renderable frame after 92.3 ms from the click; the scene later reached ready at 21333.7 ms.


The raw JSON includes resource response timing, page long-task attribution, per-window renderer samples, actual GPU/browser metadata, hidden-document pause/resume and complete disposal records. Decoded GLB bytes describe the original file content; encoded GLB bytes describe downloaded response bodies before HTTP decompression. Mobile is desktop emulation; physical-phone acceptance remains separate.
