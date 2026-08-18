// src/App.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import CalendarHeader from './components/CalendarHeader';
import Sidebar from './components/Sidebar';
import CalendarGrid from './components/CalendarGrid';
import MotivationSlider from './components/MotivationSlider';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import DayView from './components/DayView';
import YearView from './components/YearView';
import MonthView from './components/MonthView';
import DayDetailPanel from './components/DayDetailPanel';
import TaskCreationCard from './components/TaskCreationCard';
import { sortTasks } from './utils/taskSorter';
import { startOfDay } from './utils/calendarItems';
import './index.css';

const formatTime = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const App = () => {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('aridia-tasks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [motivation, setMotivation] = useState(3);
  const [viewMode, setViewMode] = useState('week');
  const [chevronHover, setChevronHover] = useState(false);
  const [selectedDashboardButton, setSelectedDashboardButton] = useState(null);
  const [chevronVisible, setChevronVisible] = useState(true);
  
  // Calendar navigation state - shared between CalendarGrid and Sidebar
  const [centerDay, setCenterDay] = useState(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    return now;
  });

  // Navigation transition state
  const [isNavigating, setIsNavigating] = useState(false);

  // Highlighting state for sidebar items
  const [highlightedItem, setHighlightedItem] = useState(null); // { id, type: 'task' | 'event' }
  
  // Trigger to clear activeBlockKey in CalendarGrid when Quick Move is used
  const [clearActiveBlockTrigger, setClearActiveBlockTrigger] = useState(0);
  const [isQuickMoving, setIsQuickMoving] = useState(false);

  // Search state
  const [searchResults, setSearchResults] = useState(null);

  // Day detail panel for year/month views
  const [panelDate, setPanelDate] = useState(null);

  // Edit card state for TaskList
  const [editCardPos, setEditCardPos] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const editCardKeyRef = useRef(0);
  const editCardRef = useRef(null);
  const closeEditDatePickerRef = useRef(null);
  const closeEditTimePickerRef = useRef(null);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('aridia-tasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = (task) => {
    const safeTask = {
      ...task,
      id: task.id || (Date.now() + Math.random()), // Ensure unique ID even for rapid task creation
      title: task.title || task.name || 'Untitled',
      energy: Number(task.energy) || 1,
      priority: Number(task.priority) || 1,
      deadline: task.deadline || '',
      time: task.startTime && task.endTime ? `${task.startTime} – ${task.endTime}` : 'Time not set',
      type: task.type || 'task',
      status: 'active',
    };
    setTasks((prev) => [...prev, safeTask]);
  };

  const deleteTask = (taskId) => {
    setTasks((prev) => prev.filter(task => task.id !== taskId));
  };

  const updateTaskStatus = (taskId, status) => {
    setTasks((prev) => prev.map(task => 
      task.id === taskId ? { ...task, status } : task
    ));
  };

  const updateTask = (taskId, updates) => {
    setTasks((prev) => prev.map(task => {
      if (task.id === taskId) {
        // If startTime and endTime are being updated, also update the time property
        if (updates.startTime && updates.endTime) {
          return { 
            ...task, 
            ...updates, 
            time: `${updates.startTime} – ${updates.endTime}` 
          };
        }
        return { ...task, ...updates };
      }
      return task;
    }));
  };

  // Handle edit task from TaskList
  const handleEditTask = useCallback((task) => {
    // Calculate center position
    const cardWidth = 430;
    const cardHeight = 240;
    const centerX = (window.innerWidth - cardWidth) / 2;
    const centerY = (window.innerHeight - cardHeight) / 2;
    
    setEditingTask(task);
    setEditCardPos({
      x: centerX,
      y: centerY,
      flippedX: false,
      flippedY: false,
      isCentered: true
    });
    editCardKeyRef.current += 1;
  }, []);

  // Auto-schedule: Find available time slot for task (tasks only)
  // Starts from current time using same logic as CalendarGrid's current time indicator
  const handleAutoSchedule = useCallback((task) => {
    if (!task || task.type !== 'task') return;

    // Get current time using same logic as CalendarGrid
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Get today's date string (YYYY-MM-DD) using local timezone (same as CalendarGrid)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today);
    
    // Use deadline date or today if no deadline
    const deadlineDateStr = task.deadline || todayStr;
    const [deadlineYear, deadlineMonth, deadlineDay] = deadlineDateStr.split('-').map(Number);
    const deadlineDate = new Date(deadlineYear, deadlineMonth - 1, deadlineDay);
    deadlineDate.setHours(0, 0, 0, 0);
    
    // Get task duration
    const duration = task.duration || 30; // minutes
    
    // Helper function to check a specific date for available slots
    const findSlotOnDate = (dateStr, startFromMinutes) => {
      // Build array of occupied time slots on this date (exclude current task)
      const occupiedSlots = [];
      tasks.forEach(t => {
        if (t.deadline === dateStr && t.startTime && t.endTime && t.id !== task.id) {
          const [startHour, startMinute] = t.startTime.split(':').map(Number);
          const [endHour, endMinute] = t.endTime.split(':').map(Number);
          const startMinutes = startHour * 60 + startMinute;
          let endMinutes = endHour * 60 + endMinute;
          
          // Handle cross-day events
          const checkDate = new Date(dateStr + 'T00:00:00');
          if (t.endDeadline) {
            const [endYear, endMonth, endDay] = t.endDeadline.split('-').map(Number);
            const endDate = new Date(endYear, endMonth - 1, endDay);
            if (endDate.getTime() > checkDate.getTime()) {
              endMinutes = 24 * 60; // End of day
            }
          } else if (endMinutes < startMinutes) {
            endMinutes = 24 * 60; // Cross-day, end of day
          }
          
          occupiedSlots.push({ start: startMinutes, end: endMinutes });
        }
      });
      
      // Sort by start time
      occupiedSlots.sort((a, b) => a.start - b.start);
      
      // Find available slot starting from startFromMinutes
      // Check every 15 minutes, but start from exact startFromMinutes (not rounded)
      let candidateStart = startFromMinutes;
      
      // Round down to nearest 15-minute mark for the loop, but check exact time first
      const roundedStart = Math.floor(startFromMinutes / 15) * 15;
      
      // First check the exact current time if it's not on a 15-minute boundary
      if (startFromMinutes !== roundedStart) {
        const candidateEnd = candidateStart + duration;
        
        // Skip if would cross midnight
        if (candidateEnd > 24 * 60) {
          return null; // Would cross midnight, skip to next day
        }
        
        // Check if this slot overlaps any occupied slot
        const overlaps = occupiedSlots.some(slot => 
          (candidateStart < slot.end && candidateEnd > slot.start)
        );
        
        if (!overlaps) {
          return { startTime: formatTime(candidateStart), endTime: formatTime(candidateEnd), dateStr };
        }
      }
      
      // Then check every 15 minutes from rounded start
      for (let minutes = roundedStart; minutes < 24 * 60; minutes += 15) {
        // Skip if before startFromMinutes (already checked exact time above)
        if (minutes < startFromMinutes) continue;
        
        candidateStart = minutes;
        const candidateEnd = candidateStart + duration;
        
        // Skip if would cross midnight
        if (candidateEnd > 24 * 60) {
          return null; // Would cross midnight, skip to next day
        }
        
        // Check if this slot overlaps any occupied slot
        const overlaps = occupiedSlots.some(slot => 
          (candidateStart < slot.end && candidateEnd > slot.start)
        );
        
        if (!overlaps) {
          return { startTime: formatTime(candidateStart), endTime: formatTime(candidateEnd), dateStr };
        }
      }
      
      return null; // No slot found on this date
    };
    
    // Always start checking from TODAY at current time, then move forward to deadline
    // This ensures we always check from "right now" regardless of when deadline is
    let currentCheckDate = new Date(today);
    let nearestSlotAfterDeadline = null;
    
    // First, check up to and including the deadline
    while (currentCheckDate.getTime() <= deadlineDate.getTime()) {
      // Format date string using local timezone (same approach as TaskForm)
      const dateStr = formatDate(currentCheckDate);
      
      // Determine start time: if checking today, start from current time; otherwise start from beginning of day
      const startFromMinutes = (dateStr === todayStr) ? currentMinutes : 0;
      
      const result = findSlotOnDate(dateStr, startFromMinutes);
      
      if (result) {
        // Found available slot within deadline - schedule immediately
        updateTask(task.id, { 
          startTime: result.startTime, 
          endTime: result.endTime,
          deadline: result.dateStr
        });
        return;
      }
      
      // Move to next day
      currentCheckDate.setDate(currentCheckDate.getDate() + 1);
    }
    
    // No slot found within deadline - continue searching beyond deadline
    // Find the nearest available slot after the deadline
    while (true) {
      const dateStr = formatDate(currentCheckDate);
      
      // Determine start time: if checking today, start from current time; otherwise start from beginning of day
      const startFromMinutes = (dateStr === todayStr) ? currentMinutes : 0;
      
      const result = findSlotOnDate(dateStr, startFromMinutes);
      
      if (result) {
        nearestSlotAfterDeadline = result;
        break; // Found nearest slot
      }
      
      // Move to next day (no limit - search indefinitely)
      currentCheckDate.setDate(currentCheckDate.getDate() + 1);
    }
    
    // Format the date for display
    const [slotYear, slotMonth, slotDay] = nearestSlotAfterDeadline.dateStr.split('-').map(Number);
    const slotDate = new Date(slotYear, slotMonth - 1, slotDay);
    const formattedDate = slotDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    // Format time for display (convert 24h to 12h)
    const [startHour, startMinute] = nearestSlotAfterDeadline.startTime.split(':').map(Number);
    const startHour12 = startHour === 0 ? 12 : startHour > 12 ? startHour - 12 : startHour;
    const ampm = startHour >= 12 ? 'PM' : 'AM';
    const formattedTime = `${startHour12}:${String(startMinute).padStart(2, '0')} ${ampm}`;
    
    // Show confirm dialog
    const shouldReschedule = confirm(`Task cannot be scheduled by deadline. Nearest available time is ${formattedDate} at ${formattedTime}. Reschedule?`);
    
    if (shouldReschedule) {
      // User confirmed - schedule to nearest available slot
      updateTask(task.id, { 
        startTime: nearestSlotAfterDeadline.startTime, 
        endTime: nearestSlotAfterDeadline.endTime,
        deadline: nearestSlotAfterDeadline.dateStr
      });
    }
    // If user clicks "No", do nothing (cancel auto-schedule)
  }, [tasks, updateTask]);

  // Smooth navigation function with slide animation
  const smoothNavigateTo = useCallback((targetDate) => {
    setIsNavigating(true);
    
    // Use a smooth transition by setting the center day
    setCenterDay(startOfDay(targetDate));
    
    // Reset navigation state after transition completes
    setTimeout(() => {
      setIsNavigating(false);
    }, 400); // Slightly longer for better visual effect
  }, []);

  const handleSetViewMode = useCallback((mode) => {
    setPanelDate(null);
    setViewMode(mode);
  }, []);

  const openDayView = useCallback((date) => {
    setPanelDate(null);
    setCenterDay(startOfDay(date));
    setViewMode('day');
  }, []);

  const openMonthView = useCallback((date) => {
    setPanelDate(null);
    setCenterDay(startOfDay(date));
    setViewMode('month');
  }, []);

  // Quick move: Move task/event to different date (preserves time)
  const handleQuickMove = useCallback((task, target) => {
    if (!task) return;
    
    // Explicitly clear any highlighting to prevent unwanted highlights
    setHighlightedItem(null);
    
    // Set flag to indicate Quick Move is in progress (checked during render to prevent flicker)
    setIsQuickMoving(true);
    
    // Clear activeBlockKey immediately to prevent flickering/dimming
    setClearActiveBlockTrigger(prev => prev + 1);

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    let targetDate;
    if (target === 'today') {
      targetDate = new Date(now);
    } else if (target === 'tomorrow') {
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (target === 'nextWeek') {
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + 7);
    } else {
      return;
    }
    
    const newDeadline = formatDate(targetDate);
    
    // Always preserve time - just update the deadline
    let updates = { deadline: newDeadline };
    
    // Handle cross-day items: update endDeadline if needed (tasks and events)
    if (task.endDeadline && task.deadline) {
      const [oldDeadlineYear, oldDeadlineMonth, oldDeadlineDay] = task.deadline.split('-').map(Number);
      const [oldEndDeadlineYear, oldEndDeadlineMonth, oldEndDeadlineDay] = task.endDeadline.split('-').map(Number);
      const oldDeadlineDate = new Date(oldDeadlineYear, oldDeadlineMonth - 1, oldDeadlineDay);
      const oldEndDeadlineDate = new Date(oldEndDeadlineYear, oldEndDeadlineMonth - 1, oldEndDeadlineDay);
      const daysDiff = Math.round((oldEndDeadlineDate - oldDeadlineDate) / (1000 * 60 * 60 * 24));
      
      const newEndDeadlineDate = new Date(targetDate);
      newEndDeadlineDate.setDate(newEndDeadlineDate.getDate() + daysDiff);
      updates.endDeadline = formatDate(newEndDeadlineDate);
    } else if (task.startTime && task.endTime) {
      // Check if item is cross-day (endTime < startTime)
      const [startHour, startMinute] = task.startTime.split(':').map(Number);
      const [endHour, endMinute] = task.endTime.split(':').map(Number);
      if (endHour < startHour || (endHour === startHour && endMinute <= startMinute)) {
        // Preserve cross-day nature
        const endDeadlineDate = new Date(targetDate);
        endDeadlineDate.setDate(endDeadlineDate.getDate() + 1);
        updates.endDeadline = formatDate(endDeadlineDate);
      } else {
        // Clear endDeadline if no longer cross-day
        updates.endDeadline = null;
      }
    }

    updateTask(task.id, updates);
    
    // Ensure highlighting remains cleared after update
    setHighlightedItem(null);
    
    // Reset Quick Move flag after update completes
    // Use setTimeout to ensure it happens after render
    setTimeout(() => {
      setIsQuickMoving(false);
    }, 0);
  }, [updateTask]);

  // Adjust duration: Adjust task/event duration
  const handleExtendDuration = useCallback((task, deltaMinutes) => {
    if (!task) return;

    if (task.type === 'task') {
      // For tasks, update duration property
      const currentDuration = task.duration || 30;
      const newDuration = currentDuration + deltaMinutes;
      
      // Prevent if duration would be < 1 minute
      if (newDuration < 1) return;
      
      const updates = { duration: newDuration };
      
      // If task is scheduled, update endTime
      if (task.startTime && task.endTime) {
        const [startHour, startMinute] = task.startTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = startMinutes + newDuration;
        
        // Check if extending past midnight
        if (endMinutes >= 24 * 60) {
          updates.endTime = formatTime(endMinutes - 24 * 60);

          // Set endDeadline for cross-day
          const [year, month, day] = task.deadline.split('-').map(Number);
          const deadlineDate = new Date(year, month - 1, day);
          deadlineDate.setDate(deadlineDate.getDate() + 1);
          updates.endDeadline = formatDate(deadlineDate);
        } else {
          updates.endTime = formatTime(endMinutes);
          // Clear endDeadline if no longer cross-day
          if (task.endDeadline) {
            updates.endDeadline = null;
          }
        }
      }
      
      updateTask(task.id, updates);
    } else if (task.type === 'event') {
      // For events, calculate duration from startTime/endTime
      if (!task.startTime || !task.endTime) return;
      
      const [startHour, startMinute] = task.startTime.split(':').map(Number);
      const [endHour, endMinute] = task.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMinute;
      let endMinutes = endHour * 60 + endMinute;
      
      // Handle cross-day events
      if (task.endDeadline) {
        const [deadlineYear, deadlineMonth, deadlineDay] = task.deadline.split('-').map(Number);
        const [endDeadlineYear, endDeadlineMonth, endDeadlineDay] = task.endDeadline.split('-').map(Number);
        const deadlineDate = new Date(deadlineYear, deadlineMonth - 1, deadlineDay);
        const endDeadlineDate = new Date(endDeadlineYear, endDeadlineMonth - 1, endDeadlineDay);
        const daysDiff = Math.round((endDeadlineDate - deadlineDate) / (1000 * 60 * 60 * 24));
        endMinutes += daysDiff * 24 * 60;
      } else if (endMinutes < startMinutes) {
        endMinutes += 24 * 60; // Cross-day
      }
      
      const currentDuration = endMinutes - startMinutes;
      const newDuration = currentDuration + deltaMinutes;
      
      // Prevent if duration would be < 1 minute
      if (newDuration < 1) return;
      
      // Calculate new end time
      const newEndMinutes = startMinutes + newDuration;
      
      const updates = {};
      
      // Check if extending past midnight
      if (newEndMinutes >= 24 * 60) {
        updates.endTime = formatTime(newEndMinutes - 24 * 60);

        // Set/update endDeadline
        const [year, month, day] = task.deadline.split('-').map(Number);
        const deadlineDate = new Date(year, month - 1, day);
        deadlineDate.setDate(deadlineDate.getDate() + 1);
        updates.endDeadline = formatDate(deadlineDate);
      } else {
        updates.endTime = formatTime(newEndMinutes);
        const newEndH = Math.floor(newEndMinutes / 60);
        const newEndM = newEndMinutes % 60;

        // If endTime is 12 AM (00:00), it's technically cross-day, so keep endDeadline
        if (newEndH === 0 && newEndM === 0) {
          const [year, month, day] = task.deadline.split('-').map(Number);
          const deadlineDate = new Date(year, month - 1, day);
          deadlineDate.setDate(deadlineDate.getDate() + 1);
          updates.endDeadline = formatDate(deadlineDate);
        } else if (newEndMinutes >= startMinutes) {
          // No longer cross-day, clear endDeadline
          updates.endDeadline = null;
        }
      }
      
      updateTask(task.id, updates);
    }
  }, [updateTask]);

  // Dismiss edit card on Escape or outside click
  useEffect(() => {
    if (!editCardPos || !editingTask) return;
    
    function handleKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        
        // Close any open date picker using the proper method
        if (closeEditDatePickerRef.current) {
          closeEditDatePickerRef.current();
        }
        // Close any open time picker using the proper method
        if (closeEditTimePickerRef.current) {
          closeEditTimePickerRef.current();
        }
        // Close the edit card
        setEditCardPos(null);
        setEditingTask(null);
      }
    }
    
    function handleClick(e) {
      // Only prevent closing if clicking inside the card itself or its pickers
      if (editCardRef.current && editCardRef.current.contains(e.target)) return;
      if (document.querySelector('.aridia-datepicker-popper')?.contains(e.target)) return;
      if (document.querySelector('.custom-time-picker-modal')?.contains(e.target)) return;
      
      // Close any open time picker using the proper method
      if (closeEditTimePickerRef.current) {
        closeEditTimePickerRef.current();
      }
      
      // Close the edit card - this will happen for ANY click outside the card
      setEditCardPos(null);
      setEditingTask(null);
    }
    
    document.addEventListener('keydown', handleKey, true); // Use capture phase
    document.addEventListener('mousedown', handleClick);
    
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [editCardPos, editingTask]);

  const handleSidebarItemClick = (item) => {
    // Toggle highlighting - if clicking the same item, unhighlight it
    if (highlightedItem && highlightedItem.id === item.id && highlightedItem.type === item.type) {
      setHighlightedItem(null);
    } else {
      setHighlightedItem(item);
    }
  };

  // Auto-navigate calendar to highlighted task's day when it changes
  // Use a ref to track the last highlighted item ID to only navigate on actual changes
  const lastHighlightedItemIdRef = useRef(null);
  
  useEffect(() => {
    if (highlightedItem) {
      // Only auto-navigate if this is a new highlighted item (not a re-render)
      const isNewHighlight = lastHighlightedItemIdRef.current !== highlightedItem.id;
      
      if (isNewHighlight) {
        lastHighlightedItemIdRef.current = highlightedItem.id;
        
        // Find the task that was highlighted
        const highlightedTask = tasks.find(task => task.id === highlightedItem.id);
        
        if (highlightedTask && highlightedTask.deadline) {
          // Parse the task's deadline
          const [year, month, day] = highlightedTask.deadline.split('-').map(Number);
          const taskDate = new Date(year, month - 1, day);
          taskDate.setHours(0, 0, 0, 0);
          
          // Navigate to the task's day when it's first highlighted
          smoothNavigateTo(taskDate);
        }
      }
    } else {
      // Clear the ref when highlighting is cleared
      lastHighlightedItemIdRef.current = null;
    }
  }, [highlightedItem, tasks, smoothNavigateTo]);
  

  const sortedTasks = sortTasks(tasks, motivation);

  // Drag state for dashboard handle
  const dragHandleRef = useRef(null);
  const [dragProgress, setDragProgress] = useState(0); // 0 = closed, 1 = fully open
  const sidebarBaseWidth = 360; // Matches sidebar width (320px) + padding (40px)
