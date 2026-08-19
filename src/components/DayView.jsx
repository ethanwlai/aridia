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
  highlightedItem = null,
  onHighlightItem,
}) => {
  const selectedDate = startOfDay(centerDay || new Date());
  const today = startOfDay(new Date());
  const isToday = isSameDate(selectedDate, today);
  const dateKey = formatDateKey(selectedDate);

  const [scrollToId, setScrollToId] = useState(null);
  const [agendaDrag, setAgendaDrag] = useState(null);
  const agendaDragRef = useRef(null);
  agendaDragRef.current = agendaDrag;

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

  const handleAgendaPointerDragStart = useCallback((item, e) => {
    if (window.openDropdownRef?.current) {
      window.openDropdownRef.current.setIsOpen(false);
      window.openDropdownRef.current.setActiveSubmenu(null);
      window.openDropdownRef.current = null;
    }
    setAgendaDrag({
      item,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    });
  }, []);

  const handleExternalDragEnd = useCallback(() => {
    setAgendaDrag(null);
  }, []);

  useEffect(() => {
    const clearSidebarDragFlags = (clearTask = false) => {
      const drag = window.globalDragState;
      if (!drag) return;
      drag.startCustomDrag = false;
      drag.startX = null;
      drag.startY = null;
      if (clearTask) drag.currentTask = null;
    };

    const onMove = (e) => {
      const drag = window.globalDragState;
      if (!drag?.startCustomDrag || !drag.currentTask) return;
      if (agendaDragRef.current?.active) return;

      const startX = drag.startX || 0;
      const startY = drag.startY || 0;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;

      const item = drag.currentTask;
      clearSidebarDragFlags(false);

      if (window.openDropdownRef?.current) {
        window.openDropdownRef.current.setIsOpen(false);
        window.openDropdownRef.current.setActiveSubmenu(null);
        window.openDropdownRef.current = null;
      }

      setAgendaDrag({
        item,
        startX,
        startY,
        active: true,
      });
    };

    const onUp = () => {
      if (window.globalDragState?.startCustomDrag) {
        clearSidebarDragFlags(true);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    if (!agendaDrag) return undefined;

    const onMove = (e) => {
      const current = agendaDragRef.current;
      if (!current || current.active) return;
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
        setAgendaDrag((prev) => prev && { ...prev, active: true });
      }
    };

    const onUp = () => {
      const current = agendaDragRef.current;
      if (!current) return;
      if (!current.active) {
        setAgendaDrag(null);
        return;
      }
      requestAnimationFrame(() => {
        if (agendaDragRef.current?.active) {
          setAgendaDrag(null);
        }
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [Boolean(agendaDrag)]);

  const isAgendaDragging = Boolean(agendaDrag?.active);
  const draggingId = agendaDrag?.item?.id ?? null;

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

      <div className={`day-view-hybrid${agendaDrag ? ' is-dragging' : ''}`}>
        <DayTimeline
          day={selectedDate}
          items={dayItems}
          highlightedItem={highlightedItem}
          onHighlightItem={onHighlightItem}
          onAdd={onAdd}
          onUpdateTask={onUpdateTask}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onEdit={onEdit}
          onAutoSchedule={onAutoSchedule}
          onQuickMove={onQuickMove}
          onExtendDuration={onExtendDuration}
          scrollToId={scrollToId}
          externalDragItem={isAgendaDragging ? agendaDrag.item : null}
          onExternalDragEnd={handleExternalDragEnd}
        />
        <DayAgenda
          day={selectedDate}
          scheduled={scheduled}
          unscheduled={unscheduled}
          highlightedItem={highlightedItem}
          onHighlightItem={onHighlightItem}
          draggingId={draggingId}
          isDragging={isAgendaDragging}
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
