import { useCallback, useMemo, useState } from 'react';
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

      <div className="day-view-hybrid">
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
        />
        <DayAgenda
          day={selectedDate}
          scheduled={scheduled}
          unscheduled={unscheduled}
          highlightedId={highlightedId}
          onSelectItem={handleSelectItem}
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
