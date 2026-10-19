// src/components/TaskForm.jsx - Updated for debugging
import React, { useState, useRef, forwardRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './TaskForm.css';

// Circular Time Picker Component
const CircularTimePicker = ({ value, onChange, onClose, anchorRef, open, timePickerTarget }) => {
  // Helper to get current time rounded up to nearest hour
  const getCurrentTimeRoundedUp = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    // If there are any minutes, round up to the next hour
    const roundedHour = currentMinutes > 0 ? currentHour + 1 : currentHour;
    const roundedTime = new Date();
    roundedTime.setHours(roundedHour, 0, 0, 0);
    return roundedTime;
  };
  // Set default value to current time rounded up for start time, or 00:00 for end time
  const getDefaultValue = () => {
    if (value) return value;
    if (timePickerTarget === 'start') {
      return getCurrentTimeRoundedUp();
    }
    return new Date(0, 0, 0, 0, 0, 0, 0); // 00:00 for end time
  };
  const [step, setStep] = useState('hour'); // 'hour' or 'minute'
  const [selectedHour, setSelectedHour] = useState(getDefaultValue().getHours());
  const [selectedMinute, setSelectedMinute] = useState(getDefaultValue().getMinutes());
  const [hourInput, setHourInput] = useState(selectedHour.toString().padStart(2, '0'));
  const [minuteInput, setMinuteInput] = useState(selectedMinute.toString().padStart(2, '0'));
  const [dragging, setDragging] = useState(false);
  const circleRef = useRef(null);

  const [position, setPosition] = useState(null);
  const [flippedX, setFlippedX] = useState(false);
  const [flippedY, setFlippedY] = useState(false);
  const pickerRef = useRef(null);
  const [pendingHour, setPendingHour] = useState(selectedHour);
  const [pendingMinute, setPendingMinute] = useState(selectedMinute);
  const [hoveredValue, setHoveredValue] = useState(null);
  const [hoveredPosition, setHoveredPosition] = useState(null); // For visual feedback
  const [lastDraggedMinute, setLastDraggedMinute] = useState(null); // Track last dragged minute
  // Simplified validation states
  const [hourInputError, setHourInputError] = useState(false);
  const [minuteInputError, setMinuteInputError] = useState(false);
  const [hourInputFocused, setHourInputFocused] = useState(false);
  const [minuteInputFocused, setMinuteInputFocused] = useState(false);
  // Simplified interaction tracking - single object instead of multiple booleans
  const [interactionState, setInteractionState] = useState({
    hasUserInput: false,
    isAutomatic: false
  });
  // Track if component is mounted
  const isMountedRef = useRef(true);
  
  // AM/PM state - determine initial value from selected hour
  const [isPM, setIsPM] = useState(selectedHour >= 12);
  
  // Dynamic hour arrays based on AM/PM
  const hours = isPM ? Array.from({length: 12}, (_, i) => i + 12) : Array.from({length: 12}, (_, i) => i);
  const minuteLabels = Array.from({length: 12}, (_, i) => i*5); // 0, 5, ..., 55
  // Sync selected values with value prop
  useEffect(() => {
    if (value) {
      const newHour = value.getHours();
      const newMinute = value.getMinutes();
      setSelectedHour(newHour);
      setSelectedMinute(newMinute);
      setPendingHour(newHour);
      setPendingMinute(newMinute);
      // Sync AM/PM state
      setIsPM(newHour >= 12);
    }
  }, [value]);
  // Sync input fields with selected values
  useEffect(() => { 
    if (!hourInputFocused) {
      setHourInput(selectedHour.toString().padStart(2, '0')); 
    }
  }, [selectedHour, hourInputFocused]);
  useEffect(() => { 
    if (!minuteInputFocused) {
      setMinuteInput(selectedMinute.toString().padStart(2, '0')); 
    }
  }, [selectedMinute, minuteInputFocused]);
  // Update input display based on hover state
  useEffect(() => {
    if (step === 'hour' && hoveredValue !== null && !hourInputFocused) {
      setHourInput(hoveredValue.toString().padStart(2, '0'));
    } else if (step === 'hour' && !hourInputFocused) {
      setHourInput(selectedHour.toString().padStart(2, '0'));
    }
  }, [hoveredValue, step, selectedHour, hourInputFocused]);
  useEffect(() => {
    if (step === 'minute' && hoveredValue !== null && !minuteInputFocused) {
      setMinuteInput(hoveredValue.toString().padStart(2, '0'));
    } else if (step === 'minute' && !minuteInputFocused) {
      setMinuteInput(selectedMinute.toString().padStart(2, '0'));
    }
  }, [hoveredValue, step, selectedMinute, minuteInputFocused]);
  // Reset step to 'hour' when switching between start/end time
  useEffect(() => {
    setStep('hour');
  }, [timePickerTarget]);

  // Add keyboard event listener for Escape key and click-away functionality
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);
  // Set position and flip/adjust if needed
  useEffect(() => {
    if (open && anchorRef.current && !position) {
      // Use a timeout to ensure the picker has been rendered and measured by the browser
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
            // If neither fits, prefer below but clamp to viewport
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
          
          // Apply the position
          setPosition({ 
            top: finalTop + window.scrollY, 
            left: finalLeft + window.scrollX 
          });
          setFlippedX(false); // No horizontal flipping needed
          setFlippedY(flippedY);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    // Reset position and flip state when picker closes
    if (!open && position) {
      setPosition(null);
      setFlippedX(false);
      setFlippedY(false);
    }
  }, [open, anchorRef, position]);
  // Helper to position numbers in a circle
  const getCirclePos = (idx, total, radius) => {
    const angle = (idx / total) * 2 * Math.PI - Math.PI/2;
    return {
      left: `${50 + radius * Math.cos(angle)}%`,
      top: `${50 + radius * Math.sin(angle)}%`,
      transform: 'translate(-50%, -50%)',
      position: 'absolute',
      pointerEvents: 'auto',
    };
  };

  const updateHourSelection = useCallback((h) => {
    setSelectedHour(h);
    setHourInput(h.toString().padStart(2, '0'));
    setPendingHour(h);
    // Update the time pill in real-time
    const d = new Date();
    d.setHours(h, selectedMinute, 0, 0);
    onChange(d);
  }, [selectedMinute, onChange]);

  // Handle AM/PM toggle
  const handleAMPMToggle = useCallback((newIsPM) => {
    setIsPM(newIsPM);
    
    // Convert current hour to new AM/PM range
    let newHour;
    if (newIsPM) {
      // Converting to PM: if current hour is 0-11, add 12; if 12-23, keep as is
      newHour = selectedHour < 12 ? selectedHour + 12 : selectedHour;
    } else {
      // Converting to AM: if current hour is 12-23, subtract 12; if 0-11, keep as is
      newHour = selectedHour >= 12 ? selectedHour - 12 : selectedHour;
    }
    
    setSelectedHour(newHour);
    setHourInput(newHour.toString().padStart(2, '0'));
    setPendingHour(newHour);
    
    // Update the time pill in real-time
    const d = new Date();
    d.setHours(newHour, selectedMinute, 0, 0);
    onChange(d);
  }, [selectedHour, selectedMinute, onChange]);
  const handleHourSelect = useCallback((h) => {
    updateHourSelection(h);
    setStep('minute');
    // Mark as user inputted and reset automatic flag
    setInteractionState({ hasUserInput: true, isAutomatic: false });
  }, [updateHourSelection]);
  const handleMinuteSelect = useCallback((m, eventType = 'click', event = null) => {
    setSelectedMinute(m);
    setMinuteInput(m.toString().padStart(2, '0'));
    setPendingMinute(m);
    const d = new Date();
    d.setHours(selectedHour, m, 0, 0);
    onChange(d);
    // Mark as user inputted and reset automatic flag
    setInteractionState({ hasUserInput: true, isAutomatic: false });
    // Auto-advance for start time on mouse interaction
    if (timePickerTarget === 'start' && eventType === 'mouse') {
      // For event form, we'll just close the picker after selecting end time
      onClose();
    }
    // For end time, close the picker on mouse interaction
    if (timePickerTarget === 'end' && eventType === 'mouse') {
      if (event) { event.preventDefault(); event.stopPropagation(); }
      onClose();
    }
    // Don't call onClose for typing
  }, [selectedHour, onChange, timePickerTarget, onClose]);
  // Calculate minute from mouse position
  const calculateMinuteFromPosition = useCallback((e) => {
    if (!circleRef.current) return null;
    const rect = circleRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width/2;
    const y = e.clientY - rect.top - rect.height/2;
    const angle = Math.atan2(y, x) + Math.PI/2;
    let minute = Math.round(((angle + 2*Math.PI) % (2*Math.PI)) / (2*Math.PI) * 60) % 60;
    return minute;
  }, []);
  // Calculate hour from mouse position
  const calculateHourFromPosition = useCallback((e) => {
    if (!circleRef.current) return null;
    const rect = circleRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width/2;
    const y = e.clientY - rect.top - rect.height/2;
    const angle = Math.atan2(y, x) + Math.PI/2;
    const r = Math.sqrt(x*x + y*y);
    
    // Only work if click is within the circle
    if (r > rect.width * 0.4) return null;
    
    let idx = Math.round(((angle + 2*Math.PI) % (2*Math.PI)) / (2*Math.PI) * 12) % 12;
    let h = hours[idx];
    return h;
  }, [hours]);
  // Handle mouse move for hover
  const handleCircleMouseMove = useCallback((e) => {
    if (step === 'hour') {
      const hour = calculateHourFromPosition(e);
      if (hour !== null) {
        setHoveredValue(hour);
        setHoveredPosition({ type: 'hour', value: hour });
      }
    } else {
      const minute = calculateMinuteFromPosition(e);
      if (minute !== null) {
        setHoveredValue(minute);
        setHoveredPosition({ type: 'minute', value: minute });
      }
    }
  }, [step, calculateHourFromPosition, calculateMinuteFromPosition]);
  // Handle mouse leave
  const handleCircleMouseLeave = useCallback(() => {
    setHoveredValue(null);
    setHoveredPosition(null);
  }, []);
  // Drag logic
  const handleDrag = useCallback((e) => {
    if (!circleRef.current) return;
    const rect = circleRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left - rect.width/2;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top - rect.height/2;
    const angle = Math.atan2(y, x) + Math.PI/2;
    if (step === 'hour') {
      const r = Math.sqrt(x*x + y*y);
      // Only work if click is within the circle
      if (r > rect.width * 0.4) return;
      
      let idx = Math.round(((angle + 2*Math.PI) % (2*Math.PI)) / (2*Math.PI) * 12) % 12;
      let h = hours[idx];
      updateHourSelection(h);
    } else {
      let minute = Math.round(((angle + 2*Math.PI) % (2*Math.PI)) / (2*Math.PI) * 60) % 60;
      setLastDraggedMinute(minute); // Track last dragged minute
      handleMinuteSelect(minute); // This will update the pill in real time, but not close the picker
    }
  }, [step, hours, updateHourSelection, handleMinuteSelect]);
  const handleMouseDown = useCallback((e) => { setDragging(true); handleDrag(e); }, [handleDrag]);
  const handleMouseMove = useCallback((e) => { if (dragging) handleDrag(e); }, [dragging, handleDrag]);
  const handleMouseUp = useCallback(() => {
    if (dragging && step === 'hour') {
      setStep('minute');
    }
    // Auto-advance to end time if we just finished dragging on minute step for start time
    if (dragging && step === 'minute' && timePickerTarget === 'start') {
      onClose();
    }
    // For end time, close the picker after drag on minute selection
    if (dragging && step === 'minute' && timePickerTarget === 'end' && lastDraggedMinute !== null) {
      handleMinuteSelect(lastDraggedMinute, 'mouse');
    }
    setDragging(false);
    setLastDraggedMinute(null); // Reset
  }, [dragging, step, timePickerTarget, onClose, handleMinuteSelect, lastDraggedMinute]);
  const handleTouchStart = useCallback((e) => { setDragging(true); handleDrag(e); }, [handleDrag]);
  const handleTouchMove = useCallback((e) => { if (dragging) handleDrag(e); }, [dragging, handleDrag]);
  const handleTouchEnd = useCallback(() => {
    if (dragging && step === 'hour') {
      setStep('minute');
    }
    // Auto-advance to end time if we just finished dragging on minute step for start time (touch)
    if (dragging && step === 'minute' && timePickerTarget === 'start') {
      onClose();
    }
    // For end time, close the picker after drag on minute selection (touch)
    if (dragging && step === 'minute' && timePickerTarget === 'end' && lastDraggedMinute !== null) {
      handleMinuteSelect(lastDraggedMinute, 'mouse');
    }
    setDragging(false);
    setLastDraggedMinute(null); // Reset
  }, [dragging, step, timePickerTarget, onClose, handleMinuteSelect, lastDraggedMinute]);
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);
  const handleOK = () => {
    applyCurrentSelection();
    // If this is start time, auto-transition to end time
    if (timePickerTarget === 'start') {
      onClose();
    } else {
      // If this is end time, handle completion and close the picker
      onClose();
    }
  };
  // Helper function to apply current selection
  const applyCurrentSelection = useCallback(() => {
    if (selectedHour === '' || isNaN(selectedHour) || selectedHour < 0 || selectedHour > 23) return;
    if (selectedMinute === '' || isNaN(selectedMinute) || selectedMinute < 0 || selectedMinute > 59) return;
    const d = new Date();
    d.setHours(Number(selectedHour), Number(selectedMinute), 0, 0);
    onChange(d);
  }, [selectedHour, selectedMinute, onChange]);
  // Input handlers
  const handleHourInputChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2);
    setHourInput(val);
    setHourInputError(false); // Clear error when user types
    if (val === '') {
      setPendingHour('');
      setSelectedHour('');
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 23) {
      setPendingHour(num);
      setSelectedHour(num);
      // Update the time pill in real-time
      const d = new Date();
      d.setHours(num, selectedMinute, 0, 0);
      onChange(d);
    }
  };
  const handleMinuteInputChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2);
    setMinuteInput(val);
    setMinuteInputError(false); // Clear error when user types
    if (val === '') {
      setPendingMinute('');
      setSelectedMinute('');
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 59) {
      setPendingMinute(num);
      setSelectedMinute(num);
      // Update the time pill in real-time
      const d = new Date();
      d.setHours(selectedHour, num, 0, 0);
      onChange(d);
    }
  };
  // Handle input focus - always clear when clicked
  const handleHourInputFocus = () => {
    setStep('hour');
    setHourInputFocused(true);
    setHourInputError(false);
    // Always clear the input when clicked
    setHourInput('');
    // Mark as interacted
    setInteractionState(prev => ({ ...prev, hasUserInput: true }));
  };
  const handleMinuteInputFocus = () => {
    setStep('minute');
    setMinuteInputFocused(true);
    setMinuteInputError(false);
    // Always clear the input when clicked
    setMinuteInput('');
    // Mark as interacted
    setInteractionState(prev => ({ ...prev, hasUserInput: true }));
  };
  // Handle input blur - validate and apply
  const handleHourInputBlur = () => {
    setHourInputFocused(false);
    const val = hourInput.trim();
    if (val === '') {
      setHourInput(selectedHour.toString().padStart(2, '0'));
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0 || num > 23) {
      setHourInputError(true);
      setHourInput(selectedHour.toString().padStart(2, '0'));
      return;
    }
    // Valid value - apply it and mark as user input
    setSelectedHour(num);
    setHourInput(num.toString().padStart(2, '0'));
    const d = new Date();
    d.setHours(num, selectedMinute, 0, 0);
    onChange(d);
    // Mark as user inputted and reset automatic flag
    setInteractionState({ hasUserInput: true, isAutomatic: false });
  };
  const handleMinuteInputBlur = () => {
    setMinuteInputFocused(false);
    const val = minuteInput.trim();
    if (val === '') {
      setMinuteInput(selectedMinute.toString().padStart(2, '0'));
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0 || num > 59) {
      setMinuteInputError(true);
      setMinuteInput(selectedMinute.toString().padStart(2, '0'));
      return;
    }
    // Valid value - apply it and mark as user input
    setSelectedMinute(num);
    setMinuteInput(num.toString().padStart(2, '0'));
    const d = new Date();
    d.setHours(selectedHour, num, 0, 0);
    onChange(d);
    // Mark as user inputted and reset automatic flag
    setInteractionState({ hasUserInput: true, isAutomatic: false });
  };
  // Handle key press for Enter and Tab
  const handleHourInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleHourInputBlur();
      if (e.key === 'Tab') {
        // Focus minute input
        const minuteInputElement = document.querySelector('.picker-input[aria-label="Minute"]');
        if (minuteInputElement) {
          minuteInputElement.focus();
        }
      }
    }
  };
  const handleMinuteInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleMinuteInputBlur();
      // Auto-advance for start time, close for end time
      if (timePickerTarget === 'start') {
        onClose();
      } else {
        onClose();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleMinuteInputBlur();
      // For Tab key, just close the picker
      onClose();
    }
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
            className={`picker-input${step === 'hour' ? ' active' : ''}${hourInputError ? ' error' : ''}`}
            type="text"
            value={hourInput}
            onChange={handleHourInputChange}
            onFocus={handleHourInputFocus}
            onBlur={handleHourInputBlur}
            onKeyDown={handleHourInputKeyDown}
            maxLength={2}
            style={{
              width: '1.8em', 
              textAlign: 'center', 
              fontWeight: 700, 
              fontSize: '1.8rem', 
              color: '#6c63ff', 
              background: step === 'hour' ? '#edeaff' : 'transparent', 
              border: hourInputError ? '2px solid #ff1744' : 'none', 
              outline: 'none', 
              borderRadius: '8px', 
              marginRight: '0.1em',
              transition: 'all 0.2s ease'
            }}
            aria-label="Hour"
          />
          <span className="picker-colon" style={{fontSize: '1.8rem'}}>:</span>
          <input
            className={`picker-input${step === 'minute' ? ' active' : ''}${minuteInputError ? ' error' : ''}`}
            type="text"
            value={minuteInput}
            onChange={handleMinuteInputChange}
            onFocus={handleMinuteInputFocus}
            onBlur={handleMinuteInputBlur}
            onKeyDown={handleMinuteInputKeyDown}
            maxLength={2}
            style={{
              width: '1.8em', 
              textAlign: 'center', 
              fontWeight: 700, 
              fontSize: '1.8rem', 
              color: '#6c63ff', 
              background: step === 'minute' ? '#edeaff' : 'transparent', 
              border: minuteInputError ? '2px solid #ff1744' : 'none', 
              outline: 'none', 
              borderRadius: '8px', 
              marginLeft: '0.1em',
              marginRight: '0.5em',
              transition: 'all 0.2s ease'
            }}
            aria-label="Minute"
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
        <div
          className="picker-circle-container"
          ref={circleRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onMouseMove={handleCircleMouseMove}
          onMouseLeave={handleCircleMouseLeave}
        >
          {step === 'hour' ? (
            <div className="picker-circle">
              {/* Single ring: 0-11 for AM, 12-23 for PM */}
              {hours.map((h, i) => (
                <button
                  key={h}
                  className={`picker-btn${(hoveredValue !== null ? hoveredValue : selectedHour) === h ? ' selected' : ''}`}
                  style={{...getCirclePos(i, 12, 40), fontSize: '0.9rem', width: 28, height: 28}}
                  onClick={() => handleHourSelect(h)}
                  onMouseEnter={() => {
                    setHoveredValue(h);
                  }}
                  onMouseLeave={() => {
                    setHoveredValue(null);
                  }}
                >{h}</button>
              ))}
            </div>
          ) : (
            <div className="picker-circle">
              {/* Only label intervals of 5, but allow drag for any minute */}
              {minuteLabels.map((m, i) => (
                <button
                  key={m}
                  className={`picker-btn${(hoveredValue !== null ? hoveredValue : selectedMinute) === m ? ' selected' : ''}`}
                  style={{...getCirclePos(i, 12, 40), fontSize: '0.9rem', width: 28, height: 28}}
                  onClick={() => handleMinuteSelect(m)}
                  onMouseEnter={() => {
                    setHoveredValue(m);
                  }}
                  onMouseLeave={() => {
                    setHoveredValue(null);
                  }}
                  onMouseUp={e => handleMinuteSelect(m, 'mouse', e)}
                  onTouchEnd={e => handleMinuteSelect(m, 'mouse', e)}
                >{String(m).padStart(2,'0')}</button>
              ))}
            </div>
          )}
        </div>
        <div className="picker-actions">
          <button className="picker-cancel" onClick={onClose}>Cancel</button>
          <button className="picker-ok" onClick={handleOK}>OK</button>
        </div>
      </div>
    </div>
  );
  // Reset interaction tracking and automatic flags when picker closes
  useEffect(() => {
    if (!open) {
      setInteractionState({ hasUserInput: false, isAutomatic: false });
    }
  }, [open]);
  // Cleanup effect to track component mounting state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  // Only render the portal if the component is open and mounted
  if (!open || !isMountedRef.current) {
    return null;
  }
  return ReactDOM.createPortal(picker, document.body);
};

