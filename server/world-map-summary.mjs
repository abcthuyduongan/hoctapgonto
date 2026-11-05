import { fail } from './online-errors.mjs';
import { resolveRegionId, REGION_METADATA } from '../src/core/world-map-regions.ts';
import {
  getChapterFromPosition,
  getSlotFromPosition,
  getChapterPositionRange,
  calculateTotalChapters,
} from '../src/core/world-map-adapter.ts';

const ALLOWED_REGIONS = ['math', 'vietnamese', 'english', 'computing', 'discovery'];

export function parseMapQuery(query = {}) {
  const allowedKeys = new Set(['region', 'chapter']);
  for (const key of Object.keys(query)) {
    if (!allowedKeys.has(key)) {
      fail(400, `Tham số không được phép: ${key}`);
    }
  }

  const region = query.region ? String(query.region).trim() : null;
  const chapterRaw = query.chapter !== undefined ? String(query.chapter).trim() : null;

  if (chapterRaw !== null && !region) {
    fail(400, 'Không thể chỉ định chương khi chưa chọn vùng.');
  }

  if (region !== null && !ALLOWED_REGIONS.includes(region)) {
    fail(400, `Vùng không hợp lệ: ${region}`);
  }

  let chapter = null;
  if (chapterRaw !== null) {
    if (chapterRaw === 'current') {
      chapter = 'current';
    } else if (/^[1-9]\d*$/.test(chapterRaw)) {
      chapter = Number(chapterRaw);
    } else {
      fail(400, `Chương không hợp lệ: ${chapterRaw}`);
    }
  }

  return { region, chapter };
}

export function projectStudentMap(journeyData, query = {}) {
  const { region, chapter } = parseMapQuery(query);
  const weeks = journeyData.weeks || [];
  const currentWeekSummary = journeyData.currentWeekSummary || null;

  const totalWeeks = weeks.length;
  const maxPosition = weeks.reduce((max, w) => Math.max(max, w.position || 0), 0);
  const totalChapters = calculateTotalChapters(maxPosition);

  // Validate chapter boundary
  let resolvedChapter = 1;
  if (chapter === 'current') {
    if (currentWeekSummary && currentWeekSummary.position > 0) {
      resolvedChapter = getChapterFromPosition(currentWeekSummary.position);
    } else {
      resolvedChapter = 1;
    }
  } else if (typeof chapter === 'number') {
    if (totalWeeks === 0) {
      if (chapter !== 1) {
        fail(400, `Lớp chưa có tuần học, không có chương ${chapter}.`);
      }
      resolvedChapter = 1;
    } else {
      if (chapter > totalChapters) {
        fail(400, `Chương ${chapter} vượt quá tổng số chương (${totalChapters}).`);
      }
      resolvedChapter = chapter;
    }
  }

  // Calculate currentWeek info
  let currentWeek = null;
  if (currentWeekSummary) {
    currentWeek = {
      weekId: currentWeekSummary.weekId,
      position: currentWeekSummary.position,
      title: currentWeekSummary.title,
      ready: !!currentWeekSummary.ready,
      hasNext: !!currentWeekSummary.hasNext,
    };
  }

  // Calculate regions overview
  const regions = ALLOWED_REGIONS.map((regionId) => {
    let assignedWeekCount = 0;
    let closedWeekCount = 0;
    let hasCurrentWeek = false;

    for (const week of weeks) {
      const hasSetInRegion = week.sets.some((s) => resolveRegionId(s.subjectLabel) === regionId);
      if (hasSetInRegion) {
        assignedWeekCount++;
        if (week.closed) {
          closedWeekCount++;
        }
        if (week.current) {
          hasCurrentWeek = true;
        }
      }
    }

    return {
      id: regionId,
      label: REGION_METADATA[regionId].label,
      assignedWeekCount,
      closedWeekCount,
      hasCurrentWeek,
    };
  });

  // Calculate regionView if region requested
  let regionView = null;
  if (region) {
    const { startPosition, endPosition } = getChapterPositionRange(resolvedChapter);

    const nodes = [];
    for (const week of weeks) {
      if (week.position < startPosition || week.position > endPosition) {
        continue;
      }

      const matchingSets = week.sets.filter((s) => resolveRegionId(s.subjectLabel) === region);
      if (matchingSets.length === 0) {
        continue;
      }

      const counts = matchingSets.reduce(
        (acc, s) => {
          if (s.questionProgress) {
            acc.total += s.questionProgress.total || 0;
            acc.zero += s.questionProgress.zero || 0;
            acc.one += s.questionProgress.one || 0;
            acc.two += s.questionProgress.two || 0;
            acc.three += s.questionProgress.three || 0;
          } else {
            acc.total += s.pack.itemCount || 0;
            if (s.done) {
              acc.two += s.pack.itemCount || 0;
            } else {
              acc.zero += s.pack.itemCount || 0;
            }
          }
          return acc;
        },
        { total: 0, zero: 0, one: 0, two: 0, three: 0 }
      );

      const state = week.current ? 'current' : week.closed ? 'closed' : 'locked';

      const safeSets = matchingSets.map((s) => {
        const setCounts = s.questionProgress
          ? {
              total: s.questionProgress.total,
              zero: s.questionProgress.zero,
              one: s.questionProgress.one,
              two: s.questionProgress.two,
              three: s.questionProgress.three,
            }
          : undefined;

        return {
          packId: s.pack.id,
          contentVersion: s.pack.version,
          title: s.pack.title,
          kind: s.pack.kind,
          subjectLabel: s.subjectLabel || '',
          itemCount: s.pack.itemCount,
          done: !!s.done,
          counts: setCounts,
        };
      });

      nodes.push({
        weekId: week.id,
        position: week.position,
        slot: getSlotFromPosition(week.position),
        title: week.title,
        state,
        counts,
        sets: safeSets,
      });
    }

    nodes.sort((a, b) => a.position - b.position);

    regionView = {
      regionId: region,
      chapter: resolvedChapter,
      totalChapters,
      startPosition,
      endPosition,
      nodes,
    };
  }

  return {
    schemaVersion: 1,
    currentWeek,
    totalWeeks,
    maxPosition,
    regions,
    regionView,
  };
}
