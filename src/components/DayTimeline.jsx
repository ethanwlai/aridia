import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import TaskCreationCard from './TaskCreationCard';
import TaskActionsDropdown from './TaskActionsDropdown';
import ShortBlockLabel from './ShortBlockLabel';
import StackedBlockLabel from './StackedBlockLabel';
import {
  assignOverlapLanes,
  BLOCK_V_GAP,
  formatDateKey,
  formatShortTimeRange,
  getItemColor,
  getItemTitle,
  getLanedBlockBounds,
  isSameDate,
  SHORT_BLOCK,
  startOfDay,
} from '../utils/calendarItems';

const ROW_HEIGHT = 50;
const TIME_COL_WIDTH = 72;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formatMinutes(totalMinutes) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function snapMinutes(minutes, step = 15) {
  return Math.round(minutes / step) * step;
}

function getItemDurationMinutes(item) {
  if (item.type === 'event' && item.startTime && item.endTime) {
    const start = parseTimeToMinutes(item.startTime);
    let end = parseTimeToMinutes(item.endTime);
    if (start == null || end == null) return 30;
    if (end <= start) end += 24 * 60;
    return Math.max(15, end - start);
  }
  return item.duration || 30;
}

function getBlockGeometry(item) {
  const start = parseTimeToMinutes(item.startTime);
  if (start == null) return null;
  const duration = getItemDurationMinutes(item);
  const rawHeight = Math.max((duration / 60) * ROW_HEIGHT, 18);
  return {
    top: (start / 60) * ROW_HEIGHT,
    height: Math.max(rawHeight - BLOCK_V_GAP, SHORT_BLOCK.dayMinHeight),
    start,
    duration,
  };
}

