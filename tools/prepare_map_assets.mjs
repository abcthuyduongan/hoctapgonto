import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const SRC_DIR = './ảnh';
const ART_ROOT = './public/art';

// Target folders
const DIRS = {
  maps: `${ART_ROOT}/maps`,
  landmarks: `${ART_ROOT}/landmarks`,
  gameCards: `${ART_ROOT}/game-cards`,
  auth: `${ART_ROOT}/auth`,
};

for (const dir of Object.values(DIRS)) {
  await mkdir(dir, { recursive: true });
}

// Flood fill alpha removal for landmarks (extracting foreground from fake checkerboard or pure white backgrounds)
async function removeLandmarkBackground(sourcePath) {
  const img = sharp(sourcePath);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  const visited = new Uint8Array(w * h);
  const queue = [];

  function isBg(idx) {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
    return maxDiff <= 15 && r >= 175;
  }

  // Border initialization
  for (let x = 0; x < w; x++) {
    queue.push(0 * w + x);
    queue.push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    queue.push(y * w + 0);
    queue.push(y * w + (w - 1));
  }

  let head = 0;
  while (head < queue.length) {
    const p = queue[head++];
    if (visited[p]) continue;
    visited[p] = 1;
    const idx = p * ch;
    if (!isBg(idx)) continue;
    data[idx + 3] = 0; // Set alpha to 0

    const px = p % w, py = (p / w) | 0;
    if (px > 0 && !visited[p - 1]) queue.push(p - 1);
    if (px < w - 1 && !visited[p + 1]) queue.push(p + 1);
    if (py > 0 && !visited[p - w]) queue.push(p - w);
    if (py < h - 1 && !visited[p + w]) queue.push(p + w);
  }

  return sharp(data, { raw: { width: w, height: h, channels: ch } });
}

