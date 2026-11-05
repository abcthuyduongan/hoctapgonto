import type {
  MapRegionId,
  MapStarCounts,
  MapWeekNode,
  RegionMapView,
} from './world-map-contracts';

export const NODES_PER_CHAPTER = 7;

export function getChapterFromPosition(position: number): number {
  if (position <= 0) return 1;
  return Math.floor((position - 1) / NODES_PER_CHAPTER) + 1;
}

export function getSlotFromPosition(position: number): number {
  if (position <= 0) return 1;
  return ((position - 1) % NODES_PER_CHAPTER) + 1;
}

export function getChapterPositionRange(chapter: number): { startPosition: number; endPosition: number } {
  const safeChapter = Math.max(1, Math.floor(chapter));
  const startPosition = (safeChapter - 1) * NODES_PER_CHAPTER + 1;
  const endPosition = safeChapter * NODES_PER_CHAPTER;
  return { startPosition, endPosition };
}

export function calculateTotalChapters(maxPosition: number): number {
  if (maxPosition <= 0) return 0;
  return Math.ceil(maxPosition / NODES_PER_CHAPTER);
}

export function isWeekNodeReady(counts: MapStarCounts): boolean {
  if (counts.total <= 0) return false;
  return counts.zero === 0 && counts.one === 0 && (counts.two + counts.three === counts.total);
}

export function filterNodesByChapter(
  nodes: MapWeekNode[],
  chapter: number
): MapWeekNode[] {
  const { startPosition, endPosition } = getChapterPositionRange(chapter);
  return nodes
    .filter((n) => n.position >= startPosition && n.position <= endPosition)
    .sort((a, b) => a.position - b.position)
    .slice(0, NODES_PER_CHAPTER);
}

export function buildRegionMapView(params: {
  regionId: MapRegionId;
  chapter: number;
  maxPosition: number;
  allRegionNodes: MapWeekNode[];
}): RegionMapView {
  const { regionId, chapter, maxPosition, allRegionNodes } = params;
  const totalChapters = calculateTotalChapters(maxPosition);
  const safeChapter = totalChapters > 0 ? Math.min(Math.max(1, chapter), totalChapters) : 1;
  const { startPosition, endPosition } = getChapterPositionRange(safeChapter);

  const nodes = filterNodesByChapter(allRegionNodes, safeChapter);

  return {
    regionId,
    chapter: safeChapter,
    totalChapters,
    startPosition,
    endPosition,
    nodes,
  };
}

export function validateSelectedPack(
  selected: { weekId: string; packId: string; contentVersion: number } | null,
  availableNodes: MapWeekNode[]
): { weekId: string; packId: string; contentVersion: number } | null {
  if (!selected) return null;
  const node = availableNodes.find((n) => n.weekId === selected.weekId);
  if (!node) return null;

  const set = node.sets.find(
    (s) => s.packId === selected.packId && s.contentVersion === selected.contentVersion
  );
  if (!set) return null;

  return selected;
}