export default function DayTimeline({
  day,
  items = [],
  highlightedId = null,
  onHighlightItem,
  onAdd,
  onUpdateTask,
  onDelete,
  onUpdateStatus,
  onEdit,
  onAutoSchedule,
  onQuickMove,
  onExtendDuration,
  scrollToId = null,
}) {
  const scrollRef = useRef(null);
  const cardRef = useRef(null);
  const dayColumnRef = useRef(null);
  const [cardPos, setCardPos] = useState(null);
  const [cardKey, setCardKey] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [nowPos, setNowPos] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [colWidth, setColWidth] = useState(0);
  const userHasScrolled = useRef(false);

  const dayStart = startOfDay(day);
  const isToday = isSameDate(dayStart, startOfDay(new Date()));
  const timedItems = useMemo(
    () => items.filter((item) => item.startTime && item.endTime),
    [items]
  );
  const lanedItems = useMemo(() => assignOverlapLanes(timedItems), [timedItems]);

  useLayoutEffect(() => {
    const el = dayColumnRef.current;
    if (!el) return undefined;
    const update = () => setColWidth(el.clientWidth || 0);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [dayStart]);

  const getCurrentTimePosition = useCallback(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60) * ROW_HEIGHT;
  }, []);

  useEffect(() => {
    if (!isToday) {
      setNowPos(null);
      return;
    }
    const update = () => setNowPos(getCurrentTimePosition());
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, [isToday, getCurrentTimePosition, dayStart]);

  useEffect(() => {
    if (userHasScrolled.current || !scrollRef.current) return;
    const target = isToday ? getCurrentTimePosition() : 8 * ROW_HEIGHT;
    scrollRef.current.scrollTop = Math.max(0, target - 120);
  }, [dayStart, isToday, getCurrentTimePosition]);

  useEffect(() => {
    if (!scrollToId || !scrollRef.current) return;
    const id = String(scrollToId).split(':')[0];
    const el = scrollRef.current.querySelector(`[data-day-block-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const match = timedItems.find((item) => String(item.id) === id);
    if (match) setActiveId(match.id);
  }, [scrollToId, timedItems]);

  const yToMinutes = useCallback((clientY) => {
    if (!dayColumnRef.current || !scrollRef.current) return 0;
    const rect = dayColumnRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const minutes = snapMinutes((y / ROW_HEIGHT) * 60);
    return Math.max(0, Math.min(24 * 60 - 15, minutes));
  }, []);

  const openCreateAt = useCallback((clientX, clientY, startMinutes) => {
    if (!scrollRef.current) return;
    const scrollRect = scrollRef.current.getBoundingClientRect();
    const start = new Date(dayStart);
    start.setHours(0, startMinutes, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 60);

    const cardWidth = 420;
    const cardHeight = 240;
    let flippedX = false;
    let flippedY = false;
    const x = clientX - scrollRect.left;
    let y = clientY - scrollRect.top + 24;
    if (clientX + cardWidth > scrollRect.right) flippedX = true;
    if (clientY + cardHeight > scrollRect.bottom) flippedY = true;

    setCardKey((k) => k + 1);
    setCardPos({
      x,
      y,
      flippedX,
      flippedY,
      defaultStartTime: start,
      defaultEndTime: end,
      defaultDeadline: dayStart,
    });
  }, [dayStart]);

  const handleColumnDoubleClick = (e) => {
    if (e.target.closest('.day-time-block') || e.target.closest('.task-creation-card')) return;
    const minutes = yToMinutes(e.clientY);
    openCreateAt(e.clientX, e.clientY, minutes);
  };

  const handleBlockMouseDown = (e, item) => {
    if (
      e.target.closest('.task-complete-btn') ||
      e.target.closest('.task-delete-btn') ||
      e.target.closest('.task-edit-btn') ||
      e.target.closest('.task-actions-dropdown-trigger') ||
      e.target.closest('.task-actions-dropdown-menu')
    ) {
      e.stopPropagation();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setActiveId(item.id);
    onHighlightItem?.(item.id);

    if (window.openDropdownRef?.current) {
      window.openDropdownRef.current.setIsOpen(false);
      window.openDropdownRef.current.setActiveSubmenu(null);
      window.openDropdownRef.current = null;
    }

    const geo = getBlockGeometry(item);
    if (!geo) return;
    const blockRect = e.currentTarget.getBoundingClientRect();
    const clickOffsetY = e.clientY - blockRect.top;

    setDragState({
      item,
      clickOffsetY,
      previewTop: geo.top,
      moved: false,
    });
  };

  useEffect(() => {
    if (!dragState) return undefined;

    const onMove = (e) => {
      const minutes = yToMinutes(e.clientY - dragState.clickOffsetY);
      const top = (minutes / 60) * ROW_HEIGHT;
      setDragState((prev) => prev && ({
        ...prev,
        previewTop: top,
        previewStart: minutes,
        moved: true,
      }));
    };

    const onUp = () => {
      setDragState((prev) => {
        if (!prev) return null;
        if (prev.moved && onUpdateTask && prev.item?.id != null) {
          const startMinutes = Math.max(0, Math.min(24 * 60 - 15, prev.previewStart ?? 0));
          const duration = getItemDurationMinutes(prev.item);
          let endMinutes = startMinutes + duration;
          const updates = {
            deadline: formatDateKey(dayStart),
            startTime: formatMinutes(startMinutes),
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
          onUpdateTask(prev.item.id, updates);
        }
        return null;
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragState, yToMinutes, onUpdateTask, dayStart]);

  return (
    <div className="day-timeline">
      <div
        className="day-timeline-scroll"
        ref={scrollRef}
        onScroll={() => { userHasScrolled.current = true; }}
        onClick={() => {
          if (cardPos) setCardPos(null);
        }}
      >
        <div className="day-timeline-grid" style={{ height: 24 * ROW_HEIGHT }}>
          <div className="day-timeline-hours" style={{ width: TIME_COL_WIDTH }}>
            {HOURS.map((hour) => (
              <div key={hour} className="day-timeline-hour" style={{ height: ROW_HEIGHT }}>
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
            ))}
          </div>

          <div
            className="day-timeline-daycol"
            ref={dayColumnRef}
            onDoubleClick={handleColumnDoubleClick}
          >
            {HOURS.map((hour) => (
              <div key={hour} className="day-timeline-slot" style={{ height: ROW_HEIGHT }} />
            ))}

            {isToday && nowPos != null && (
              <div className="day-timeline-now" style={{ top: nowPos }}>
                <span className="day-timeline-now-dot" />
              </div>
            )}

            {lanedItems.map((item) => {
              const geo = getBlockGeometry(item);
              if (!geo) return null;
              const isDragging = dragState?.item?.id === item.id && dragState.moved;
              const top = isDragging ? dragState.previewTop : geo.top;
              const height = geo.height;
              const color = getItemColor(item);
              const isActive = activeId === item.id || highlightedId === item.id;
              const completed = item.status === 'completed';
              const { left, width } = getLanedBlockBounds(
                0,
                colWidth || dayColumnRef.current?.clientWidth || 320,
                item._lane || 0,
                item._laneCount || 1
              );

              return (
                <div
                  key={item.id}
                  data-day-block-id={item.id}
                  className={`day-time-block${isActive ? ' is-active' : ''}${completed ? ' is-completed' : ''}${isDragging ? ' is-dragging' : ''}${height < SHORT_BLOCK.dayInlineBelow ? ' is-short' : ''}`}
                  style={{
                    top,
                    left,
                    width,
                    height,
                    background: color,
                    opacity: isDragging ? 0.85 : completed ? 0.55 : 1,
                  }}
                  onMouseDown={(e) => handleBlockMouseDown(e, item)}
                  onMouseEnter={(e) => {
                    e.currentTarget.querySelectorAll('.day-block-action, .task-actions-dropdown-trigger').forEach((el) => {
                      el.style.opacity = '1';
                    });
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.querySelectorAll('.day-block-action, .task-actions-dropdown-trigger').forEach((el) => {
                      if (!el.classList.contains('selected')) el.style.opacity = '0';
                    });
                  }}
                >
                  {height < SHORT_BLOCK.dayInlineBelow ? (
                    <ShortBlockLabel
                      className="day-time-block-inline"
                      titleClassName="day-time-block-title"
                      timeClassName="day-time-block-time-inline"
                      title={getItemTitle(item)}
                      timeText={formatShortTimeRange(item.startTime, item.endTime)}
                      actionGutter={SHORT_BLOCK.dayActionGutter}
                    />
                  ) : (
                    <StackedBlockLabel
                      titleClassName="day-time-block-title"
                      timeClassName="day-time-block-time"
                      title={getItemTitle(item)}
                      timeText={
                        item.startTime && item.endTime
                          ? `${item.startTime} - ${item.endTime}`
                          : ''
                      }
                      titleStyle={{
                        fontSize: '0.85rem',
                        paddingRight: 72,
                      }}
                      timeStyle={{
                        fontSize: '0.72rem',
                        opacity: 0.92,
                      }}
                    />
                  )}

                  <div className="day-block-actions">
                    {onEdit && (
                      <button
                        type="button"
                        className="day-block-action task-edit-btn"
                        title="Edit"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onEdit(item);
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`day-block-action task-complete-btn${completed ? ' selected' : ''}`}
                      title="Complete"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onUpdateStatus?.(item.id, completed ? 'active' : 'completed');
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20,6 9,17 4,12"></polyline>
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="day-block-action task-delete-btn"
                      title="Delete"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete?.(item.id);
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                      </svg>
                    </button>
                    <div style={{ pointerEvents: 'auto' }}>
                      <TaskActionsDropdown
                        task={item}
                        onAutoSchedule={onAutoSchedule && item.type === 'task' ? onAutoSchedule : null}
                        onQuickMove={onQuickMove}
                        onExtendDuration={onExtendDuration}
                        isTask={item.type === 'task'}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {dragState?.moved && dragState.item && (() => {
              const previewItem = lanedItems.find((i) => i.id === dragState.item.id) || dragState.item;
              const { left, width } = getLanedBlockBounds(
                0,
                colWidth || dayColumnRef.current?.clientWidth || 320,
                previewItem._lane || 0,
                previewItem._laneCount || 1
              );
              return (
                <div
                  className="day-time-block-preview"
                  style={{
                    top: dragState.previewTop,
                    left,
                    width,
                    height: getBlockGeometry(dragState.item)?.height || 30,
                    background: getItemColor(dragState.item),
                  }}
                />
              );
            })()}
          </div>
        </div>

        {cardPos && (
          <div
            ref={cardRef}
            style={{
              position: 'absolute',
              left: cardPos.flippedX ? cardPos.x - 430 : cardPos.x,
              top: cardPos.y,
              zIndex: 100,
              transform: cardPos.flippedY ? 'translateY(-240px)' : 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <TaskCreationCard
              key={cardKey}
              onCancel={() => setCardPos(null)}
              onAdd={(task) => {
                if (task.startTime && task.endTime && task.startTime === task.endTime) return;
                onAdd?.(task);
                setCardPos(null);
              }}
              flippedX={cardPos.flippedX}
              flippedY={cardPos.flippedY}
              defaultStartTime={cardPos.defaultStartTime}
              defaultEndTime={cardPos.defaultEndTime}
              defaultDeadline={cardPos.defaultDeadline}
            />
          </div>
        )}
      </div>
      <p className="day-timeline-hint">Double-click an empty slot to create · Drag a block to reschedule</p>
    </div>
  );
}
