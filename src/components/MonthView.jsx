import { useMemo } from 'react';
import { addMonths, format } from 'date-fns';
import CalendarViewNav from './CalendarViewNav';
import MonthCalendarGrid from './MonthCalendarGrid';
import { buildItemsByDate, startOfDay } from '../utils/calendarItems';
import './OverviewViews.css';

export default function MonthView({
  centerDay,
  setCenterDay,
  tasks = [],
  panelDate = null,
  onDayClick,
  onDayDoubleClick,
  highlightedItem = null,
  onHighlightItem,
}) {
  const today = startOfDay(new Date());
  const monthDate = useMemo(
    () => new Date(centerDay.getFullYear(), centerDay.getMonth(), 1),
    [centerDay]
  );
  const itemsByDate = useMemo(() => buildItemsByDate(tasks), [tasks]);

  const goToday = () => setCenterDay(today);
  const goPrev = () => setCenterDay(addMonths(startOfDay(centerDay), -1));
  const goNext = () => setCenterDay(addMonths(startOfDay(centerDay), 1));

  return (
    <div className="month-view">
      <CalendarViewNav
        label={format(monthDate, 'MMMM yyyy')}
        onPrev={goPrev}
        onNext={goNext}
        onToday={
          monthDate.getFullYear() === today.getFullYear() &&
          monthDate.getMonth() === today.getMonth()
            ? undefined
            : goToday
        }
        prevLabel="Previous month"
        nextLabel="Next month"
      />
      <div className="month-view-body">
        <MonthCalendarGrid
          monthDate={monthDate}
          itemsByDate={itemsByDate}
          variant="chips"
          today={today}
          selectedDate={panelDate}
          maxChips={3}
          onDayClick={onDayClick}
          onDayDoubleClick={onDayDoubleClick}
          onMoreClick={onDayClick}
          highlightedItem={highlightedItem}
          onHighlightItem={onHighlightItem}
        />
      </div>
    </div>
  );
}
