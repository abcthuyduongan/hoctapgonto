# V3.7 island carousel capture

Captured 2026-10-14T02:12:51.242Z, 155.0.4283.45, Intel(R) Core(TM) Ultra 5 125H.

Headless Edge on Windows. Touch viewports are desktop emulation, not physical-phone testing. FPS is the real renderer rolling window, not an independent GPU profiler. Math and fox are textured premium GLBs; Memory and Language are provisional models.

| View | Renderer median FPS | P95 frame ms | Draw calls | Horizontal overflow | Outside/blocked controls | Primary touch targets below 44px | Page/resource errors |
|---|---:|---:|---:|---|---:|---:|---:|
| carousel-initial-1440x900 | 59.9 | 17 | 94 | PASS | 0 | n/a | 0 |
| carousel-math-1440x900 | 59.9 | 17 | 88 | PASS | 0 | n/a | 0 |
| carousel-memory-1440x900 | 59.9 | 17 | 88 | PASS | 0 | n/a | 0 |
| carousel-language-1440x900 | 60.2 | 17.100000000000364 | 88 | PASS | 0 | n/a | 0 |
| carousel-initial-390x844 | 59.9 | 17.199999999999818 | 49 | PASS | 0 | 0 | 0 |
| carousel-math-390x844 | 59.9 | 17.099999999998545 | 46 | PASS | 0 | 0 | 0 |
| carousel-memory-390x844 | 59.9 | 17 | 46 | PASS | 0 | 0 | 0 |
| carousel-language-390x844 | 59.9 | 17.100000000000364 | 46 | PASS | 0 | 0 | 0 |
| carousel-initial-320x640 | 59.9 | 17 | 49 | PASS | 0 | 0 | 0 |
| carousel-math-320x640 | 59.9 | 17 | 46 | PASS | 0 | 0 | 0 |
| carousel-memory-320x640 | 59.9 | 17.099999999998545 | 46 | PASS | 0 | 0 | 0 |
| carousel-language-320x640 | 60.2 | 17.19999999999891 | 46 | PASS | 0 | 0 | 0 |

Visual QA requires reviewing the screenshots; layout and motion assertions do not establish final premium-art approval. See carousel-browser-evidence.json for actual transforms, rectangles and frame-window samples.
