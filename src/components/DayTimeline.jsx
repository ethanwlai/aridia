import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import TaskActionsDropdown from './TaskActionsDropdown';
import ShortBlockLabel from './ShortBlockLabel';
import StackedBlockLabel from './StackedBlockLabel';
import {
  assignOverlapLanes,
  formatDateKey,
  formatMinutes,
  formatShortTimeRange,
  getCalendarHighlightOpacity,
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
  toggleCalendarHighlight,
} from '../utils/calendarItems';

const ROW_HEIGHT = 50;
const TIME_COL_WIDTH = 72;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SCROLL_EDGE = 48;
const SCROLL_BASE_SPEED = 14;
const CREATE_DURATION_MINUTES = 30;
const CREATE_DRAG_THRESHOLD = 6;
const CREATE_SNAP_MINUTES = 5;

function rangeFromCreateDrag(originMinutes, currentMinutes) {
  const step = CREATE_SNAP_MINUTES;
  let start = Math.min(originMinutes, currentMinutes);
  let end = Math.max(originMinutes, currentMinutes);
  if (end - start < step) {
    if (currentMinutes >= originMinutes) {
      end = start + step;
    } else {
      start = end - step;
    }
  }
  start = Math.max(0, Math.min(24 * 60 - step, start));
  end = Math.max(start + step, Math.min(24 * 60, end));
  return { startMinutes: start, endMinutes: end };
}

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
  highlightedItem = null,
  onHighlightItem,
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
  createSession = null,
  onCreateAt,
  onCancelCreate,
}) {
  const scrollRef = useRef(null);
  const dayColumnRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const [nowPos, setNowPos] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [createDrag, setCreateDrag] = useState(null);
  const [colWidth, setColWidth] = useState(0);
  const userHasScrolled = useRef(false);
  const justDraggedRef = useRef(false);
  const dragStateRef = useRef(null);
  dragStateRef.current = dragState;
  const createDragRef = useRef(null);
  createDragRef.current = createDrag;
  const stopCreateDragListenersRef = useRef(null);
  const stopBlockDragListenersRef = useRef(null);
  const dayStartRef = useRef(null);
  const onUpdateTaskRef = useRef(onUpdateTask);
  onUpdateTaskRef.current = onUpdateTask;
  const onExternalDragEndRef = useRef(onExternalDragEnd);
  onExternalDragEndRef.current = onExternalDragEnd;
  const onHighlightItemRef = useRef(onHighlightItem);
  onHighlightItemRef.current = onHighlightItem;
  const onCreateAtRef = useRef(onCreateAt);
  onCreateAtRef.current = onCreateAt;
  const onCancelCreateRef = useRef(onCancelCreate);
  onCancelCreateRef.current = onCancelCreate;
  const externalDragItemRef = useRef(externalDragItem);
  externalDragItemRef.current = externalDragItem;

  const dayKey = formatDateKey(day);
  const dayStart = useMemo(() => startOfDay(day), [dayKey]);
  dayStartRef.current = dayStart;
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

  const yToSnappedMinutes = useCallback((clientY, step = 15) => {
    if (!dayColumnRef.current) return 0;
    const rect = dayColumnRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    return Math.max(0, Math.min(24 * 60, snapMinutes((y / ROW_HEIGHT) * 60, step)));
  }, []);

  const yToMinutes = useCallback((clientY, step = 15) => {
    return Math.min(24 * 60 - step, yToSnappedMinutes(clientY, step));
  }, [yToSnappedMinutes]);

  const closeCreate = useCallback(() => {
    onCancelCreate?.();
  }, [onCancelCreate]);

  const markJustDragged = useCallback(() => {
    justDraggedRef.current = true;
    window.setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);
  }, []);

  const handleColumnClick = (e) => {
    if (e.target.closest('.day-time-block') || e.target.closest('.day-agenda')) return;
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    const minutes = Math.max(0, Math.min(24 * 60 - CREATE_DURATION_MINUTES, yToMinutes(e.clientY)));
    onCreateAt?.(minutes);
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

  const abortAllDrags = useCallback(({ keepBlock = false, keepCreate = false } = {}) => {
    if (!keepCreate) {
      stopCreateDragListenersRef.current?.();
      createDragRef.current = null;
      setCreateDrag(null);
    }
    if (!keepBlock) {
      stopBlockDragListenersRef.current?.();
      dragStateRef.current = null;
      setDragState(null);
    }
  }, []);

  const handleBlockMouseDown = (e, item) => {
    if (
      e.target.closest('.task-complete-btn') ||
      e.target.closest('.task-delete-btn') ||
      e.target.closest('.task-edit-btn') ||
      e.target.closest('.task-actions-dropdown-trigger') ||
      e.target.closest('.task-actions-dropdown-menu')
    ) {
      e.stopPropagation();
      closeCreate();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    abortAllDrags();
    closeCreate();
    setActiveId(item.id);
    toggleCalendarHighlight(highlightedItem, onHighlightItem, item);

    if (window.openDropdownRef?.current) {
      window.openDropdownRef.current.setIsOpen(false);
      window.openDropdownRef.current.setActiveSubmenu(null);
      window.openDropdownRef.current = null;
    }

    const geo = getBlockGeometry(item);
    if (!geo) return;
    const clickOffsetY = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const dragId = item.id;
    const initial = {
      item,
      source: 'block',
      clickOffsetY,
      previewTop: geo.top,
      previewStart: geo.start,
      moved: false,
      overGrid: true,
    };
    dragStateRef.current = initial;
    setDragState(initial);

    const onMove = (moveEvent) => {
      const current = dragStateRef.current;
      if (!current || current.source !== 'block' || current.item?.id !== dragId) return;
      autoScrollAt(moveEvent.clientY);
      const minutes = yToMinutes(moveEvent.clientY - current.clickOffsetY);
      const next = {
        ...current,
        previewTop: (minutes / 60) * ROW_HEIGHT,
        previewStart: minutes,
        moved: true,
        overGrid: true,
      };
      dragStateRef.current = next;
      setDragState(next);
    };

    const onUp = () => {
      stopBlockDragListenersRef.current?.();
      const current = dragStateRef.current;
      if (!current || current.source !== 'block' || current.item?.id !== dragId) return;
      dragStateRef.current = null;
      setDragState(null);
      if (current.moved) markJustDragged();
      if (current.moved && current.item?.id != null) {
        onUpdateTaskRef.current?.(
          current.item.id,
          timeUpdatesForDrop(
            dayStartRef.current,
            current.previewStart ?? 0,
            getItemDurationMinutes(current.item)
          )
        );
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    stopBlockDragListenersRef.current = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      stopBlockDragListenersRef.current = null;
    };
  };

  const handleColumnMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.day-time-block') || e.target.closest('.day-agenda')) return;

    abortAllDrags();
    const originMinutes = yToSnappedMinutes(e.clientY, CREATE_SNAP_MINUTES);
    const initial = {
      originX: e.clientX,
      originY: e.clientY,
      originMinutes,
      currentMinutes: originMinutes,
      active: false,
    };
    createDragRef.current = initial;

    const onMove = (moveEvent) => {
      const current = createDragRef.current;
      if (!current) return;
      autoScrollAt(moveEvent.clientY);
      const dx = moveEvent.clientX - current.originX;
      const dy = moveEvent.clientY - current.originY;
      const active = current.active || Math.hypot(dx, dy) >= CREATE_DRAG_THRESHOLD;
      if (!active) return;
      if (moveEvent.cancelable) moveEvent.preventDefault();
      if (!current.active) onCancelCreateRef.current?.();
      const next = {
        ...current,
        currentMinutes: yToSnappedMinutes(moveEvent.clientY, CREATE_SNAP_MINUTES),
        active: true,
      };
      createDragRef.current = next;
      setCreateDrag(next);
    };

    const onUp = (upEvent) => {
      stopCreateDragListenersRef.current?.();
      const current = createDragRef.current;
      createDragRef.current = null;
      setCreateDrag(null);
      if (!current?.active) return;
      markJustDragged();
      if (!isOverScrollArea(upEvent.clientX, upEvent.clientY)) return;
      const { startMinutes, endMinutes } = rangeFromCreateDrag(
        current.originMinutes,
        current.currentMinutes
      );
      onCreateAtRef.current?.(startMinutes, endMinutes);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    stopCreateDragListenersRef.current = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      stopCreateDragListenersRef.current = null;
    };
  };

  useEffect(() => () => {
    stopCreateDragListenersRef.current?.();
    stopBlockDragListenersRef.current?.();
  }, []);

  useLayoutEffect(() => {
    const item = externalDragItemRef.current;
    if (item == null || item.id == null) return undefined;

    abortAllDrags();
    onCancelCreateRef.current?.();

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
      if (current?.moved) markJustDragged();
      if (current?.source === 'agenda' && isOverScrollArea(e.clientX, e.clientY) && current.item?.id != null) {
        onUpdateTaskRef.current?.(
          current.item.id,
          timeUpdatesForDrop(dayStart, current.previewStart ?? yToMinutes(e.clientY), getItemDurationMinutes(current.item))
        );
        onHighlightItemRef.current?.({ id: current.item.id, type: current.item.type });
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
    markJustDragged,
    abortAllDrags,
  ]);

  useEffect(() => {
    if (!createSession) return undefined;

    const handleKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closeCreate();
    };

    const handleMouseDown = (e) => {
      if (e.target.closest('.day-agenda')) return;
      if (document.querySelector('.aridia-datepicker-popper')?.contains(e.target)) return;
      if (document.querySelector('.taskform-datepicker-popper')?.contains(e.target)) return;
      if (document.querySelector('.react-datepicker-popper')?.contains(e.target)) return;
      if (document.querySelector('.custom-time-picker-modal')?.contains(e.target)) return;
      if (document.querySelector('.custom-duration-picker-modal')?.contains(e.target)) return;
      if (e.target.closest('.day-timeline-daycol') && !e.target.closest('.day-time-block')) return;
      closeCreate();
    };

    document.addEventListener('keydown', handleKey, true);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [createSession, closeCreate]);

  return (
    <div className={`day-timeline${dragState || createDrag?.active ? ' is-dragging' : ''}`}>
      <div
        className="day-timeline-scroll"
        ref={scrollRef}
        onScroll={() => { userHasScrolled.current = true; }}
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
            onClick={handleColumnClick}
            onMouseDown={handleColumnMouseDown}
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
              const completed = item.status === 'completed';
              const highlightOpacity = getCalendarHighlightOpacity(highlightedItem, item);
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
                  className={`day-time-block${completed ? ' is-completed' : ''}${isDragging ? ' is-dragging' : ''}${height < SHORT_BLOCK.dayInlineBelow ? ' is-short' : ''}`}
                  style={{
                    top,
                    left,
                    width,
                    height,
                    background: color,
                    opacity: isDragging ? 0.85 : highlightOpacity,
                  }}
                  onMouseDown={(e) => handleBlockMouseDown(e, item)}
                  onClick={(e) => e.stopPropagation()}
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
                        fontSize: '0.75rem',
                        fontWeight: 500,
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

            {(() => {
              const draftRange = createDrag?.active
                ? rangeFromCreateDrag(createDrag.originMinutes, createDrag.currentMinutes)
                : createSession
                  ? { startMinutes: createSession.startMinutes, endMinutes: createSession.endMinutes }
                  : null;
              if (!draftRange) return null;
              const visibleEnd = Math.min(draftRange.endMinutes, 24 * 60);
              const duration = Math.max(CREATE_SNAP_MINUTES, visibleEnd - draftRange.startMinutes);
              const top = (draftRange.startMinutes / 60) * ROW_HEIGHT;
              const height = getDayBlockHeightPx(duration, ROW_HEIGHT);
              const { left, width } = getLanedBlockBounds(
                0,
                colWidth || dayColumnRef.current?.clientWidth || 320,
                0,
                1
              );
              const endLabel = draftRange.endMinutes >= 24 * 60
                ? '00:00'
                : formatMinutes(draftRange.endMinutes);
              return (
                <div
                  className={`day-time-block-draft${height < SHORT_BLOCK.dayInlineBelow ? ' is-short' : ''}`}
                  style={{ top, left, width, height }}
                >
                  <div className="day-time-block-draft-time">
                    {formatShortTimeRange(formatMinutes(draftRange.startMinutes), endLabel)}
                  </div>
                </div>
              );
            })()}

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
      </div>
      <p className="day-timeline-hint">Click or drag an empty slot to create · Drag a block to schedule</p>
    </div>
  );
}
