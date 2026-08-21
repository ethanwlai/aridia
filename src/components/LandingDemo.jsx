import { useEffect, useMemo, useState } from 'react';
import aridiaLogo from '../assets/aridia-logo.png';
import { sortTasks } from '../utils/taskSorter';
import './LandingDemo.css';

const PLACE_ID = 'lab';

const DAYS = [
  { key: 'mon', label: 'Mon', num: '18' },
  { key: 'tue', label: 'Tue', num: '19' },
  { key: 'wed', label: 'Wed', num: '20' },
  { key: 'thu', label: 'Thu', num: '21' },
  { key: 'fri', label: 'Fri', num: '22' },
];

const ENERGY_COLOR = {
  1: '#4ade80',
  2: '#22c55e',
  3: '#fbbf24',
  4: '#f97316',
  5: '#dc2626',
};

const MOTIVATION_COLOR = {
  1: '#4c1d95',
  2: '#5b21b6',
  3: '#6d28d9',
  4: '#7c3aed',
  5: '#8b5cf6',
};

const STEPS = [
  { id: 'idle', duration: 2000, caption: '', motivation: 2, dashOpen: false, placed: false },
  { id: 'open', duration: 2200, caption: 'Open the task dashboard.', motivation: 2, dashOpen: true, placed: false },
  { id: 'energy3', duration: 1600, caption: 'Match the list to your energy.', motivation: 3, dashOpen: true, placed: false },
  { id: 'energy4', duration: 2000, caption: 'Match the list to your energy.', motivation: 4, dashOpen: true, placed: false },
  { id: 'place', duration: 2500, caption: 'Place it on the calendar.', motivation: 4, dashOpen: true, placed: true },
  { id: 'hold', duration: 1800, caption: 'Place it on the calendar.', motivation: 4, dashOpen: true, placed: true },
];

function daysFromNow(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildSampleTasks() {
  return [
    { id: 'tidy', title: 'Tidy desk', type: 'task', energy: 1, priority: 1, deadline: daysFromNow(14) },
    { id: PLACE_ID, title: 'Write lab report', type: 'task', energy: 5, priority: 5, deadline: daysFromNow(2) },
    { id: 'read', title: 'Read chapter 3', type: 'task', energy: 2, priority: 2, deadline: daysFromNow(5) },
    { id: 'email', title: 'Email advisor', type: 'task', energy: 1, priority: 4, deadline: daysFromNow(3) },
  ];
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function LandingDemo() {
  const samples = useMemo(() => buildSampleTasks(), []);
  const startIndex = prefersReducedMotion() ? STEPS.length - 1 : 0;
  const [stepIndex, setStepIndex] = useState(startIndex);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    let cancelled = false;
    let timer;
    let index = 0;

    const clear = () => {
      window.clearTimeout(timer);
      timer = undefined;
    };

    const schedule = () => {
      clear();
      if (cancelled || document.hidden) return;
      setStepIndex(index);
      timer = window.setTimeout(() => {
        index = (index + 1) % STEPS.length;
        schedule();
      }, STEPS[index].duration);
    };

    const onVisibility = () => {
      if (document.hidden) clear();
      else schedule();
    };

    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clear();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const step = STEPS[stepIndex];
  const sorted = sortTasks(samples, step.motivation);
  const fillPct = ((step.motivation - 1) / 4) * 100;
  const fillColor = MOTIVATION_COLOR[step.motivation];

  return (
    <div className={`landing-demo${step.dashOpen ? ' is-open' : ''}`} aria-hidden="true">
      <div className="landing-demo-product">
        <aside className="landing-demo-dash">
          <div className="landing-demo-energy">
            <span>Motivation Level</span>
            <div className="landing-demo-track">
              <div
                className="landing-demo-fill"
                style={{ width: `${fillPct}%`, background: fillColor }}
              />
            </div>
            <strong>{step.motivation}</strong>
          </div>
          <div className="landing-demo-list-label">Recommended Task Order</div>
          <div className="landing-demo-list" style={{ height: `${8 + sorted.length * 52}px` }}>
            {sorted.map((task, index) => (
              <div
                key={task.id}
                className={`landing-demo-task${step.placed && task.id === PLACE_ID ? ' is-placed-src' : ''}`}
                style={{ transform: `translateY(${8 + index * 52}px)` }}
              >
                <span className="landing-demo-task-num">{index + 1}</span>
                <span className="landing-demo-task-title">{task.title}</span>
                <span className="landing-demo-task-energy" style={{ color: ENERGY_COLOR[task.energy] }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M7 2v11h3v9l7-12h-4l4-8z" />
                  </svg>
                </span>
              </div>
            ))}
          </div>
        </aside>

        <div className={`landing-demo-handle${step.id === 'open' ? ' is-clicking' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </div>

        <div className="landing-demo-window">
          <div className="landing-demo-header">
            <img className="landing-demo-logo" src={aridiaLogo} alt="" width={75} height={36} />
            <div className="landing-demo-pills">
              <span>Day</span>
              <span className="is-active">Week</span>
              <span>Month</span>
              <span>Year</span>
            </div>
            <span className="landing-demo-search">Search tasks...</span>
          </div>

          <div className="landing-demo-grid">
            <div className="landing-demo-times">
              <span>9 AM</span>
              <span>11 AM</span>
              <span>1 PM</span>
              <span>3 PM</span>
            </div>
            {DAYS.map((day) => (
              <div key={day.key} className="landing-demo-col">
                <div className="landing-demo-day">
                  <span>{day.label}</span>
                  <strong>{day.num}</strong>
                </div>
                <div className="landing-demo-slots">
                  {day.key === 'mon' && (
                    <div className="landing-demo-block landing-demo-block--school" style={{ top: '6%', height: '28%' }}>
                      Lecture
                    </div>
                  )}
                  {day.key === 'tue' && (
                    <div
                      className={`landing-demo-block landing-demo-block--school landing-demo-lab${step.placed ? ' is-placed' : ''}`}
                      style={{ top: '52%', height: '28%' }}
                    >
                      Write lab report
                    </div>
                  )}
                  {day.key === 'wed' && (
                    <div className="landing-demo-block landing-demo-block--extra" style={{ top: '30%', height: '22%' }}>
                      Club
                    </div>
                  )}
                  {day.key === 'thu' && (
                    <div className="landing-demo-block landing-demo-block--work" style={{ top: '6%', height: '40%' }}>
                      Shift
                    </div>
                  )}
                  {day.key === 'fri' && (
                    <div className="landing-demo-block landing-demo-block--fun" style={{ top: '68%', height: '24%' }}>
                      Movie
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className={`landing-demo-caption${step.caption ? ' is-on' : ''}`}>{step.caption || '\u00a0'}</p>
    </div>
  );
}
