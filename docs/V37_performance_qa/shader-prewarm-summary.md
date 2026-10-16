# V3.7 production performance evidence

Captured 2026-10-14T06:28:30.447Z, Edge 155.0.4283.45. CPU: Intel(R) Core(TM) Ultra 5 125H. GPU: ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11).

Production Edge; fresh isolated context per viewport; deviceScaleFactor 1. Mobile viewport/touch uses the same desktop CPU/GPU. FPS and P95 come from the actual renderer rolling 180-frame window after warmup. Long tasks are observed only inside the isolated app page; browser attribution can be unknown. Feedback latency begins at the actual click event and ends two RAF callbacks after the expected feedback enters the DOM, approximating a renderable frame, not a physical display paint measurement. No fixed FPS acceptance threshold is asserted.

Each cold-load figure is one local-server sample, not a statistically significant speed comparison. Triangle counts are GPU render passes and include shadows; actual LOD geometry reductions are validated separately in performance-world.spec.ts. A zero long-task count in a warmed phase does not establish zero long tasks during loading or the first quality switch; both are reported below.

| Viewport | Phase | Median reported FPS | Worst reported P95 frame ms | GPU triangles range | Geometry detail | Long tasks >50ms |
|---|---|---:|---:|---:|---|---:|
| 1440×900 | home-balanced | 55.9 | 18.2 | 118632–221328 | full | 0 |
| 1440×900 | home-low | 55.9 | 18.1 | 75074–75074 | reduced | 0 |
| 1440×900 | home-high | 56.5 | 18.1 | 221328–221328 | full | 0 |
| 390×844 | home-balanced | 56.5 | 18.2 | 118632–221328 | full | 0 |
| 390×844 | home-low | 55.6 | 18.1 | 75074–75074 | reduced | 0 |
| 390×844 | home-high | 55.9 | 18.1 | 221328–221328 | full | 0 |

| Width | Initial long tasks | Worst initial task ms | First-low long tasks | Worst first-low task ms | LOD CPU prep ms | Largest mesh prep ms |
|---|---:|---:|---:|---:|---:|---:|
| 1440 | 2 | 409.0 | 1 | 95.0 | 282.0 | 21.9 |
| 390 | 1 | 107.0 | 0 | 0.0 | 227.0 | 18.2 |

| Width | Correct answer | Click to renderable frame ms | WebGL contexts | Active canvases |
|---|---|---:|---:|---:|
| 1440 | math-quest | 47.3 | 1 | 1 |
| 1440 | memory-match | 48.2 | 1 | 1 |
| 1440 | sentence-builder | 47.4 | 1 | 1 |
| 390 | math-quest | 48.3 | 1 | 1 |
| 390 | memory-match | 46.7 | 1 | 1 |
| 390 | sentence-builder | 48.5 | 1 | 1 |

| Width | Baseline ready ms | Current ready ms | Decoded GLB bytes | Encoded GLB bytes | Max GLBs in flight | Bitmaps closed once / decoded | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1440 | 1076.6 | 1202.5 | 7271708 | 7271708 | 2 | 87/87 | 0 |
| 390 | 981.8 | 1011.1 | 7271708 | 7271708 | 2 | 87/87 | 0 |

The raw JSON includes resource response timing, page long-task attribution, per-window renderer samples, actual GPU/browser metadata, hidden-document pause/resume and complete disposal records. Decoded GLB bytes describe the original file content; encoded GLB bytes describe downloaded response bodies before HTTP decompression. Mobile is desktop emulation; physical-phone acceptance remains separate.
