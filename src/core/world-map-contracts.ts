export type MapRegionId = 'math' | 'vietnamese' | 'english' | 'computing' | 'discovery';

export type MapNodeState = 'current' | 'closed' | 'locked';

export interface MapStarCounts {
  total: number;
  zero: number;
  one: number;
  two: number;
  three: number;
}

export interface MapSetSummary {
  packId: string;
  contentVersion: number;
  title: string;
  kind: string;
  subjectLabel: string;
  itemCount: number;
  done: boolean;
  counts?: MapStarCounts;
}

export interface MapWeekNode {
  weekId: string;
  position: number;
  slot: number;
  title: string;
  state: MapNodeState;
  counts: MapStarCounts;
  sets: MapSetSummary[];
}

export interface RegionMapView {
  regionId: MapRegionId;
  chapter: number;
  totalChapters: number;
  startPosition: number;
  endPosition: number;
  nodes: MapWeekNode[];
}

export interface MapRegionOverview {
  id: MapRegionId;
  label: string;
  assignedWeekCount: number;
  closedWeekCount: number;
  hasCurrentWeek: boolean;
}

export interface MapCurrentWeek {
  weekId: string;
  position: number;
  title: string;
  ready: boolean;
  hasNext: boolean;
}

export interface MapOverviewResponse {
  schemaVersion: 1;
  currentWeek: MapCurrentWeek | null;
  totalWeeks: number;
  maxPosition: number;
  regions: MapRegionOverview[];
  regionView: RegionMapView | null;
}