// Asset specification mapping
const ASSET_SPECS = [
  // 10 Map Backgrounds
  { id: 'map-world-wide', src: `${SRC_DIR}/Gemini_Generated_Image_v7e6pgv7e6pgv7e6.png`, dest: `${DIRS.maps}/map-world-wide.webp`, width: 1600, height: 1000, type: 'map', role: 'background' },
  { id: 'map-world-tall', src: `${SRC_DIR}/Gemini_Generated_Image_v7e6pgv7e6pgv7e6 (1).png`, dest: `${DIRS.maps}/map-world-tall.webp`, width: 1024, height: 1365, type: 'map', role: 'background' },
  { id: 'map-math-wide', src: `${SRC_DIR}/ChatGPT Image Nov 5, 2026, 08_15_33 AM-1.png`, dest: `${DIRS.maps}/map-math-wide.webp`, width: 1600, height: 1000, type: 'map', role: 'background' },
  { id: 'map-math-tall', src: `${SRC_DIR}/ChatGPT Image Nov 5, 2026, 08_15_34 AM-2.png`, dest: `${DIRS.maps}/map-math-tall.webp`, width: 1024, height: 1365, type: 'map', role: 'background' },
  { id: 'map-vietnamese-wide', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47.png`, dest: `${DIRS.maps}/map-vietnamese-wide.webp`, width: 1600, height: 1000, type: 'map', role: 'background' },
  { id: 'map-vietnamese-tall', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (1).png`, dest: `${DIRS.maps}/map-vietnamese-tall.webp`, width: 1024, height: 1365, type: 'map', role: 'background' },
  { id: 'map-english-wide', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (2).png`, dest: `${DIRS.maps}/map-english-wide.webp`, width: 1600, height: 1000, type: 'map', role: 'background' },
  { id: 'map-english-tall', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (3).png`, dest: `${DIRS.maps}/map-english-tall.webp`, width: 1024, height: 1365, type: 'map', role: 'background' },
  { id: 'map-computing-wide', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (4).png`, dest: `${DIRS.maps}/map-computing-wide.webp`, width: 1600, height: 1000, type: 'map', role: 'background' },
  { id: 'map-computing-tall', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (5).png`, dest: `${DIRS.maps}/map-computing-tall.webp`, width: 1024, height: 1365, type: 'map', role: 'background' },

  // 12 Landmarks (with transparency)
  { id: 'place-math-number-house', src: `${SRC_DIR}/Gemini_Generated_Image_v31tuwv31tuwv31t.png`, dest: `${DIRS.landmarks}/place-math-number-house.webp`, width: 512, height: 512, type: 'landmark', role: 'place' },
  { id: 'place-math-garden', src: `${SRC_DIR}/Gemini_Generated_Image_g7ut1fg7ut1fg7ut.png`, dest: `${DIRS.landmarks}/place-math-garden.webp`, width: 512, height: 512, type: 'landmark', role: 'place' },
  { id: 'place-math-market', src: `${SRC_DIR}/Gemini_Generated_Image_g7ut1fg7ut1fg7ut (1).png`, dest: `${DIRS.landmarks}/place-math-market.webp`, width: 512, height: 512, type: 'landmark', role: 'place' },
  { id: 'place-vietnamese-library', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (6).png`, dest: `${DIRS.landmarks}/place-vietnamese-library.webp`, width: 512, height: 512, type: 'landmark', role: 'place' },
  { id: 'place-vietnamese-word-tree', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (7).png`, dest: `${DIRS.landmarks}/place-vietnamese-word-tree.webp`, width: 512, height: 512, type: 'landmark', role: 'place' },
  { id: 'place-vietnamese-story-house', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (8).png`, dest: `${DIRS.landmarks}/place-vietnamese-story-house.webp`, width: 512, height: 512, type: 'landmark', role: 'place' },
  { id: 'place-english-harbor', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (9).png`, dest: `${DIRS.landmarks}/place-english-harbor.webp`, width: 512, height: 512, type: 'landmark', role: 'place' },
  { id: 'place-english-lighthouse', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (10).png`, dest: `${DIRS.landmarks}/place-english-lighthouse.webp`, width: 512, height: 512, type: 'landmark', role: 'place' },
  { id: 'place-english-cafe', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (11).png`, dest: `${DIRS.landmarks}/place-english-cafe.webp`, width: 512, height: 512, type: 'landmark', role: 'place' },
  { id: 'place-computing-workshop', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (12).png`, dest: `${DIRS.landmarks}/place-computing-workshop.webp`, width: 512, height: 512, type: 'landmark', role: 'place' },
  { id: 'place-computing-keyboard-garden', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (13).png`, dest: `${DIRS.landmarks}/place-computing-keyboard-garden.webp`, width: 512, height: 512, type: 'landmark', role: 'place' },
  { id: 'place-computing-info-station', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (14).png`, dest: `${DIRS.landmarks}/place-computing-info-station.webp`, width: 512, height: 512, type: 'landmark', role: 'place' },

  // 5 Game Cards
  { id: 'game-card-question-island', src: `${SRC_DIR}/Gemini_Generated_Image_g7ut1fg7ut1fg7ut (3).png`, dest: `${DIRS.gameCards}/game-card-question-island.webp`, width: 720, height: 480, type: 'card', role: 'thumbnail' },
  { id: 'game-card-memory-grove', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (15).png`, dest: `${DIRS.gameCards}/game-card-memory-grove.webp`, width: 720, height: 480, type: 'card', role: 'thumbnail' },
  { id: 'game-card-sentence-house', src: `${SRC_DIR}/Gemini_Generated_Image_xj471txj471txj47 (16).png`, dest: `${DIRS.gameCards}/game-card-sentence-house.webp`, width: 720, height: 480, type: 'card', role: 'thumbnail' },
  { id: 'game-card-word-bridge', src: `${SRC_DIR}/Gemini_Generated_Image_g7ut1fg7ut1fg7ut (4).png`, dest: `${DIRS.gameCards}/game-card-word-bridge.webp`, width: 720, height: 480, type: 'card', role: 'thumbnail' },
  { id: 'game-card-sequence-trail', src: `${SRC_DIR}/Gemini_Generated_Image_g7ut1fg7ut1fg7ut (5).png`, dest: `${DIRS.gameCards}/game-card-sequence-trail.webp`, width: 720, height: 480, type: 'card', role: 'thumbnail' },

  // 1 Auth banner
  { id: 'auth-welcome', src: `${SRC_DIR}/Gemini_Generated_Image_g7ut1fg7ut1fg7ut (6).png`, dest: `${DIRS.auth}/auth-welcome.webp`, width: 1200, height: 900, type: 'auth', role: 'banner' },
];

console.log(`Processing ${ASSET_SPECS.length} assets...`);
const manifestAssets = [];
let totalBytes = 0;

for (const spec of ASSET_SPECS) {
  process.stdout.write(`- ${spec.id}... `);
  let pipeline;
  if (spec.type === 'landmark') {
    pipeline = await removeLandmarkBackground(spec.src);
    pipeline = pipeline.resize(spec.width, spec.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  } else {
    pipeline = sharp(spec.src).resize(spec.width, spec.height, { fit: 'cover' });
  }

  const quality = spec.type === 'landmark' ? 82 : (spec.type === 'map' ? 75 : 78);
  const webpBuffer = await pipeline.webp({ quality }).toBuffer();
  await writeFile(spec.dest, webpBuffer);

  const hash = createHash('sha256').update(webpBuffer).digest('hex');
  const bytes = webpBuffer.length;
  totalBytes += bytes;

  manifestAssets.push({
    id: spec.id,
    role: spec.role,
    type: spec.type,
    src: spec.dest.replace('./public', ''),
    width: spec.width,
    height: spec.height,
    mime: 'image/webp',
    bytes,
    sha256: hash,
  });

  console.log(`${(bytes / 1024).toFixed(1)} KiB [OK]`);
}

const manifest = {
  artVersion: 1,
  generatedAt: new Date().toISOString(),
  totalAssets: manifestAssets.length,
  totalBytes,
  assets: manifestAssets,
};

await writeFile(`${DIRS.maps}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\nManifest written to ${DIRS.maps}/manifest.json`);
console.log(`Total size: ${(totalBytes / 1024 / 1024).toFixed(2)} MiB across ${manifestAssets.length} assets.`);
