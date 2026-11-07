import { resolveRegionId } from './world-map-regions.ts';
import type { MapRegionId } from './world-map-contracts.ts';

export type DeepLinkTarget = 'hoc' | 'nhiem-vu' | 'thi' | 'ban-do' | 'qua';

export interface DeepLinkRoute {
  target: DeepLinkTarget;
  subject?: string;
  regionId?: MapRegionId;
  presetId?: string;
}

/**
 * Parses and sanitizes a deep-link hash for student UI (BAO-10, ket-noi-bao-an.md section 5.1).
 * Supported:
 * - #/hoc/toan, #/hoc/tieng-viet, #/hoc/tieng-anh, #/hoc/tin-hoc
 * - #/nhiem-vu
 * - #/thi/{presetId}
 * - #/ban-do
 * - #/qua
 * Any unrecognized target safely falls back to 'ban-do'.
 */
export function parseStudentDeepLink(rawHash: string | null | undefined): DeepLinkRoute {
  if (!rawHash) return { target: 'ban-do' };
  const clean = String(rawHash)
    .trim()
    .replace(/^#\/?/, '')
    .replace(/^\//, '');

  // 1. hoc/{subject}
  const hocMatch = clean.match(/^hoc\/(toan|tieng-viet|tieng-anh|tin-hoc)$/i);
  if (hocMatch) {
    const subject = hocMatch[1].toLowerCase();
    const regionId = resolveRegionId(subject);
    return { target: 'hoc', subject, regionId };
  }

  // 2. nhiem-vu
  if (clean.toLowerCase() === 'nhiem-vu') {
    return { target: 'nhiem-vu' };
  }

  // 3. thi/{presetId}
  const thiMatch = clean.match(/^thi\/([a-zA-Z0-9_-]{1,64})$/i);
  if (thiMatch) {
    return { target: 'thi', presetId: thiMatch[1] };
  }

  // 4. qua
  if (clean.toLowerCase() === 'qua') {
    return { target: 'qua' };
  }

  // 5. ban-do (default)
  return { target: 'ban-do' };
}
