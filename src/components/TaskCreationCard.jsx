import React, { useState, useRef, forwardRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './TaskCreationCard.css';

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

const DatePillsInput = forwardRef(({ value, onClick, isDatePickerOpen }, ref) => {
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
    // Remove focus from the clicked element immediately
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

// --- BEGIN: Working CircularTimePicker ---
const CircularTimePicker = ({ value, onChange, onClose, anchorRef, open, timePickerTarget, onStartTimeComplete, onEndTimeComplete, automaticStartTime, automaticEndTime, setAutomaticStartTime, setAutomaticEndTime }) => {
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
  // Initialize hourInput with 12-hour format
  const getInitialDisplayHour = (hour24) => {
    if (hour24 === 0) return 12; // 0 = 12 AM
    if (hour24 === 12) return 12; // 12 = 12 PM
    if (hour24 < 12) return hour24; // 1-11 AM
    return hour24 - 12; // 13-23 PM -> 1-11
  };
  const [hourInput, setHourInput] = useState(getInitialDisplayHour(selectedHour).toString().padStart(2, '0'));
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
  
  // Always show 1-12 for hour selection
  const hours = Array.from({length: 12}, (_, i) => i + 1); // 1-12
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
  // Sync input fields with selected values - convert 24-hour to 12-hour display
  useEffect(() => { 
    if (!hourInputFocused) {
      // Convert 24-hour format to 12-hour display format
      let displayHour;
      if (selectedHour === 0) {
        displayHour = 12; // 0 = 12 AM
      } else if (selectedHour === 12) {
        displayHour = 12; // 12 = 12 PM
      } else if (selectedHour < 12) {
        displayHour = selectedHour; // 1-11 AM
      } else {
        displayHour = selectedHour - 12; // 13-23 PM -> 1-11
      }
      setHourInput(displayHour.toString().padStart(2, '0')); 
    }
  }, [selectedHour, hourInputFocused]);
  useEffect(() => { 
    if (!minuteInputFocused) {
      setMinuteInput(selectedMinute.toString().padStart(2, '0')); 
    }
  }, [selectedMinute, minuteInputFocused]);
  // Update input display based on hover state - convert to 12-hour display
  useEffect(() => {
    if (step === 'hour' && hoveredValue !== null && !hourInputFocused) {
      // Convert 24-hour hoveredValue to 12-hour display
      let displayHour;
      if (hoveredValue === 0) {
        displayHour = 12; // 0 = 12 AM
      } else if (hoveredValue === 12) {
        displayHour = 12; // 12 = 12 PM
      } else if (hoveredValue < 12) {
        displayHour = hoveredValue; // 1-11 AM
      } else {
        displayHour = hoveredValue - 12; // 13-23 PM -> 1-11
      }
      setHourInput(displayHour.toString().padStart(2, '0'));
    } else if (step === 'hour' && !hourInputFocused) {
      // Convert 24-hour selectedHour to 12-hour display
      let displayHour;
      if (selectedHour === 0) {
        displayHour = 12; // 0 = 12 AM
      } else if (selectedHour === 12) {
        displayHour = 12; // 12 = 12 PM
      } else if (selectedHour < 12) {
        displayHour = selectedHour; // 1-11 AM
      } else {
        displayHour = selectedHour - 12; // 13-23 PM -> 1-11
      }
      setHourInput(displayHour.toString().padStart(2, '0'));
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
      pointerEvents: 'none',
    };
  };

  const updateHourSelection = useCallback((displayHour) => {
    // Convert 12-hour display (1-12) to 24-hour format (0-23)
    let hour24;
    if (displayHour === 12) {
      hour24 = isPM ? 12 : 0; // 12 PM = 12, 12 AM = 0
    } else {
      hour24 = isPM ? displayHour + 12 : displayHour; // PM: add 12, AM: keep as is
    }
    
    setSelectedHour(hour24);
    // Display hour in 12-hour format
    setHourInput(displayHour.toString().padStart(2, '0'));
    setPendingHour(hour24);
    // Update the time pill in real-time
    const d = new Date();
    d.setHours(hour24, selectedMinute, 0, 0);
    onChange(d);
  }, [selectedMinute, onChange, isPM]);

  // Handle AM/PM toggle
  const handleAMPMToggle = useCallback((newIsPM) => {
    setIsPM(newIsPM);
    
    // Get current display hour (1-12) from 24-hour format
    let displayHour;
    if (selectedHour === 0) {
      displayHour = 12; // 0 = 12 AM
    } else if (selectedHour === 12) {
      displayHour = 12; // 12 = 12 PM
    } else if (selectedHour < 12) {
      displayHour = selectedHour; // 1-11 AM
    } else {
      displayHour = selectedHour - 12; // 13-23 PM -> 1-11
    }
    
    // Convert display hour to new 24-hour format based on new AM/PM
    let newHour24;
    if (displayHour === 12) {
      newHour24 = newIsPM ? 12 : 0; // 12 PM = 12, 12 AM = 0
    } else {
      newHour24 = newIsPM ? displayHour + 12 : displayHour; // PM: add 12, AM: keep as is
    }
    
    setSelectedHour(newHour24);
    setHourInput(displayHour.toString().padStart(2, '0'));
    setPendingHour(newHour24);
    
    // Update the time pill in real-time
    const d = new Date();
    d.setHours(newHour24, selectedMinute, 0, 0);
    onChange(d);
  }, [selectedHour, selectedMinute, onChange]);
  const handleHourSelect = useCallback((h) => {
    updateHourSelection(h);
    setStep('minute');
    // Mark as user inputted and reset automatic flag
    setInteractionState({ hasUserInput: true, isAutomatic: false });
    if (timePickerTarget === 'start') {
      setAutomaticStartTime(false); // User has taken control
    } else {
      setAutomaticEndTime(false); // User has taken control
    }
  }, [updateHourSelection, timePickerTarget]);
  const handleMinuteSelect = useCallback((m, eventType = 'click', event = null) => {
    setSelectedMinute(m);
    setMinuteInput(m.toString().padStart(2, '0'));
    setPendingMinute(m);
    const d = new Date();
    d.setHours(selectedHour, m, 0, 0);
    onChange(d);
    // Mark as user inputted and reset automatic flag
    setInteractionState({ hasUserInput: true, isAutomatic: false });
    if (timePickerTarget === 'start') {
      setAutomaticStartTime(false); // User has taken control
    } else {
      setAutomaticEndTime(false); // User has taken control
    }
    // Auto-advance for start time on mouse interaction
    if (timePickerTarget === 'start' && eventType === 'mouse') {
      onStartTimeComplete && onStartTimeComplete();
    }
    // For end time, close the picker on mouse interaction
    if (timePickerTarget === 'end' && eventType === 'mouse') {
      if (event) { event.preventDefault(); event.stopPropagation(); }
      onEndTimeComplete && onEndTimeComplete();
      onClose();
    }
    // Don't call onClose for typing
  }, [selectedHour, onChange, timePickerTarget, onStartTimeComplete, onEndTimeComplete, onClose]);
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
      const displayHour = calculateHourFromPosition(e);
      if (displayHour !== null) {
        // Convert display hour (1-12) to 24-hour format for comparison
        let hour24;
        if (displayHour === 12) {
          hour24 = isPM ? 12 : 0; // 12 PM = 12, 12 AM = 0
        } else {
          hour24 = isPM ? displayHour + 12 : displayHour; // PM: add 12, AM: keep as is
        }
        setHoveredValue(hour24);
        setHoveredPosition({ type: 'hour', value: displayHour });
      }
    } else {
      const minute = calculateMinuteFromPosition(e);
      if (minute !== null) {
        setHoveredValue(minute);
        setHoveredPosition({ type: 'minute', value: minute });
      }
    }
  }, [step, calculateHourFromPosition, calculateMinuteFromPosition, isPM]);
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
      onStartTimeComplete && onStartTimeComplete();
    }
    // NEW: For end time, close the picker after drag on minute selection
    if (dragging && step === 'minute' && timePickerTarget === 'end' && lastDraggedMinute !== null) {
      handleMinuteSelect(lastDraggedMinute, 'mouse');
    }
    setDragging(false);
    setLastDraggedMinute(null); // Reset
  }, [dragging, step, timePickerTarget, onStartTimeComplete, handleMinuteSelect, lastDraggedMinute]);
  const handleTouchStart = useCallback((e) => { setDragging(true); handleDrag(e); }, [handleDrag]);
  const handleTouchMove = useCallback((e) => { if (dragging) handleDrag(e); }, [dragging, handleDrag]);
  const handleTouchEnd = useCallback(() => {
    if (dragging && step === 'hour') {
      setStep('minute');
    }
    // Auto-advance to end time if we just finished dragging on minute step for start time (touch)
    if (dragging && step === 'minute' && timePickerTarget === 'start') {
      onStartTimeComplete && onStartTimeComplete();
    }
    // NEW: For end time, close the picker after drag on minute selection (touch)
    if (dragging && step === 'minute' && timePickerTarget === 'end' && lastDraggedMinute !== null) {
      handleMinuteSelect(lastDraggedMinute, 'mouse');
    }
    setDragging(false);
    setLastDraggedMinute(null); // Reset
  }, [dragging, step, timePickerTarget, onStartTimeComplete, handleMinuteSelect, lastDraggedMinute]);
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
      onStartTimeComplete && onStartTimeComplete();
    } else {
      // If this is end time, handle completion and close the picker
      onEndTimeComplete && onEndTimeComplete();
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
    const displayHour = parseInt(val, 10);
    // Validate 12-hour format (1-12)
    if (!isNaN(displayHour) && displayHour >= 1 && displayHour <= 12) {
      // Convert 12-hour display to 24-hour format
      let hour24;
      if (displayHour === 12) {
        hour24 = isPM ? 12 : 0; // 12 PM = 12, 12 AM = 0
      } else {
        hour24 = isPM ? displayHour + 12 : displayHour; // PM: add 12, AM: keep as is
      }
      setPendingHour(hour24);
      setSelectedHour(hour24);
      // Update the time pill in real-time
      const d = new Date();
      d.setHours(hour24, selectedMinute, 0, 0);
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
  // Handle input blur - validate and apply (12-hour format)
  const handleHourInputBlur = () => {
    setHourInputFocused(false);
    const val = hourInput.trim();
    if (val === '') {
      // Convert 24-hour to 12-hour display
      let displayHour;
      if (selectedHour === 0) {
        displayHour = 12; // 0 = 12 AM
      } else if (selectedHour === 12) {
        displayHour = 12; // 12 = 12 PM
      } else if (selectedHour < 12) {
        displayHour = selectedHour; // 1-11 AM
      } else {
        displayHour = selectedHour - 12; // 13-23 PM -> 1-11
      }
      setHourInput(displayHour.toString().padStart(2, '0'));
      return;
    }
    const displayHour = parseInt(val, 10);
    // Validate 12-hour format (1-12)
    if (isNaN(displayHour) || displayHour < 1 || displayHour > 12) {
      setHourInputError(true);
      // Convert 24-hour to 12-hour display for error fallback
      let fallbackDisplayHour;
      if (selectedHour === 0) {
        fallbackDisplayHour = 12;
      } else if (selectedHour === 12) {
        fallbackDisplayHour = 12;
      } else if (selectedHour < 12) {
        fallbackDisplayHour = selectedHour;
      } else {
        fallbackDisplayHour = selectedHour - 12;
      }
      setHourInput(fallbackDisplayHour.toString().padStart(2, '0'));
      return;
    }
    // Convert 12-hour display to 24-hour format
    let hour24;
    if (displayHour === 12) {
      hour24 = isPM ? 12 : 0; // 12 PM = 12, 12 AM = 0
    } else {
      hour24 = isPM ? displayHour + 12 : displayHour; // PM: add 12, AM: keep as is
    }
    // Valid value - apply it and mark as user input
    setSelectedHour(hour24);
    setHourInput(displayHour.toString().padStart(2, '0'));
    const d = new Date();
    d.setHours(hour24, selectedMinute, 0, 0);
    onChange(d);
    // Mark as user inputted and reset automatic flag
    setInteractionState({ hasUserInput: true, isAutomatic: false });
    if (timePickerTarget === 'start') {
      setAutomaticStartTime(false); // User has taken control
    } else {
      setAutomaticEndTime(false); // User has taken control
    }
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
    if (timePickerTarget === 'start') {
      setAutomaticStartTime(false); // User has taken control
    } else {
      setAutomaticEndTime(false); // User has taken control
    }
  };
  // NEW: Handle key press for Enter and Tab
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
        onStartTimeComplete && onStartTimeComplete();
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
          {/* AM/PM Toggle - Always reserve space, but only show on hour step */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '2px',
            opacity: step === 'hour' ? 1 : 0,
            pointerEvents: step === 'hour' ? 'auto' : 'none',
            width: step === 'hour' ? 'auto' : '40px', // Reserve space when hidden
            transition: 'opacity 0s' // Instant visibility change, no transition delay
          }}>
            <button
              type="button"
              onClick={() => handleAMPMToggle(false)}
              style={{
                padding: '6px 8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                background: !isPM ? '#6c63ff' : '#e0e0e0',
                color: !isPM ? 'white' : '#666',
                cursor: 'pointer',
                transition: 'background 0.2s ease, color 0.2s ease' // Only transition colors, not visibility
              }}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => handleAMPMToggle(true)}
              style={{
                padding: '6px 8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                background: isPM ? '#6c63ff' : '#e0e0e0',
                color: isPM ? 'white' : '#666',
                cursor: 'pointer',
                transition: 'background 0.2s ease, color 0.2s ease' // Only transition colors, not visibility
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
              {/* Single ring: 1-12 for hour selection */}
              {hours.map((displayHour, i) => {
                // Convert display hour (1-12) to 24-hour format for comparison
                let hour24;
                if (displayHour === 12) {
                  hour24 = isPM ? 12 : 0; // 12 PM = 12, 12 AM = 0
                } else {
                  hour24 = isPM ? displayHour + 12 : displayHour; // PM: add 12, AM: keep as is
                }
                const isSelected = (hoveredValue !== null ? hoveredValue : selectedHour) === hour24;
                
                return (
                  <button
                    key={displayHour}
                    className={`picker-btn${isSelected ? ' selected' : ''}`}
                    style={{...getCirclePos(i, 12, 40), fontSize: '0.9rem', width: 28, height: 28}}
                    onClick={() => handleHourSelect(displayHour)}
                    onMouseEnter={() => {
                      setHoveredValue(hour24);
                    }}
                    onMouseLeave={() => {
                      setHoveredValue(null);
                    }}
                  >{displayHour}</button>
                );
              })}
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
      setAutomaticStartTime(false);
      setAutomaticEndTime(false);
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
// --- END: Working CircularTimePicker ---

const CircularDurationPicker = ({ value, onChange, onClose, anchorRef, open }) => {
  // Helper to convert minutes to hours and minutes
  const minutesToHoursMinutes = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes };
  };

  // Helper to convert hours and minutes to total minutes
  const hoursMinutesToMinutes = (hours, minutes) => {
    return hours * 60 + minutes;
  };

  // Helper to format duration for display
  const formatDuration = (totalMinutes) => {
    if (totalMinutes === 0) return '0m';
    const { hours, minutes } = minutesToHoursMinutes(totalMinutes);
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  // Set default value to 30 minutes if no value provided
  const getDefaultValue = () => {
    if (value !== undefined) return value;
    return 30; // Default to 30 minutes
  };

  const defaultMinutes = getDefaultValue();
  const defaultHours = Math.floor(defaultMinutes / 60);
  const defaultMinutesRemainder = defaultMinutes % 60;

  const [minuteInputFocused, setMinuteInputFocused] = useState(false);
  
  // Step state for two-step interface
  const [step, setStep] = useState('hour'); // 'hour' or 'minute'
  const [selectedHours, setSelectedHours] = useState(defaultHours);
  const [selectedMinutes, setSelectedMinutes] = useState(defaultMinutesRemainder);
  const [hourInput, setHourInput] = useState(defaultHours.toString());
  const [minuteInput, setMinuteInput] = useState(defaultMinutesRemainder.toString().padStart(2, '0'));
  const [dragging, setDragging] = useState(false);
  const circleRef = useRef(null);
  const [position, setPosition] = useState(null);
  const pickerRef = useRef(null);
  const [hoveredValue, setHoveredValue] = useState(null);
  const [hoveredPosition, setHoveredPosition] = useState(null);
  const [draggedValue, setDraggedValue] = useState(null);
  const [hourInputError, setHourInputError] = useState(false);
  const [minuteInputError, setMinuteInputError] = useState(false);
  const [hourInputFocused, setHourInputFocused] = useState(false);
  
  // Rotation tracking state
  const [currentRotation, setCurrentRotation] = useState(0); // 0-7 rotations (0-7 hours)
  const [completedPositions, setCompletedPositions] = useState(new Set()); // Track which positions completed in current rotation
  const [lastPosition, setLastPosition] = useState(null); // Track last position for sequential validation
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState(null);

  // Clock-like interface: 12 positions, each = 5 minutes
  const clockPositions = Array.from({length: 12}, (_, i) => i * 5); // 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
  const maxRotations = 8; // 8 hours maximum
  const maxMinutes = maxRotations * 60; // 480 minutes
  
  // Hour positions: 0-11
  const hourPositions = Array.from({length: 12}, (_, i) => i); // 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11

  // Sync selected values with value prop
  useEffect(() => {
    if (value !== undefined) {
      const { hours, minutes } = minutesToHoursMinutes(value);
      setSelectedHours(hours);
      setSelectedMinutes(minutes);
    }
  }, [value]);

  // Sync input fields with selected values
  useEffect(() => { 
    if (!hourInputFocused) {
      setHourInput(selectedHours.toString()); 
    }
  }, [selectedHours, hourInputFocused]);
  useEffect(() => { 
    if (!minuteInputFocused) {
      setMinuteInput(selectedMinutes.toString().padStart(2, '0')); 
    }
  }, [selectedMinutes, minuteInputFocused]);

  // Update input display based on hover state (like the time picker)
  useEffect(() => {
    if (step === 'hour' && hoveredValue !== null && !hourInputFocused) {
      setHourInput(hoveredValue.toString().padStart(2, '0'));
    } else if (step === 'hour' && !hourInputFocused) {
      setHourInput(selectedHours.toString().padStart(2, '0'));
    }
  }, [hoveredValue, step, selectedHours, hourInputFocused]);
  useEffect(() => {
    if (step === 'minute' && hoveredValue !== null && !minuteInputFocused) {
      setMinuteInput(hoveredValue.toString().padStart(2, '0'));
    } else if (step === 'minute' && !minuteInputFocused) {
      setMinuteInput(selectedMinutes.toString().padStart(2, '0'));
    }
  }, [hoveredValue, step, selectedMinutes, minuteInputFocused]);



  // Set position and flip/adjust if needed
  useEffect(() => {
    if (open && anchorRef.current && !position) {
      const timer = setTimeout(() => {
        if (pickerRef.current) {
          const anchorRect = anchorRef.current.getBoundingClientRect();
          const pickerRect = pickerRef.current.getBoundingClientRect();
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const margin = 8;
          const pickerHeight = pickerRect.height;
          const pickerWidth = pickerRect.width;

          let finalTop, finalLeft;

          // Determine Vertical Placement
          const posBelow = anchorRect.bottom + margin;
          const posAbove = anchorRect.top - pickerHeight - margin;
          const fitsVerticallyBelow = posBelow + pickerHeight <= vh;
          const fitsVerticallyAbove = posAbove >= margin;

          if (fitsVerticallyBelow) {
            finalTop = posBelow;
          } else if (fitsVerticallyAbove) {
            finalTop = posAbove;
          } else {
            finalTop = (vh - pickerHeight) / 2;
          }

          // Determine Horizontal Placement - center on anchor, clamp to viewport
          finalLeft = anchorRect.left + (anchorRect.width / 2) - (pickerWidth / 2);
          if (finalLeft + pickerWidth > vw - margin) {
            finalLeft = vw - pickerWidth - margin;
          }
          if (finalLeft < margin) {
            finalLeft = margin;
          }
          
          setPosition({ top: finalTop + window.scrollY, left: finalLeft + window.scrollX });
        }
      }, 0);

      return () => clearTimeout(timer);
    }
    
    if (!open && position) {
      setPosition(null);
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
      pointerEvents: 'none',
    };
  };

  const updateDuration = useCallback((hours, minutes) => {
    const totalMinutes = hoursMinutesToMinutes(hours, minutes);
    onChange(totalMinutes);
  }, [onChange]);

  const handleHourSelect = useCallback((h) => {
    setSelectedHours(h);
    setHourInput(h.toString());
    // Don't update duration yet - wait for minute selection
    setStep('minute');
  }, []);

  // Debug effect to track step changes
  useEffect(() => {
    // Step changed
  }, [step]);

  const handleMinuteSelect = useCallback((m, eventType = 'click', event = null) => {
    setSelectedMinutes(m);
    setMinuteInput(m.toString().padStart(2, '0'));
    // Update the duration with the new minute value - use functional update to ensure latest state
    setSelectedHours(currentHours => {
      const totalMinutes = hoursMinutesToMinutes(currentHours, m);
      onChange(totalMinutes);
      return currentHours; // Return same value to avoid changing state
    });
    // Auto-close the picker on mouse interaction
    if (eventType === 'mouse') {
      onClose();
    }
  }, [onChange, onClose]);

  // Helper function to ensure duration calculation uses current input values
  const updateDurationFromCurrentInputs = useCallback(() => {
    const currentHourInput = parseInt(hourInput, 10) || 0;
    const currentMinuteInput = parseInt(minuteInput, 10) || 0;
    const totalMinutes = hoursMinutesToMinutes(currentHourInput, currentMinuteInput);
    onChange(totalMinutes);
  }, [hourInput, minuteInput, onChange]);

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
    
    // Calculate which hour position we're at (0-11)
    const position = Math.round(((angle + 2*Math.PI) % (2*Math.PI)) / (2*Math.PI) * 12) % 12;
    const hour = hourPositions[position];
    return hour;
  }, [hourPositions]);

  // Calculate minute from mouse position (simple version for dragging)
  const calculateMinuteFromPosition = useCallback((e) => {
    if (!circleRef.current) return null;
    const rect = circleRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width/2;
    const y = e.clientY - rect.top - rect.height/2;
    const angle = Math.atan2(y, x) + Math.PI/2;
    const r = Math.sqrt(x*x + y*y);
    
    // Only work if click is within the circle
    if (r > rect.width * 0.4) return null;
    
    // Calculate which minute position we're at (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
    const position = Math.round(((angle + 2*Math.PI) % (2*Math.PI)) / (2*Math.PI) * 12) % 12;
    const minute = clockPositions[position];
    return minute;
  }, [clockPositions]);

  // Calculate total minutes from mouse position (controlled rotations with sequential validation)
  const calculateMinutesFromPosition = useCallback((e) => {
    if (!circleRef.current) return null;
    const rect = circleRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width/2;
    const y = e.clientY - rect.top - rect.height/2;
    const angle = Math.atan2(y, x) + Math.PI/2;
    const r = Math.sqrt(x*x + y*y);
    
    // Only work if click is within the circle
    if (r > rect.width * 0.4) return null;
    
    // Calculate precise minute position (0-59) for smooth dragging
    const minutePosition = ((angle + 2*Math.PI) % (2*Math.PI)) / (2*Math.PI) * 60;
    const preciseMinutes = Math.round(minutePosition);
    
    // If not dragging, just return the precise position (no rotations)
    if (!isDragging) {
      return preciseMinutes;
    }
    
    // For dragging: implement rotation logic with precise minutes
    // Find the nearest 5-minute interval for validation
    const nearestInterval = Math.round(preciseMinutes / 5) * 5;
    const expectedNextInterval = getNextExpectedPosition();
    
    // Check if the nearest interval is valid for the current rotation
    if (nearestInterval === expectedNextInterval) {
      // Valid next interval in sequence
      const newCompletedPositions = new Set(completedPositions);
      newCompletedPositions.add(nearestInterval);
      setCompletedPositions(newCompletedPositions);
      setLastPosition(nearestInterval);
      
      // Calculate total minutes with precise value
      const totalMinutes = (currentRotation * 60) + preciseMinutes;
      return totalMinutes;
    } else if (completedPositions.size === 12 && nearestInterval === 0) {
      // Special case: completed all 12 positions and reached 0 again - advance to next rotation
      const nextRotation = Math.min(currentRotation + 1, 7); // Max 8 rotations (0-7)
      setCurrentRotation(nextRotation);
      setCompletedPositions(new Set([0]));
      setLastPosition(0);
      
      // Calculate total minutes with precise value
      const totalMinutes = (nextRotation * 60) + preciseMinutes;
      return totalMinutes;
    } else if (completedPositions.size === 0 && nearestInterval === 0) {
      // Special case: starting a new rotation at position 0
      const newCompletedPositions = new Set([0]);
      setCompletedPositions(newCompletedPositions);
      setLastPosition(0);
      
      const totalMinutes = (currentRotation * 60) + preciseMinutes;
      return totalMinutes;
    } else {
      // Invalid interval - stay in current rotation but allow precise minutes
      const totalMinutes = (currentRotation * 60) + preciseMinutes;
      return totalMinutes;
    }
  }, [isDragging, currentRotation, completedPositions, lastPosition]);
  
  // Helper function to get the next expected position in clockwise sequence
  const getNextExpectedPosition = useCallback(() => {
    if (completedPositions.size === 0) {
      return 0; // Start with 0
    }
    
    // Find the highest completed position
    const maxCompleted = Math.max(...Array.from(completedPositions));
    
    // Next position should be the next 5-minute increment
    const nextPosition = (maxCompleted + 5) % 60;
    
    return nextPosition;
  }, [completedPositions]);

  // Handle mouse move for hover (simplified like time picker)
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
    if (step === 'hour') {
      // In hour step, calculate hour from position and update selected hour
      const hour = calculateHourFromPosition(e);
      if (hour !== null) {
        setSelectedHours(hour);
        setDraggedValue(hour);
        // Update duration with dragged hour and current minute for real-time feedback
        const totalMinutes = hoursMinutesToMinutes(hour, selectedMinutes);
        onChange(totalMinutes);
      }
    } else {
      // In minute step, calculate minute from position and update selected minute
      const minute = calculateMinuteFromPosition(e);
      if (minute !== null) {
        setSelectedMinutes(minute);
        setDraggedValue(minute);
        // Update duration with current hour and dragged minute for real-time feedback
        const totalMinutes = hoursMinutesToMinutes(selectedHours, minute);
        onChange(totalMinutes);
      }
    }
  }, [step, calculateHourFromPosition, calculateMinuteFromPosition, selectedHours, selectedMinutes, onChange]);

  const handleMouseDown = useCallback((e) => { 
    // Don't interfere if clicking on a button element or its children
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      return;
    }
    
    // Clear any existing hover state to prevent conflicts
    setHoveredValue(null);
    setHoveredPosition(null);
    
    setDragStartPos({ x: e.clientX, y: e.clientY });
    // Only process the click if it's on a valid position
    if (step === 'hour') {
      const hour = calculateHourFromPosition(e);
      if (hour !== null) {
        handleDrag(e);
      }
    } else {
      const minute = calculateMinuteFromPosition(e);
      if (minute !== null) {
        handleDrag(e);
      }
    }
  }, [handleDrag, step, calculateHourFromPosition, calculateMinuteFromPosition]);
  const handleMouseMove = useCallback((e) => { 
    if (dragStartPos && !isDragging) {
      // Check if we've moved enough to start dragging
      const distance = Math.sqrt(
        Math.pow(e.clientX - dragStartPos.x, 2) + 
        Math.pow(e.clientY - dragStartPos.y, 2)
      );
      if (distance > 10) { // Increased threshold to 10px for better click detection
        setIsDragging(true);
        setDragging(true);
      }
    }
    if (dragging || isDragging) {
      handleDrag(e); 
    }
  }, [dragging, isDragging, handleDrag, dragStartPos]);
  const handleMouseUp = useCallback(() => {
    // Clear hover state to prevent conflicts
    setHoveredValue(null);
    setHoveredPosition(null);
    
    if (isDragging) {
      // If we were dragging, handle the final selection
      if (step === 'hour') {
        // Auto-advance to minute step when dragging ends on hour screen
        setStep('minute');
      } else {
        // On minute screen, auto-close the picker after drag
        onClose();
      }
    } else {
      // If we weren't dragging, this was a click - handle auto-advancing
      if (step === 'hour') {
        // Auto-advance to minute step for clicks on hour screen
        setStep('minute');
      } else {
        // Auto-close for clicks on minute screen
        onClose();
      }
    }
    
    setIsDragging(false);
    setDragging(false);
    setDraggedValue(null);
    setDragStartPos(null);
    
    // Reset rotation if drag ended without completing a full rotation
    if (completedPositions.size < 12) {
      setCurrentRotation(0);
      setCompletedPositions(new Set());
      setLastPosition(null);
    }
  }, [completedPositions.size, isDragging, step, onClose]);
  const handleTouchStart = useCallback((e) => { 
    // Don't interfere if touching on a button element
    if (e.target.tagName === 'BUTTON') {
      return;
    }
    
    setDragStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    // Only process the touch if it's on a valid position
    if (step === 'hour') {
      const hour = calculateHourFromPosition(e);
      if (hour !== null) {
        handleDrag(e);
      }
    } else {
      const minute = calculateMinuteFromPosition(e);
      if (minute !== null) {
        handleDrag(e);
      }
    }
  }, [handleDrag, step, calculateHourFromPosition, calculateMinuteFromPosition]);
  const handleTouchMove = useCallback((e) => { 
    if (dragStartPos && !isDragging) {
      // Check if we've moved enough to start dragging
      const distance = Math.sqrt(
        Math.pow(e.touches[0].clientX - dragStartPos.x, 2) + 
        Math.pow(e.touches[0].clientY - dragStartPos.y, 2)
      );
      if (distance > 10) { // Increased threshold to 10px for better click detection
        setIsDragging(true);
        setDragging(true);
      }
    }
    if (dragging) handleDrag(e); 
  }, [dragging, handleDrag, dragStartPos, isDragging]);
  const handleTouchEnd = useCallback(() => {
    // Clear hover state to prevent conflicts
    setHoveredValue(null);
    setHoveredPosition(null);
    
    if (isDragging) {
      // If we were dragging, handle the final selection
      if (step === 'hour') {
        // Auto-advance to minute step when dragging ends on hour screen
        setStep('minute');

      } else {
        // On minute screen, auto-close the picker after drag
        onClose();
      }
    } else {
      // If we weren't dragging, this was a touch click - handle auto-advancing
      if (step === 'hour') {
        // Auto-advance to minute step for touch clicks on hour screen
        setStep('minute');

      } else {
        // Auto-close for touch clicks on minute screen
        onClose();
      }
    }
    
    setIsDragging(false);
    setDragging(false);
    setDraggedValue(null);
    setDragStartPos(null);
    
    // Reset rotation if drag ended without completing a full rotation
    if (completedPositions.size < 12) {
      setCurrentRotation(0);
      setCompletedPositions(new Set());
      setLastPosition(null);
    }
  }, [completedPositions.size, isDragging, step, onClose]);

  useEffect(() => {
    // Always add mouse up listener when we have a drag start position
    if (dragStartPos) {
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
  }, [dragStartPos, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Input handlers for minutes only
  const handleHourInputChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2);
    setHourInput(val);
    setHourInputError(false); // Clear error when user types
    if (val === '') {
      setSelectedHours(0);
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 11) {
      setSelectedHours(num);
      // Update the duration pill in real-time
      const totalMinutes = hoursMinutesToMinutes(num, selectedMinutes);
      onChange(totalMinutes);
    }
  };

  const handleMinuteInputChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2);
    setMinuteInput(val);
    setMinuteInputError(false); // Clear error when user types

    if (val === '') {
      setSelectedMinutes(0);
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 59) {
      setSelectedMinutes(num);
      // Update the duration pill in real-time
      const totalMinutes = hoursMinutesToMinutes(selectedHours, num);
      onChange(totalMinutes);

    }
  };

  // Handle input focus - always clear when clicked
  const handleHourInputFocus = () => {
    setStep('hour');
    setHourInputFocused(true);
    setHourInputError(false);
    // Always clear the input when clicked
    setHourInput('');
  };

  const handleMinuteInputFocus = () => {
    setStep('minute');
    setMinuteInputFocused(true);
    setMinuteInputError(false);
    // Always clear the input when clicked
    setMinuteInput('');
  };

  // Handle input blur - validate and apply
  const handleHourInputBlur = () => {
    setHourInputFocused(false);
    const val = hourInput.trim();
    if (val === '') {
      setHourInput(selectedHours.toString());
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0 || num > 11) {
      setHourInputError(true);
      setHourInput(selectedHours.toString());
      return;
    }
    // Valid value - apply it
    setSelectedHours(num);
    setHourInput(num.toString());
    const totalMinutes = hoursMinutesToMinutes(num, selectedMinutes);
    onChange(totalMinutes);
  };

  const handleMinuteInputBlur = () => {
    setMinuteInputFocused(false);
    const val = minuteInput.trim();
    if (val === '') {
      setMinuteInput(selectedMinutes.toString().padStart(2, '0'));
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0 || num > 59) {
      setMinuteInputError(true);
      setMinuteInput(selectedMinutes.toString().padStart(2, '0'));
      return;
    }
    // Valid value - apply it
    setSelectedMinutes(num);
    setMinuteInput(num.toString().padStart(2, '0'));
    const totalMinutes = hoursMinutesToMinutes(selectedHours, num);
    onChange(totalMinutes);
  };

  // Handle key press for Enter and Tab
  const handleHourInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleHourInputBlur();
      if (e.key === 'Tab') {
        // Focus minute input
        const minuteInputElement = document.querySelector('.picker-input[aria-label="Minutes"]');
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
      // Auto-close for Enter key
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleMinuteInputBlur();
      // For Tab key, just close the picker
      onClose();
    }
  };

  const handleOK = () => {
    onClose && onClose();
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

  const currentDuration = formatDuration(value || 0);

  const picker = (
    <div ref={pickerRef} className="custom-duration-picker-modal" style={pickerStyle} onMouseDown={(e) => e.stopPropagation()}>
      <div className="circular-duration-picker light-theme">
        <div className="picker-display" style={{gap: '0.2em'}}>
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
            aria-label="Hours"
          />
          <span className="picker-colon" style={{fontSize: '1.8rem', marginRight: '0.3em', color: '#6c63ff', fontWeight: 600}}>H</span>
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
              transition: 'all 0.2s ease'
            }}
            aria-label="Minutes"
          />
          <span className="picker-colon" style={{fontSize: '1.8rem', marginLeft: '0.3em', color: '#6c63ff', fontWeight: 600}}>M</span>
        </div>
        <div
          className="picker-circle-container"
          ref={circleRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onMouseMove={handleCircleMouseMove}
          onMouseLeave={handleCircleMouseLeave}
        >
          <div className="picker-circle">
            {step === 'hour' ? (
              // Hour selection: 12 positions (0-11) - using same sizing as time picker
              hourPositions.map((hour, i) => (
                <button
                  key={hour}
                  className={`picker-btn${(hoveredValue !== null ? hoveredValue : selectedHours) === hour ? ' selected' : ''}`}
                  style={{...getCirclePos(i, 12, 40), fontSize: '0.9rem', width: 28, height: 28}}
                  onClick={() => handleHourSelect(hour)}
                  onMouseEnter={() => {
                    setHoveredValue(hour);
                  }}
                  onMouseLeave={() => {
                    setHoveredValue(null);
                  }}
                >
                  {hour}
                </button>
              ))
            ) : (
              // Minute selection: 12 positions (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55) - using same sizing as time picker
              clockPositions.map((minutes, i) => (
                <button
                  key={minutes}
                  className={`picker-btn${(hoveredValue !== null ? hoveredValue : selectedMinutes) === minutes ? ' selected' : ''}`}
                  style={{...getCirclePos(i, 12, 40), fontSize: '0.9rem', width: 28, height: 28}}
                  onClick={() => handleMinuteSelect(minutes)}
                  onMouseEnter={() => {
                    setHoveredValue(minutes);
                  }}
                  onMouseLeave={() => {
                    setHoveredValue(null);
                  }}
                  onMouseUp={e => handleMinuteSelect(minutes, 'mouse', e)}
                  onTouchEnd={e => handleMinuteSelect(minutes, 'mouse', e)}
                >
                  {minutes}
                </button>
              ))
            )}
          </div>
        </div>
        <div className="picker-actions">
          <button className="picker-cancel" onClick={onClose}>Cancel</button>
          <button className="picker-ok" onClick={handleOK}>OK</button>
        </div>
      </div>
    </div>
  );

  if (!open) {
    return null;
  }

  return ReactDOM.createPortal(picker, document.body);
};

