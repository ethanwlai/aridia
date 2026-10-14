import { useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import {
  buildItemsByDate,
  formatDateKey,
  formatItemTime,
  getCalendarHighlightOpacity,
  getItemColor,
  getItemTitle,
  highlightedTaskSelector,
  isCalendarHighlighted,
  scrollHighlightedIntoView,
  toggleCalendarHighlight,
} from '../utils/calendarItems';
import './OverviewViews.css';

export default function DayDetailPanel({
  date,
  tasks = [],
  onClose,
  highlightedItem = null,
  onHighlightItem,
  onOpenDay,
  asSheet = false,
  locateToken = 0,
}) {
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const scrolledLocateRef = useRef(0);
  const itemsByDate = useMemo(() => buildItemsByDate(tasks), [tasks]);
  const items = date ? (itemsByDate[formatDateKey(date)] || []) : [];

  useEffect(() => {
    const locateKey = `${locateToken}:${date ? formatDateKey(date) : ''}`;
    if (!locateToken || !highlightedItem || !listRef.current) return;
    if (scrolledLocateRef.current === locateKey) return;
    if (!items.some((item) => isCalendarHighlighted(highlightedItem, item))) return;
    const scrolled = scrollHighlightedIntoView(
      listRef.current,
      highlightedTaskSelector(highlightedItem.id),
      { force: true }
    );
    if (scrolled) scrolledLocateRef.current = locateKey;
  }, [locateToken, highlightedItem, date, items]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current?.contains(event.target)) return;
      if (event.target.closest('.mcg-day') || event.target.closest('.overview-nav-bar')) return;
      onClose?.();
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!date) return null;

  return (
    <aside ref={panelRef} className={`day-detail-panel${asSheet ? ' day-detail-panel--sheet' : ''}`}>
      <div className="day-detail-header">
        <div>
          <h2 className="day-detail-heading">{format(date, 'EEEE')}</h2>
          <p className="day-detail-sub">{format(date, 'MMMM d, yyyy')}</p>
        </div>
        <button type="button" className="day-detail-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {onOpenDay && (
        <button
          type="button"
          className="day-detail-open-day"
          onClick={() => onOpenDay(date)}
        >
          Open day
        </button>
      )}
      <div className="day-detail-list" ref={listRef}>
        {items.length === 0 ? (
          <p className="day-detail-empty">No tasks or events</p>
        ) : (
          items.map((item) => (
            <button
              type="button"
              key={item.id || `${getItemTitle(item)}-${item.startTime || ''}`}
              className="day-detail-item"
              data-task-id={item.id}
              style={{ opacity: getCalendarHighlightOpacity(highlightedItem, item) }}
              onClick={() => toggleCalendarHighlight(highlightedItem, onHighlightItem, item)}
            >
              <span className="day-detail-swatch" style={{ background: getItemColor(item) }} />
              <span>
                <div className="day-detail-item-title">{getItemTitle(item)}</div>
                <div className="day-detail-item-time">{formatItemTime(item)}</div>
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