const TIME_COL_WIDTH = 80; // px, matches CalendarGrid

  // Calculate the available width for the main layout
  const [mainLayoutWidth, setMainLayoutWidth] = useState(window.innerWidth);
  const mainLayoutRef = useRef();
  useEffect(() => {
    function handleResize() {
      if (mainLayoutRef.current) {
        setMainLayoutWidth(mainLayoutRef.current.offsetWidth);
      } else {
        setMainLayoutWidth(window.innerWidth);
      }
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Comfortable width for the last visible column when dashboard is fully expanded
  const COMFORTABLE_COL_WIDTH = 180; // Adjusted for better spacing with wider sidebar
  // Maximum dashboard width: main layout width - sidebar - time column - comfortable last column width
  const dashboardMaxWidth = Math.max(0, mainLayoutWidth - sidebarBaseWidth - TIME_COL_WIDTH - COMFORTABLE_COL_WIDTH);
  // Calculate dashboard width and visible columns
  const dashboardWidth = dragProgress * dashboardMaxWidth;

  // Drag event handlers (with snap)
  function handleDragStart(e) {
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleDragEnd, { once: true });
    dragHandleRef.current._startX = e.clientX;
    dragHandleRef.current._startProgress = dragProgress;
  }
  function handleDrag(e) {
    if (!dragHandleRef.current) return;
    const dx = e.clientX - dragHandleRef.current._startX;
    const maxDx = dashboardMaxWidth;
    let newProgress = dragHandleRef.current._startProgress + dx / maxDx;
    newProgress = Math.max(0, Math.min(1, newProgress));
    // Snap to max if close
    if (newProgress > 0.95) newProgress = 1;
    setDragProgress(newProgress);
  }
  function handleDragEnd() {
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleDrag);
    // Snap dragProgress to 0 or 1 if close to ends
    setDragProgress(prev => {
      if (prev < 0.05) return 0;
      if (prev > 0.95) return 1;
      return prev;
    });
  }

  return (
    <>
      <div className="frame-box">
        <div className="app-wrapper">
          <div
            className="main-layout"
            ref={mainLayoutRef}
            style={{ position: 'relative', display: 'flex', flexDirection: 'row', height: '100%', width: '100%', background: '#2e0066' }}
          >
            {/* Sidebar and dashboard area */}
            <div style={{
              width: sidebarBaseWidth + dashboardWidth,
              height: '100%',
              display: 'flex',
              flexDirection: 'row',
              position: 'relative',
              background: '#2e0066',
            }}>
              <Sidebar 
          tasks={tasks} 
          onDelete={deleteTask} 
          onUpdateStatus={updateTaskStatus}
          centerDay={centerDay}
          onItemClick={handleSidebarItemClick}
          onAutoSchedule={handleAutoSchedule}
          onQuickMove={handleQuickMove}
          onExtendDuration={handleExtendDuration}
          highlightedItem={highlightedItem}
          onHighlightItem={setHighlightedItem}
          onEdit={handleEditTask}
          searchResults={searchResults}
        />
              {/* Dashboard panel with Aridia Classic */}
              <div
                className="dashboard-panel"
                style={{
                  width: dashboardWidth,
                  minWidth: 0,
                  maxWidth: dashboardMaxWidth,
                  height: '100%',
                  maxHeight: '100%',
                  background: '#2e0066',
                  color: 'white',
                  transition: 'width 0.3s cubic-bezier(.4,0,.2,1)',
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: dashboardWidth > 40 ? '2rem 1.5rem' : '0',
                  opacity: dashboardWidth > 40 ? 1 : 0,
                  pointerEvents: dashboardWidth > 40 ? 'auto' : 'none',
                  borderRight: 'none',
                  boxShadow: 'none',
                  borderRadius: '16px',
                }}
                onScroll={(e) => {
                  const scrollTop = e.target.scrollTop;
                  setChevronVisible(scrollTop < 10); // Hide chevron when scrolled more than 10px
                }}
              >
                <div style={{ width: '100%', minHeight: 'fit-content', flex: '1 1 auto' }}>
                  {/* Dashboard Header */}
                <div style={{ 
                  display: 'flex', 
                  gap: '1rem', 
                  marginBottom: '2rem', 
                  width: '100%',
                  flexWrap: 'wrap'
                }}>
                  <div style={{
                    background: '#2e0066',
                    padding: '1rem 1.5rem',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flex: '1 1 150px',
                    minWidth: '120px',
                    border: '1px solid #a084e8',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      minWidth: 0,
                      flex: 1,
                      overflow: 'hidden'
                    }}>
                      <h1 style={{ 
                        fontSize: '1.5rem',
                        fontWeight: 700, 
                        color: 'white', 
                        margin: 0,
                        marginBottom: '0.25rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        width: '100%'
                      }}>
                        Dashboard
                      </h1>
                      <span style={{ 
                        fontSize: '0.9rem',
                        color: 'white', 
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        width: '100%'
                      }}>
                        {new Date().toLocaleDateString('en-US', { 
                          month: 'numeric', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Task Summary Cards */}
                <div 
                  style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    marginBottom: '2rem', 
                    width: '100%',
                    flexWrap: 'wrap'
                  }}
                  onClick={(e) => {
                    // If clicking on the container itself (not a button), dehighlight
                    if (e.target === e.currentTarget) {
                      setSelectedDashboardButton(null);
                    }
                  }}
                >
                  {/* Tasks Card */}
                  <div 
                    style={{
                      background: selectedDashboardButton === 'tasks' 
                        ? 'linear-gradient(135deg, #a084e8 0%, #8b5cf6 100%)' 
                        : '#2e0066',
                      padding: '1rem',
                      borderRadius: '12px',
                      flex: '1 1 150px',
                      minWidth: '120px',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      border: selectedDashboardButton === 'tasks' ? 'none' : '1px solid #a084e8',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      caretColor: 'transparent'
                    }}
                    onClick={() => setSelectedDashboardButton('tasks')}
                  >
                    <span style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 700, 
                      color: 'white'
                    }}>
                      {tasks.filter(task => task.type === 'task' && task.status === 'active').length}
                    </span>
                    <span style={{ 
                      fontSize: '0.9rem', 
                      color: 'white',
                      fontWeight: 500
                    }}>
                      Tasks
                    </span>
                  </div>

                  {/* Events Card */}
                  <div 
                    style={{
                      background: selectedDashboardButton === 'events' 
                        ? 'linear-gradient(135deg, #a084e8 0%, #8b5cf6 100%)' 
                        : '#2e0066',
                      padding: '1rem',
                      borderRadius: '12px',
                      flex: '1 1 150px',
                      minWidth: '120px',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      border: selectedDashboardButton === 'events' ? 'none' : '1px solid #a084e8',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      caretColor: 'transparent'
                    }}
                    onClick={() => setSelectedDashboardButton('events')}
                  >
                    <span style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 700, 
                      color: 'white'
                    }}>
                      {tasks.filter(task => task.type === 'event' && task.status === 'active').length}
                    </span>
                    <span style={{ 
                      fontSize: '0.9rem', 
                      color: 'white',
                      fontWeight: 500
                    }}>
                      Events
                    </span>
                  </div>

                  {/* Incomplete Card */}
                  <div 
                    style={{
                      background: selectedDashboardButton === 'incomplete' 
                        ? 'linear-gradient(135deg, #a084e8 0%, #8b5cf6 100%)' 
                        : '#2e0066',
                      padding: '1rem',
                      borderRadius: '12px',
                      flex: '1 1 150px',
                      minWidth: '120px',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      border: selectedDashboardButton === 'incomplete' ? 'none' : '1px solid #a084e8',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      caretColor: 'transparent'
                    }}
                    onClick={() => setSelectedDashboardButton('incomplete')}
                  >
                    <span style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 700, 
                      color: 'white'
                    }}>
                      {tasks.filter(task => task.status === 'incompleted').length}
                    </span>
                    <span style={{ 
                      fontSize: '0.9rem', 
                      color: 'white',
                      fontWeight: 500
                    }}>
                      Incomplete
                    </span>
                  </div>

                  {/* Completed Card */}
                  <div 
                    style={{
                      background: selectedDashboardButton === 'completed' 
                        ? 'linear-gradient(135deg, #a084e8 0%, #8b5cf6 100%)' 
                        : '#2e0066',
                      padding: '1rem',
                      borderRadius: '12px',
                      flex: '1 1 150px',
                      minWidth: '120px',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      border: selectedDashboardButton === 'completed' ? 'none' : '1px solid #a084e8',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      caretColor: 'transparent'
                    }}
                    onClick={() => setSelectedDashboardButton('completed')}
                  >
                    <span style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 700, 
                      color: 'white'
                    }}>
                      {tasks.filter(task => task.status === 'completed').length}
                    </span>
                    <span style={{ 
                      fontSize: '0.9rem', 
                      color: 'white',
                      fontWeight: 500
                    }}>
                      Completed
                    </span>
                  </div>
                </div>

                {/* Aridia Classic Section */}
                <div 
                  style={{ 
                    marginTop: '0.5rem', 
                    width: '100%',
                    padding: '1.5rem',
                    background: '#2e0066',
                    borderRadius: '12px',
                    border: '1px solid #a084e8',
                    cursor: 'default',
                    overflow: 'hidden'
                  }}
                >
                  <MotivationSlider motivation={motivation} setMotivation={setMotivation} />
                  <TaskList 
                    tasks={sortedTasks} 
                    onDelete={deleteTask} 
                    onEdit={handleEditTask}
                    onUpdateStatus={updateTaskStatus}
                    onAutoSchedule={handleAutoSchedule}
                    onQuickMove={handleQuickMove}
                    onExtendDuration={handleExtendDuration}
                  />
                  <TaskForm addTask={addTask} />
                </div>
                </div>
              </div>
              {/* Vertical drag line (full height, invisible but interactive) */}
              <div
                ref={dragHandleRef}
                onMouseDown={handleDragStart}
                onDoubleClick={() => {
                  setDragProgress(prev => (prev < 1 ? 1 : 0));
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: sidebarBaseWidth + dashboardWidth, // no border needed
                  width: 16, // make it easier to grab
                  height: '100%',
                  background: 'transparent',
                  borderRadius: 2,
                  zIndex: 25,
                  cursor: 'ew-resize',
                  transition: 'background 0.15s',
                }}
              />
              {/* Dynamic chevron positioning */}
              {dragProgress > 0.1 ? (
                // Dashboard is open - chevron in header
                <div
                  onMouseDown={handleDragStart}
                  onMouseEnter={() => setChevronHover(true)}
                  onMouseLeave={() => setChevronHover(false)}
                  onDoubleClick={() => {
                    setDragProgress(prev => (prev < 1 ? 1 : 0));
                  }}
                  style={{
                    position: 'absolute',
                    top: '2rem',
                    left: sidebarBaseWidth + dashboardWidth - 94,
                    width: 32,
                    height: 35,
                    zIndex: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    cursor: 'ew-resize',
                    background: 'transparent',
                    transition: 'left 0.18s cubic-bezier(.4,1.2,.6,1), opacity 0.2s ease',
                    opacity: chevronVisible ? 1 : 0,
                    pointerEvents: chevronVisible ? 'auto' : 'none',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </div>
              ) : (
                // Dashboard is closed - chevron in sidebar
                <div
                  onMouseDown={handleDragStart}
                  onMouseEnter={() => setChevronHover(true)}
                  onMouseLeave={() => setChevronHover(false)}
                  onDoubleClick={() => {
                    setDragProgress(prev => (prev < 1 ? 1 : 0));
                  }}
                  style={{
                    position: 'absolute',
                    top: '2rem',
                    left: sidebarBaseWidth - 62,
                    width: 32,
                    height: 35,
                    zIndex: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    cursor: 'ew-resize',
                    background: 'transparent',
                    transition: 'left 0.18s cubic-bezier(.4,1.2,.6,1)',
                    opacity: chevronHover ? 0.8 : 1,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </div>
              )}
            </div>
            {/* Calendar grid area, flush right and expanding left to the drag line */}
            <div className="calendar-wrapper" style={{ 
              flex: 1, 
              alignSelf: 'stretch', 
              marginLeft: 0,
              minWidth: 0,
              borderLeft: 'none'
            }}>
              <CalendarHeader 
                viewMode={viewMode} 
                setViewMode={handleSetViewMode} 
                tasks={tasks}
                onSearch={setSearchResults}
                sidebarWidth={sidebarBaseWidth + dashboardWidth}
                onHighlightItem={setHighlightedItem}
              />
              {viewMode === 'week' && (
                <CalendarGrid 
                  onAdd={addTask} 
                  tasks={tasks} 
                  onDelete={deleteTask} 
                  onUpdateStatus={updateTaskStatus} 
                  onUpdateTask={updateTask}
                  centerDay={centerDay}
                  setCenterDay={smoothNavigateTo}
                  highlightedItem={highlightedItem}
                  onHighlightItem={setHighlightedItem}
                  isNavigating={isNavigating}
                  searchResults={searchResults}
                  onAutoSchedule={handleAutoSchedule}
                  onQuickMove={handleQuickMove}
                  onExtendDuration={handleExtendDuration}
                  onEdit={handleEditTask}
                  clearActiveBlockTrigger={clearActiveBlockTrigger}
                  isQuickMoving={isQuickMoving}
                />
              )}
              {viewMode === 'day' && (
                <DayView
                  tasks={tasks}
                  centerDay={centerDay}
                  setCenterDay={smoothNavigateTo}
                  onAdd={addTask}
                  onUpdateTask={updateTask}
                  onDelete={deleteTask}
                  onUpdateStatus={updateTaskStatus}
                  onEdit={handleEditTask}
                  onAutoSchedule={handleAutoSchedule}
                  onQuickMove={handleQuickMove}
                  onExtendDuration={handleExtendDuration}
                  highlightedItem={highlightedItem}
                  onHighlightItem={setHighlightedItem}
                />
              )}
              {(viewMode === 'month' || viewMode === 'year') && (
                <div className="overview-shell">
                  {viewMode === 'year' ? (
                    <YearView
                      centerDay={centerDay}
                      setCenterDay={smoothNavigateTo}
                      tasks={tasks}
                      panelDate={panelDate}
                      onDayClick={setPanelDate}
                      onDayDoubleClick={openDayView}
                      onMonthTitleClick={openMonthView}
                    />
                  ) : (
                    <MonthView
                      centerDay={centerDay}
                      setCenterDay={smoothNavigateTo}
                      tasks={tasks}
                      panelDate={panelDate}
                      onDayClick={setPanelDate}
                      onDayDoubleClick={openDayView}
                    />
                  )}
                  {panelDate && (
                    <DayDetailPanel
                      date={panelDate}
                      tasks={tasks}
                      onClose={() => setPanelDate(null)}
                      onItemClick={(_item, date) => openDayView(date)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Task Creation Card - Centered */}
      {editCardPos && editingTask && (
        <div
          ref={editCardRef}
          style={{
            position: 'fixed',
            display: 'block',
            left: editCardPos.x,
            top: editCardPos.y,
            zIndex: 1000,
            pointerEvents: 'auto',
          }}
        >
          <TaskCreationCard
            key={editCardKeyRef.current}
            editingTask={editingTask}
            showPlusCircle={false}
            onCancel={() => {
              setEditCardPos(null);
              setEditingTask(null);
            }}
            onUpdate={(task) => {
              if (editingTask && editingTask.id) {
                // Convert task data to updates format
                const updates = {
                  title: task.name || task.title,
                  description: task.description,
                  deadline: task.deadline,
                  priority: task.priority,
                  energy: task.energy,
                  duration: task.duration,
                  taskType: task.taskType,
                  type: task.type,
                };
                
                // Handle startTime and endTime if present
                if (task.startTime && task.endTime) {
                  updates.startTime = task.startTime;
                  updates.endTime = task.endTime;
                }
                
                updateTask(editingTask.id, updates);
              }
              setEditCardPos(null);
              setEditingTask(null);
            }}
            flippedX={false}
            flippedY={false}
            onDatePickerClose={(closeMethod) => {
              closeEditDatePickerRef.current = closeMethod;
            }}
            onTimePickerClose={(closeMethod) => {
              closeEditTimePickerRef.current = closeMethod;
            }}
          />
        </div>
      )}
    </>
  );
};

export default App;
