# V3.7 PR03 textured art capture

Captured 2026-10-14T05:43:03.771Z, Edge 155.0.4283.45.

Production Edge, isolated contexts. Mobile viewport/touch emulation uses the desktop GPU. Renderer FPS is a rolling-window sample. Baseline preserves the previous two-GLB build before PR03 assets.

| View | Ready assets | Median FPS | Draw calls | Triangles | Max GLB requests in flight | Overflow | Outside/blocked controls | Touch targets below 44px | Errors |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|
| home-overview-1440x900 | 5 | 57.1 | 129 | 221328 | 2 | PASS | 0 | n/a | 0 |
| home-math-quest-1440x900 | 5 | 56.8 | 123 | 220080 | 2 | PASS | 0 | n/a | 0 |
| home-memory-match-1440x900 | 5 | 56.8 | 123 | 220080 | 2 | PASS | 0 | n/a | 0 |
| home-sentence-builder-1440x900 | 5 | 57.1 | 123 | 220080 | 2 | PASS | 0 | n/a | 0 |
| game-math-quest-waiting-1440x900 | 5 | 57.1 | 63 | 110420 | 2 | PASS | 0 | n/a | 0 |
| game-memory-match-waiting-1440x900 | 5 | 56.8 | 61 | 102116 | 2 | PASS | 0 | n/a | 0 |
| game-sentence-builder-waiting-1440x900 | 5 | 56.5 | 65 | 100316 | 2 | PASS | 0 | n/a | 0 |
| home-overview-390x844 | 5 | 57.1 | 69 | 118632 | 2 | PASS | 0 | 0 | 0 |
| home-math-quest-390x844 | 5 | 56.8 | 66 | 118008 | 2 | PASS | 0 | 0 | 0 |
| home-memory-match-390x844 | 5 | 56.8 | 66 | 118008 | 2 | PASS | 0 | 0 | 0 |
| home-sentence-builder-390x844 | 5 | 57.5 | 66 | 118008 | 2 | PASS | 0 | 0 | 0 |
| game-math-quest-waiting-390x844 | 5 | 56.8 | 26 | 44180 | 2 | PASS | 0 | 0 | 0 |
| game-memory-match-waiting-390x844 | 5 | 57.1 | 25 | 46892 | 2 | PASS | 0 | 0 | 0 |
| game-sentence-builder-waiting-390x844 | 5 | 57.1 | 26 | 44240 | 2 | PASS | 0 | 0 | 0 |
| home-overview-320x640 | 5 | 57.1 | 69 | 118632 | 2 | PASS | 0 | 0 | 0 |
| home-math-quest-320x640 | 5 | 57.1 | 66 | 118008 | 2 | PASS | 0 | 0 | 0 |
| home-memory-match-320x640 | 5 | 56.8 | 66 | 118008 | 2 | PASS | 0 | 0 | 0 |
| home-sentence-builder-320x640 | 5 | 56.8 | 66 | 118008 | 2 | PASS | 0 | 0 | 0 |
| game-math-quest-waiting-320x640 | 5 | 57.1 | 26 | 44180 | 2 | PASS | 0 | 0 | 0 |
| game-memory-match-waiting-320x640 | 5 | 56.8 | 27 | 55644 | 2 | PASS | 0 | 0 | 0 |
| game-sentence-builder-waiting-320x640 | 5 | 56.8 | 26 | 44240 | 2 | PASS | 0 | 0 | 0 |

Visual acceptance requires reviewing the screenshots. The file gate does not establish final art approval.
