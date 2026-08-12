import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './TaskEventForm.css';

const PRIORITY_LABELS = [null, 'Very Low', 'Low', 'Medium', 'High', 'Very High'];
const ENERGY_LABELS = [null, 'Light', 'Easy', 'Moderate', 'Hard', 'Intense'];

// Task type colors
const TASK_TYPE_COLORS = {
  Work: '#ff6b81', // light red
  School: '#4fc3f7',
  Extra: '#ffb86b',
  Entertainment: '#00bfae',
};
const DEFAULT_TASK_TYPES = ['Work', 'School', 'Extra', 'Entertainment'];

const DatePillsInput = React.forwardRef(({ value, onClick, isDatePickerOpen }, ref) => {
  let mm = '', dd = '', yyyy = '';
  if (value) {
    const d = new Date(value);
    if (!isNaN(d)) {
      mm = String(d.getMonth() + 1);
      dd = String(d.getDate());
      yyyy = String(d.getFullYear());
    }
  }
  
  const handleClick = (e) => {
    e.target.blur();
    onClick(e);
  };
  
  return (
    <div className="pill-row pill-row-datepicker" ref={ref}>
      <span
        className={`pill pill-date pill-date-trigger${isDatePickerOpen ? ' active' : ''}`}
        onClick={handleClick}
        tabIndex={0}
        role="button"
        title="Pick a date"
      >{mm || 'MM'}</span>
      <span
        className={`pill pill-date pill-date-trigger${isDatePickerOpen ? ' active' : ''}`}
        onClick={handleClick}
        tabIndex={0}
        role="button"
        title="Pick a date"
      >{dd || 'DD'}</span>
      <span
        className={`pill pill-date pill-date-trigger pill-year${isDatePickerOpen ? ' active' : ''}`}
        onClick={handleClick}
        tabIndex={0}
        role="button"
        title="Pick a date"
      >{yyyy || 'YYYY'}</span>
    </div>
  );
});

