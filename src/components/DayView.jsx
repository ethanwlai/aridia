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
}) => {
  const selectedDate = startOfDay(centerDay || new Date());
  const today = startOfDay(new Date());
  const isToday = isSameDate(selectedDate, today);
  const dateKey = formatDateKey(selectedDate);

  const [highlightedId, setHighlightedId] = useState(null);
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
          externalDragItem={isAgendaDragging ? agendaDrag.item : null}
          onExternalDragEnd={handleExternalDragEnd}
        />
        <DayAgenda
          day={selectedDate}
          scheduled={scheduled}
          unscheduled={unscheduled}
          highlightedId={highlightedId}
          draggingId={draggingId}
          isDragging={isAgendaDragging}
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
