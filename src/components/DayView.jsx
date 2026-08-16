import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format } from 'date-fns';
import CalendarViewNav from './CalendarViewNav';
import DayTimeline from './DayTimeline';
import DayAgenda from './DayAgenda';
import {
  buildItemsByDate,
  formatDateKey,
  isSameDate,
  startOfDay,
} from '../utils/calendarItems';
import './DayView.css';

const DRAG_THRESHOLD = 6;

if (typeof window !== 'undefined') {
  window.globalDragState = window.globalDragState || {
    currentTask: null,
    startCustomDrag: false,
    startX: null,
    startY: null,
  };
}

function clearGlobalDrag() {
  if (!window.globalDragState) return;
  window.globalDragState.startCustomDrag = false;
  window.globalDragState.startX = null;
  window.globalDragState.startY = null;
  window.globalDragState.currentTask = null;
}

const DayView = ({
  tasks = [],
  centerDay,
  setCenterDay,
  onAdd,
  onUpdateTask,
  onDelete,
  onUpdateStatus,
  onEdit,
  onAutoSchedule,
  onQuickMove,
  onExtendDuration,
}) => {
  const dayStartMs = startOfDay(centerDay || new Date()).getTime();
  const selectedDate = useMemo(() => new Date(dayStartMs), [dayStartMs]);
  const today = startOfDay(new Date());
  const isToday = isSameDate(selectedDate, today);
  const dateKey = formatDateKey(selectedDate);

  const [highlightedId, setHighlightedId] = useState(null);
  const [scrollToId, setScrollToId] = useState(null);
  const [externalDrag, setExternalDrag] = useState(null);
  const externalDragRef = useRef(null);
  externalDragRef.current = externalDrag;

  const dayItems = useMemo(() => {
    const byDate = buildItemsByDate(tasks);
    return byDate[dateKey] || [];
  }, [tasks, dateKey]);

  const scheduled = useMemo(
    () => dayItems.filter((item) => item.startTime && item.endTime),
    [dayItems]
  );
  const unscheduled = useMemo(
    () => dayItems.filter((item) => !item.startTime || !item.endTime),
    [dayItems]
  );

  const goPrev = () => setCenterDay?.(addDays(selectedDate, -1));
  const goNext = () => setCenterDay?.(addDays(selectedDate, 1));
  const goToday = () => setCenterDay?.(today);

  const handleSelectItem = useCallback((item) => {
    setHighlightedId(item.id);
    if (item.startTime && item.endTime) {
      setScrollToId(`${item.id}:${Date.now()}`);
    }
  }, []);

  const handleAgendaPointerDragStart = useCallback((item, e) => {
    if (window.openDropdownRef?.current) {
      window.openDropdownRef.current.setIsOpen(false);
      window.openDropdownRef.current.setActiveSubmenu(null);
      window.openDropdownRef.current = null;
    }
    setExternalDrag({
      item,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      source: 'agenda',
    });
  }, []);

  const handleExternalDragEnd = useCallback(() => {
    setExternalDrag(null);
    clearGlobalDrag();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const current = externalDragRef.current;

      if (!current && window.globalDragState?.startCustomDrag && window.globalDragState.currentTask) {
        const startX = window.globalDragState.startX || 0;
        const startY = window.globalDragState.startY || 0;
        const distance = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (distance >= DRAG_THRESHOLD) {
          setExternalDrag({
            item: window.globalDragState.currentTask,
            startX,
            startY,
            active: true,
            source: 'sidebar',
          });
          clearGlobalDrag();
        }
        return;
      }

      if (!current || current.active) return;
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
        setExternalDrag((prev) => (prev && !prev.active ? { ...prev, active: true } : prev));
      }
    };

    const onUp = () => {
      if (window.globalDragState?.startCustomDrag) {
        clearGlobalDrag();
      }
      const current = externalDragRef.current;
      if (!current) return;
      if (!current.active) {
        setExternalDrag(null);
        return;
      }
      requestAnimationFrame(() => {
        if (externalDragRef.current?.active) {
          setExternalDrag(null);
        }
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const isExternalDragging = Boolean(externalDrag?.active);
  const draggingId = externalDrag?.item?.id ?? null;

  return (
    <div className="day-view">
      <CalendarViewNav
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        prevLabel="Previous day"
        nextLabel="Next day"
      />

      <div className="day-view-header">
        <div className="day-view-heading-block">
          <h1 className="day-title">
            {isToday ? 'Today' : format(selectedDate, 'EEEE')}
          </h1>
          <p className="day-subtitle">{format(selectedDate, 'MMMM d, yyyy')}</p>
        </div>
      </div>

      <div className={`day-view-hybrid${externalDrag ? ' is-dragging' : ''}`}>
        <DayTimeline
          day={selectedDate}
          items={dayItems}
          highlightedId={highlightedId}
          onHighlightItem={setHighlightedId}
          onAdd={onAdd}
          onUpdateTask={onUpdateTask}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onEdit={onEdit}
          onAutoSchedule={onAutoSchedule}
          onQuickMove={onQuickMove}
          onExtendDuration={onExtendDuration}
          scrollToId={scrollToId}
          externalDragItem={isExternalDragging ? externalDrag.item : null}
          onExternalDragEnd={handleExternalDragEnd}
        />
        <DayAgenda
          day={selectedDate}
          scheduled={scheduled}
          unscheduled={unscheduled}
          highlightedId={highlightedId}
          draggingId={draggingId}
          isDragging={isExternalDragging}
          onSelectItem={handleSelectItem}
          onPointerDragStart={handleAgendaPointerDragStart}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onAutoSchedule={onAutoSchedule}
          onQuickMove={onQuickMove}
          onExtendDuration={onExtendDuration}
        />
      </div>
    </div>
  );
};

export default DayView;
