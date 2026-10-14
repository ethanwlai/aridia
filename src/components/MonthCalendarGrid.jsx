import { useRef } from 'react';
import { format } from 'date-fns';
import { formatDateKey, getCalendarHighlightOpacity, getItemColor, getItemTitle, getMonthCells, isCalendarHighlighted, isSameDate, toggleCalendarHighlight } from '../utils/calendarItems';
import './OverviewViews.css';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CLICK_DELAY_MS = 250;

export default function MonthCalendarGrid({
  monthDate,
  itemsByDate = {},
  variant = 'compact',
  today,
  selectedDate = null,
  showMonthTitle = false,
  maxChips = 3,
  onDayClick,
  onDayDoubleClick,
  onMonthTitleClick,
  onMoreClick,
  highlightedItem = null,
  onHighlightItem,
}) {
  const clickTimerRef = useRef(null);
  const cells = getMonthCells(monthDate);
  const isCompact = variant === 'compact';

  const clearClickTimer = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  };

  const handleDayClick = (date) => {
    if (!onDayDoubleClick) {
      onDayClick?.(date);
      return;
    }
    clearClickTimer();
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      onDayClick?.(date);
    }, CLICK_DELAY_MS);
  };

  const handleDayDoubleClick = (date) => {
    clearClickTimer();
    onDayDoubleClick?.(date);
  };

  return (
    <div className={`mcg ${isCompact ? 'mcg-compact' : 'mcg-full'}`}>
      {showMonthTitle && (
        <button
          type="button"
          className="mcg-month-title"
          onClick={() => onMonthTitleClick?.(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1))}
        >
          {format(monthDate, 'MMMM')}
        </button>
      )}
      <div className="mcg-weekdays">
        {WEEKDAYS.map((day, i) => (
          <div key={`${day}-${i}`} className="mcg-weekday">{day}</div>
        ))}
      </div>
      <div className="mcg-days">
        {cells.map(({ date, inMonth }) => {
          const key = formatDateKey(date);
          const items = itemsByDate[key] || [];
          const isToday = today && isSameDate(date, today);
          const isSelected = selectedDate && isSameDate(date, selectedDate);
          const isLocated = isCompact && inMonth && items.some((item) => isCalendarHighlighted(highlightedItem, item));
          const extraCount = Math.max(0, items.length - maxChips);

          return (
            <div
              key={key}
              data-date={key}
              className={[
                'mcg-day',
                inMonth ? 'in-month' : 'out-month',
                isToday ? 'is-today' : '',
                isSelected ? 'is-selected' : '',
                isLocated ? 'is-located' : '',
                items.length > 0 ? 'has-items' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handleDayClick(date)}
              onDoubleClick={(e) => {
                e.preventDefault();
                handleDayDoubleClick(date);
              }}
            >
              <span className="mcg-day-number">{date.getDate()}</span>
              {isCompact ? (
                items.length > 0 && inMonth ? <span className="mcg-busy-dot" /> : null
              ) : (
                <div className="mcg-chips">
                  {items.slice(0, maxChips).map((item) => (
                    <div
                      key={item.id || `${getItemTitle(item)}-${item.startTime || ''}`}
                      className="mcg-chip"
                      data-task-id={item.id}
                      style={{
                        background: getItemColor(item),
                        opacity: getCalendarHighlightOpacity(highlightedItem, item),
                      }}
                      title={getItemTitle(item)}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        clearClickTimer();
                        toggleCalendarHighlight(highlightedItem, onHighlightItem, item);
                      }}
                    >
                      <span className="mcg-chip-label">{getItemTitle(item)}</span>
                    </div>
                  ))}
                  {extraCount > 0 && (
                    <button
                      type="button"
                      className="mcg-more"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        clearClickTimer();
                        (onMoreClick || onDayClick)?.(date);
                      }}
                    >
                      +{extraCount} more
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
