import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import TaskActionsDropdown from './TaskActionsDropdown';
import ShortBlockLabel from './ShortBlockLabel';
import StackedBlockLabel from './StackedBlockLabel';
import NowMarker from './NowMarker';
import {
  assignOverlapLanes,
  formatDateKey,
  formatMinutes,
  formatShortTimeRange,
  getCalendarHighlightOpacity,
  isCalendarHighlighted,
  getDayBlockHeightPx,
  getItemColor,
  getItemDurationMinutes,
  getItemTitle,
  getLanedBlockBounds,
  isSameDate,
  parseTimeToMinutes,
  SHORT_BLOCK,
  scrollHighlightedIntoView,
  snapMinutes,
  startOfDay,
  timeUpdatesForDrop,
  toggleCalendarHighlight,
} from '../utils/calendarItems';
import { useCalendarPinchZoom } from '../hooks/useCalendarPinchZoom';

const TIME_COL_WIDTH = 72;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SCROLL_EDGE = 48;
const SCROLL_BASE_SPEED = 14;
const CREATE_DURATION_MINUTES = 30;
const CREATE_DRAG_THRESHOLD = 6;
const CREATE_HOLD_MS = 300;
const CREATE_HOLD_CANCEL_PX = 10;
const BLOCK_DRAG_THRESHOLD = 6;
const CREATE_START_SNAP_MINUTES = 15;
const CREATE_SNAP_MINUTES = 5;

function isVerticalScrollMove(dx, dy) {
  return Math.abs(dy) >= CREATE_HOLD_CANCEL_PX && Math.abs(dy) >= Math.abs(dx);
}