const TASKFORM_THEMES = {
  dashboard: {
    cardBg: 'rgba(160, 132, 232, 0.1)',
    cardBorder: '1px solid rgba(160, 132, 232, 0.2)',
    cardShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
    text: 'white',
    label: 'white',
    muted: '#a084e8',
    toggleBg: '#2e0066',
    toggleBorder: '#a084e8',
    inputBg: '#2e0066',
    inputText: 'white',
    inputBorder: '#a084e8',
    icon: '#a084e8',
    timePillBg: 'rgba(108, 99, 255, 0.6)',
    timePillText: '#fff',
    timePillHover: '#ddd6fe',
    timePillBorder: 'none',
    trackUnused: '#4b5563',
    cancelBorder: '#a084e8',
    cancelText: 'white',
    submitBg: '#6c63ff',
    submitHover: '#5b54e6',
    submitText: 'white',
    placeholder: '#9ca3af',
  },
  day: {
    cardBg: 'transparent',
    cardBorder: 'none',
    cardShadow: 'none',
    text: '#2e0066',
    label: '#2e0066',
    muted: '#2e0066',
    toggleBg: '#faf8ff',
    toggleBorder: '#e1e1e1',
    inputBg: '#faf8ff',
    inputText: '#2e0066',
    inputBorder: '#e1e1e1',
    icon: '#2e0066',
    timePillBg: '#faf8ff',
    timePillText: '#2e0066',
    timePillHover: '#faf8ff',
    timePillBorder: '1px solid #e1e1e1',
    trackUnused: '#e1e1e1',
    cancelBorder: '#e1e1e1',
    cancelText: '#2e0066',
    submitBg: '#2e0066',
    submitHover: '#3d1a7a',
    submitText: '#fff',
    placeholder: '#999',
  },
};

