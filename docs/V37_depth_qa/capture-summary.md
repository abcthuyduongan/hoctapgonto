# V3.7 composition capture

Captured 2026-10-14T00:32:30.300Z, 155.0.4283.45, Intel(R) Core(TM) Ultra 5 125H.

Headless Edge on Windows. Mobile and landscape are viewport/touch emulation on the same desktop GPU, not physical phone measurements. FPS samples use the renderer rolling window and are not an independent GPU profiler.

| View | Renderer median FPS | P95 frame ms | Draw calls | Triangles | Horizontal overflow | Outside/blocked controls | Primary touch controls below 44px | Page/resource errors |
|---|---:|---:|---:|---:|---|---:|---:|---:|
| depth-default-1440x900 | 59.9 | 17 | 88 | 122732 | PASS | 0 | n/a | 0 |
| depth-math-1440x900 | 59.9 | 17 | 88 | 122732 | PASS | 0 | n/a | 0 |
| depth-default-390x844 | 59.9 | 16.900000000000546 | 46 | 64852 | PASS | 0 | 0 | 0 |
| depth-math-390x844 | 59.9 | 17 | 46 | 64852 | PASS | 0 | 0 | 0 |
| depth-default-320x640 | 59.9 | 17 | 46 | 64852 | PASS | 0 | 0 | 0 |
| depth-math-320x640 | 59.9 | 17 | 46 | 64852 | PASS | 0 | 0 | 0 |
| depth-default-844x390 | 59.9 | 17 | 88 | 122732 | PASS | 0 | 0 | 0 |
| depth-math-844x390 | 59.9 | 17 | 88 | 122732 | PASS | 0 | 0 | 0 |

Visual quality requires reviewing the screenshots; successful control/layout checks do not establish art approval. See depth-browser-evidence.json for exact rectangles and rolling-window samples.