const formatTime = (date, mode = '24') => {
  if (!date) return '--:--';
  let hours = date.getHours();
  let minutes = date.getMinutes();
  if (mode === '12') {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${String(minutes).padStart(2, '0')} ${ampm}`;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Circular Time Picker Component (simplified version)
const CircularTimePicker = ({ value, onChange, onClose, anchorRef, open, timePickerTarget }) => {
  const [step, setStep] = useState('hour');
  const [selectedHour, setSelectedHour] = useState(value ? value.getHours() : 12);
  const [selectedMinute, setSelectedMinute] = useState(value ? value.getMinutes() : 0);
  const [position, setPosition] = useState(null);
  const pickerRef = useRef(null);
  const [isPM, setIsPM] = useState(selectedHour >= 12);
  
  const hours = isPM ? Array.from({length: 12}, (_, i) => i + 12) : Array.from({length: 12}, (_, i) => i);
  const minuteLabels = Array.from({length: 12}, (_, i) => i*5);

  useEffect(() => {
    if (open && anchorRef.current && !position) {
      const timer = setTimeout(() => {
        if (pickerRef.current) {
          const anchorRect = anchorRef.current.getBoundingClientRect();
          const pickerRect = pickerRef.current.getBoundingClientRect();
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const margin = 8;
          const pickerWidth = pickerRect.width;
          const pickerHeight = pickerRect.height;
          
          let finalTop, finalLeft;
          let flippedY = false;
          
          // Simple vertical positioning: prefer below, fallback to above
          const posBelow = anchorRect.bottom + margin;
          const posAbove = anchorRect.top - pickerHeight - margin;
          const fitsBelow = posBelow + pickerHeight <= vh - margin;
          const fitsAbove = posAbove >= margin;
          
          if (fitsBelow) {
            finalTop = posBelow;
            flippedY = false;
          } else if (fitsAbove) {
            finalTop = posAbove;
            flippedY = true;
          } else {
            finalTop = Math.max(margin, Math.min(vh - pickerHeight - margin, posBelow));
            flippedY = false;
          }
          
          // Simple horizontal positioning: center on anchor, clamp to viewport
          finalLeft = anchorRect.left + (anchorRect.width / 2) - (pickerWidth / 2);
          if (finalLeft + pickerWidth > vw - margin) {
            finalLeft = vw - pickerWidth - margin;
          }
          if (finalLeft < margin) {
            finalLeft = margin;
          }
          
          setPosition({ 
            top: finalTop + window.scrollY, 
            left: finalLeft + window.scrollX 
          });
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    
    if (!open && position) {
      setPosition(null);
    }
  }, [open, anchorRef, position]);

  const getCirclePos = (idx, total, radius) => {
    const angle = (idx / total) * 2 * Math.PI - Math.PI/2;
    return {
      left: `${50 + radius * Math.cos(angle)}%`,
      top: `${50 + radius * Math.sin(angle)}%`,
      transform: 'translate(-50%, -50%)',
      position: 'absolute',
      pointerEvents: 'none',
    };
  };

  const handleHourSelect = (h) => {
    setSelectedHour(h);
    setStep('minute');
  };

  const handleMinuteSelect = (m) => {
    setSelectedMinute(m);
    const d = new Date();
    d.setHours(selectedHour, m, 0, 0);
    onChange(d);
    onClose();
  };

  const handleAMPMToggle = (newIsPM) => {
    setIsPM(newIsPM);
    let newHour;
    if (newIsPM) {
      newHour = selectedHour < 12 ? selectedHour + 12 : selectedHour;
    } else {
      newHour = selectedHour >= 12 ? selectedHour - 12 : selectedHour;
    }
    setSelectedHour(newHour);
  };

  const pickerStyle = position
    ? {
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 9999,
        background: 'transparent',
      }
    : {
        position: 'absolute',
        top: '-9999px',
        left: '-9999px',
        visibility: 'hidden',
      };

  const picker = (
    <div 
      ref={pickerRef} 
      className="custom-time-picker-modal" 
      style={pickerStyle} 
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="circular-time-picker light-theme">
        <div className="picker-display" style={{gap: '0.2em', display: 'flex', alignItems: 'center'}}>
          <input
            className={`picker-input${step === 'hour' ? ' active' : ''}`}
            type="text"
            value={selectedHour.toString().padStart(2, '0')}
            readOnly
            style={{
              width: '1.8em', 
              textAlign: 'center', 
              fontWeight: 700, 
              fontSize: '1.8rem', 
              color: '#6c63ff', 
              background: step === 'hour' ? '#edeaff' : 'transparent', 
              border: 'none', 
              outline: 'none', 
              borderRadius: '8px', 
              marginRight: '0.1em',
              transition: 'all 0.2s ease'
            }}
          />
          <span className="picker-colon" style={{fontSize: '1.8rem'}}>:</span>
          <input
            className={`picker-input${step === 'minute' ? ' active' : ''}`}
            type="text"
            value={selectedMinute.toString().padStart(2, '0')}
            readOnly
            style={{
              width: '1.8em', 
              textAlign: 'center', 
              fontWeight: 700, 
              fontSize: '1.8rem', 
              color: '#6c63ff', 
              background: step === 'minute' ? '#edeaff' : 'transparent', 
              border: 'none', 
              outline: 'none', 
              borderRadius: '8px', 
              marginLeft: '0.1em',
              marginRight: '0.5em',
              transition: 'all 0.2s ease'
            }}
          />
          {/* AM/PM Toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <button
              type="button"
              onClick={() => step === 'hour' && handleAMPMToggle(false)}
              disabled={step === 'minute'}
              style={{
                padding: '6px 8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                background: !isPM ? '#6c63ff' : '#e0e0e0',
                color: !isPM ? 'white' : '#666',
                cursor: step === 'hour' ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => step === 'hour' && handleAMPMToggle(true)}
              disabled={step === 'minute'}
              style={{
                padding: '6px 8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                background: isPM ? '#6c63ff' : '#e0e0e0',
                color: isPM ? 'white' : '#666',
                cursor: step === 'hour' ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              PM
            </button>
          </div>
        </div>
        <div className="picker-circle-container">
          {step === 'hour' ? (
            <div className="picker-circle">
              {hours.map((h, i) => (
                <button
                  key={h}
                  className={`picker-btn${selectedHour === h ? ' selected' : ''}`}
                  style={{...getCirclePos(i, 12, 40), fontSize: '0.9rem', width: 28, height: 28}}
                  onClick={() => handleHourSelect(h)}
                >{h}</button>
              ))}
            </div>
          ) : (
            <div className="picker-circle">
              {minuteLabels.map((m, i) => (
                <button
                  key={m}
                  className={`picker-btn${selectedMinute === m ? ' selected' : ''}`}
                  style={{...getCirclePos(i, 12, 40), fontSize: '0.9rem', width: 28, height: 28}}
                  onClick={() => handleMinuteSelect(m)}
                >{String(m).padStart(2,'0')}</button>
              ))}
            </div>
          )}
        </div>
        <div className="picker-actions">
          <button className="picker-cancel" onClick={onClose}>Cancel</button>
          <button className="picker-ok" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );

  if (!open) {
    return null;
  }
  return ReactDOM.createPortal(picker, document.body);
};

const TaskEventForm = ({ addTask, addEvent }) => {
  const [creationType, setCreationType] = useState('task'); // 'task' or 'event'
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState(null);
  const [priority, setPriority] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [taskType, setTaskType] = useState('Work');
  const [taskDuration, setTaskDuration] = useState(30);
  
  // Event-specific fields
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState(null);
  const startTimePillRef = useRef(null);
  const endTimePillRef = useRef(null);
  
  // Date picker state
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!name.trim() || !deadline) return;
    
    if (creationType === 'event') {
      if (!startTime || !endTime) return;
      
      // Compute endDeadline if endTime is less than startTime (cross-day)
      let endDeadline = null;
      const startHour = startTime.getHours();
      const startMinute = startTime.getMinutes();
      const endHour = endTime.getHours();
      const endMinute = endTime.getMinutes();
      if (endHour < startHour || (endHour === startHour && endMinute < startMinute)) {
        const endDateObj = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
        endDateObj.setDate(endDateObj.getDate() + 1);
        endDeadline = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      }
      
      const eventData = {
        name,
        description,
        month: deadline.getMonth() + 1,
        day: deadline.getDate(),
        year: deadline.getFullYear(),
        priority,
        deadline: `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}-${String(deadline.getDate()).padStart(2, '0')}`,
        startTime: startTime ? formatTime(startTime, '24') : null,
        endTime: endTime ? formatTime(endTime, '24') : null,
        endDeadline,
        taskType,
        type: 'event',
      };
      
      if (addEvent) {
        addEvent(eventData);
      }
    } else {
      const taskData = {
        name,
        description,
        month: deadline.getMonth() + 1,
        day: deadline.getDate(),
        year: deadline.getFullYear(),
        priority,
        energy,
        deadline: `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}-${String(deadline.getDate()).padStart(2, '0')}`,
        duration: taskDuration,
        taskType,
        type: 'task',
      };
      
      if (addTask) {
        addTask(taskData);
      }
    }
    
    // Reset form
    setName('');
    setDescription('');
    setDeadline(null);
    setPriority(3);
    setEnergy(3);
    setStartTime(null);
    setEndTime(null);
    setTaskDuration(30);
  };

  return (
    <div style={{
      marginBottom: '2rem',
      padding: '1rem',
      background: 'rgba(160, 132, 232, 0.1)',
      borderRadius: '8px',
      border: '1px solid rgba(160, 132, 232, 0.2)'
    }}>
      {/* Event/Task Toggle */}
      <div style={{
        display: 'flex',
        background: '#2e0066',
        borderRadius: '999px',
        padding: '0.1rem',
        border: '1px solid #a084e8',
        marginBottom: '1rem'
      }}>
        <button
          onClick={() => { setCreationType('task'); setShowTimePicker(false); }}
          style={{
            background: creationType === 'task' ? 'linear-gradient(135deg, #a084e8 0%, #8b5cf6 100%)' : 'transparent',
            color: creationType === 'task' ? 'white' : '#a084e8',
            border: 'none',
            borderRadius: '999px',
            padding: '0.2rem 0.5rem',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            outline: 'none',
            caretColor: 'transparent'
          }}
        >
          Task
        </button>
        <button
          onClick={() => { setCreationType('event'); setShowTimePicker(false); }}
          style={{
            background: creationType === 'event' ? 'linear-gradient(135deg, #a084e8 0%, #8b5cf6 100%)' : 'transparent',
            color: creationType === 'event' ? 'white' : '#a084e8',
            border: 'none',
            borderRadius: '999px',
            padding: '0.2rem 0.5rem',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            outline: 'none',
            caretColor: 'transparent'
          }}
        >
          Event
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Name Input */}
        <div>
          <input
            type="text"
            placeholder={`Enter ${creationType} name...`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.875rem',
              borderRadius: '8px',
              border: '1px solid #a084e8',
              background: '#2e0066',
              color: 'white',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
          />
        </div>

        {/* Description Input */}
        <div>
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: '100%',
              padding: '0.875rem',
              borderRadius: '8px',
              border: '1px solid #a084e8',
              background: '#2e0066',
              color: 'white',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
          />
        </div>

        {/* Date and Type Row */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Date Picker */}
          <div style={{ flex: '1', minWidth: '150px' }}>
            <DatePicker
              selected={deadline}
              onChange={date => setDeadline(date)}
              customInput={<DatePillsInput isDatePickerOpen={isDatePickerOpen} />}
              calendarClassName="custom-datepicker-calendar"
              dropdownMode="select"
              showPopperArrow={false}
              popperPlacement="bottom-start"
              portalId={null}
              popperClassName="aridia-datepicker-popper"
              open={isDatePickerOpen}
              onCalendarOpen={() => { setIsDatePickerOpen(true); setShowTimePicker(false); }}
              onCalendarClose={() => { setIsDatePickerOpen(false); }}
              onSelect={() => setIsDatePickerOpen(false)}
              onClickOutside={() => { setIsDatePickerOpen(false); }}
              onChangeRaw={e => e.preventDefault()}
              closeOnScroll={true}
              onInputClick={() => { setIsDatePickerOpen(true); setShowTimePicker(false); }}
              shouldCloseOnSelect={true}
            />
          </div>

          {/* Task Type */}
          <div style={{ flex: '1', minWidth: '150px' }}>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '8px',
                border: '1px solid #a084e8',
                background: '#2e0066',
                color: 'white',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
            >
              {DEFAULT_TASK_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

         {/* Time/Duration Row */}
         {creationType === 'event' ? (
           <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
             {/* Start Time */}
             <div style={{ flex: '0.165', minWidth: '40px' }}>
               <span
                 className={`pill pill-time pill-time-trigger${showTimePicker && timePickerTarget === 'start' ? ' active' : ''}`}
                 tabIndex={0}
                 role="button"
                 title="Pick start time"
                 ref={startTimePillRef}
                 onClick={() => { 
                   setShowTimePicker(true); 
                   setTimePickerTarget('start'); 
                 }}
               >
                 {startTime ? formatTime(startTime, '24') : 'Start'}
               </span>
             </div>

             {/* End Time */}
             <div style={{ flex: '0.165', minWidth: '40px' }}>
               <span
                 className={`pill pill-time pill-time-trigger${showTimePicker && timePickerTarget === 'end' ? ' active' : ''}`}
                 tabIndex={0}
                 role="button"
                 title="Pick end time"
                 ref={endTimePillRef}
                 onClick={() => { 
                   setShowTimePicker(true); 
                   setTimePickerTarget('end'); 
                 }}
               >
                 {endTime ? formatTime(endTime, '24') : 'End'}
               </span>
             </div>
           </div>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Duration */}
            <div style={{ flex: '1', minWidth: '120px' }}>
              <select
                value={taskDuration}
                onChange={(e) => setTaskDuration(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  borderRadius: '8px',
                  border: '1px solid #a084e8',
                  background: '#2e0066',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
                <option value={240}>4 hours</option>
              </select>
            </div>
          </div>
        )}

        {/* Priority and Energy Row */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Priority */}
          <div style={{ flex: '1', minWidth: '120px' }}>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '8px',
                border: '1px solid #a084e8',
                background: '#2e0066',
                color: 'white',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
            >
              {[1, 2, 3, 4, 5].map(val => (
                <option key={val} value={val}>★ {PRIORITY_LABELS[val]}</option>
              ))}
            </select>
          </div>

          {/* Energy (only for tasks) */}
          {creationType === 'task' && (
            <div style={{ flex: '1', minWidth: '120px' }}>
              <select
                value={energy}
                onChange={(e) => setEnergy(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  borderRadius: '8px',
                  border: '1px solid #a084e8',
                  background: '#2e0066',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
              >
                {[1, 2, 3, 4, 5].map(val => (
                  <option key={val} value={val}>⚡ {ENERGY_LABELS[val]}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          style={{
            background: '#a084e8',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.875rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s',
            fontFamily: 'Karla, sans-serif'
          }}
        >
          Add {creationType === 'event' ? 'Event' : 'Task'}
        </button>
      </form>

      {/* Time Picker */}
      {showTimePicker && (
        <CircularTimePicker
          value={timePickerTarget === 'start' ? startTime : endTime}
          onChange={d => {
            if (timePickerTarget === 'start') {
              setStartTime(d);
            } else {
              setEndTime(d);
            }
          }}
          onClose={() => { 
            setShowTimePicker(false); 
          }}
          anchorRef={timePickerTarget === 'start' ? startTimePillRef : endTimePillRef}
          open={showTimePicker}
          timePickerTarget={timePickerTarget}
        />
      )}
    </div>
  );
};

export default TaskEventForm;
