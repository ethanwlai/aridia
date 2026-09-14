import { useMemo } from 'react';
import { addYears } from 'date-fns';
import CalendarViewNav from './CalendarViewNav';
import MonthCalendarGrid from './MonthCalendarGrid';
import { buildItemsByDate, startOfDay } from '../utils/calendarItems';
import './OverviewViews.css';

export default function YearView({
  centerDay,
  setCenterDay,
  tasks = [],
  panelDate = null,
  onDayClick,
  onDayDoubleClick,
  onMonthTitleClick,
}) {
  const year = centerDay.getFullYear();
  const today = startOfDay(new Date());
  const itemsByDate = useMemo(() => buildItemsByDate(tasks), [tasks]);

  const months = useMemo(() => {
    const all = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
    if (!panelDate || panelDate.getFullYear() !== year) return all;
    const start = Math.floor(panelDate.getMonth() / 4) * 4;
    return all.slice(start, start + 4);
  }, [year, panelDate]);

  const goToday = () => setCenterDay(today);
  const goPrev = () => setCenterDay(addYears(startOfDay(centerDay), -1));
  const goNext = () => setCenterDay(addYears(startOfDay(centerDay), 1));

  return (
    <div className="year-view">
      <CalendarViewNav
        label={String(year)}
        onPrev={goPrev}
        onNext={goNext}
        onToday={year === today.getFullYear() ? undefined : goToday}
        prevLabel="Previous year"
        nextLabel="Next year"
      />
      <div className="year-view-body">
        <div className={`year-month-grid${months.length === 4 ? ' year-month-grid--focus' : ''}`}>
          {months.map((monthDate) => (
            <MonthCalendarGrid
              key={monthDate.getMonth()}
              monthDate={monthDate}
              itemsByDate={itemsByDate}
              variant="compact"
              today={today}
              selectedDate={panelDate}
              showMonthTitle
              onDayClick={onDayClick}
              onDayDoubleClick={onDayDoubleClick}
              onMonthTitleClick={onMonthTitleClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
