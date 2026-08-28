import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isToday, startOfDay } from 'date-fns';
import aridiaLogo from '../assets/aridia-logo.png';
import MotivationSlider from './MotivationSlider';
import StackedBlockLabel from './StackedBlockLabel';
import { formatDateKey, formatShortTimeRange, getItemColor, parseTimeToMinutes } from '../utils/calendarItems';
import { sortTasks } from '../utils/taskSorter';
import './LandingDemo.css';

const PLACE_ID = 'lab';
const ROW_HEIGHT = 50;
const HOUR_START = 8;
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const TASK_CARD_STEP = 56;
const LOGO_HEIGHT = 32;
const LOGO_WIDTH = Math.round(LOGO_HEIGHT * (286 / 138));

const ENERGY_COLOR = {
  1: '#4ade80',
  2: '#22c55e',
  3: '#fbbf24',
  4: '#f97316',
  5: '#dc2626',
};

const PRIORITY_COLOR = {
  1: '#22c55e',
  2: '#eab308',
  3: '#f97316',
  4: '#ef4444',
  5: '#dc2626',
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
    { id: 'tidy', title: 'Tidy desk', type: 'task', energy: 1, priority: 1, deadline: daysFromNow(14), duration: 15 },
    { id: PLACE_ID, title: 'Write lab report', type: 'task', energy: 5, priority: 5, deadline: daysFromNow(2), duration: 120, taskType: 'School' },
    { id: 'read', title: 'Read chapter 3', type: 'task', energy: 2, priority: 2, deadline: daysFromNow(5), duration: 45 },
    { id: 'email', title: 'Email advisor', type: 'task', energy: 1, priority: 4, deadline: daysFromNow(3), duration: 20 },
  ];
}

function hourLabel(hour) {
  return format(new Date(2000, 0, 1, hour), 'h aa');
}

function blockMetrics(item) {
  const start = parseTimeToMinutes(item.startTime) ?? HOUR_START * 60;
  const end = parseTimeToMinutes(item.endTime) ?? start + 60;
  return {
    top: ((start - HOUR_START * 60) / 60) * ROW_HEIGHT,
    height: Math.max(ROW_HEIGHT * 0.5, ((end - start) / 60) * ROW_HEIGHT),
  };
}