function rangeFromCreateDrag(originMinutes, currentMinutes) {
  const step = CREATE_START_SNAP_MINUTES;
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

function getBlockGeometry(item, rowHeight) {
  const start = parseTimeToMinutes(item.startTime);
  if (start == null) return null;
  const duration = getItemDurationMinutes(item);
  return {
    top: (start / 60) * rowHeight,
    height: getDayBlockHeightPx(duration, rowHeight),
    start,
    duration,
  };
}

function previewHeightFor(item, rowHeight) {
  return getBlockGeometry(item, rowHeight)?.height ?? getDayBlockHeightPx(getItemDurationMinutes(item), rowHeight);
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
  externalDragItem = null,
  onExternalDragEnd,
  createSession = null,
  onCreateAt,
  onCancelCreate,
  tapToCreate = false,
  selectThenDrag = false,
  longPressMove = false,
  focusNowToken = 0,
  locateToken = 0,
}) {
  const scrollRef = useRef(null);
  const onPinchStartRef = useRef(() => {});
  const dayColumnRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const [nowPos, setNowPos] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [createDrag, setCreateDrag] = useState(null);
  const [colWidth, setColWidth] = useState(0);
  const userHasScrolled = useRef(false);
  const ignoreScrollRef = useRef(false);
  const { rowHeight, rowHeightRef, pinchActiveRef } = useCalendarPinchZoom(scrollRef, {
    onPinchStartRef,
    ignoreScrollRef,
  });
  const justDraggedRef = useRef(false);
  const dragStateRef = useRef(null);
  const scrolledLocateRef = useRef(0);
  dragStateRef.current = dragState;
  const createDragRef = useRef(null);
  const stopCreateDragListenersRef = useRef(null);
  const stopBlockDragListenersRef = useRef(null);
  const stopSelectTapRef = useRef(null);
  const dayStartRef = useRef(null);
  const onUpdateTaskRef = useRef(onUpdateTask);
  onUpdateTaskRef.current = onUpdateTask;
  const onExternalDragEndRef = useRef(onExternalDragEnd);
  onExternalDragEndRef.current = onExternalDragEnd;
  const onHighlightItemRef = useRef(onHighlightItem);
  onHighlightItemRef.current = onHighlightItem;
  const highlightedItemRef = useRef(highlightedItem);
  highlightedItemRef.current = highlightedItem;
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
    return (now.getHours() + now.getMinutes() / 60) * rowHeightRef.current;
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
  }, [isToday, getCurrentTimePosition, dayStart, rowHeight]);

  useEffect(() => {
    if (highlightedItem) return;
    if (userHasScrolled.current || !scrollRef.current) return;
    const target = isToday ? getCurrentTimePosition() : 8 * rowHeightRef.current;
    scrollRef.current.scrollTop = Math.max(0, target - 120);
  }, [dayStart, isToday, getCurrentTimePosition, highlightedItem]);

  useLayoutEffect(() => {
    if (!focusNowToken || !scrollRef.current) return;
    userHasScrolled.current = false;
    ignoreScrollRef.current = true;
    const target = isToday ? getCurrentTimePosition() : 8 * rowHeightRef.current;
    scrollRef.current.scrollTop = Math.max(0, target - 120);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ignoreScrollRef.current = false;
      });
    });
    return () => cancelAnimationFrame(id);
  }, [focusNowToken, isToday, getCurrentTimePosition]);

  useEffect(() => {
    if (!highlightedItem || !scrollRef.current) {
      if (!highlightedItem) setActiveId(null);
      return;
    }
    const drag = dragStateRef.current;
    if (drag?.source === 'block' || drag?.source === 'agenda') return;
    const id = String(highlightedItem.id).split(':')[0];
    const locateKey = `${locateToken}:${dayKey}`;
    const force = locateToken > 0 && scrolledLocateRef.current !== locateKey;
    const found = scrollHighlightedIntoView(
      scrollRef.current,
      `[data-day-block-id="${id}"]`,
      { force }
    );
    if (force && found) scrolledLocateRef.current = locateKey;
    const match = timedItems.find((item) => String(item.id) === id);
    if (match) setActiveId(match.id);
  }, [highlightedItem, timedItems, locateToken]);

  const yToSnappedMinutes = useCallback((clientY, step = 15) => {
    if (!dayColumnRef.current) return 0;
    const rect = dayColumnRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    return Math.max(0, Math.min(24 * 60, snapMinutes((y / rowHeightRef.current) * 60, step)));
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

  const minutesFromTap = (clientY) => {
    const column = dayColumnRef.current;
    const scrollEl = scrollRef.current;
    if (!column || !scrollEl) return null;
    const viewportOffset = window.visualViewport?.offsetTop ?? 0;
    const scrollRect = scrollEl.getBoundingClientRect();
    const columnTopInContent = column.getBoundingClientRect().top - scrollRect.top + scrollEl.scrollTop;
    const y = clientY + viewportOffset - scrollRect.top + scrollEl.scrollTop - columnTopInContent;
    let start = snapMinutes((y / rowHeightRef.current) * 60, CREATE_START_SNAP_MINUTES);
    if (!Number.isFinite(start)) return null;
    start = Math.max(0, Math.min(24 * 60, start));
    if (start >= 24 * 60) start = 24 * 60 - CREATE_START_SNAP_MINUTES;
    const end = Math.min(24 * 60, start + CREATE_DURATION_MINUTES);
    return { start, end };
  };

  const handleColumnClick = (e) => {
    if (e.target.closest('.day-time-block') || e.target.closest('.day-agenda')) return;
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    if (tapToCreate) {
      const range = minutesFromTap(e.clientY);
      if (!range) return;
      onCreateAt?.(range.start, range.end);
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

  onPinchStartRef.current = () => {
    abortAllDrags();
    stopSelectTapRef.current?.();
  };

  const handleBlockMouseDown = (e, item, options = {}) => {
    if (pinchActiveRef.current) return;
    if (
      e.target.closest('.task-complete-btn') ||
      e.target.closest('.task-delete-btn') ||
      e.target.closest('.task-edit-btn') ||
      e.target.closest('.task-actions-dropdown-trigger') ||
      e.target.closest('.task-actions-dropdown-menu') ||
      e.target.closest('.task-actions-dropdown-submenu')
    ) {
      e.stopPropagation();
      closeCreate();
      return;
    }

    const isTouch = e.pointerType && e.pointerType !== 'mouse';

    if (selectThenDrag && isTouch) {
      e.stopPropagation();
      closeCreate();
      stopSelectTapRef.current?.();

      const alreadySelected = isCalendarHighlighted(highlightedItemRef.current, item) || activeId === item.id;
      if (!alreadySelected) {
        const startX = e.clientX;
        const startY = e.clientY;
        let abandoned = false;
        const stop = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onCancel);
          if (stopSelectTapRef.current === stop) stopSelectTapRef.current = null;
        };
        const onMove = (moveEvent) => {
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;
          if (!isVerticalScrollMove(dx, dy)) return;
          abandoned = true;
          stop();
        };
        const onUp = () => {
          stop();
          if (abandoned) return;
          setActiveId(item.id);
          if (!isCalendarHighlighted(highlightedItemRef.current, item)) {
            onHighlightItemRef.current?.({ id: item.id, type: item.type });
          }
        };
        const onCancel = () => {
          abandoned = true;
          stop();
        };
        stopSelectTapRef.current = stop;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
        return;
      }

      options = { ...options, touchSelectDrag: true };
    }

    if (longPressMove && isTouch && !options.touchSelectDrag) {
      const startX = e.clientX;
      const startY = e.clientY;
      const target = e.currentTarget;
      const timer = window.setTimeout(() => {
        handleBlockMouseDown({
          ...e,
          pointerType: 'mouse',
          button: 0,
          currentTarget: target,
          clientX: startX,
          clientY: startY,
          target: e.target,
          preventDefault() {},
          stopPropagation() {},
        }, item, { fromLongPress: true });
      }, 400);
      const cancel = (moveEvent) => {
        if (moveEvent.type === 'pointermove' && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 8) {
          return;
        }
        window.clearTimeout(timer);
        window.removeEventListener('pointermove', cancel);
        window.removeEventListener('pointerup', cancel);
        window.removeEventListener('pointercancel', cancel);
      };
      window.addEventListener('pointermove', cancel);
      window.addEventListener('pointerup', cancel);
      window.addEventListener('pointercancel', cancel);
      e.preventDefault();
      e.stopPropagation();
      closeCreate();
      setActiveId(item.id);
      if (!isCalendarHighlighted(highlightedItem, item)) {
        onHighlightItem?.({ id: item.id, type: item.type });
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    abortAllDrags();
    closeCreate();
    setActiveId(item.id);

    if (window.openDropdownRef?.current) {
      window.openDropdownRef.current.setIsOpen(false);
      window.openDropdownRef.current.setActiveSubmenu(null);
      window.openDropdownRef.current = null;
    }

    const geo = getBlockGeometry(item, rowHeightRef.current);
    if (!geo) return;
    const clickOffsetY = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const dragId = item.id;
    const originX = e.clientX;
    const originY = e.clientY;
    const smoothTouch = Boolean(options.touchSelectDrag || options.fromLongPress);
    const originTop = geo.top;
    const originColumnTop = dayColumnRef.current?.getBoundingClientRect().top ?? 0;
    const initial = {
      item,
      source: 'block',
      clickOffsetY,
      previewTop: geo.top,
      previewStart: geo.start,
      moved: false,
      overGrid: true,
      fromLongPress: Boolean(options.fromLongPress),
    };
    dragStateRef.current = initial;
    setDragState(initial);

    const keepHighlightForDrag = () => {
      if (isCalendarHighlighted(highlightedItemRef.current, item)) return;
      if (window.globalDragState) window.globalDragState.suppressHighlightNavigation = true;
      onHighlightItemRef.current?.({ id: item.id, type: item.type });
    };

    const applyDragPoint = (clientX, clientY) => {
      const current = dragStateRef.current;
      if (!current || current.source !== 'block' || current.item?.id !== dragId) return;
      if (!current.moved && Math.hypot(clientX - originX, clientY - originY) < BLOCK_DRAG_THRESHOLD) {
        return;
      }
      if (!current.moved) keepHighlightForDrag();
      autoScrollAt(clientY);
      let previewTop;
      let previewStart;
      if (smoothTouch) {
        const columnTop = dayColumnRef.current?.getBoundingClientRect().top ?? originColumnTop;
        const visualTop = originTop + (clientY - originY) + (originColumnTop - columnTop);
        previewTop = visualTop;
        previewStart = yToMinutes(visualTop + columnTop);
      } else {
        const minutes = yToMinutes(clientY - current.clickOffsetY);
        previewTop = (minutes / 60) * rowHeightRef.current;
        previewStart = minutes;
      }
      const next = {
        ...current,
        previewTop,
        previewStart,
        moved: true,
        overGrid: true,
      };
      dragStateRef.current = next;
      setDragState(next);
    };

    const onMove = (moveEvent) => {
      applyDragPoint(moveEvent.clientX, moveEvent.clientY);
    };

    const finishDrag = ({ save }) => {
      stopBlockDragListenersRef.current?.();
      const current = dragStateRef.current;
      if (!current || current.source !== 'block' || current.item?.id !== dragId) return;
      dragStateRef.current = null;
      setDragState(null);
      if (save && current.moved) {
        markJustDragged();
        if (current.item?.id != null) {
          onUpdateTaskRef.current?.(
            current.item.id,
            timeUpdatesForDrop(
              dayStartRef.current,
              current.previewStart ?? 0,
              getItemDurationMinutes(current.item)
            )
          );
        }
        return;
      }
      if (!save || current.moved || current.fromLongPress) return;
      const wasHighlighted = isCalendarHighlighted(highlightedItemRef.current, item);
      toggleCalendarHighlight(highlightedItemRef.current, onHighlightItemRef.current, item);
      if (wasHighlighted) setActiveId(null);
    };

    const onUp = () => finishDrag({ save: true });
    const onCancel = () => {
      if (options.touchSelectDrag) return;
      finishDrag({ save: true });
    };

    const onBlockTouchMove = (event) => {
      if (event.cancelable) event.preventDefault();
      if (!options.touchSelectDrag) return;
      const touch = event.touches[0];
      if (!touch) return;
      applyDragPoint(touch.clientX, touch.clientY);
    };

    const onTouchEnd = (event) => {
      const touch = event.changedTouches?.[0];
      if (touch) applyDragPoint(touch.clientX, touch.clientY);
      finishDrag({ save: true });
    };

    const onTouchCancel = () => finishDrag({ save: false });

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    if (options.fromLongPress || options.touchSelectDrag) {
      window.addEventListener('touchmove', onBlockTouchMove, { capture: true, passive: false });
    }
    if (options.touchSelectDrag) {
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('touchcancel', onTouchCancel);
    }
    stopBlockDragListenersRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('touchmove', onBlockTouchMove, { capture: true });
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
      stopBlockDragListenersRef.current = null;
    };
  };

  const handleColumnMouseDown = (e) => {
    if (pinchActiveRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('.day-time-block') || e.target.closest('.day-agenda')) return;

    abortAllDrags();
    const isTouch = e.pointerType && e.pointerType !== 'mouse';
    const originMinutes = yToSnappedMinutes(e.clientY, CREATE_START_SNAP_MINUTES);
    createDragRef.current = {
      originX: e.clientX,
      originY: e.clientY,
      originMinutes,
      currentMinutes: originMinutes,
      active: false,
      armed: !isTouch,
      abandoned: false,
    };

    let holdTimer = 0;
    if (isTouch) {
      holdTimer = window.setTimeout(() => {
        const current = createDragRef.current;
        if (!current || current.abandoned || current.armed) return;
        const dx = (current.lastX ?? current.originX) - current.originX;
        const dy = (current.lastY ?? current.originY) - current.originY;
        if (isVerticalScrollMove(dx, dy)) {
          createDragRef.current = null;
          swallowFollowingClick();
          stop();
          return;
        }
        const armed = { ...current, armed: true, active: false };
        createDragRef.current = armed;
        setCreateDrag(armed);
      }, CREATE_HOLD_MS);
    }

    const onTouchMove = (event) => {
      const current = createDragRef.current;
      if (!current?.armed || current.abandoned) return;
      if (event.cancelable) event.preventDefault();
    };

    const stop = () => {
      if (holdTimer) window.clearTimeout(holdTimer);
      holdTimer = 0;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('touchmove', onTouchMove, { capture: true });
      stopCreateDragListenersRef.current = null;
    };

    const swallowFollowingClick = () => {
      justDraggedRef.current = true;
      window.setTimeout(() => {
        justDraggedRef.current = false;
      }, 400);
    };

    const onMove = (moveEvent) => {
      const current = createDragRef.current;
      if (!current || current.abandoned) return;
      const dx = moveEvent.clientX - current.originX;
      const dy = moveEvent.clientY - current.originY;
      const dist = Math.hypot(dx, dy);
      if (!current.armed) {
        createDragRef.current = {
          ...current,
          lastX: moveEvent.clientX,
          lastY: moveEvent.clientY,
        };
        if (isVerticalScrollMove(dx, dy)) {
          swallowFollowingClick();
          stop();
          createDragRef.current = null;
          setCreateDrag(null);
        }
        return;
      }
      if (moveEvent.cancelable) moveEvent.preventDefault();
      if (!current.active && dist < CREATE_DRAG_THRESHOLD) return;
      autoScrollAt(moveEvent.clientY);
      const currentMinutes = yToSnappedMinutes(moveEvent.clientY, CREATE_START_SNAP_MINUTES);
      const next = {
        ...current,
        lastX: moveEvent.clientX,
        lastY: moveEvent.clientY,
        currentMinutes,
        active: true,
        armed: true,
      };
      createDragRef.current = next;
      setCreateDrag(next);
    };

    const openCreateRange = (upEvent, originMinutes, currentMinutes) => {
      if (isTouch) swallowFollowingClick();
      else markJustDragged();
      window.__aridiaSuppressCreateDismiss = true;
      window.setTimeout(() => {
        window.__aridiaSuppressCreateDismiss = false;
      }, 400);
      if (!isOverScrollArea(upEvent.clientX, upEvent.clientY)) return;
      const { startMinutes, endMinutes } = rangeFromCreateDrag(originMinutes, currentMinutes);
      onCreateAtRef.current?.(startMinutes, endMinutes);
    };

    const onUp = (upEvent) => {
      const current = createDragRef.current;
      stop();
      createDragRef.current = null;
      setCreateDrag(null);
      if (!current || current.abandoned) return;
      if (current.active) {
        openCreateRange(upEvent, current.originMinutes, current.currentMinutes);
        return;
      }
      if (isTouch && current.armed) {
        openCreateRange(upEvent, current.originMinutes, current.originMinutes);
      }
    };

    const onCancel = (cancelEvent) => {
      const current = createDragRef.current;
      const dx = current ? cancelEvent.clientX - current.originX : 0;
      const dy = current ? cancelEvent.clientY - current.originY : 0;
      const moved = current && (isVerticalScrollMove(dx, dy) || Math.hypot(dx, dy) >= CREATE_HOLD_CANCEL_PX);
      stop();
      createDragRef.current = null;
      setCreateDrag(null);
      if (current?.active || current?.armed || (current && !current.armed && moved)) swallowFollowingClick();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    if (isTouch) window.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    stopCreateDragListenersRef.current = stop;
  };

  useEffect(() => () => {
    stopCreateDragListenersRef.current?.();
    stopBlockDragListenersRef.current?.();
    stopSelectTapRef.current?.();
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
        previewTop: (minutes / 60) * rowHeightRef.current,
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
      if (e.target.closest('.create-sheet-overlay')) return;
      if (e.target.closest('.create-sheet')) return;
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
    <div className={`day-timeline${(dragState?.moved || dragState?.source === 'agenda' || createDrag?.active) ? ' is-dragging' : ''}`}>
      <div
        className="day-timeline-scroll"
        ref={scrollRef}
        onScroll={() => {
          if (ignoreScrollRef.current) return;
          userHasScrolled.current = true;
        }}
      >
        <div className="day-timeline-grid" style={{ height: 24 * rowHeight }}>
          <div className="day-timeline-hours" style={{ width: TIME_COL_WIDTH }}>
            {HOURS.map((hour) => (
              <div key={hour} className="day-timeline-hour" style={{ height: rowHeight }}>
                {format(new Date(0, 0, 0, hour), 'h aa')}
              </div>
            ))}
          </div>

          <div
            className="day-timeline-daycol"
            ref={dayColumnRef}
            onClick={handleColumnClick}
            onPointerDown={handleColumnMouseDown}
          >
            {HOURS.map((hour) => (
              <div key={hour} className="day-timeline-slot" style={{ height: rowHeight }} />
            ))}

            {isToday && nowPos != null && <NowMarker top={nowPos} />}

            {lanedItems.map((item) => {
              const geo = getBlockGeometry(item, rowHeight);
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
                  className={`day-time-block${completed ? ' is-completed' : ''}${isDragging ? ' is-dragging' : ''}${height < SHORT_BLOCK.dayInlineBelow ? ' is-short' : ''}${activeId === item.id ? ' is-selected' : ''}`}
                  style={{
                    top,
                    left,
                    width,
                    height,
                    background: color,
                    opacity: isDragging ? 0.85 : highlightOpacity,
                  }}
                  onPointerDown={(e) => handleBlockMouseDown(e, item)}
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
              const primed = Boolean(createDrag?.armed && !createDrag.active);
              const draftRange = createDrag?.active
                ? rangeFromCreateDrag(createDrag.originMinutes, createDrag.currentMinutes)
                : primed
                  ? rangeFromCreateDrag(createDrag.originMinutes, createDrag.originMinutes)
                  : createSession
                    ? { startMinutes: createSession.startMinutes, endMinutes: createSession.endMinutes }
                    : null;
              if (!draftRange) return null;
              const visibleEnd = Math.min(draftRange.endMinutes, 24 * 60);
              const duration = Math.max(CREATE_SNAP_MINUTES, visibleEnd - draftRange.startMinutes);
              const top = (draftRange.startMinutes / 60) * rowHeight;
              const height = getDayBlockHeightPx(duration, rowHeight);
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
                  className={`day-time-block-draft${primed ? ' is-primed' : ''}${height < SHORT_BLOCK.dayInlineBelow ? ' is-short' : ''}`}
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
                    height: previewHeightFor(dragState.item, rowHeight),
                    background: getItemColor(dragState.item),
                  }}
                >
                  <StackedBlockLabel
                    blockSelector=".day-time-block-preview"
                    titleClassName="day-time-block-title"
                    timeClassName="day-time-block-preview-time"
                    title={getItemTitle(dragState.item)}
                    timeText={formatShortTimeRange(dropTimes.startTime, dropTimes.endTime)}
                    titleStyle={{ paddingRight: 0, fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}
                    timeStyle={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.95 }}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      <p className="day-timeline-hint">
        {selectThenDrag
          ? 'Tap an empty slot to create · Hold, then drag, an empty slot · Tap a block to select, then drag it'
          : tapToCreate
            ? 'Tap an empty slot to create · Hold, then drag, an empty slot · Long-press a block to move'
            : 'Click or drag an empty slot to create · Drag a block to schedule'}
      </p>
    </div>
  );
}
