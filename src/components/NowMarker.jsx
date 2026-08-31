import './NowMarker.css';

export default function NowMarker({ top }) {
  return (
    <div
      className="day-timeline-now"
      style={top != null ? { top } : undefined}
    >
      <span className="day-timeline-now-dot" />
    </div>
  );
}