const DatePillsInput = forwardRef(({ value, onClick, isDatePickerOpen, onChange, placeholder, onBlur, hasError, onAutoComplete, palette = TASKFORM_THEMES.dashboard }, ref) => {
  const handleClick = (e) => {
    // Call the onClick prop that DatePicker expects
    if (onClick) {
      onClick(e);
    }
  };
  
  return (
    <div style={{ position: 'relative', width: '100%', display: 'block' }}>
      <input
        ref={ref}
        type="text"
        value={value || ''}
        onChange={onChange}
        onBlur={(e) => {
          const inputValue = e.target.value;
          
          // Call our auto-completion logic directly
          if (inputValue && inputValue.includes('/')) {
            const parts = inputValue.split('/');
            if (parts.length === 3) {
                          // Call the auto-completion function from parent
              if (onAutoComplete) {
                onAutoComplete(inputValue);
              }
            }
          }
          
          // Also call the DatePicker's onBlur if it exists
          if (onBlur) {
            onBlur(e);
          }
        }}
        placeholder={placeholder || "MM/DD/YYYY"}
        style={{
          width: '100%',
          padding: '0.875rem',
          paddingRight: '2.5rem', // Space for calendar icon
          borderRadius: '8px',
          border: hasError ? '2px solid #ff1744' : `1px solid ${palette.inputBorder}`,
          background: palette.inputBg,
          color: palette.inputText,
          fontSize: '0.9rem',
          fontFamily: 'inherit',
          fontWeight: 'inherit',
          outline: 'none',
          transition: 'border-color 0.2s ease',
          animation: hasError ? 'shake 0.3s ease-in-out' : 'none',
        }}
      />
      {!value && (
        <div style={{
          position: 'absolute',
          left: '0.875rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: palette.placeholder,
          fontSize: '0.9rem',
          pointerEvents: 'none',
          fontFamily: 'inherit'
        }}>
          MM/DD/YYYY
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        style={{
          position: 'absolute',
          right: '0.5rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem',
          color: palette.icon,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
        </svg>
      </button>
    </div>
  );
});

const ENERGY_LABELS = [null, 'Light', 'Easy', 'Moderate', 'Hard', 'Intense'];

function toDeadlineYmd(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'string' && value) return value;
  return null;
}

const TaskForm = ({
  addTask,
  defaultStartTime,
  defaultEndTime,
  defaultDeadline,
  onTimesChange,
  onCancel,
  variant,
  eventOnly = false,
}) => {
  const ui = TASKFORM_THEMES[variant] || TASKFORM_THEMES.dashboard;
  const isDay = variant === 'day';
  // Toggle state. Calendar create locks this to an event.
  const [creationType, setCreationType] = useState(eventOnly || defaultStartTime ? 'event' : 'task'); // 'task' or 'event'
  
  // Shared state
  const [name, setName] = useState('');
  const [taskType, setTaskType] = useState('Work');
  const [deadline, setDeadline] = useState(() => {
    const fromDefault = toDeadlineYmd(defaultDeadline);
    if (fromDefault) return fromDefault;
    // Initialize with current date in YYYY-MM-DD format
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  
  // Task-specific state
  const [energy, setEnergy] = useState(1);
  const [priority, setPriority] = useState(1);
  const [duration, setDuration] = useState('30');
  const [durationError, setDurationError] = useState(false);
  
  // Event-specific state
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(() => {
    if (defaultStartTime instanceof Date) return defaultStartTime;
    // Calculate the next 30-minute interval
    const now = new Date();
    const currentMinutes = now.getMinutes();
    const currentHour = now.getHours();
    
    // Round up to the next 30-minute interval
    let nextIntervalMinutes = Math.ceil(currentMinutes / 30) * 30;
    let nextIntervalHour = currentHour;
    
    // If we go past 60 minutes, increment the hour
    if (nextIntervalMinutes >= 60) {
      nextIntervalMinutes = 0;
      nextIntervalHour = (nextIntervalHour + 1) % 24;
    }
    
    const fallbackStart = new Date();
    fallbackStart.setHours(nextIntervalHour, nextIntervalMinutes, 0, 0);
    return fallbackStart;
  });
  const [endTime, setEndTime] = useState(() => {
    if (defaultEndTime instanceof Date) return defaultEndTime;
    // Calculate 1 hour after the default start time
    const now = new Date();
    const currentMinutes = now.getMinutes();
    const currentHour = now.getHours();
    
    // Round up to the next 30-minute interval
    let nextIntervalMinutes = Math.ceil(currentMinutes / 30) * 30;
    let nextIntervalHour = currentHour;
    
    // If we go past 60 minutes, increment the hour
    if (nextIntervalMinutes >= 60) {
      nextIntervalMinutes = 0;
      nextIntervalHour = (nextIntervalHour + 1) % 24;
    }
    
    // Add 1 hour to get end time
    const endHour = (nextIntervalHour + 1) % 24;
    
    const fallbackEnd = new Date();
    fallbackEnd.setHours(endHour, nextIntervalMinutes, 0, 0);
    return fallbackEnd;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState(null);
  const startTimePillRef = useRef(null);
  const endTimePillRef = useRef(null);

  // DatePicker states
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isDraggingDate, setIsDraggingDate] = useState(false);
  const [draggedDate, setDraggedDate] = useState(null);
  const [datePickerFlip, setDatePickerFlip] = useState({ flippedX: false, flippedY: false });
  const datePickerRef = useRef(null);
  
  // Drag states for sliders
  const [isDraggingEnergy, setIsDraggingEnergy] = useState(false);
  const [dragEnergyValue, setDragEnergyValue] = useState(energy);
  const [isDraggingPriority, setIsDraggingPriority] = useState(false);
  const [dragPriorityValue, setDragPriorityValue] = useState(priority);

  // Enhanced date validation and formatting
  const [dateInputError, setDateInputError] = useState(false);
  const [dateInputValue, setDateInputValue] = useState('');

  // Initialize dateInputValue when deadline changes
  useEffect(() => {
    if (deadline) {
      setDateInputValue(formatDateForDisplay(deadline));
    } else {
      setDateInputValue('');
    }
  }, [deadline]);

  const onTimesChangeRef = useRef(onTimesChange);
  onTimesChangeRef.current = onTimesChange;

  const defaultStartMs = defaultStartTime instanceof Date ? defaultStartTime.getTime() : null;
  const defaultEndMs = defaultEndTime instanceof Date ? defaultEndTime.getTime() : null;
  const defaultDeadlineKey = toDeadlineYmd(defaultDeadline);

  useEffect(() => {
    if (defaultStartMs != null) setStartTime(new Date(defaultStartMs));
    if (defaultEndMs != null) setEndTime(new Date(defaultEndMs));
  }, [defaultStartMs, defaultEndMs]);

  useEffect(() => {
    if (defaultDeadlineKey) setDeadline(defaultDeadlineKey);
  }, [defaultDeadlineKey]);

  useEffect(() => {
    onTimesChangeRef.current?.(startTime, endTime);
  }, [startTime, endTime]);

  // Reset dateInputValue when form is submitted
  const resetForm = () => {
    setName('');
    setDescription('');
    setEnergy(1);
    setPriority(1);
    setTaskType('Work');
    
    // Reset deadline to current date
    const today = new Date();
    const currentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setDeadline(currentDate);
    
    setDuration(30);
    
    // Reset to new default times
    const now = new Date();
    const currentMinutes = now.getMinutes();
    const currentHour = now.getHours();
    
    // Round up to the next 30-minute interval
    let nextIntervalMinutes = Math.ceil(currentMinutes / 30) * 30;
    let nextIntervalHour = currentHour;
    
    // If we go past 60 minutes, increment the hour
    if (nextIntervalMinutes >= 60) {
      nextIntervalMinutes = 0;
      nextIntervalHour = (nextIntervalHour + 1) % 24;
    }
    
    const defaultStartTime = new Date();
    defaultStartTime.setHours(nextIntervalHour, nextIntervalMinutes, 0, 0);
    
    const endHour = (nextIntervalHour + 1) % 24;
    const defaultEndTime = new Date();
    defaultEndTime.setHours(endHour, nextIntervalMinutes, 0, 0);
    
    setStartTime(defaultStartTime);
    setEndTime(defaultEndTime);
    setDateInputValue('');
    setDateInputError(false);
  };

  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    // Use local date methods to avoid timezone issues
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const formatDateForDisplay = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    // Use local date methods to avoid timezone issues
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formatDateForInputFromLocal = (date) => {
    if (!date) return '';
    // Extract year, month, day from the date object
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    const day = date.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const formatDateForDisplayFromLocal = (date) => {
    if (!date) return '';
    // Extract year, month, day from the date object
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    const day = date.getDate();
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
  };

  const createLocalDate = (year, month, day) => {
    // Create a date in local timezone without timezone conversion
    return new Date(year, month - 1, day, 12, 0, 0, 0); // Use noon to avoid DST issues
  };

  const createLocalDateFromString = (dateString) => {
    // Parse YYYY-MM-DD string and create local date
    const [year, month, day] = dateString.split('-').map(Number);
    return createLocalDate(year, month, day);
  };

  // Time formatting function for events
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

  const parseDateFromInput = (inputValue) => {
    if (!inputValue) return null;

    // Remove all non-numeric characters except slashes
    const cleanInput = inputValue.replace(/[^\d\/]/g, '');
    
    // Handle different input patterns
    const patterns = [
      // MM/DD/YY or MM/DD/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,
      // MM-DD-YY or MM-DD-YYYY  
      /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/,
      // YYYY-MM-DD
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    ];
    
    for (const pattern of patterns) {
      const match = cleanInput.match(pattern);
      if (match) {
        let month = parseInt(match[1], 10) - 1; // JS months are 0-indexed
        let day = parseInt(match[2], 10);
        let year = parseInt(match[3], 10);
        
        // Handle 2-digit years - always assume 20XX
        if (year < 100) {
          year += 2000; // 25 -> 2025, 13 -> 2013, etc.
        }
        
        // Validate month and day
        if (month < 0 || month > 11) return null;
        if (day < 1 || day > 31) return null;
        
        const date = createLocalDate(year, month + 1, day);
        
        // Check if the date is valid (handles leap years, etc.)
        if (date.getFullYear() === year && 
            date.getMonth() === month && 
            date.getDate() === day) {
          return date;
        }
      }
    }
    
    return null;
  };

  const autoFormatDateInput = (inputValue) => {
    // Remove all non-numeric characters
    const numbers = inputValue.replace(/\D/g, '');
    
    if (numbers.length === 0) return '';
    if (numbers.length === 1) return numbers;
    if (numbers.length === 2) return numbers + '/';
    if (numbers.length === 3) {
      // Handle case like 842 -> 8/4/2
      const month = numbers.slice(0, 1);
      const day = numbers.slice(1, 2);
      const year = numbers.slice(2, 3);
      return month + '/' + day + '/' + year;
    }
    if (numbers.length === 4) {
      // Handle case like 8425 -> 8/4/25
      const month = numbers.slice(0, 1);
      const day = numbers.slice(1, 2);
      const year = numbers.slice(2, 4);
      return month + '/' + day + '/' + year;
    }
    if (numbers.length === 5) {
      // Handle 2-digit year: 8425 -> 08/04/25
      const month = numbers.slice(0, 2);
      const day = numbers.slice(2, 4);
      const year = numbers.slice(4, 5);
      return month + '/' + day + '/' + year;
    }
    if (numbers.length === 6) return numbers.slice(0, 2) + '/' + numbers.slice(2, 4) + '/' + numbers.slice(4, 6);
    if (numbers.length === 7) return numbers.slice(0, 2) + '/' + numbers.slice(2, 4) + '/' + numbers.slice(4, 7);
    if (numbers.length >= 8) return numbers.slice(0, 2) + '/' + numbers.slice(2, 4) + '/' + numbers.slice(4, 8);
    
    return numbers;
  };

  const handleDateInputChange = (e) => {
    const inputValue = e.target.value;
    const formattedInput = autoFormatDateInput(inputValue);
    setDateInputValue(formattedInput);
    setDateInputError(false);
  };

  const autoCompleteDate = () => {
    if (dateInputValue && dateInputValue.includes('/')) {
      const parts = dateInputValue.split('/');
      
      // Only auto-complete when there are exactly 3 parts
      if (parts.length === 3) {
        let [month, day, year] = parts;
        
        // Add leading zeros to month and day
        month = month.padStart(2, '0');
        day = day.padStart(2, '0');
        
        // Convert any year to 4-digit year (add 2000 to any year)
        if (year.length === 1) {
          year = '200' + year;
        } else if (year.length === 2) {
          year = '20' + year;
        } else if (year.length === 3) {
          year = '2' + year;
        }
        
        const autoCompletedDate = `${month}/${day}/${year}`;
        setDateInputValue(autoCompletedDate);
        
        // Try to parse the auto-completed date
        const parsedDate = parseDateFromInput(autoCompletedDate);
        if (parsedDate) {
          setDeadline(formatDateForInputFromLocal(parsedDate));
        } else {
          setDeadline('');
        }
      }
    }
  };

  const autoCompleteDateWithValue = (inputValue) => {
    if (inputValue && inputValue.includes('/')) {
      const parts = inputValue.split('/');
      
      // Only auto-complete when there are exactly 3 parts
      if (parts.length === 3) {
        let [month, day, year] = parts;
        
        // Add leading zeros to month and day
        month = month.padStart(2, '0');
        day = day.padStart(2, '0');
        
        // Convert any year to 4-digit year (add 2000 to any year)
        if (year.length === 1) {
          year = '200' + year;
        } else if (year.length === 2) {
          year = '20' + year;
        } else if (year.length === 3) {
          year = '2' + year;
        }
        
        const autoCompletedDate = `${month}/${day}/${year}`;
        setDateInputValue(autoCompletedDate);
        
        // Try to parse the auto-completed date
        const parsedDate = parseDateFromInput(autoCompletedDate);
        if (parsedDate) {
          setDeadline(formatDateForInputFromLocal(parsedDate));
        } else {
          setDeadline('');
        }
      }
    }
  };

  const handleDateInputBlur = (e) => {
    const inputValue = e.target.value;
    
    // Trigger auto-completion when user clicks away
    if (inputValue && inputValue.includes('/')) {
      const parts = inputValue.split('/');
      if (parts.length === 3) {
        autoCompleteDateWithValue(inputValue);
      }
    }
    
    // Set error state if date is invalid
    if (dateInputValue && dateInputValue.includes('/')) {
      const parts = dateInputValue.split('/');
      if (parts.length === 3) {
        const parsedDate = parseDateFromInput(dateInputValue);
        if (!parsedDate) {
          setDateInputError(true);
        } else {
          setDateInputError(false);
        }
      }
    }
  };

  // Date picker drag functionality (same as TaskCreationCard)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingDate) return;

      const calendar = document.querySelector('.custom-datepicker-calendar');
      if (!calendar) return;
      
      const dateElements = calendar.querySelectorAll('.react-datepicker__day:not(.react-datepicker__day--outside-month):not(.react-datepicker__day--disabled)');
      let targetDate = null;
      
      const prevHighlighted = calendar.querySelector('.react-datepicker__day.drag-highlighted');
      if (prevHighlighted) {
        prevHighlighted.classList.remove('drag-highlighted');
      }
      
      for (const element of dateElements) {
        const rect = element.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && 
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          element.classList.add('drag-highlighted');
          
          const ariaLabel = element.getAttribute('aria-label');
          if (ariaLabel) {
            const dateMatch = ariaLabel.match(/(\w+),\s+(\w+)\s+(\d+)(?:st|nd|rd|th),\s+(\d+)/);
            if (dateMatch) {
              const [, , monthName, day, year] = dateMatch;
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                 'July', 'August', 'September', 'October', 'November', 'December'];
              const monthIndex = monthNames.indexOf(monthName);
              if (monthIndex !== -1) {
                targetDate = createLocalDate(parseInt(year), monthIndex + 1, parseInt(day));
              }
            }
          }
          
          if (!targetDate) {
            const dateText = element.textContent;
            if (dateText && !isNaN(dateText)) {
              const currentMonth = deadline ? new Date(deadline).getMonth() : new Date().getMonth();
              const currentYear = deadline ? new Date(deadline).getFullYear() : new Date().getFullYear();
              targetDate = createLocalDate(currentYear, currentMonth + 1, parseInt(dateText));
            }
          }
          break;
        }
      }
      
      if (targetDate) {
        setDraggedDate(targetDate);
      }
    };

    const handleMouseUp = () => {
      const calendar = document.querySelector('.custom-datepicker-calendar');
      if (calendar) {
        const highlighted = calendar.querySelector('.react-datepicker__day.drag-highlighted');
        if (highlighted) {
          highlighted.classList.remove('drag-highlighted');
        }
      }
      
      if (isDraggingDate && draggedDate) {
        setDeadline(formatDateForInputFromLocal(draggedDate));
        setIsDatePickerOpen(false);
      }
      setIsDraggingDate(false);
      setDraggedDate(null);
    };

    if (isDraggingDate) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDate, draggedDate, deadline]);

  // Add mouse down listeners to calendar when it opens
  useEffect(() => {
    if (!isDatePickerOpen) return;

    const addCalendarListeners = () => {
      const calendar = document.querySelector('.custom-datepicker-calendar');
      if (!calendar) {
        setTimeout(addCalendarListeners, 100);
        return;
      }

      const handleMouseDown = (e) => {
        const dateElement = e.target.closest('.react-datepicker__day:not(.react-datepicker__day--outside-month):not(.react-datepicker__day--disabled)');
        if (dateElement) {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingDate(true);
          
          const ariaLabel = dateElement.getAttribute('aria-label');
          let initialDate = null;
          
          if (ariaLabel) {
            const dateMatch = ariaLabel.match(/(\w+),\s+(\w+)\s+(\d+)(?:st|nd|rd|th),\s+(\d+)/);
            if (dateMatch) {
              const [, , monthName, day, year] = dateMatch;
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                 'July', 'August', 'September', 'October', 'November', 'December'];
              const monthIndex = monthNames.indexOf(monthName);
              if (monthIndex !== -1) {
                initialDate = createLocalDate(parseInt(year), monthIndex + 1, parseInt(day));
              }
            }
          }
          
          if (!initialDate) {
            const dateText = dateElement.textContent;
            if (dateText && !isNaN(dateText)) {
              const currentMonth = deadline ? new Date(deadline).getMonth() : new Date().getMonth();
              const currentYear = deadline ? new Date(deadline).getFullYear() : new Date().getFullYear();
              initialDate = createLocalDate(currentYear, currentMonth + 1, parseInt(dateText));
            }
          }
          
          if (initialDate) {
            setDraggedDate(initialDate);
          }
        }
      };

      calendar.addEventListener('mousedown', handleMouseDown);
      
      return () => {
        calendar.removeEventListener('mousedown', handleMouseDown);
      };
    };

    const cleanup = addCalendarListeners();
    return cleanup;
  }, [isDatePickerOpen, deadline]);

  // Add keyboard event listener for Escape key
  useEffect(() => {
    if (!isDatePickerOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsDatePickerOpen(false);
        setIsDraggingDate(false);
        setDraggedDate(null);
        if (document.activeElement) {
          document.activeElement.blur();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDatePickerOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !deadline || isNaN(new Date(deadline).getTime())) {
      alert(`Please enter a ${creationType} name and valid deadline.`);
      return;
    }

    if (creationType === 'event') {
      if (!startTime || !endTime) {
        alert("Please select both start and end times for the event.");
        return;
      }
      if (formatTime(startTime, '24') === formatTime(endTime, '24')) {
        return;
      }

      const event = {
        id: Date.now(),
        name,
        title: name,
        description,
        taskType,
        startTime: formatTime(startTime, '24'),
        endTime: formatTime(endTime, '24'),
        deadline, // store as raw string (YYYY-MM-DD)
        type: 'event', // This will make it appear in calendar but not task list
      };

      addTask(event); // Use addTask for now, but with type: 'event'
    } else {
    const task = {
      id: Date.now(),
      name,
      title: name,
      energy: Number(energy),
      priority: Number(priority),
      taskType,
      duration: Number(duration),
      deadline, // store as raw string (YYYY-MM-DD)
        type: 'task', // This will make it appear in task list
    };

    addTask(task);
    
    // Save personalized defaults when task is submitted
    savePersonalizedDefaults();
    }
    
    resetForm();
  };

  const getTaskTypeColor = (type) => {
    switch (type) {
      case 'Work': return '#ff6b81'; // light red
      case 'School': return '#4fc3f7'; // blue
      case 'Extra': return '#ffb86b'; // orange
      case 'Entertainment': return '#00bfae'; // teal
      default: return '#a084e8'; // purple
    }
  };

  const getEnergyColor = (level) => {
    switch (level) {
      case 1: return '#4c1d95'; // dark purple
      case 2: return '#5b21b6'; // medium purple
      case 3: return '#6d28d9'; // light purple
      case 4: return '#7c3aed'; // bright purple
      case 5: return '#8b5cf6'; // light purple
      default: return '#6d28d9';
    }
  };

  const getPriorityColor = (level) => {
    switch (level) {
      case 1: return '#4c1d95'; // dark purple
      case 2: return '#5b21b6'; // medium purple
      case 3: return '#6d28d9'; // light purple
      case 4: return '#7c3aed'; // bright purple
      case 5: return '#8b5cf6'; // light purple
      default: return '#6d28d9';
    }
  };

  // Personalized autofill system
  const getPersonalizedDefaults = () => {
    if (!name.trim()) return null;
    
    try {
      const userPreferences = JSON.parse(localStorage.getItem('aridia-task-preferences') || '{}');
      const nameLower = name.toLowerCase();
      
      // Find the best matching task name (partial match)
      let bestMatch = null;
      let bestMatchLength = 0;
      
      Object.keys(userPreferences).forEach(storedName => {
        const storedNameLower = storedName.toLowerCase();
        
        // Check if current input partially matches stored name or vice versa
        if (nameLower.includes(storedNameLower) || storedNameLower.includes(nameLower)) {
          const matchLength = Math.min(nameLower.length, storedNameLower.length);
          if (matchLength > bestMatchLength) {
            bestMatchLength = matchLength;
            bestMatch = storedName;
          }
        }
      });
      
      // Only apply if we have a reasonable match (at least 3 characters)
      if (bestMatch && bestMatchLength >= 3) {
        const preferences = userPreferences[bestMatch];
        return {
          energy: preferences.energy,
          priority: preferences.priority,
          duration: preferences.duration,
          taskType: preferences.taskType
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error loading personalized defaults:', error);
      return null;
    }
  };

  const savePersonalizedDefaults = () => {
    if (!name.trim()) return;
    
    try {
      const userPreferences = JSON.parse(localStorage.getItem('aridia-task-preferences') || '{}');
      
      // Save current values for this task name
      userPreferences[name.trim()] = {
        energy: energy,
        priority: priority,
        duration: duration,
        taskType: taskType,
        lastUsed: Date.now()
      };
      
      // Clean up old entries (older than 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      Object.keys(userPreferences).forEach(key => {
        if (userPreferences[key].lastUsed < thirtyDaysAgo) {
          delete userPreferences[key];
        }
      });
      
      localStorage.setItem('aridia-task-preferences', JSON.stringify(userPreferences));
    } catch (error) {
      console.error('Error saving personalized defaults:', error);
    }
  };

  const applyPersonalizedDefaults = () => {
    const defaults = getPersonalizedDefaults();
    if (defaults) {
      setEnergy(defaults.energy);
      setPriority(defaults.priority);
      setDuration(defaults.duration);
      setTaskType(defaults.taskType);
    }
  };

  // Energy slider drag handlers
  const handleEnergyMouseDown = (e) => {
    setIsDraggingEnergy(true);
    setDragEnergyValue(energy);
  };

  const handleEnergyMouseMove = (e) => {
    if (!isDraggingEnergy) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, x / width));
    const value = 1 + (percentage * 4); // 1 to 5
    setDragEnergyValue(value);
  };

  const handleEnergyMouseUp = () => {
    if (isDraggingEnergy) {
      setEnergy(Math.round(dragEnergyValue));
      setIsDraggingEnergy(false);
    }
  };

  const handleEnergyChange = (e) => {
    const value = parseFloat(e.target.value);
    setEnergy(value);
    setDragEnergyValue(value);
  };

  // Priority slider drag handlers
  const handlePriorityMouseDown = (e) => {
    setIsDraggingPriority(true);
    setDragPriorityValue(priority);
  };

  const handlePriorityMouseMove = (e) => {
    if (!isDraggingPriority) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, x / width));
    const value = 1 + (percentage * 4); // 1 to 5
    setDragPriorityValue(value);
  };

  const handlePriorityMouseUp = () => {
    if (isDraggingPriority) {
      setPriority(Math.round(dragPriorityValue));
      setIsDraggingPriority(false);
    }
  };

  const handlePriorityChange = (e) => {
    const value = parseFloat(e.target.value);
    setPriority(value);
    setDragPriorityValue(value);
  };

  return (
    <div
      className={isDay ? 'taskform--day' : undefined}
      style={{
      background: ui.cardBg,
      padding: isDay ? 0 : '1.5rem',
      borderRadius: isDay ? 0 : '8px',
      border: ui.cardBorder,
      boxShadow: ui.cardShadow,
      fontFamily: "'Karla', sans-serif",
      width: isDay ? '100%' : undefined,
      minWidth: isDay ? 0 : undefined,
      minHeight: isDay ? 0 : undefined,
      height: isDay ? '100%' : undefined,
      boxSizing: 'border-box',
    }}>
      <style>
        {`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }
        `}
      </style>
      <form
        onSubmit={handleSubmit}
        className={isDay ? 'taskform-day-form' : undefined}
        style={isDay ? undefined : { display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {/* Task Creation Header */}
        <div className={isDay ? 'taskform-day-header' : undefined} style={isDay ? undefined : { marginBottom: '0.5rem' }}>
          <div
            className={isDay ? 'taskform-day-title-row' : undefined}
            style={isDay ? undefined : {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            minWidth: 0,
            gap: '0.5rem'
          }}>
          <div
            className={isDay ? 'taskform-day-title-text' : undefined}
            style={{
            fontSize: '1rem',
            fontWeight: 600,
              color: ui.text,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1
            }}>
              {creationType === 'task' ? 'Task' : 'Event'} Creation
            </div>
            
            {/* Event/Task Toggle. Calendar create shows a fixed Event pill. */}
            <div style={{
              display: 'flex',
              flexShrink: 0,
              background: ui.toggleBg,
              borderRadius: '999px',
              padding: '0.1rem',
              border: `1px solid ${ui.toggleBorder}`
            }}>
              {!eventOnly && (
              <button
                type="button"
                className={`creation-type-btn${creationType === 'task' ? ' is-selected' : ''}`}
                onClick={() => { setCreationType('task'); setShowTimePicker(false); }}
              >
                Task
              </button>
              )}
              <button
                type="button"
                className={`creation-type-btn${eventOnly || creationType === 'event' ? ' is-selected' : ''}`}
                aria-disabled={eventOnly || undefined}
                onClick={() => {
                  if (eventOnly) return;
                  setCreationType('event');
                  setShowTimePicker(false);
                }}
              >
                Event
              </button>
            </div>
          </div>
          {creationType === 'event' ? (
            // Event creation: side by side layout
            <div
              className={isDay ? 'taskform-day-row' : undefined}
              style={isDay ? undefined : { 
              display: 'flex', 
              gap: '1rem', 
              marginTop: '0.25rem'
            }}>
              {/* Event Name Input - 60% */}
              <div className={isDay ? 'taskform-day-field taskform-day-field-name' : undefined} style={isDay ? undefined : { flex: '0.6' }}>
                <input
                  type="text"
                  placeholder="Enter event name..."
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    // Apply personalized defaults after a short delay
                    setTimeout(() => applyPersonalizedDefaults(), 500);
                  }}
                  required
            style={{
              width: '100%',
              minWidth: 0,
              padding: '0.875rem',
              borderRadius: '8px',
              border: `1px solid ${ui.inputBorder}`,
              background: ui.inputBg,
              color: ui.inputText,
              fontSize: '0.9rem',
              fontFamily: "'Karla', sans-serif",
              outline: 'none',
              transition: 'border-color 0.2s ease',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
                />
              </div>
              
              {/* Description Input - 40% */}
              <div className={isDay ? 'taskform-day-field taskform-day-field-desc' : undefined} style={isDay ? undefined : { flex: '0.4' }}>
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
            style={{
              width: '100%',
              minWidth: 0,
              padding: '0.875rem',
              borderRadius: '8px',
              border: `1px solid ${ui.inputBorder}`,
              background: ui.inputBg,
              color: ui.inputText,
              fontSize: '0.9rem',
              fontFamily: "'Karla', sans-serif",
              outline: 'none',
              transition: 'border-color 0.2s ease',
              overflow: 'hidden'
            }}
                />
              </div>
            </div>
          ) : (
            // Task creation: side by side layout
            <div
              className={isDay ? 'taskform-day-row' : undefined}
              style={isDay ? undefined : { 
              display: 'flex', 
              gap: '1rem', 
              marginTop: '0.25rem'
            }}>
              {/* Task Name Input - 60% */}
              <div className={isDay ? 'taskform-day-field taskform-day-field-name' : undefined} style={isDay ? undefined : { flex: '0.6' }}>
                <input
                  type="text"
                  placeholder="Enter task name..."
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    // Apply personalized defaults after a short delay
                    setTimeout(() => applyPersonalizedDefaults(), 500);
                  }}
                  required
            style={{
              width: '100%',
              minWidth: 0,
              padding: '0.875rem',
              borderRadius: '8px',
              border: `1px solid ${ui.inputBorder}`,
              background: ui.inputBg,
              color: ui.inputText,
              fontSize: '0.9rem',
              fontFamily: "'Karla', sans-serif",
              outline: 'none',
              transition: 'border-color 0.2s ease',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
                />
              </div>
              
              {/* Description Input - 40% */}
              <div className={isDay ? 'taskform-day-field taskform-day-field-desc' : undefined} style={isDay ? undefined : { flex: '0.4' }}>
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
            style={{
              width: '100%',
              minWidth: 0,
              padding: '0.875rem',
              borderRadius: '8px',
              border: `1px solid ${ui.inputBorder}`,
              background: ui.inputBg,
              color: ui.inputText,
              fontSize: '0.9rem',
              fontFamily: "'Karla', sans-serif",
              outline: 'none',
              transition: 'border-color 0.2s ease',
              overflow: 'hidden'
            }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Task Type, Deadline, and Duration - Side by Side */}
        <div
          className={isDay ? 'taskform-day-row' : undefined}
          style={isDay ? undefined : { 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '0.5rem',
          flexWrap: 'wrap'
        }}>
          {/* Task Type Dropdown */}
          <div className={isDay ? 'taskform-day-field' : undefined} style={isDay ? undefined : { flex: '1', minWidth: '150px' }}>
            <label style={{
              marginBottom: '0.25rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: ui.label,
              display: 'block'
            }}>
              {creationType === 'event' ? 'Event Type' : 'Task Type'}
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.875rem',

                borderRadius: '8px',
                border: `1px solid ${ui.inputBorder}`,
                background: ui.inputBg,
                color: ui.inputText,
                fontSize: '0.9rem',
                fontFamily: "'Karla', sans-serif",
                outline: 'none',
                transition: 'border-color 0.2s ease',
                marginTop: '0.25rem'
              }}
            >
              <option value="Work">Work</option>
              <option value="School">School</option>
              <option value="Extra">Extra</option>
              <option value="Entertainment">Entertainment</option>
            </select>
          </div>

          {/* Deadline Input with DatePicker */}
          <div className={isDay ? 'taskform-day-field' : undefined} style={isDay ? { position: 'relative' } : { flex: '1', minWidth: '150px', position: 'relative' }}>
            <label style={{
              marginBottom: '0.25rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: ui.label,
              display: 'block'
            }}>
              Deadline
            </label>
            <div style={{ marginTop: '0.25rem', position: 'relative' }}>
              <div style={{ position: 'relative', display: 'block', width: '100%' }}>
              <DatePicker
                ref={datePickerRef}
                selected={isDraggingDate ? draggedDate : (deadline ? createLocalDateFromString(deadline) : null)}
                onChange={date => {
                  if (!isDraggingDate) {
                    setDeadline(formatDateForInputFromLocal(date));
                    setDateInputValue(formatDateForDisplayFromLocal(date));
                  }
                }}
                customInput={
                  <DatePillsInput 
                    isDatePickerOpen={isDatePickerOpen}
                    onChange={handleDateInputChange}
                    onBlur={handleDateInputBlur}
                    value={dateInputValue}
                    hasError={dateInputError}
                    placeholder="MM/DD/YYYY"
                    onClick={() => setIsDatePickerOpen(true)}
                    onAutoComplete={autoCompleteDateWithValue}
                    palette={ui}
                  />
                }
                calendarClassName={`custom-datepicker-calendar${isDraggingDate ? ' dragging' : ''}`}

                dropdownMode="select"
                showPopperArrow={false}


                portalId={null}
                popperClassName={`taskform-datepicker-popper${datePickerFlip.flippedX ? ' flipped-x' : ''}${datePickerFlip.flippedY ? ' flipped-y' : ''}`}
                open={isDatePickerOpen}
                onCalendarOpen={() => {
          
                  setIsDatePickerOpen(true);
                  
                  // Calculate flip logic for DatePicker positioning
                  setTimeout(() => {
                    const inputElement = datePickerRef.current?.input;
                    if (inputElement) {
                      const inputRect = inputElement.getBoundingClientRect();
                      const datePickerWidth = 240; // DatePicker width
                      const datePickerHeight = 280; // Approximate DatePicker height
                      const vw = window.innerWidth;
                      const vh = window.innerHeight;
                      
                      let flippedX = false;
                      let flippedY = false;
                      
                      // Check if DatePicker would overflow right edge
                      if (inputRect.left + datePickerWidth > vw) {
                        flippedX = true;
                      }
                      
                      // Check if DatePicker would overflow bottom edge
                      if (inputRect.bottom + datePickerHeight > vh) {
                        flippedY = true;
                      }
                      
                      setDatePickerFlip({ flippedX, flippedY });
                    }
                  }, 0);
                }}
                onCalendarClose={() => { 
                  setIsDatePickerOpen(false); 
                  setIsDraggingDate(false); 
                  setDraggedDate(null);
                  if (document.activeElement) {
                    document.activeElement.blur();
                  }
                }}
                onSelect={(date) => {
                  if (!isDraggingDate) {
                    setIsDatePickerOpen(false);
                  }
                }}
                onClickOutside={() => { 
                  setIsDatePickerOpen(false); 
                  setIsDraggingDate(false); 
                  setDraggedDate(null);
                  if (document.activeElement) {
                    document.activeElement.blur();
                  }
                }}

                closeOnScroll={true}
                onInputClick={() => { setIsDatePickerOpen(true); }}
                shouldCloseOnSelect={!isDraggingDate}
              />
              </div>
            </div>
          </div>

          {/* Time Pills (for events) or Duration Input (for tasks) */}
                      {creationType === 'event' ? (
            <div className={isDay ? 'taskform-day-field taskform-day-times' : undefined} style={isDay ? undefined : { flex: '1', minWidth: '300px' }}>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: ui.label,
                marginBottom: '0.25rem',
                display: 'flex',
                gap: '1rem'
              }}>
                <div style={{ flex: '1', textAlign: 'center' }}>Start Time</div>
                <div style={{ flex: '1', textAlign: 'center' }}>End Time</div>
              </div>
              <div
                className={isDay ? 'taskform-day-times-pills' : undefined}
                style={isDay ? undefined : { 
                display: 'flex', 
                gap: '1rem',
                marginTop: '0.25rem',
                width: '100%',
                flexWrap: 'wrap'
              }}>
                {/* Start Time Section */}
                <div className={isDay ? 'taskform-day-field' : undefined} style={isDay ? undefined : { flex: '1', minWidth: '120px' }}>
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: ui.timePillBg,
                      color: ui.timePillText,
                      borderRadius: '12px',
                      padding: '0.75rem 1rem',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: ui.timePillBorder,
                      outline: 'none',
                      textAlign: 'center',
                      minWidth: isDay ? 0 : '100px',
                      height: '50px',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      caretColor: 'transparent',
                      userSelect: 'none',
                      width: '100%'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = ui.timePillHover}
                    onMouseLeave={(e) => e.target.style.backgroundColor = ui.timePillBg}
                  >
                    {startTime ? formatTime(startTime, '24') : 'Start'}
                  </span>
                </div>

                {/* End Time Section */}
                <div className={isDay ? 'taskform-day-field' : undefined} style={isDay ? undefined : { flex: '1', minWidth: '120px' }}>
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: ui.timePillBg,
                      color: ui.timePillText,
                      borderRadius: '12px',
                      padding: '0.75rem 1rem',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: ui.timePillBorder,
                      outline: 'none',
                      textAlign: 'center',
                      minWidth: isDay ? 0 : '100px',
                      height: '50px',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      caretColor: 'transparent',
                      userSelect: 'none',
                      width: '100%'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = ui.timePillHover}
                    onMouseLeave={(e) => e.target.style.backgroundColor = ui.timePillBg}
                  >
                    {endTime ? formatTime(endTime, '24') : 'End'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
          <div className={isDay ? 'taskform-day-field' : undefined} style={isDay ? undefined : { flex: '1', minWidth: '150px' }}>
            <label style={{
              marginBottom: '0.25rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: ui.label,
              display: 'block'
            }}>
              Duration (minutes)
            </label>
            <div style={{ position: 'relative', marginTop: '0.25rem' }}>
              <input
                type="text"
                value={duration}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow numbers and empty string
                  if (value === '' || /^\d+$/.test(value)) {
                    setDuration(value);
                    setDurationError(false); // Clear error when user types
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setDuration('30'); // Set default when leaving empty
                    setDurationError(false);
                  } else {
                    const numValue = Number(value);
                    if (numValue < 5 || numValue > 480) {
                      setDurationError(true);
                      setDuration('30'); // Reset to default on invalid input
                    } else {
                      setDurationError(false);
                    }
                  }
                }}
                className={durationError ? 'duration-input-error' : ''}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  borderRadius: '8px',
                  border: durationError ? '2px solid #ff1744' : `1px solid ${ui.inputBorder}`,
                  background: ui.inputBg,
                  color: ui.inputText,
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                            />
              {durationError && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0',
                  right: '0',
                  background: '#fff3cd',
                  color: '#856404',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  marginTop: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  zIndex: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}>
                  <span style={{ fontSize: '1rem' }}>⚠️</span>
                  Please enter a value between 5 and 480
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Energy and Priority Levels - Side by Side (for tasks only) */}
        {creationType === 'task' && (
        <div
          className={isDay ? 'taskform-day-row' : undefined}
          style={isDay ? undefined : { 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '0.5rem',
          flexWrap: 'wrap'
        }}>
          {/* Energy Level */}
          <div className={isDay ? 'taskform-day-field' : undefined} style={isDay ? undefined : { flex: '1', minWidth: '200px' }}>
            <label style={{
              marginBottom: '0.25rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: ui.label,
              display: 'block'
            }}>
              Energy Level
            </label>
            <div 
              style={{ position: 'relative', padding: '0.5rem 0', marginTop: '0.25rem' }}
              onMouseMove={handleEnergyMouseMove}
              onMouseUp={handleEnergyMouseUp}
              onMouseLeave={handleEnergyMouseUp}
            >
              <input
                type="range"
                className="taskform-level-slider"
                min="1"
                max="5"
                step="0.01"
                value={isDraggingEnergy ? dragEnergyValue : energy}
                onChange={handleEnergyChange}
                onMouseDown={handleEnergyMouseDown}
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  background: `linear-gradient(to right, ${getEnergyColor(Math.round(isDraggingEnergy ? dragEnergyValue : energy))} 0%, ${getEnergyColor(Math.round(isDraggingEnergy ? dragEnergyValue : energy))} ${((isDraggingEnergy ? dragEnergyValue : energy) - 1) * 25}%, ${ui.trackUnused} ${((isDraggingEnergy ? dragEnergyValue : energy) - 1) * 25}%, ${ui.trackUnused} 100%)`,
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  transition: isDraggingEnergy ? 'none' : 'background 0.2s ease'
                }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: '#9ca3af',
                paddingLeft: '10px',
                paddingRight: '5px'
              }}>
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
              </div>
            </div>
          </div>

          {/* Priority Level */}
          <div className={isDay ? 'taskform-day-field' : undefined} style={isDay ? undefined : { flex: '1', minWidth: '200px' }}>
            <label style={{
              marginBottom: '0.25rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: ui.label,
              display: 'block'
            }}>
              Priority Level
            </label>
            <div 
              style={{ position: 'relative', padding: '0.5rem 0', marginTop: '0.25rem' }}
              onMouseMove={handlePriorityMouseMove}
              onMouseUp={handlePriorityMouseUp}
              onMouseLeave={handlePriorityMouseUp}
            >
              <input
                type="range"
                className="taskform-level-slider"
                min="1"
                max="5"
                step="0.01"
                value={isDraggingPriority ? dragPriorityValue : priority}
                onChange={handlePriorityChange}
                onMouseDown={handlePriorityMouseDown}
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  background: `linear-gradient(to right, ${getPriorityColor(Math.round(isDraggingPriority ? dragPriorityValue : priority))} 0%, ${getPriorityColor(Math.round(isDraggingPriority ? dragPriorityValue : priority))} ${((isDraggingPriority ? dragPriorityValue : priority) - 1) * 25}%, ${ui.trackUnused} ${((isDraggingPriority ? dragPriorityValue : priority) - 1) * 25}%, ${ui.trackUnused} 100%)`,
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  transition: isDraggingPriority ? 'none' : 'background 0.2s ease'
                }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: '#9ca3af',
                paddingLeft: '10px',
                paddingRight: '5px'
              }}>
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Submit Button */}
        <div className={isDay ? 'taskform-day-actions' : undefined} style={isDay ? undefined : { display: 'flex', gap: '0.75rem' }}>
          {onCancel ? (
            <button
              type="button"
              onClick={() => {
                resetForm();
                onCancel();
              }}
              style={{
                flex: 1,
                padding: '0.875rem',
                borderRadius: '8px',
                border: `1px solid ${ui.cancelBorder}`,
                background: 'transparent',
                color: ui.cancelText,
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            style={{
              flex: onCancel ? 1 : undefined,
              padding: '0.875rem',
              borderRadius: '8px',
              border: 'none',
              background: ui.submitBg,
              color: ui.submitText,
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = ui.submitHover;
            }}
            onMouseLeave={(e) => {
              e.target.style.background = ui.submitBg;
            }}
          >
            Add {creationType === 'task' ? 'Task' : 'Event'}
          </button>
        </div>
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

export default TaskForm;
