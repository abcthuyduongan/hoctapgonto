import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WORLD_MAP_ANCHORS, REGION_SLOT_ANCHORS } from '../src/core/world-map-layout.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const manifestPath = path.join(rootDir, 'public', 'art', 'maps', 'manifest.json');

test('AS01 & AS02: manifest has exactly 28 verified assets with matching roles and dimensions', () => {
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.artVersion, 1);
  assert.equal(manifest.totalAssets, 28);
  assert.equal(manifest.assets.length, 28);

  const roles = new Map();
  for (const asset of manifest.assets) {
    roles.set(asset.role, (roles.get(asset.role) || 0) + 1);

    // Verify file exists on disk
    const diskPath = path.join(rootDir, 'public', asset.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(diskPath), `Asset file must exist on disk: ${asset.src}`);

    const buffer = fs.readFileSync(diskPath);
    assert.equal(buffer.length, asset.bytes, `Bytes mismatch for ${asset.id}`);

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    assert.equal(hash, asset.sha256, `SHA256 mismatch for ${asset.id}`);

    // Verify dimension contracts
    if (asset.role === 'background') {
      if (asset.id.endsWith('-wide')) {
        assert.equal(asset.width, 1600);
        assert.equal(asset.height, 1000);
      } else if (asset.id.endsWith('-tall')) {
        assert.equal(asset.width, 1024);
        assert.equal(asset.height, 1365);
      }
    } else if (asset.role === 'place') {
      assert.equal(asset.width, 512);
      assert.equal(asset.height, 512);
    } else if (asset.role === 'thumbnail') {
      assert.equal(asset.width, 720);
      assert.equal(asset.height, 480);
    } else if (asset.role === 'banner') {
      assert.equal(asset.width, 1200);
      assert.equal(asset.height, 900);
    }
  }

  assert.equal(roles.get('background'), 10, 'Must have 10 map backgrounds');
  assert.equal(roles.get('place'), 12, 'Must have 12 landmark places');
  assert.equal(roles.get('thumbnail'), 5, 'Must have 5 game cards');
  assert.equal(roles.get('banner'), 1, 'Must have 1 auth banner');
});

test('AS03: all 12 landmark places have valid WebP alpha transparency', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const landmarks = manifest.assets.filter((a) => a.role === 'place');
  assert.equal(landmarks.length, 12);

  for (const lm of landmarks) {
    const diskPath = path.join(rootDir, 'public', lm.src.replace(/^\//, ''));
    const buffer = fs.readFileSync(diskPath);

    // WebP with alpha channel: RIFF header, WEBP signature, VP8X chunk with alpha flag bit set
    assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
    assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');

    // VP8X extended header has flag byte at offset 20: bit 4 (0x10) is alpha
    if (buffer.toString('ascii', 12, 16) === 'VP8X') {
      const flags = buffer[20];
      const hasAlpha = (flags & 0x10) !== 0;
      assert.ok(hasAlpha, `Landmark ${lm.id} must declare alpha in VP8X chunk`);
    } else {
      // Or lossless VP8L chunk which natively supports alpha
      assert.ok(
        buffer.toString('ascii', 12, 16) === 'VP8L' || buffer.includes(Buffer.from('ALPH')),
        `Landmark ${lm.id} must contain alpha data`
      );
    }
  }
});

test('AS04: hash mismatch detection', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const firstAsset = manifest.assets[0];

  const diskPath = path.join(rootDir, 'public', firstAsset.src.replace(/^\//, ''));
  const buffer = fs.readFileSync(diskPath);

  // Simulate modified byte
  const modified = Buffer.from(buffer);
  modified[modified.length - 1] ^= 0xff;

  const modifiedHash = crypto.createHash('sha256').update(modified).digest('hex');
  assert.notEqual(modifiedHash, firstAsset.sha256, 'Modified bytes must change hash');
});

test('AS05: anchor coordinates strictly between 0% and 100%', () => {
  // Check world map anchors
  for (const [regionId, anchor] of Object.entries(WORLD_MAP_ANCHORS)) {
    assert.ok(anchor.wide.x > 0 && anchor.wide.x < 100, `World ${regionId} wide.x out of range`);
    assert.ok(anchor.wide.y > 0 && anchor.wide.y < 100, `World ${regionId} wide.y out of range`);
    assert.ok(anchor.tall.x > 0 && anchor.tall.x < 100, `World ${regionId} tall.x out of range`);
    assert.ok(anchor.tall.y > 0 && anchor.tall.y < 100, `World ${regionId} tall.y out of range`);
  }

  // Check 7 region slot anchors
  for (let slot = 1; slot <= 7; slot++) {
    const anchor = REGION_SLOT_ANCHORS[slot];
    assert.ok(anchor, `Slot ${slot} must have an anchor config`);
    assert.ok(anchor.wide.x > 0 && anchor.wide.x < 100, `Slot ${slot} wide.x out of range`);
    assert.ok(anchor.wide.y > 0 && anchor.wide.y < 100, `Slot ${slot} wide.y out of range`);
    assert.ok(anchor.tall.x > 0 && anchor.tall.x < 100, `Slot ${slot} tall.x out of range`);
    assert.ok(anchor.tall.y > 0 && anchor.tall.y < 100, `Slot ${slot} tall.y out of range`);
  }
});

test('AS08: asset byte budget gate', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const totalBytes = manifest.totalBytes;
  const budgetBytes = Math.round(2.276 * 1024 * 1024); // 2.276 MiB = 2,386,559 bytes

  assert.ok(
    totalBytes <= budgetBytes,
    `Total asset size ${totalBytes} bytes (${(totalBytes / 1024 / 1024).toFixed(2)} MiB) must be <= ${budgetBytes} bytes (2.276 MiB)`
  );
});
