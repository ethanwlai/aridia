import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import TaskCreationCard from './TaskCreationCard';
import TaskActionsDropdown from './TaskActionsDropdown';
import ShortBlockLabel from './ShortBlockLabel';
import StackedBlockLabel from './StackedBlockLabel';
import {
  assignOverlapLanes,
  formatDateKey,
  formatShortTimeRange,
  getDayBlockHeightPx,
  getItemColor,
  getItemDurationMinutes,
  getItemTitle,
  getLanedBlockBounds,
  isSameDate,
  parseTimeToMinutes,
  SHORT_BLOCK,
  snapMinutes,
  startOfDay,
  timeUpdatesForDrop,
} from '../utils/calendarItems';

const ROW_HEIGHT = 50;
const TIME_COL_WIDTH = 72;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SCROLL_EDGE = 48;
const SCROLL_BASE_SPEED = 14;

function getBlockGeometry(item) {
  const start = parseTimeToMinutes(item.startTime);
  if (start == null) return null;
  const duration = getItemDurationMinutes(item);
  return {
    top: (start / 60) * ROW_HEIGHT,
    height: getDayBlockHeightPx(duration, ROW_HEIGHT),
    start,
    duration,
  };
}

function previewHeightFor(item) {
  return getBlockGeometry(item)?.height ?? getDayBlockHeightPx(getItemDurationMinutes(item), ROW_HEIGHT);
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
  externalDragItem = null,
  onExternalDragEnd,
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
  const dragStateRef = useRef(null);
  dragStateRef.current = dragState;
  const onUpdateTaskRef = useRef(onUpdateTask);
  onUpdateTaskRef.current = onUpdateTask;
  const onExternalDragEndRef = useRef(onExternalDragEnd);
  onExternalDragEndRef.current = onExternalDragEnd;
  const onHighlightItemRef = useRef(onHighlightItem);
  onHighlightItemRef.current = onHighlightItem;
  const externalDragItemRef = useRef(externalDragItem);
  externalDragItemRef.current = externalDragItem;

  const dayKey = formatDateKey(day);
  const dayStart = useMemo(() => startOfDay(day), [dayKey]);
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
      source: 'block',
      clickOffsetY,
      previewTop: geo.top,
      previewStart: geo.start,
      moved: false,
      overGrid: true,
    });
  };

  const autoScrollAt = useCallback((clientY) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (clientY < rect.top || clientY > rect.bottom) return;
    const fromTop = clientY - rect.top;
    const fromBottom = rect.bottom - clientY;
    if (fromTop < SCROLL_EDGE) {
      const speed = Math.round(SCROLL_BASE_SPEED * Math.max(1, (SCROLL_EDGE - fromTop) / 16));
      el.scrollTop -= speed;
    } else if (fromBottom < SCROLL_EDGE) {
      const speed = Math.round(SCROLL_BASE_SPEED * Math.max(1, (SCROLL_EDGE - fromBottom) / 16));
      el.scrollTop += speed;
    }
  }, []);

  const isOverScrollArea = useCallback((clientX, clientY) => {
    const el = scrollRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right
      && clientY >= rect.top && clientY <= rect.bottom;
  }, []);

  useLayoutEffect(() => {
    const item = externalDragItemRef.current;
    if (item == null || item.id == null) return undefined;

    const initial = {
      item,
      source: 'agenda',
      clickOffsetY: 0,
      previewTop: 0,
      previewStart: 0,
      moved: true,
      overGrid: false,
    };
    dragStateRef.current = initial;
    setDragState(initial);

    const onMove = (e) => {
      const current = dragStateRef.current;
      if (!current || current.source !== 'agenda') return;
      autoScrollAt(e.clientY);
      const minutes = yToMinutes(e.clientY);
      const overGrid = isOverScrollArea(e.clientX, e.clientY);
      const next = {
        ...current,
        previewTop: (minutes / 60) * ROW_HEIGHT,
        previewStart: minutes,
        moved: true,
        overGrid,
      };
      dragStateRef.current = next;
      setDragState(next);
    };

    const onUp = (e) => {
      const current = dragStateRef.current;
      setDragState(null);
      dragStateRef.current = null;
      if (current?.source === 'agenda' && isOverScrollArea(e.clientX, e.clientY) && current.item?.id != null) {
        onUpdateTaskRef.current?.(
          current.item.id,
          timeUpdatesForDrop(dayStart, current.previewStart ?? yToMinutes(e.clientY), getItemDurationMinutes(current.item))
        );
        onHighlightItemRef.current?.(current.item.id);
      }
      onExternalDragEndRef.current?.();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragState((prev) => (prev?.source === 'agenda' ? null : prev));
    };
  }, [
    externalDragItem?.id,
    autoScrollAt,
    isOverScrollArea,
    yToMinutes,
    dayStart,
  ]);

  useEffect(() => {
    if (!dragState || dragState.source === 'agenda') return undefined;

    const onMove = (e) => {
      const current = dragStateRef.current;
      if (!current || current.source === 'agenda') return;
      autoScrollAt(e.clientY);
      const minutes = yToMinutes(e.clientY - current.clickOffsetY);
      setDragState((prev) => prev && ({
        ...prev,
        previewTop: (minutes / 60) * ROW_HEIGHT,
        previewStart: minutes,
        moved: true,
        overGrid: true,
      }));
    };

    const onUp = () => {
      const current = dragStateRef.current;
      setDragState(null);
      if (current?.source === 'block' && current.moved && current.item?.id != null) {
        onUpdateTaskRef.current?.(
          current.item.id,
          timeUpdatesForDrop(dayStart, current.previewStart ?? 0, getItemDurationMinutes(current.item))
        );
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [
    Boolean(dragState) && dragState?.source !== 'agenda',
    dragState?.item?.id,
    yToMinutes,
    dayStart,
    autoScrollAt,
  ]);

  return (
    <div className={`day-timeline${dragState ? ' is-dragging' : ''}`}>
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
              const isDragging = dragState?.item?.id === item.id && (dragState.moved || dragState.source === 'agenda');
              const top = isDragging && dragState.source !== 'agenda' ? dragState.previewTop : geo.top;
              const height = geo.height;
              const color = getItemColor(item);
              const isActive = !isDragging && (activeId === item.id || highlightedId === item.id);
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

            {dragState?.moved && dragState.item && (dragState.source !== 'agenda' || dragState.overGrid) && (() => {
              const previewItem = lanedItems.find((i) => i.id === dragState.item.id) || dragState.item;
              const useFullWidth = dragState.source === 'agenda';
              const { left, width } = getLanedBlockBounds(
                0,
                colWidth || dayColumnRef.current?.clientWidth || 320,
                useFullWidth ? 0 : (previewItem._lane || 0),
                useFullWidth ? 1 : (previewItem._laneCount || 1)
              );
              const dropTimes = timeUpdatesForDrop(
                dayStart,
                dragState.previewStart ?? 0,
                getItemDurationMinutes(dragState.item)
              );
              return (
                <div
                  className="day-time-block-preview"
                  style={{
                    top: dragState.previewTop,
                    left,
                    width,
                    height: previewHeightFor(dragState.item),
                    background: getItemColor(dragState.item),
                  }}
                >
                  <div className="day-time-block-preview-label">
                    <div className="day-time-block-title">{getItemTitle(dragState.item)}</div>
                    <div className="day-time-block-preview-time">
                      {formatShortTimeRange(dropTimes.startTime, dropTimes.endTime)}
                    </div>
                  </div>
                </div>
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
      <p className="day-timeline-hint">Double-click an empty slot to create · Drag a block or list item to schedule</p>
    </div>
  );
}