function timeFrame(task) {
  if (!task.duration) return '30m';
  const hours = Math.floor(task.duration / 60);
  const minutes = task.duration % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatDeadline(deadline) {
  if (deadline instanceof Date && !Number.isNaN(deadline.getTime())) {
    return format(deadline, 'M/d/yyyy');
  }
  if (typeof deadline === 'string') {
    const [year, month, day] = deadline.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) return format(date, 'M/d/yyyy');
  }
  return '';
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function LandingDemo() {
  const samples = useMemo(() => buildSampleTasks(), []);
  const startIndex = prefersReducedMotion() ? STEPS.length - 1 : 0;
  const [stepIndex, setStepIndex] = useState(startIndex);

  const today = useMemo(() => startOfDay(new Date()), []);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(today, i - 2)),
    [today]
  );

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

  const calendarItems = useMemo(() => {
    const key = (offset) => formatDateKey(weekDays[offset]);
    return [
      { id: 'lecture', title: 'Lecture', type: 'event', taskType: 'School', deadline: key(0), startTime: '09:00', endTime: '11:00' },
      { id: 'club', title: 'Club', type: 'event', taskType: 'Extra', deadline: key(2), startTime: '11:00', endTime: '12:30' },
      { id: 'shift', title: 'Shift', type: 'event', taskType: 'Work', deadline: key(3), startTime: '09:00', endTime: '12:00' },
      { id: 'movie', title: 'Movie', type: 'event', taskType: 'Entertainment', deadline: key(4), startTime: '15:00', endTime: '16:30' },
      { id: PLACE_ID, title: 'Write lab report', type: 'task', taskType: 'School', deadline: key(1), startTime: '13:00', endTime: '15:00' },
    ];
  }, [weekDays]);

  const nowTop = useMemo(() => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const start = HOUR_START * 60;
    const end = (HOURS[HOURS.length - 1] + 1) * 60;
    if (minutes < start || minutes > end) return null;
    return ((minutes - start) / 60) * ROW_HEIGHT;
  }, []);

  const taskCount = samples.filter((t) => t.type === 'task').length;
  const eventCount = calendarItems.filter((t) => t.type === 'event').length;

  return (
    <div className={`landing-demo${step.dashOpen ? ' is-open' : ''}`} aria-hidden="true">
      <div className="landing-demo-product">
        <aside className="landing-demo-dash dashboard-panel">
          <div className="landing-demo-dash-inner">
            <div className="landing-demo-dash-hero">
              <h1>Dashboard</h1>
              <span>
                {new Date().toLocaleDateString('en-US', {
                  month: 'numeric',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="landing-demo-chips">
              <div className="landing-demo-chip">
                <strong>{taskCount}</strong>
                <span>Tasks</span>
              </div>
              <div className="landing-demo-chip">
                <strong>{eventCount}</strong>
                <span>Events</span>
              </div>
              <div className="landing-demo-chip">
                <strong>0</strong>
                <span>Incomplete</span>
              </div>
              <div className="landing-demo-chip">
                <strong>0</strong>
                <span>Completed</span>
              </div>
            </div>

            <div className="landing-demo-classic">
              <MotivationSlider motivation={step.motivation} setMotivation={() => {}} />
              <div className="landing-demo-list-label">Recommended Task Order</div>
              <div className="landing-demo-list" style={{ height: `${8 + sorted.length * TASK_CARD_STEP}px` }}>
                {sorted.map((task, index) => (
                  <div
                    key={task.id}
                    className={`landing-demo-task${step.placed && task.id === PLACE_ID ? ' is-placed-src' : ''}`}
                    style={{ transform: `translateY(${8 + index * TASK_CARD_STEP}px)` }}
                  >
                    <span className="landing-demo-task-num">{index + 1}</span>
                    <div className="landing-demo-task-row">
                      <span className="landing-demo-task-title">{task.title}</span>
                      <div className="landing-demo-task-pills">
                        <span className="landing-demo-pill" style={{ color: ENERGY_COLOR[task.energy] }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M7 2v11h3v9l7-12h-4l4-8z" />
                          </svg>
                        </span>
                        <span className="landing-demo-pill" style={{ color: PRIORITY_COLOR[task.priority] }}>★</span>
                        <span className="landing-demo-pill">{timeFrame(task)}</span>
                        <span className="landing-demo-pill">{formatDeadline(task.deadline)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className={`landing-demo-handle${step.id === 'open' ? ' is-clicking' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </div>

        <div className="landing-demo-window">
          <div className="calendar-header">
            <span className="calendar-brand-logo">
              <img src={aridiaLogo} alt="" width={LOGO_WIDTH} height={LOGO_HEIGHT} />
            </span>
            <div
              className="calendar-controls"
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 248,
                display: 'flex',
                justifyContent: 'center',
                zIndex: 10,
              }}
            >
              <button type="button" tabIndex={-1}>Day</button>
              <button type="button" className="active" tabIndex={-1}>Week</button>
              <button type="button" tabIndex={-1}>Month</button>
              <button type="button" tabIndex={-1}>Year</button>
            </div>
            <input
              className="calendar-search"
              type="text"
              placeholder="Search tasks..."
              readOnly
              tabIndex={-1}
            />
          </div>

          <div className="landing-demo-week">
            <div className="calendar-nav-bar">
              <span className="calendar-nav-arrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </span>
              <span className="calendar-nav-arrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </span>
            </div>

            <div className="landing-demo-week-head">
              <div className="day-header time-column" />
              {weekDays.map((date) => (
                <div
                  key={formatDateKey(date)}
                  className={isToday(date) ? 'day-header current-day-header' : 'day-header'}
                >
                  <div className="weekday-label">{format(date, 'EEE')}</div>
                  <div className="day-number">{format(date, 'd')}</div>
                </div>
              ))}
            </div>

            <div className="landing-demo-week-body">
              <div className="landing-demo-time-col">
                {HOURS.map((hour) => (
                  <div key={hour} className="calendar-cell time-column" style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}>
                    {hourLabel(hour)}
                  </div>
                ))}
              </div>
              {weekDays.map((date) => {
                const key = formatDateKey(date);
                const dayItems = calendarItems.filter((item) => item.deadline === key);
                const todayCol = isToday(date);
                return (
                  <div
                    key={key}
                    className={`landing-demo-day-col${todayCol ? ' current-day-col' : ''}`}
                  >
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="calendar-cell"
                        style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}
                      />
                    ))}
                    {todayCol && nowTop != null && (
                      <div className="current-time-indicator landing-demo-now" style={{ top: nowTop }}>
                        <div className="current-time-line" />
                      </div>
                    )}
                    {dayItems.map((item) => {
                      const geo = blockMetrics(item);
                      const placedLab = item.id === PLACE_ID;
                      return (
                        <div
                          key={item.id}
                          className={`calendar-time-block${placedLab ? ' landing-demo-lab' : ''}${placedLab && step.placed ? ' is-placed' : ''}`}
                          style={{
                            position: 'absolute',
                            left: 4,
                            right: 4,
                            width: 'auto',
                            top: geo.top,
                            height: geo.height,
                            background: getItemColor(item),
                            borderRadius: 8,
                            color: '#fff',
                            padding: '6px 7px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start',
                            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.15)',
                            overflow: 'hidden',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            lineHeight: 1.2,
                            zIndex: 5,
                          }}
                        >
                          <StackedBlockLabel
                            title={item.title}
                            timeText={formatShortTimeRange(item.startTime, item.endTime)}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p className={`landing-demo-caption${step.caption ? ' is-on' : ''}`}>{step.caption || '\u00a0'}</p>
    </div>
  );
}
