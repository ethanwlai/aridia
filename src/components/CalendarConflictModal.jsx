import './CalendarConflictModal.css';

export default function CalendarConflictModal({
  localCount,
  cloudCount,
  onKeepCloud,
  onUseLocal,
  busy,
}) {
  return (
    <div className="conflict-overlay" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
      <div className="conflict-card">
        <h2 id="conflict-title">Choose a calendar</h2>
        <p>
          This device has local tasks and events, and your account already has a saved calendar.
          Pick one — they will not be merged.
        </p>
        <p className="conflict-counts">
          Account: {cloudCount} item{cloudCount === 1 ? '' : 's'} · This device: {localCount} item{localCount === 1 ? '' : 's'}
        </p>
        <div className="conflict-actions">
          <button type="button" className="conflict-keep" onClick={onKeepCloud} disabled={busy}>
            Keep my account calendar
          </button>
          <button type="button" className="conflict-local" onClick={onUseLocal} disabled={busy}>
            Use this device’s calendar
          </button>
        </div>
      </div>
    </div>
  );
}
