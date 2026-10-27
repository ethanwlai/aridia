import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { addMonths, format } from 'date-fns';
import CalendarViewNav from './CalendarViewNav';
import MonthCalendarGrid from './MonthCalendarGrid';
import { buildItemsByDate, formatDateKey, highlightedTaskSelector, isCalendarHighlighted, parseDateKey, scrollHighlightedIntoView, startOfDay } from '../utils/calendarItems';
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
  compact = false,
  locateToken = 0,
}) {
  const today = startOfDay(new Date());
  const monthDate = useMemo(
    () => new Date(centerDay.getFullYear(), centerDay.getMonth(), 1),
    [centerDay]
  );
  const itemsByDate = useMemo(() => buildItemsByDate(tasks), [tasks]);
  const bodyRef = useRef(null);
  const scrolledLocateRef = useRef(0);
  const maxChips = compact ? 1 : 3;

  useEffect(() => {
    const locateKey = `${locateToken}:${monthDate.getFullYear()}-${monthDate.getMonth()}`;
    if (!locateToken || !highlightedItem || scrolledLocateRef.current === locateKey) return;
    const task = tasks.find((item) => isCalendarHighlighted(highlightedItem, item));
    const date = parseDateKey(task?.deadline);
    if (!date) return;
    if (date.getFullYear() !== monthDate.getFullYear() || date.getMonth() !== monthDate.getMonth()) return;
    const dayItems = itemsByDate[formatDateKey(date)] || [];
    const index = dayItems.findIndex((item) => isCalendarHighlighted(highlightedItem, item));
    if (index < 0) {
      scrolledLocateRef.current = locateKey;
      return;
    }
    if (index < maxChips) {
      const scrolled = scrollHighlightedIntoView(
        bodyRef.current,
        highlightedTaskSelector(highlightedItem.id),
        { force: true }
      );
      if (scrolled) scrolledLocateRef.current = locateKey;
      return;
    }
    scrollHighlightedIntoView(
      bodyRef.current,
      `.mcg-day.in-month[data-date="${formatDateKey(date)}"]`,
      { force: true }
    );
    onDayClick?.(date);
    scrolledLocateRef.current = locateKey;
  }, [locateToken, highlightedItem, monthDate, tasks, itemsByDate, maxChips, onDayClick]);

  const shownYear = monthDate.getFullYear();
  const shownMonth = monthDate.getMonth();
  useLayoutEffect(() => {
    const container = bodyRef.current;
    if (!container) return;
    const dayNumber = new Date().getDate();
    const lastDay = new Date(shownYear, shownMonth + 1, 0).getDate();
    const target = startOfDay(new Date(shownYear, shownMonth, Math.min(dayNumber, lastDay)));
    const el = container.querySelector(`.mcg-day.in-month[data-date="${formatDateKey(target)}"]`);
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = (elRect.top + elRect.height / 2) - (containerRect.top + containerRect.height / 2);
    const max = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollTop = Math.max(0, Math.min(max, container.scrollTop + delta));
  }, [shownYear, shownMonth]);

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
      <div className="month-view-body" ref={bodyRef}>
        <MonthCalendarGrid
          monthDate={monthDate}
          itemsByDate={itemsByDate}
          variant="chips"
          today={today}
          selectedDate={panelDate}
          maxChips={maxChips}
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
