const TASK_TYPE_COLORS = {
  Work: '#ff6b81',
  School: '#4fc3f7',
  Extra: '#ffb86b',
  Entertainment: '#00bfae',
};

export function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function isSameDate(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function getItemTitle(item) {
  return item?.title || item?.name || 'Untitled';
}

export function getItemColor(item) {
  const raw = item?.taskType;
  const name = typeof raw === 'string' ? raw : raw?.name;
  return TASK_TYPE_COLORS[name] || '#a259ff';
}

export function formatItemTime(item) {
  if (item?.startTime && item?.endTime) {
    return `${item.startTime} - ${item.endTime}`;
  }
  if (item?.startTime) return item.startTime;
  return 'Time not set';
}

function formatClock12(timeStr) {
  if (!timeStr) return '';
  const [hRaw, mRaw] = String(timeStr).split(':').map(Number);
  if (Number.isNaN(hRaw) || Number.isNaN(mRaw)) return timeStr;
  const period = hRaw >= 12 ? 'PM' : 'AM';
  const hour = hRaw % 12 || 12;
  return {
    label: `${hour}:${String(mRaw).padStart(2, '0')}`,
    period,
  };
}

/** Compact horizontal range for short blocks, e.g. "9:00 AM - 10:00 AM". */
export function formatShortTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return '';
  const start = formatClock12(startTime);
  const end = formatClock12(endTime);
  if (!start?.label || !end?.label) return `${startTime} - ${endTime}`;
  return `${start.label} ${start.period} - ${end.label} ${end.period}`;
}

/** Shared short-block layout thresholds (day vs week). */
export const SHORT_BLOCK = {
  dayInlineBelow: 36,
  weekInlineBelow: 48,
  dayMinHeight: 12,
  weekMinHeight: 14,
  dayActionGutter: 72,
  weekActionGutter: 56,
  titleMinCh: 2.5,
  inlineGap: 8,
};

function startTimeMinutes(item) {
  if (!item?.startTime) return Number.POSITIVE_INFINITY;
  const [h, m] = String(item.startTime).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return Number.POSITIVE_INFINITY;
  return h * 60 + m;
}

export function sortCalendarItems(items = []) {
  return [...items].sort((a, b) => {
    const diff = startTimeMinutes(a) - startTimeMinutes(b);
    if (diff !== 0) return diff;
    return getItemTitle(a).toLowerCase().localeCompare(getItemTitle(b).toLowerCase());
  });
}

export function buildItemsByDate(tasks = []) {
  const map = {};
  for (const task of tasks) {
    if (!task?.deadline) continue;
    const start = parseDateKey(task.deadline);
    if (!start) continue;
    let end = task.endDeadline ? parseDateKey(task.endDeadline) : start;
    if (!end || end < start) end = start;

    const maxEnd = new Date(start);
    maxEnd.setDate(maxEnd.getDate() + 31);
    if (end > maxEnd) end = maxEnd;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = formatDateKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
  }
  for (const key of Object.keys(map)) {
    map[key] = sortCalendarItems(map[key]);
  }
  return map;
}

export function getMonthCells(monthDate, { weeks = 6 } = {}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    date.setHours(0, 0, 0, 0);
    cells.push({
      date,
      inMonth: date.getMonth() === month,
    });
  }
  return cells;
}

/** Horizontal inset from day-column edge (px). */
export const BLOCK_H_PAD = 4;
/** Gap between overlap lanes (px). */
export const BLOCK_LANE_GAP = 3;
/** Shrink block height slightly so back-to-back items don't share an edge (px). */
export const BLOCK_V_GAP = 2;

function parseHm(timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function parseTimeToMinutes(timeStr) {
  return parseHm(timeStr);
}

export function formatMinutes(totalMinutes) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function snapMinutes(minutes, step = 15) {
  return Math.round(minutes / step) * step;
}

export function getItemDurationMinutes(item) {
  if (item?.type === 'event' && item.startTime && item.endTime) {
    const start = parseHm(item.startTime);
    let end = parseHm(item.endTime);
    if (start == null || end == null) return 30;
    if (end <= start) end += 24 * 60;
    return Math.max(15, end - start);
  }
  return item?.duration || 30;
}

export function timeUpdatesForDrop(dayStart, startMinutes, duration) {
  const clampedStart = Math.max(0, Math.min(24 * 60 - 15, startMinutes));
  const endMinutes = clampedStart + duration;
  const updates = {
    deadline: formatDateKey(dayStart),
    startTime: formatMinutes(clampedStart),
  };
  if (endMinutes >= 24 * 60) {
    updates.endTime = formatMinutes(endMinutes - 24 * 60);
    const next = new Date(dayStart);
    next.setDate(next.getDate() + 1);
    updates.endDeadline = formatDateKey(next);
  } else {
    updates.endTime = formatMinutes(endMinutes);
    updates.endDeadline = null;
  }
  return updates;
}

export function getDayBlockHeightPx(durationMinutes, rowHeight = 50) {
  const rawHeight = Math.max((durationMinutes / 60) * rowHeight, 18);
  return Math.max(rawHeight - BLOCK_V_GAP, SHORT_BLOCK.dayMinHeight);
}

/** Resolve start/end minutes for a rendered calendar block (supports multi-day slices). */
export function getBlockIntervalMinutes(block) {
  if (block?._multiDay) {
    const start = (block._blockStartHour || 0) * 60 + (block._blockStartMinute || 0);
    let end = (block._blockEndHour || 0) * 60 + (block._blockEndMinute || 0);
    if (end <= start) end = start + 15;
    return { start, end };
  }
  const source = block?._group ? block.tasks?.[0] : block;
  const start = parseHm(source?.startTime);
  let end = parseHm(source?.endTime);
  if (start == null || end == null) return null;
  if (end <= start) end += 24 * 60;
  return { start, end };
}

/**
 * Assign side-by-side lanes for overlapping blocks within one day column.
 * Returns new objects with `_lane` and `_laneCount`.
 */
export function assignOverlapLanes(blocks = []) {
  const items = blocks.map((block, index) => {
    const interval = getBlockIntervalMinutes(block) || { start: 0, end: 15 };
    return {
      block,
      index,
      start: interval.start,
      end: interval.end,
      lane: 0,
      laneCount: 1,
    };
  });

  items.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start) || a.index - b.index);

  const laneEnds = [];
  for (const item of items) {
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    item.lane = lane;
  }

  for (const item of items) {
    let maxLane = item.lane;
    for (const other of items) {
      if (other.start < item.end && other.end > item.start) {
        maxLane = Math.max(maxLane, other.lane);
      }
    }
    item.laneCount = maxLane + 1;
  }

  // Restore original order for stable React keys / paint order
  items.sort((a, b) => a.index - b.index);
  return items.map(({ block, lane, laneCount }) => ({
    ...block,
    _lane: lane,
    _laneCount: laneCount,
  }));
}

/**
 * Compute absolute left/width inside a day column for a laned block.
 */
export function getLanedBlockBounds(colLeft, colWidth, lane = 0, laneCount = 1, {
  hPad = BLOCK_H_PAD,
  laneGap = BLOCK_LANE_GAP,
} = {}) {
  const count = Math.max(1, laneCount);
  const index = Math.min(Math.max(0, lane), count - 1);
  const usable = Math.max(0, colWidth - hPad * 2);
  const laneWidth = usable / count;
  const left = colLeft + hPad + index * laneWidth + laneGap / 2;
  const width = Math.max(8, laneWidth - laneGap);
  return { left, width };
}