const TaskCreationCard = ({ onAdd, onCancel, flippedX, flippedY, onDatePickerClose, onTimePickerClose, defaultStartTime, defaultEndTime, defaultDeadline, editingTask, onUpdate, showPlusCircle = true, onTimesChange }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline || null);
  const [priority, setPriority] = useState(3);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const priorityDropdownRef = useRef(null);
  
  const [energy, setEnergy] = useState(3);
  const [showEnergyDropdown, setShowEnergyDropdown] = useState(false);
  const energyDropdownRef = useRef(null);
  const [creationType, setCreationType] = useState('event'); // 'event' or 'task'
  
  // Adjustable positioning offset for task type pill
  const taskTypePillLeftOffset = -50; // Adjust left/right position (negative = left, positive = right)
  // Use defaultStartTime and defaultEndTime if provided
  const [startTime, setStartTime] = useState(defaultStartTime || null); // Date or null
  const [endTime, setEndTime] = useState(defaultEndTime || null); // Date or null
  
  // Duration for tasks (in minutes)
  const [taskDuration, setTaskDuration] = useState(30); // Default 30 minutes
  
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState(null); // 'start' or 'end'
  const startTimePillRef = useRef(null);
  const endTimePillRef = useRef(null);
  const durationPillRef = useRef(null);
  const cardRef = useRef(null);
  // Track if automatic values were set by +/-1 hour logic
  const [automaticStartTime, setAutomaticStartTime] = useState(false);
  const [automaticEndTime, setAutomaticEndTime] = useState(false);
  
  // Duration picker state
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  // State to control date picker open/close
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [taskTypes, setTaskTypes] = useState(DEFAULT_TASK_TYPES);
  const [taskType, setTaskType] = useState(taskTypes[0]);
  const [showTaskTypeDropdown, setShowTaskTypeDropdown] = useState(false);
  const taskTypeDropdownRef = useRef(null);
  
  // Date picker drag states
  const [isDraggingDate, setIsDraggingDate] = useState(false);
  const [draggedDate, setDraggedDate] = useState(null);
  const datePickerRef = useRef(null);
  const onTimesChangeRef = useRef(onTimesChange);
  onTimesChangeRef.current = onTimesChange;

  const defaultStartMs = defaultStartTime instanceof Date ? defaultStartTime.getTime() : null;
  const defaultEndMs = defaultEndTime instanceof Date ? defaultEndTime.getTime() : null;

  React.useEffect(() => {
    if (editingTask) return;
    if (defaultStartMs != null) setStartTime(new Date(defaultStartMs));
    if (defaultEndMs != null) setEndTime(new Date(defaultEndMs));
  }, [editingTask, defaultStartMs, defaultEndMs]);

  React.useEffect(() => {
    onTimesChangeRef.current?.(startTime, endTime);
  }, [startTime, endTime]);

  // Populate fields when editingTask is provided
  React.useEffect(() => {
    if (editingTask) {
      setName(editingTask.title || editingTask.name || '');
      setDescription(editingTask.description || '');
      
      // Parse deadline
      if (editingTask.deadline) {
        if (editingTask.deadline instanceof Date) {
          setDeadline(editingTask.deadline);
        } else if (typeof editingTask.deadline === 'string') {
          const [year, month, day] = editingTask.deadline.split('-').map(Number);
          setDeadline(new Date(year, month - 1, day));
        }
      }
      
      setPriority(editingTask.priority || 3);
      setEnergy(editingTask.energy || 3);
      setTaskDuration(editingTask.duration || 30);
      setCreationType(editingTask.type || 'task');
      
      // Set task type
      if (editingTask.taskType) {
        const foundType = taskTypes.find(t => t.name === editingTask.taskType.name || t.name === editingTask.taskType);
        if (foundType) {
          setTaskType(foundType);
        }
      }
      
      // Parse startTime and endTime if they exist
      if (editingTask.startTime) {
        // If it's a string like "14:30", parse it
        if (typeof editingTask.startTime === 'string') {
          const [hours, minutes] = editingTask.startTime.split(':').map(Number);
          const startDate = new Date();
          startDate.setHours(hours, minutes || 0, 0, 0);
          setStartTime(startDate);
        } else if (editingTask.startTime instanceof Date) {
          setStartTime(editingTask.startTime);
        }
      }
      
      if (editingTask.endTime) {
        if (typeof editingTask.endTime === 'string') {
          const [hours, minutes] = editingTask.endTime.split(':').map(Number);
          const endDate = new Date();
          endDate.setHours(hours, minutes || 0, 0, 0);
          setEndTime(endDate);
        } else if (editingTask.endTime instanceof Date) {
          setEndTime(editingTask.endTime);
        }
      }
    }
  }, [editingTask, taskTypes]);

  // Close dropdown if clicked outside
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target)) {
        setShowPriorityDropdown(false);
      }
      if (taskTypeDropdownRef.current && !taskTypeDropdownRef.current.contains(event.target)) {
        setShowTaskTypeDropdown(false);
      }
      if (durationPillRef.current && !durationPillRef.current.contains(event.target)) {
        setShowDurationPicker(false);
      }
      if (energyDropdownRef.current && !energyDropdownRef.current.contains(event.target)) {
        setShowEnergyDropdown(false);
      }
    }
    if (showPriorityDropdown || showTaskTypeDropdown || showDurationPicker || showEnergyDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPriorityDropdown, showTaskTypeDropdown, showDurationPicker, showEnergyDropdown]);

  // Helper to format duration for display
  const formatDuration = (totalMinutes) => {
    if (totalMinutes === 0) return '0m';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const handleAdd = () => {
    if (!name.trim() || !deadline) return;
    
    // If editing, call onUpdate instead
    if (editingTask && onUpdate) {
      if (creationType === 'event') {
        if (!startTime || !endTime) return;
        // Compute endDeadline if endTime is less than startTime (cross-day)
        let endDeadline = null;
        const startHour = startTime.getHours();
        const startMinute = startTime.getMinutes();
        const endHour = endTime.getHours();
        const endMinute = endTime.getMinutes();
        if (endHour < startHour || (endHour === startHour && endMinute < startMinute)) {
          // End is on the next day
          const endDateObj = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
          endDateObj.setDate(endDateObj.getDate() + 1);
          endDeadline = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
        }
        const taskData = {
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
          type: creationType,
        };
        onUpdate(taskData);
      } else {
        // Task update
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
          type: creationType,
        };
        onUpdate(taskData);
      }
      return;
    }
    
    if (creationType === 'event') {
      if (!startTime || !endTime) return;
      // Compute endDeadline if endTime is less than startTime (cross-day)
      let endDeadline = null;
      const startHour = startTime.getHours();
      const startMinute = startTime.getMinutes();
      const endHour = endTime.getHours();
      const endMinute = endTime.getMinutes();
      if (endHour < startHour || (endHour === startHour && endMinute < startMinute)) {
        // End is on the next day
        const endDateObj = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
        endDateObj.setDate(endDateObj.getDate() + 1);
        endDeadline = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      }
      const taskData = {
        name,
        description,
        month: deadline.getMonth() + 1,
        day: deadline.getDate(),
        year: deadline.getFullYear(),
        priority,
        deadline: `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}-${String(deadline.getDate()).padStart(2, '0')}`,
        startTime: startTime ? formatTime(startTime, '24') : null,
        endTime: endTime ? formatTime(endTime, '24') : null,
        endDeadline, // null if not cross-day
        taskType,
        type: creationType, // 'event' or 'task'
      };
  
      if (onAdd) {
        onAdd(taskData);
      }
    } else {
      // Task creation
      const taskData = {
        name,
        description,
        month: deadline.getMonth() + 1,
        day: deadline.getDate(),
        year: deadline.getFullYear(),
        priority,
        energy,
        deadline: `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}-${String(deadline.getDate()).padStart(2, '0')}`,
        duration: taskDuration, // Duration in minutes
        taskType,
        type: creationType, // 'event' or 'task'
      };
  
      if (onAdd) {
        onAdd(taskData);
      }
    }
    
    setName('');
    setDescription('');
    setDeadline(null);
    setPriority(3);
    setEnergy(3);
    setStartTime(null);
    setEndTime(null);
    setTaskDuration(30);
  };

  const handleCancel = React.useCallback(() => {
    setName('');
    setDescription('');
    setDeadline(null);
    setPriority(3);
    setEnergy(3);
    setStartTime(null);
    setEndTime(null);
    setTaskDuration(30);
    setShowTimePicker(false);
    setTimePickerTarget(null);
    setShowDurationPicker(false);
    setIsDatePickerOpen(false);
    setShowPriorityDropdown(false);
    setShowEnergyDropdown(false);
    setShowTaskTypeDropdown(false);
    onCancel && onCancel();
  }, [onCancel]);

  // Method to close date picker
  const closeDatePicker = React.useCallback(() => {
    setIsDatePickerOpen(false);
    onDatePickerClose && onDatePickerClose();
  }, [onDatePickerClose]);

  // Expose closeTimePicker method to parent
  const closeTimePicker = React.useCallback(() => {
    setShowTimePicker(false);
    setTimePickerTarget(null);
  }, []);

  // Helper function to calculate end time (start time + 1 hour)
  const calculateEndTime = useCallback((startTime) => {
    if (!startTime) return null;
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    return endTime;
  }, []);

  // Handle start time completion - auto-transition to end time
  const handleStartTimeComplete = useCallback(() => {
    if (startTime) {
      const calculatedEndTime = new Date(startTime);
      calculatedEndTime.setHours(calculatedEndTime.getHours() + 1);
      setEndTime(calculatedEndTime);
      setAutomaticEndTime(true);
      setTimePickerTarget('end');
      // Keep the time picker open for end time selection
      setShowTimePicker(true);
    }
  }, [startTime]);

  // Handle end time completion - close picker
  const handleEndTimeComplete = useCallback(() => {
    if (endTime) {
      setShowTimePicker(false);
      setTimePickerTarget(null);
    }
  }, [endTime, startTime]);

  // Date picker drag functionality
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingDate) return;
      
      // Find all date elements in the calendar
      const calendar = document.querySelector('.custom-datepicker-calendar');
      if (!calendar) return;
      
      const dateElements = calendar.querySelectorAll('.react-datepicker__day:not(.react-datepicker__day--outside-month):not(.react-datepicker__day--disabled)');
      let targetDate = null;
      
      // Remove previous drag highlight
      const prevHighlighted = calendar.querySelector('.react-datepicker__day.drag-highlighted');
      if (prevHighlighted) {
        prevHighlighted.classList.remove('drag-highlighted');
      }
      
      for (const element of dateElements) {
        const rect = element.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && 
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          // Add drag highlight to this element
          element.classList.add('drag-highlighted');
          
          // Extract date from the element's aria-label which contains full date info
          const ariaLabel = element.getAttribute('aria-label');
          if (ariaLabel) {
            // Parse the aria-label (e.g., "Choose Monday, September 2nd, 2024")
            const dateMatch = ariaLabel.match(/(\w+),\s+(\w+)\s+(\d+)(?:st|nd|rd|th),\s+(\d+)/);
            if (dateMatch) {
              const [, , monthName, day, year] = dateMatch;
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                 'July', 'August', 'September', 'October', 'November', 'December'];
              const monthIndex = monthNames.indexOf(monthName);
              if (monthIndex !== -1) {
                targetDate = new Date(parseInt(year), monthIndex, parseInt(day));
              }
            }
          }
          
          // Fallback to current approach if aria-label parsing fails
          if (!targetDate) {
            const dateText = element.textContent;
            if (dateText && !isNaN(dateText)) {
              const currentMonth = deadline ? deadline.getMonth() : new Date().getMonth();
              const currentYear = deadline ? deadline.getFullYear() : new Date().getFullYear();
              targetDate = new Date(currentYear, currentMonth, parseInt(dateText));
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
      // Clean up drag highlighting
      const calendar = document.querySelector('.custom-datepicker-calendar');
      if (calendar) {
        const highlighted = calendar.querySelector('.react-datepicker__day.drag-highlighted');
        if (highlighted) {
          highlighted.classList.remove('drag-highlighted');
        }
      }
      
      if (isDraggingDate && draggedDate) {
        setDeadline(draggedDate);
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
        // Calendar might not be rendered yet, try again
        setTimeout(addCalendarListeners, 100);
        return;
      }

      const handleMouseDown = (e) => {
        // Check if we're clicking on a date cell
        const dateElement = e.target.closest('.react-datepicker__day:not(.react-datepicker__day--outside-month):not(.react-datepicker__day--disabled)');
        if (dateElement) {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingDate(true);
          
          // Set initial dragged date using aria-label for accurate month/year
          const ariaLabel = dateElement.getAttribute('aria-label');
          let initialDate = null;
          
          if (ariaLabel) {
            // Parse the aria-label (e.g., "Choose Monday, September 2nd, 2024")
            const dateMatch = ariaLabel.match(/(\w+),\s+(\w+)\s+(\d+)(?:st|nd|rd|th),\s+(\d+)/);
            if (dateMatch) {
              const [, , monthName, day, year] = dateMatch;
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                 'July', 'August', 'September', 'October', 'November', 'December'];
              const monthIndex = monthNames.indexOf(monthName);
              if (monthIndex !== -1) {
                initialDate = new Date(parseInt(year), monthIndex, parseInt(day));
              }
            }
          }
          
          // Fallback to current approach if aria-label parsing fails
          if (!initialDate) {
            const dateText = dateElement.textContent;
            if (dateText && !isNaN(dateText)) {
              const currentMonth = deadline ? deadline.getMonth() : new Date().getMonth();
              const currentYear = deadline ? deadline.getFullYear() : new Date().getFullYear();
              initialDate = new Date(currentYear, currentMonth, parseInt(dateText));
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

    // Add listeners after a short delay to ensure calendar is rendered
    const cleanup = addCalendarListeners();
    
    return cleanup;
  }, [isDatePickerOpen, deadline]);

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      // Ensure time picker is closed when component unmounts
      setShowTimePicker(false);
      setTimePickerTarget(null);
      setIsDraggingDate(false);
      setDraggedDate(null);
    };
  }, []);

  // Pass closeDatePicker and closeTimePicker methods to parent
  useEffect(() => {
    if (onDatePickerClose) {
      onDatePickerClose(closeDatePicker);
    }
    if (onTimePickerClose) {
      onTimePickerClose(closeTimePicker);
    }
  }, [closeDatePicker, closeTimePicker, onDatePickerClose, onTimePickerClose]);

  return (
    <div ref={cardRef} className={`task-creation-card${flippedX ? ' flipped-x' : ''}${flippedY ? ' flipped-y' : ''}`} style={{overflow: 'visible'}}>
      {showPlusCircle && (
        <div className="plus-circle">
          <span className="plus-sign">+</span>
        </div>
      )}
      <div className="card-content">
        {/* Event/Task Toggle */}
        <div style={{
          position: 'absolute',
          top: '2rem',
          right: '1rem',
          display: 'flex',
          flexShrink: 0,
          background: '#2e0066',
          borderRadius: '999px',
          padding: '0.1rem',
          border: '1px solid #a084e8',
          zIndex: 20
        }}>
          <button
            onClick={() => { setCreationType('event'); setShowTimePicker(false); setShowDurationPicker(false); }}
            tabIndex={-1}
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
          <button
            onClick={() => { setCreationType('task'); setShowTimePicker(false); setShowDurationPicker(false); }}
            tabIndex={-1}
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
        </div>
        <div className="task-title-row" style={{display: 'flex', alignItems: 'center', width: '100%', minWidth: 0, marginBottom: '0.2rem', position: 'relative', overflow: 'visible'}}>
          <div
            className="tasktype-badge tasktype-pill-dropdown"
            style={{
              background: TASK_TYPE_COLORS[taskType]+"22",
              color: taskType === 'School' ? '#1565c0' : TASK_TYPE_COLORS[taskType],
              cursor: 'pointer',
              position: 'absolute',
              left: `${228 + taskTypePillLeftOffset}px`,
              top: 0,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              padding: '0 0.7rem',
              height: 25,
              lineHeight: '25px',
              whiteSpace: 'nowrap',
              transition: 'width 0.2s',
              minWidth: 0,
              display: 'inline-flex',
              zIndex: showTaskTypeDropdown ? 10001 : 10,
            }}
            onClick={() => { setShowTaskTypeDropdown(v => !v); setShowTimePicker(false); setShowDurationPicker(false); }}
            ref={taskTypeDropdownRef}
            tabIndex={0}
          >
            <span style={{display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: TASK_TYPE_COLORS[taskType], marginRight: 6, verticalAlign: 'middle'}}></span>
            <span className="tasktype-label">{taskType}</span>
            {showTaskTypeDropdown && (
              <div className="tasktype-dropdown-menu" style={{ position: 'absolute', left: 0, top: '110%', background: '#fff', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8, borderRadius: 16, boxShadow: '0 2px 8px 0 rgba(60,60,60,0.10)', paddingTop: 8, paddingLeft: 4, paddingRight: 4, minWidth: 120, zIndex: 10000 }}>
                {taskTypes.map((type, idx) => (
                  <div
                    key={type}
                    className="tasktype-dropdown-item"
                    style={{
                      background: TASK_TYPE_COLORS[type]+"22",
                      color: type === 'School' ? '#1565c0' : TASK_TYPE_COLORS[type],
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '0 0.7rem',
                      height: 25,
                      lineHeight: '25px',
                      margin: 0,
                      whiteSpace: 'nowrap',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onClick={e => { e.stopPropagation(); setTaskType(type); setShowTaskTypeDropdown(false); }}
                  >
                    <span style={{display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: TASK_TYPE_COLORS[type], marginRight: 6, verticalAlign: 'middle'}}></span>
                    {type}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            className="task-title-input"
            placeholder={creationType === 'event' ? 'Event Name' : 'Task Name'}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus={false}
            style={{
              fontSize: '1rem',
              fontFamily: "'Karla', sans-serif"
            }}
          />
        </div>
        
        {/* Description Input - moved below task name */}
        <div className="task-desc-wrap" style={{ marginBottom: '0.5rem' }}>
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            autoFocus={false}
            style={{
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              padding: '0.5rem 0',
              borderRadius: '0',
              border: 'none',
              background: 'white',
              color: '#333',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.2s ease',
              fontFamily: 'inherit',
              marginLeft: '0',
              marginRight: '0',
              overflow: 'hidden'
            }}
          />
        </div>
        {/* Pills Row: Date + Time + Priority */}
        <div className="pill-row pill-row-combined" style={{ position: 'relative' }}>
          <div style={{ display: 'inline-block', position: 'relative' }}>
          <DatePicker
            ref={datePickerRef}
            selected={isDraggingDate ? draggedDate : deadline}
            openToDate={editingTask ? (() => {
              // When editing, always open to today's month
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return today;
            })() : (deadline || new Date())}
            onChange={date => {
              if (!isDraggingDate) {
                setDeadline(date);
              }
            }}
            customInput={<DatePillsInput isDatePickerOpen={isDatePickerOpen} />}
            calendarClassName={`custom-datepicker-calendar${isDraggingDate ? ' dragging' : ''}`}

            dropdownMode="select"
            showPopperArrow={false}
            popperPlacement="bottom-start"

            portalId={null}
            popperClassName="aridia-datepicker-popper"
            open={isDatePickerOpen}
            onCalendarOpen={() => { setIsDatePickerOpen(true); setShowTimePicker(false); setShowDurationPicker(false); }}
            onCalendarClose={() => { 
              setIsDatePickerOpen(false); 
              setIsDraggingDate(false); 
              setDraggedDate(null);
              // Remove focus from any focused elements to clear active states
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
              // Remove focus from any focused elements to clear active states
              if (document.activeElement) {
                document.activeElement.blur();
              }
            }}
            onChangeRaw={e => e.preventDefault()}
            closeOnScroll={true}
            onInputClick={() => { setIsDatePickerOpen(true); setShowTimePicker(false); setShowDurationPicker(false); }}
            shouldCloseOnSelect={!isDraggingDate}
          />
          </div>
          {/* Time Pills for Events, Duration for Tasks */}
          {creationType === 'event' ? (
            <>
              <span
                className={`pill pill-time pill-time-trigger${showTimePicker && timePickerTarget === 'start' ? ' active' : ''}`}
                tabIndex={0}
                role="button"
                title="Pick start time"
                ref={startTimePillRef}
                onClick={() => { 
                  if (showTimePicker) {
                    setTimePickerTarget('start');
                    if (!startTime && endTime) {
                      const calculatedStartTime = new Date(endTime);
                      calculatedStartTime.setHours(calculatedStartTime.getHours() - 1);
                      setStartTime(calculatedStartTime);
                    }
                  } else {
                    setShowTimePicker(true); 
                    setTimePickerTarget('start'); 
                    if (!startTime && endTime) {
                      const calculatedStartTime = new Date(endTime);
                      calculatedStartTime.setHours(calculatedStartTime.getHours() - 1);
                      setStartTime(calculatedStartTime);
                    }
                  }
                }}
              >{startTime ? formatTime(startTime, '24') : 'Start'}</span>
              <span
                className={`pill pill-time pill-time-trigger${showTimePicker && timePickerTarget === 'end' ? ' active' : ''}`}
                tabIndex={0}
                role="button"
                title="Pick end time"
                ref={endTimePillRef}
                onClick={() => { 
                  if (showTimePicker) {
                    setTimePickerTarget('end');
                    if (!endTime && startTime) {
                      const calculatedEndTime = calculateEndTime(startTime);
                      setEndTime(calculatedEndTime);
                    }
                  } else {
                    setShowTimePicker(true); 
                    setTimePickerTarget('end'); 
                    if (!endTime && startTime) {
                      const calculatedEndTime = calculateEndTime(startTime);
                      setEndTime(calculatedEndTime);
                    }
                  }
                }}
              >{endTime ? formatTime(endTime, '24') : 'End'}</span>
            </>
          ) : (
            <span
              className={`pill pill-duration pill-duration-trigger${showDurationPicker ? ' active' : ''}`}
              tabIndex={0}
              role="button"
              title="Pick duration"
              ref={durationPillRef}
              onClick={() => { setShowDurationPicker(v => !v); setShowTimePicker(false); }}
            >{formatDuration(taskDuration)}</span>
          )}
          {/* Priority Pills (for tasks only) */}
          {creationType === 'task' && (
            <div
              className="priority-badge priority-pill-dropdown"
              style={{
                background: priority === 1 ? '#f2fdf7' :
                            priority === 2 ? '#e2faef' :
                            priority === 3 ? '#fff9d6' :
                            priority === 4 ? '#ffeaea' :
                            priority === 5 ? '#ffd6d6' : '#eee',
                color: priority === 1 ? '#218838' :
                       priority === 2 ? '#218838' :
                       priority === 3 ? '#bfa100' :
                       priority === 4 ? '#b71c1c' :
                       priority === 5 ? '#b71c1c' : '#333',
                cursor: 'pointer',
                position: 'relative',
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 999,
                padding: '0 1rem',
                height: 25,
                lineHeight: '25px',
                whiteSpace: 'nowrap',
                marginLeft: '0.25rem'
              }}
              onClick={() => { setShowPriorityDropdown(v => !v); setShowTimePicker(false); setShowDurationPicker(false); setShowEnergyDropdown(false); }}
              ref={priorityDropdownRef}
              tabIndex={0}
            >
              <span className="star">★</span>
              <span className="priority-label">{PRIORITY_LABELS[priority]}</span>
              {showPriorityDropdown && (
                <div className="priority-dropdown-menu" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3,4,5].map(val => (
                    <div
                      key={val}
                      className="priority-dropdown-item"
                      data-priority={val}
                      onClick={e => { e.stopPropagation(); setPriority(val); setShowPriorityDropdown(false); }}
                    >
                      <span className="star">★</span>
                      {PRIORITY_LABELS[val]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Energy Level Pills (for tasks only) */}
          {creationType === 'task' && (
            <div
              className="energy-badge energy-pill-dropdown"
              style={{
                background: energy === 1 ? '#f2fdf7' :
                            energy === 2 ? '#e2faef' :
                            energy === 3 ? '#fff9d6' :
                            energy === 4 ? '#ffeaea' :
                            energy === 5 ? '#ffd6d6' : '#eee',
                color: energy === 1 ? '#218838' :
                       energy === 2 ? '#218838' :
                       energy === 3 ? '#bfa100' :
                       energy === 4 ? '#b71c1c' :
                       energy === 5 ? '#b71c1c' : '#333',
                cursor: 'pointer',
                position: 'relative',
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 999,
                padding: '0 1rem',
                height: 25,
                lineHeight: '25px',
                whiteSpace: 'nowrap',
                marginLeft: '0.25rem'
              }}
              onClick={() => { setShowEnergyDropdown(v => !v); setShowTimePicker(false); setShowDurationPicker(false); setShowPriorityDropdown(false); }}
              ref={energyDropdownRef}
              tabIndex={0}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{marginRight: '0.2em'}}>
                <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
              </svg>
              <span className="priority-label">{ENERGY_LABELS[energy]}</span>
              {showEnergyDropdown && (
                <div className="priority-dropdown-menu" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3,4,5].map(val => (
                    <div
                      key={val}
                      className="priority-dropdown-item"
                      data-priority={val}
                      onClick={e => { e.stopPropagation(); setEnergy(val); setShowEnergyDropdown(false); }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{marginRight: '0.2em'}}>
                        <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
                      </svg>
                      {ENERGY_LABELS[val]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {/* End Pills Row */}
        {showTimePicker && (
          <CircularTimePicker
            value={timePickerTarget === 'start' ? startTime : endTime}
            onChange={d => {
              if (timePickerTarget === 'start') {
                setStartTime(d);
              } else {
                setEndTime(d);
                // REMOVED: Real-time start time updates - only update when complete
              }
            }}
            onClose={() => { 
              setShowTimePicker(false); 
            }}
            anchorRef={timePickerTarget === 'start' ? startTimePillRef : endTimePillRef}
            open={showTimePicker}
            timePickerTarget={timePickerTarget}
            onStartTimeComplete={handleStartTimeComplete}
            onEndTimeComplete={handleEndTimeComplete}
            automaticStartTime={automaticStartTime}
            automaticEndTime={automaticEndTime}
            setAutomaticStartTime={setAutomaticStartTime}
            setAutomaticEndTime={setAutomaticEndTime}
          />
        )}
        {showDurationPicker && (
          <CircularDurationPicker
            value={taskDuration}
            onChange={(newValue) => {
              setTaskDuration(newValue);
            }}
            onClose={() => { 
              setShowDurationPicker(false); 
            }}
            anchorRef={durationPillRef}
            open={showDurationPicker}
          />
        )}
        <hr className="divider" />
        <div className="button-row">
          <button className="cancel-btn" onClick={handleCancel}>Cancel</button>
          <button className="add-btn" onClick={handleAdd}>
            {editingTask ? 'Update' : 'Add'} {creationType === 'event' ? 'Event' : 'Task'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskCreationCard;
