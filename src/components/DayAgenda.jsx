import { useState } from 'react';
import { createPortal } from 'react-dom';
import TaskCreationCard from './TaskCreationCard';
import TaskActionsDropdown from './TaskActionsDropdown';
import {
  formatItemTime,
  getItemColor,
  getItemTitle,
  startOfDay,
} from '../utils/calendarItems';

function PriorityLabel({ priority }) {
  if (priority >= 4) return <span className="day-agenda-priority high">High</span>;
  if (priority === 3) return <span className="day-agenda-priority medium">Med</span>;
  if (priority) return <span className="day-agenda-priority low">Low</span>;
  return null;
}

function AgendaRow({
  item,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  onUpdateStatus,
  onAutoSchedule,
  onQuickMove,
  onExtendDuration,
}) {
  const completed = item.status === 'completed';
  return (
    <div
      className={`day-agenda-row${isActive ? ' is-active' : ''}${completed ? ' is-completed' : ''}`}
      onClick={() => onSelect?.(item)}
    >
      <span className="day-agenda-swatch" style={{ background: getItemColor(item) }} />
      <div className="day-agenda-row-main">
        <div className="day-agenda-row-title">{getItemTitle(item)}</div>
        <div className="day-agenda-row-meta">
          <span>{formatItemTime(item)}</span>
          <PriorityLabel priority={item.priority} />
          {item.type === 'event' ? <span className="day-agenda-type">Event</span> : null}
        </div>
      </div>
      <div className="day-agenda-row-actions" onClick={(e) => e.stopPropagation()}>
        {onEdit && (
          <button
            type="button"
            className="day-agenda-icon-btn task-edit-btn"
            title="Edit"
            onClick={() => onEdit(item)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
          </button>
        )}
        <button
          type="button"
          className={`day-agenda-icon-btn task-complete-btn${completed ? ' selected' : ''}`}
          title="Complete"
          onClick={() => onUpdateStatus?.(item.id, completed ? 'active' : 'completed')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
        </button>
        <button
          type="button"
          className="day-agenda-icon-btn task-delete-btn"
          title="Delete"
          onClick={() => onDelete?.(item.id)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
          </svg>
        </button>
        <div className="day-agenda-dropdown-wrap">
          <TaskActionsDropdown
            task={item}
            onAutoSchedule={onAutoSchedule && item.type === 'task' ? onAutoSchedule : null}
            onQuickMove={onQuickMove}
            onExtendDuration={onExtendDuration}
            isTask={item.type !== 'event'}
          />
        </div>
      </div>
    </div>
  );
}

export default function DayAgenda({
  day,
  scheduled = [],
  unscheduled = [],
  highlightedId = null,
  onSelectItem,
  onAdd,
  onEdit,
  onDelete,
  onUpdateStatus,
  onAutoSchedule,
  onQuickMove,
  onExtendDuration,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const dayStart = startOfDay(day);

  const openCreate = () => {
    setShowCreate(true);
  };

  const renderRow = (item) => (
    <AgendaRow
      key={item.id}
      item={item}
      isActive={highlightedId === item.id}
      onSelect={onSelectItem}
      onEdit={onEdit}
      onDelete={onDelete}
      onUpdateStatus={onUpdateStatus}
      onAutoSchedule={onAutoSchedule}
      onQuickMove={onQuickMove}
      onExtendDuration={onExtendDuration}
    />
  );

  return (
    <aside className="day-agenda">
      <div className="day-agenda-toolbar">
        <button type="button" className="day-agenda-add-btn" onClick={openCreate}>
          + Add
        </button>
      </div>

      <section className="day-agenda-section">
        <h3 className="day-agenda-section-title">Scheduled</h3>
        {scheduled.length === 0 ? (
          <p className="day-agenda-empty">No timed items</p>
        ) : (
          scheduled.map(renderRow)
        )}
      </section>

      <section className="day-agenda-section">
        <h3 className="day-agenda-section-title">Unscheduled</h3>
        {unscheduled.length === 0 ? (
          <p className="day-agenda-empty">Nothing waiting to be timed</p>
        ) : (
          unscheduled.map(renderRow)
        )}
      </section>

      {showCreate && createPortal(
        <div className="day-agenda-create-overlay" onClick={() => setShowCreate(false)}>
          <div className="day-agenda-create-card" onClick={(e) => e.stopPropagation()}>
            <TaskCreationCard
              showPlusCircle={false}
              onCancel={() => setShowCreate(false)}
              onAdd={(task) => {
                if (task.startTime && task.endTime && task.startTime === task.endTime) return;
                onAdd?.(task);
                setShowCreate(false);
              }}
              defaultDeadline={dayStart}
              defaultStartTime={(() => {
                const d = new Date(dayStart);
                d.setHours(9, 0, 0, 0);
                return d;
              })()}
              defaultEndTime={(() => {
                const d = new Date(dayStart);
                d.setHours(10, 0, 0, 0);
                return d;
              })()}
            />
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
}
