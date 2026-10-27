import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import CalendarViewNav from './CalendarViewNav';
import MonthCalendarGrid from './MonthCalendarGrid';
import { buildItemsByDate, formatDateKey, isCalendarHighlighted, parseDateKey, sameMonthDayInYear, scrollHighlightedIntoView, startOfDay } from '../utils/calendarItems';
import './OverviewViews.css';

export default function YearView({
  centerDay,
  setCenterDay,
  tasks = [],
  panelDate = null,
  onDayClick,
  onDayDoubleClick,
  onMonthTitleClick,
  highlightedItem = null,
  locateToken = 0,
}) {
  const year = centerDay.getFullYear();
  const today = startOfDay(new Date());
  const itemsByDate = useMemo(() => buildItemsByDate(tasks), [tasks]);
  const bodyRef = useRef(null);
  const scrolledLocateRef = useRef(0);

  const months = useMemo(() => {
    const all = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
    if (!panelDate || panelDate.getFullYear() !== year) return all;
    const start = Math.floor(panelDate.getMonth() / 4) * 4;
    return all.slice(start, start + 4);
  }, [year, panelDate]);

  useEffect(() => {
    const locateKey = `${locateToken}:${year}`;
    if (!locateToken || !highlightedItem || scrolledLocateRef.current === locateKey) return;
    const task = tasks.find((item) => isCalendarHighlighted(highlightedItem, item));
    const date = parseDateKey(task?.deadline);
    if (!date || date.getFullYear() !== year) return;
    const scrolled = scrollHighlightedIntoView(
      bodyRef.current,
      `.mcg-day.in-month[data-date="${formatDateKey(date)}"]`,
      { force: true }
    );
    if (scrolled) scrolledLocateRef.current = locateKey;
  }, [locateToken, highlightedItem, year, tasks, months]);

  useLayoutEffect(() => {
    const target = sameMonthDayInYear(year, new Date());
    scrollHighlightedIntoView(
      bodyRef.current,
      `.mcg-day.in-month[data-date="${formatDateKey(target)}"]`
    );
  }, [year]);

  const goToday = () => setCenterDay(today);
  const goPrev = () => setCenterDay(sameMonthDayInYear(year - 1, new Date()));
  const goNext = () => setCenterDay(sameMonthDayInYear(year + 1, new Date()));

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
      <div className="year-view-body" ref={bodyRef}>
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
              highlightedItem={highlightedItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
