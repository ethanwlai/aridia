import './OverviewViews.css';

export default function CalendarViewNav({ label, onPrev, onNext, onToday, prevLabel, nextLabel }) {
  return (
    <div className="calendar-nav-bar overview-nav-bar">
      <button
        className="calendar-nav-arrow left"
        onClick={onPrev}
        aria-label={prevLabel || 'Previous'}
        onDoubleClick={(e) => { e.preventDefault(); e.currentTarget.blur(); }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" style={{ display: 'block', margin: 'auto' }} fill="black" xmlns="http://www.w3.org/2000/svg">
          <polygon points="11,3 5,8 11,13" />
        </svg>
      </button>
      <button
        className="calendar-nav-arrow right"
        onClick={onNext}
        aria-label={nextLabel || 'Next'}
        onDoubleClick={(e) => { e.preventDefault(); e.currentTarget.blur(); }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" style={{ display: 'block', margin: 'auto' }} fill="black" xmlns="http://www.w3.org/2000/svg">
          <polygon points="5,3 11,8 5,13" />
        </svg>
      </button>
      {label ? <span className="overview-nav-label">{label}</span> : null}
      {onToday ? (
        <button type="button" className="overview-today-btn" onClick={onToday}>
          Today
        </button>
      ) : null}
    </div>
  );
}
