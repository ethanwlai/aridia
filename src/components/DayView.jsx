import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format } from 'date-fns';
import CalendarViewNav from './CalendarViewNav';
import DayTimeline from './DayTimeline';
import DayAgenda from './DayAgenda';
import {
  buildItemsByDate,
  formatDateKey,
  startOfDay,
} from '../utils/calendarItems';
import './DayView.css';

const DRAG_THRESHOLD = 6;
const CREATE_DURATION_MINUTES = 30;
const CREATE_MIN_DURATION_MINUTES = 5;

function buildCreateSession(dayStart, startMinutes, endMinutes) {
  const minDuration = endMinutes == null ? CREATE_DURATION_MINUTES : CREATE_MIN_DURATION_MINUTES;
  let start = Number(startMinutes) || 0;
  let end = endMinutes == null ? start + CREATE_DURATION_MINUTES : Number(endMinutes);
  if (end <= start) end = start + minDuration;
  start = Math.max(0, Math.min(24 * 60 - minDuration, start));
  end = Math.max(start + minDuration, Math.min(24 * 60, end));
  const startDate = new Date(dayStart);
  startDate.setHours(0, start, 0, 0);
  const endDate = new Date(dayStart);
  endDate.setHours(0, end, 0, 0);
  return {
    startMinutes: start,
    endMinutes: end,
    start: startDate,
    end: endDate,
  };
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
  highlightedItem = null,
  onHighlightItem,
}) => {
  const selectedDate = startOfDay(centerDay || new Date());
  const dateKey = formatDateKey(selectedDate);

  const [agendaDrag, setAgendaDrag] = useState(null);
  const [createSession, setCreateSession] = useState(null);
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

  const closeCreate = useCallback(() => {
    setCreateSession(null);
  }, []);

  const handleCreateAt = useCallback((startMinutes, endMinutes) => {
    setCreateSession(buildCreateSession(selectedDate, startMinutes, endMinutes));
  }, [selectedDate]);

  const handleCreateTimesChange = useCallback((start, end) => {
    if (!(start instanceof Date) || !(end instanceof Date)) return;
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    let endMinutes = end.getHours() * 60 + end.getMinutes();
    if (endMinutes <= startMinutes) endMinutes += 24 * 60;
    setCreateSession((prev) => (
      prev
        ? { ...prev, startMinutes, endMinutes, start, end }
        : prev
    ));
  }, []);

  const handleCreateAdd = useCallback((task) => {
    if (task.startTime && task.endTime && task.startTime === task.endTime) return;
    onAdd?.(task);
    setCreateSession(null);
  }, [onAdd]);

  useEffect(() => {
    setCreateSession(null);
  }, [dateKey]);

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
        prevLabel="Previous day"
        nextLabel="Next day"
      >
        <div className="day-view-heading">
          <h1 className="day-title">{format(selectedDate, 'EEEE')}</h1>
        </div>
      </CalendarViewNav>

      <div className="day-view-header" />

      <div className={`day-view-hybrid${agendaDrag ? ' is-dragging' : ''}`}>
        <DayTimeline
          day={selectedDate}
          items={dayItems}
          highlightedItem={highlightedItem}
          onHighlightItem={onHighlightItem}
          onUpdateTask={onUpdateTask}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onEdit={onEdit}
          onAutoSchedule={onAutoSchedule}
          onQuickMove={onQuickMove}
          onExtendDuration={onExtendDuration}
          externalDragItem={isAgendaDragging ? agendaDrag.item : null}
          onExternalDragEnd={handleExternalDragEnd}
          createSession={createSession}
          onCreateAt={handleCreateAt}
          onCancelCreate={closeCreate}
        />
        <DayAgenda
          day={selectedDate}
          scheduled={scheduled}
          unscheduled={unscheduled}
          highlightedItem={highlightedItem}
          onHighlightItem={onHighlightItem}
          draggingId={draggingId}
          isDragging={isAgendaDragging}
          onAdd={createSession ? handleCreateAdd : onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onAutoSchedule={onAutoSchedule}
          onQuickMove={onQuickMove}
          onExtendDuration={onExtendDuration}
          createSession={createSession}
          onCancelCreate={closeCreate}
          onTimesChange={handleCreateTimesChange}
        />
      </div>
    </div>
  );
};

export default DayView;
