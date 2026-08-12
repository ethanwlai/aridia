import { useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import {
  buildItemsByDate,
  formatDateKey,
  formatItemTime,
  getItemColor,
  getItemTitle,
} from '../utils/calendarItems';
import './OverviewViews.css';

export default function DayDetailPanel({ date, tasks = [], onClose, onItemClick }) {
  const panelRef = useRef(null);
  const itemsByDate = useMemo(() => buildItemsByDate(tasks), [tasks]);
  const items = date ? (itemsByDate[formatDateKey(date)] || []) : [];

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
    <aside ref={panelRef} className="day-detail-panel">
      <div className="day-detail-header">
        <div>
          <h2 className="day-detail-heading">{format(date, 'EEEE')}</h2>
          <p className="day-detail-sub">{format(date, 'MMMM d, yyyy')}</p>
        </div>
        <button type="button" className="day-detail-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="day-detail-list">
        {items.length === 0 ? (
          <p className="day-detail-empty">No tasks or events</p>
        ) : (
          items.map((item) => (
            <button
              type="button"
              key={item.id || `${getItemTitle(item)}-${item.startTime || ''}`}
              className="day-detail-item"
              onClick={() => onItemClick?.(item, date)}
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
