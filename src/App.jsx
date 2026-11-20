// src/App.jsx
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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
import CalendarConflictModal from './components/CalendarConflictModal';
import './components/CalendarConflictModal.css';
import CreateSheet from './components/CreateSheet';
import { useLayoutMode, getLayoutMode } from './hooks/useLayoutMode';
import { CalendarZoomProvider } from './hooks/useCalendarPinchZoom';
import useDrawerEdgeSwipe from './hooks/useDrawerEdgeSwipe';
import { useAuth } from './context/AuthContext';
import { sortEventsByDeadline, sortTasks } from './utils/taskSorter';
import { isItemScheduled, isSameDate, sameCalendarItemId, sameMonthDayInYear, startOfDay } from './utils/calendarItems';
import {
  PENDING_AUTH_KEY,
  clearLocalTasks,
  clearPendingAuth,
  deleteCloudItem,
  fetchCloudItems,
  insertCloudItem,
  isUuid,
  loadLocalTasks,
  loadSavedLocalTasks,
  newItemId,
  replaceCloudWithLocal,
  saveLocalTasks,
  updateCloudItem,
  uploadLocalItems,
} from './lib/items';
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

const ITEM_ACTION_SELECTOR = [
  '.task-complete-btn',
  '.task-delete-btn',
  '.task-edit-btn',
  '.task-actions-dropdown-trigger',
  '.task-actions-dropdown-menu',
  '.task-actions-dropdown-submenu',
  '.day-agenda-row-actions',
].join(', ');

const ITEM_SELECTION_SELECTOR = [
  '.calendar-time-block',
  '.day-time-block',
  '.day-agenda-row',
  '.mcg-chip',
  '.day-detail-item',
  '.task-list-item',
  '[data-task-id]',
].join(', ');

function isItemSelectionTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest(ITEM_ACTION_SELECTOR)) return false;
  return Boolean(target.closest(ITEM_SELECTION_SELECTOR));
}

const DASHBOARD_LIST_TITLES = {
  tasks: 'Task List',
  events: 'Event List',
  incomplete: 'Incomplete List',
  completed: 'Complete List',
};

function matchesDashboardFilter(item, filter) {
  const isTask = item.type === 'task';
  const isDone = item.status === 'completed';
  switch (filter) {
    case 'tasks':
      return isTask;
    case 'events':
      return item.type === 'event';
    case 'incomplete':
      return isTask && !isDone;
    case 'completed':
      return isTask && isDone;
    default:
      return isTask;
  }
}

const App = () => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const [tasks, setTasks] = useState([]);
  const [hydratedUserId, setHydratedUserId] = useState(undefined);
  const [syncError, setSyncError] = useState('');
  const [conflict, setConflict] = useState(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const tasksReady = !authLoading && hydratedUserId === userId;
  const { isCompact, isDrawerChrome } = useLayoutMode();
  const [motivation, setMotivation] = useState(3);
  const [viewMode, setViewMode] = useState(() => (getLayoutMode() === 'compact' ? 'day' : 'week'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPresent, setDrawerPresent] = useState(false);
  const [drawerShown, setDrawerShown] = useState(false);
  const [drawerDragging, setDrawerDragging] = useState(false);
  const drawerOverlayRef = useRef(null);
  const [pinTodayToken, setPinTodayToken] = useState(0);
  const [freezeAgendaToken, setFreezeAgendaToken] = useState(0);
  const [selectedDashboardButton, setSelectedDashboardButton] = useState(null);
  const [drawerSection, setDrawerSection] = useState('agenda');
  
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
  const [listFocus, setListFocus] = useState(null); // dashboard list row, including unscheduled items
  const [locateToken, setLocateToken] = useState(0);
  
  // Trigger to clear activeBlockKey in CalendarGrid when Quick Move is used
  const [clearActiveBlockTrigger, setClearActiveBlockTrigger] = useState(0);
  const [isQuickMoving, setIsQuickMoving] = useState(false);
  const [focusNowToken, setFocusNowToken] = useState(0);

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

  const reportSyncError = useCallback((err) => {
    console.error(err);
    setSyncError(err?.message || 'Could not save to your account.');
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      setSyncError('');
      try {
        if (!userId) {
          setConflict(null);
          setTasks(loadLocalTasks());
          setHydratedUserId(null);
          return;
        }

        const pending = sessionStorage.getItem(PENDING_AUTH_KEY);
        const cloud = await fetchCloudItems(userId);
        if (cancelled) return;
        const local = loadSavedLocalTasks();

        if (cloud.length === 0 && local.length > 0) {
          const uploaded = await uploadLocalItems(local, userId);
          if (cancelled) return;
          clearLocalTasks();
          clearPendingAuth();
          setTasks(uploaded);
          setHydratedUserId(userId);
          return;
        }

        if (!pending || local.length === 0) {
          setTasks(cloud);
          clearPendingAuth();
          setHydratedUserId(userId);
          return;
        }

        setTasks(cloud);
        setConflict({ localItems: local, cloudItems: cloud });
        clearPendingAuth();
        setHydratedUserId(userId);
      } catch (err) {
        if (cancelled) return;
        reportSyncError(err);
        setTasks(userId ? [] : loadLocalTasks());
        setHydratedUserId(userId);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [userId, authLoading, reportSyncError]);

  useEffect(() => {
    if (!tasksReady || userId) return;
    saveLocalTasks(tasks);
  }, [tasks, tasksReady, userId]);

  const addTask = (task) => {
    const safeTask = {
      ...task,
      id: isUuid(task.id) ? task.id : newItemId(),
      title: task.title || task.name || 'Untitled',
      energy: Number(task.energy) || 1,
      priority: Number(task.priority) || 1,
      deadline: task.deadline || '',
      time: task.startTime && task.endTime ? `${task.startTime} – ${task.endTime}` : 'Time not set',
      type: task.type || 'task',
      status: 'active',
    };
    setTasks((prev) => [...prev, safeTask]);
    if (userIdRef.current) {
      insertCloudItem(safeTask, userIdRef.current).catch(reportSyncError);
    }
  };

  const deleteTask = (taskId) => {
    setTasks((prev) => prev.filter(task => task.id !== taskId));
    if (userIdRef.current) {
      deleteCloudItem(taskId, userIdRef.current).catch(reportSyncError);
    }
  };

  const updateTaskStatus = (taskId, status) => {
    const current = tasks.find(task => task.id === taskId);
    setTasks((prev) => prev.map(task =>
      task.id === taskId ? { ...task, status } : task
    ));
    if (userIdRef.current && current) {
      updateCloudItem({ ...current, status }, userIdRef.current).catch(reportSyncError);
    }
  };

  const updateTask = (taskId, updates) => {
    const current = tasks.find(task => task.id === taskId);
    const merged = current
      ? (updates.startTime && updates.endTime
        ? { ...current, ...updates, time: `${updates.startTime} – ${updates.endTime}` }
        : { ...current, ...updates })
      : null;
    setTasks((prev) => prev.map(task => {
      if (task.id === taskId) {
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
    if (userIdRef.current && merged) {
      updateCloudItem(merged, userIdRef.current).catch(reportSyncError);
    }
  };

  const handleKeepCloud = () => {
    setConflict(null);
  };

  const handleUseLocalCalendar = async () => {
    if (!conflict || !userId) return;
    setConflictBusy(true);
    try {
      const uploaded = await replaceCloudWithLocal(conflict.localItems, userId);
      clearLocalTasks();
      setTasks(uploaded);
      setConflict(null);
    } catch (err) {
      reportSyncError(err);
    } finally {
      setConflictBusy(false);
    }
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

  const centerDayRef = useRef(centerDay);
  centerDayRef.current = centerDay;
  const navigationTimerRef = useRef(null);

  // Smooth navigation function with slide animation.
  // Accepts a Date or an updater so rapid clicks stack on the latest day
  // instead of the day from the last render.
  const smoothNavigateTo = useCallback((targetDate) => {
    const current = centerDayRef.current;
    const resolved = typeof targetDate === 'function' ? targetDate(current) : targetDate;
    const next = startOfDay(resolved);
    if (isSameDate(current, next)) return;

    centerDayRef.current = next;
    setIsNavigating(true);
    setCenterDay(next);

    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
    navigationTimerRef.current = setTimeout(() => {
      navigationTimerRef.current = null;
      setIsNavigating(false);
    }, 400); // Slightly longer for better visual effect
  }, []);

  const navigateMonth = useCallback((targetDate) => {
    const current = centerDayRef.current;
    const resolved = typeof targetDate === 'function' ? targetDate(current) : targetDate;
    const next = startOfDay(resolved);
    if (!isSameDate(current, next)) {
      setFreezeAgendaToken((n) => n + 1);
    }
    smoothNavigateTo(targetDate);
  }, [smoothNavigateTo]);

  const handleSetViewMode = useCallback((mode) => {
    setPanelDate(null);
    setHighlightedItem(null);
    setListFocus(null);
    if (mode !== viewMode && (mode === 'day' || mode === 'week' || mode === 'month')) {
      const target = sameMonthDayInYear(centerDayRef.current.getFullYear(), new Date());
      if (!isSameDate(centerDayRef.current, target)) {
        setFreezeAgendaToken((n) => n + 1);
        setCenterDay(target);
      }
    }
    setViewMode(mode);
  }, [viewMode]);

  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerShown(false);
    if (prefersReducedMotion()) setDrawerPresent(false);
  }, []);

  const openDrawer = useCallback((section = 'agenda') => {
    setDrawerSection(section === 'tasks' ? 'tasks' : 'agenda');
    setCenterDay(startOfDay(new Date()));
    setFocusNowToken((n) => n + 1);
    setPinTodayToken((n) => n + 1);
    setDrawerPresent(true);
    setDrawerOpen(true);
    if (prefersReducedMotion()) setDrawerShown(true);
  }, []);

  const toggleDrawer = useCallback(() => {
    if (drawerOpen && drawerSection === 'tasks') closeDrawer();
    else openDrawer('tasks');
  }, [drawerOpen, drawerSection, closeDrawer, openDrawer]);

  const suppressDrawerClickRef = useDrawerEdgeSwipe({
    enabled: isDrawerChrome,
    isOpen: drawerOpen,
    drawerMounted: drawerPresent,
    overlayRef: drawerOverlayRef,
    onPreview: () => {
      setDrawerDragging(true);
      setDrawerPresent(true);
    },
    onCommitOpen: () => {
      openDrawer();
      setDrawerShown(true);
      setDrawerDragging(false);
    },
    onCommitClose: () => {
      setDrawerDragging(false);
      closeDrawer();
    },
    onRevert: () => {
      setDrawerDragging(false);
    },
  });

  const handleDrawerOverlayClick = useCallback(() => {
    if (suppressDrawerClickRef.current) {
      suppressDrawerClickRef.current = false;
      return;
    }
    closeDrawer();
  }, [closeDrawer, suppressDrawerClickRef]);

  useEffect(() => {
    if (!isDrawerChrome) {
      setDrawerOpen(false);
      setDrawerShown(false);
      setDrawerPresent(false);
      setDrawerDragging(false);
    }
  }, [isDrawerChrome]);

  useLayoutEffect(() => {
    if (!isDrawerChrome || !drawerPresent || !drawerOpen || drawerShown) return undefined;
    if (prefersReducedMotion()) {
      setDrawerShown(true);
      return undefined;
    }
    const id = requestAnimationFrame(() => setDrawerShown(true));
    return () => cancelAnimationFrame(id);
  }, [isDrawerChrome, drawerPresent, drawerOpen, drawerShown]);

  useEffect(() => {
    if (drawerOpen || drawerDragging || !drawerPresent || !isDrawerChrome) return undefined;
    const timeout = window.setTimeout(() => setDrawerPresent(false), 360);
    return () => window.clearTimeout(timeout);
  }, [drawerOpen, drawerDragging, drawerPresent, isDrawerChrome]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  const scrollDrawerSection = useCallback((section, behavior) => {
    const root = drawerOverlayRef.current;
    if (!root) return;
    if (section === 'tasks') {
      const panel = root.querySelector('.dashboard-panel');
      const motivation = panel?.querySelector('[data-drawer-target="motivation"]');
      if (!panel) return;
      const top = motivation
        ? Math.max(0, panel.scrollTop + motivation.getBoundingClientRect().top - panel.getBoundingClientRect().top - 8)
        : 0;
      panel.scrollTo({ top, behavior });
      return;
    }
    const scroller = root.querySelector('[data-agenda-scroll]');
    if (!scroller) return;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayBlock = scroller.querySelector(`[data-date="${todayKey}"]`);
    const top = todayBlock
      ? Math.max(0, scroller.scrollTop + todayBlock.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 8)
      : 0;
    scroller.scrollTo({ top, behavior });
  }, []);

  useLayoutEffect(() => {
    if (!isDrawerChrome || !drawerShown || drawerSection !== 'agenda') return undefined;
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    const id = requestAnimationFrame(() => scrollDrawerSection('agenda', behavior));
    return () => cancelAnimationFrame(id);
  }, [isDrawerChrome, drawerShown, drawerSection, scrollDrawerSection]);

  useLayoutEffect(() => {
    if (!isDrawerChrome || !drawerShown || drawerSection !== 'tasks') return undefined;
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    const id = requestAnimationFrame(() => scrollDrawerSection('tasks', behavior));
    return () => cancelAnimationFrame(id);
  }, [isDrawerChrome, drawerShown, drawerSection, selectedDashboardButton, scrollDrawerSection]);

  const openDayView = useCallback((date) => {
    setPanelDate(null);
    setHighlightedItem(null);
    setListFocus(null);
    setCenterDay(startOfDay(date));
    setViewMode('day');
  }, []);

  const openMonthView = useCallback((date) => {
    setPanelDate(null);
    setHighlightedItem(null);
    setListFocus(null);
    setCenterDay(startOfDay(date));
    setViewMode('month');
  }, []);

  const handleHighlightItem = useCallback((item, meta) => {
    setListFocus(null);
    setHighlightedItem(item);
    if (meta?.locate && viewMode === 'week') setLocateToken((n) => n + 1);
  }, [viewMode]);

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (window.globalDragState?.suppressSelectionClear) {
        window.globalDragState.suppressSelectionClear = false;
        return;
      }
      if (isItemSelectionTarget(e.target)) return;
      setHighlightedItem(null);
      setListFocus(null);
    };
    document.addEventListener('mousedown', handlePointerDown, true);
    return () => document.removeEventListener('mousedown', handlePointerDown, true);
  }, []);

  // Quick move: Move task/event to different date (preserves time)
  const handleQuickMove = useCallback((task, target) => {
    if (!task) return;
    
    // Explicitly clear any highlighting to prevent unwanted highlights
    setHighlightedItem(null);
    setListFocus(null);
    
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
    setListFocus(null);
    
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
    setListFocus(null);
    if (viewMode === 'month') {
      setHighlightedItem({ id: item.id, type: item.type });
      setLocateToken((n) => n + 1);
      const match = tasks.find((task) => sameCalendarItemId(item, task));
      if (match?.deadline) {
        const [year, month, day] = match.deadline.split('-').map(Number);
        const taskDate = new Date(year, month - 1, day);
        taskDate.setHours(0, 0, 0, 0);
        navigateMonth(taskDate);
      }
      return;
    }
    // Toggle highlighting - if clicking the same item, unhighlight it
    if (highlightedItem && highlightedItem.id === item.id && highlightedItem.type === item.type) {
      setHighlightedItem(null);
    } else {
      setHighlightedItem(item);
      if (viewMode === 'week') setLocateToken((n) => n + 1);
      if (isDrawerChrome) closeDrawer();
    }
  };

  const handleLocateListItem = useCallback((item) => {
    if (!item) return;
    const selection = { id: item.id, type: item.type };
    setListFocus(selection);
    if (!isItemScheduled(item)) {
      setHighlightedItem(null);
      return;
    }
    setHighlightedItem(selection);
    setLocateToken((n) => n + 1);
    if (isDrawerChrome) closeDrawer();
  }, [isDrawerChrome, closeDrawer]);

  // Auto-navigate calendar to highlighted task's day when it changes
  // Use a ref to track the last highlighted item ID to only navigate on actual changes
  const lastHighlightedItemIdRef = useRef(null);
  
  useEffect(() => {
    if (highlightedItem) {
      if (window.globalDragState?.suppressHighlightNavigation) {
        window.globalDragState.suppressHighlightNavigation = false;
        lastHighlightedItemIdRef.current = highlightedItem.id;
        return;
      }
      // Only auto-navigate if this is a new highlighted item (not a re-render)
      const isNewHighlight = lastHighlightedItemIdRef.current !== highlightedItem.id;
      
      if (isNewHighlight) {
        lastHighlightedItemIdRef.current = highlightedItem.id;
        if (viewMode === 'week') return;

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
  }, [highlightedItem, tasks, smoothNavigateTo, viewMode]);
  

  const dashboardItems = tasks.filter((item) =>
    matchesDashboardFilter(item, selectedDashboardButton)
  );
  const sortedTasks = selectedDashboardButton === 'events'
    ? sortEventsByDeadline(dashboardItems)
    : sortTasks(dashboardItems, motivation);
  const dashboardListTitle = DASHBOARD_LIST_TITLES[selectedDashboardButton] ?? 'Task List';

  // Drag state for dashboard handle
  const dragHandleRef = useRef(null);
  const [dragProgress, setDragProgress] = useState(0); // 0 = closed, 1 = fully open
  const [isDraggingDashboard, setIsDraggingDashboard] = useState(false);
  const sidebarBaseWidth = isDrawerChrome ? 0 : 360;
  const SIDEBAR_COLUMN_WIDTH = 340; // matches .sidebar width
  const TIME_COL_WIDTH = 80; // px, matches CalendarGrid

  useEffect(() => {
    const hide = isDrawerChrome || dragProgress > 0;
    document.documentElement.classList.toggle('hide-scrollbars', hide);
    return () => document.documentElement.classList.remove('hide-scrollbars');
  }, [isDrawerChrome, dragProgress]);

  const prevDragProgressRef = useRef(dragProgress);
  useEffect(() => {
    const prevProgress = prevDragProgressRef.current;
    const opened = prevProgress === 0 && dragProgress > 0;
    const closed = prevProgress > 0 && dragProgress === 0;
    prevDragProgressRef.current = dragProgress;
    if (!opened && !closed) return;
    setCenterDay(startOfDay(new Date()));
    setFocusNowToken((n) => n + 1);
  }, [dragProgress]);

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
  const dashboardMaxWidth = isDrawerChrome
    ? 0
    : Math.max(0, mainLayoutWidth - 360 - TIME_COL_WIDTH - COMFORTABLE_COL_WIDTH);
  const dashboardWidth = isDrawerChrome ? 0 : dragProgress * dashboardMaxWidth;
  const dashboardContentWidth = Math.max(0, dashboardMaxWidth + sidebarBaseWidth - SIDEBAR_COLUMN_WIDTH);

  const toggleDashboard = useCallback(() => {
    setDragProgress((prev) => (prev < 1 ? 1 : 0));
  }, []);

  useEffect(() => {
    if (isDrawerChrome) return undefined;
    const onKey = (event) => {
      if (event.key !== 't' && event.key !== 'T') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      event.preventDefault();
      toggleDashboard();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isDrawerChrome, toggleDashboard]);

  // Drag event handlers (with snap). Transitions stay off while the pointer
  // is down so the shell tracks 1:1; mouseup restores the ease for the snap.
  function handleDragStart(e) {
    if (isDrawerChrome) return;
    dragHandleRef.current?.closest('.sidebar-shell')?.classList.add('is-dragging');
    setIsDraggingDashboard(true);
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
    dragHandleRef.current?.closest('.sidebar-shell')?.classList.remove('is-dragging');
    setIsDraggingDashboard(false);
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
        {syncError && (
          <div className="sync-banner" role="status">{syncError}</div>
        )}
        {!tasksReady && (
          <div className="app-loading-mask">Loading calendar…</div>
        )}
        <div className="app-wrapper">
          <div
            className="main-layout"
            ref={mainLayoutRef}
            style={{ position: 'relative', display: 'flex', flexDirection: 'row', height: '100%', width: '100%', background: '#2e0066' }}
          >
            {/* Sidebar and dashboard area */}
            {(isDrawerChrome ? drawerPresent : true) && (
            <div
              ref={isDrawerChrome ? drawerOverlayRef : undefined}
              className={isDrawerChrome ? `app-drawer-overlay${drawerShown ? ' is-open' : ''}${drawerDragging ? ' is-dragging' : ''}` : `sidebar-shell${isDraggingDashboard ? ' is-dragging' : ''}`}
              onClick={isDrawerChrome ? handleDrawerOverlayClick : undefined}
              style={isDrawerChrome ? undefined : {
                width: sidebarBaseWidth + dashboardWidth,
                '--dashboard-open-width': `${dashboardContentWidth}px`,
              }}
            >
              <div
                className={isDrawerChrome ? 'app-drawer' : undefined}
                data-section={isDrawerChrome ? drawerSection : undefined}
                onClick={isDrawerChrome ? (e) => e.stopPropagation() : undefined}
                onTransitionEnd={isDrawerChrome ? (event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.propertyName !== 'transform') return;
                  if (!drawerOpen) setDrawerPresent(false);
                } : undefined}
                style={isDrawerChrome ? undefined : {
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'row',
                  position: 'relative',
                  background: '#2e0066',
                }}
              >
              {isDrawerChrome && (
                <div className="drawer-section-jumps" role="tablist" aria-label="Agenda and tasks">
                  <button
                    type="button"
                    role="tab"
                    className={drawerSection === 'agenda' ? 'is-active' : ''}
                    aria-selected={drawerSection === 'agenda'}
                    onClick={() => {
                      setDrawerSection('agenda');
                      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
                      requestAnimationFrame(() => scrollDrawerSection('agenda', behavior));
                    }}
                  >
                    Agenda
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={drawerSection === 'tasks' ? 'is-active' : ''}
                    aria-selected={drawerSection === 'tasks'}
                    title="Tasks and motivation"
                    onClick={() => {
                      setDrawerSection('tasks');
                      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
                      requestAnimationFrame(() => scrollDrawerSection('tasks', behavior));
                    }}
                  >
                    Tasks
                  </button>
                </div>
              )}
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
          onHighlightItem={handleHighlightItem}
          onEdit={handleEditTask}
          searchResults={searchResults}
          allowCalendarDrag={!isDrawerChrome}
          pinTodayToken={pinTodayToken}
          freezeAgendaToken={freezeAgendaToken}
          viewMode={viewMode}
        />
              {/* Dashboard panel with Aridia Classic */}
              <div
                className="dashboard-panel"
                style={isDrawerChrome ? {
                  width: '100%',
                  minWidth: 0,
                  maxWidth: 'none',
                  background: '#2e0066',
                  color: 'white',
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '2rem 1.5rem',
                  opacity: 1,
                  pointerEvents: 'auto',
                  borderRight: 'none',
                  boxShadow: 'none',
                  borderRadius: '16px',
                } : {
                  pointerEvents: dragProgress > 0 ? 'auto' : 'none',
                }}
              >
                <div
                  className={isDrawerChrome ? undefined : 'dashboard-panel-body'}
                  style={isDrawerChrome
                    ? { width: '100%', minHeight: 'fit-content', flex: '1 1 auto' }
                    : {
                        opacity: dragProgress,
                        transform: `translateX(${(1 - dragProgress) * 12}px)`,
                      }}
                >
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
                      {tasks.filter((item) => matchesDashboardFilter(item, 'tasks')).length}
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
                      {tasks.filter((item) => matchesDashboardFilter(item, 'events')).length}
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
                      {tasks.filter((item) => matchesDashboardFilter(item, 'incomplete')).length}
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
                      {tasks.filter((item) => matchesDashboardFilter(item, 'completed')).length}
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
                  {(selectedDashboardButton == null || selectedDashboardButton === 'tasks') && (
                    <MotivationSlider motivation={motivation} setMotivation={setMotivation} />
                  )}
                  <TaskList 
                    tasks={sortedTasks}
                    title={dashboardListTitle}
                    onDelete={deleteTask} 
                    onEdit={handleEditTask}
                    onUpdateStatus={updateTaskStatus}
                    onAutoSchedule={handleAutoSchedule}
                    onQuickMove={handleQuickMove}
                    onExtendDuration={handleExtendDuration}
                    onLocateItem={handleLocateListItem}
                    listFocus={listFocus}
                  />
                  <TaskForm addTask={addTask} />
                </div>
                </div>
              </div>
              {!isDrawerChrome && (
              /* Vertical drag line (full height, invisible but interactive) */
              <div
                ref={dragHandleRef}
                className="dashboard-resize-handle"
                onMouseDown={handleDragStart}
                onDoubleClick={() => {
                  setDragProgress(prev => (prev < 1 ? 1 : 0));
                }}
                style={{ left: sidebarBaseWidth + dashboardWidth }}
              />
              )}
              </div>
            </div>
            )}
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
                dashboardFullyOpen={!isDrawerChrome && dragProgress === 1}
                onHighlightItem={handleHighlightItem}
                compactChrome={isDrawerChrome}
                isCompact={isCompact}
                onOpenDrawer={toggleDrawer}
                onToggleDashboard={toggleDashboard}
                drawerOpen={drawerOpen}
                tasksDoorOpen={drawerOpen && drawerSection === 'tasks'}
              />
              <CalendarZoomProvider>
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
                  onHighlightItem={handleHighlightItem}
                  isNavigating={isNavigating}
                  searchResults={searchResults}
                  onAutoSchedule={handleAutoSchedule}
                  onQuickMove={handleQuickMove}
                  onExtendDuration={handleExtendDuration}
                  onEdit={handleEditTask}
                  clearActiveBlockTrigger={clearActiveBlockTrigger}
                  isQuickMoving={isQuickMoving}
                  focusNowToken={focusNowToken}
                  locateToken={locateToken}
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
                  onHighlightItem={handleHighlightItem}
                  focusNowToken={focusNowToken}
                  locateToken={locateToken}
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
                      onDayDoubleClick={isDrawerChrome ? undefined : openDayView}
                      onMonthTitleClick={openMonthView}
                      highlightedItem={highlightedItem}
                      locateToken={locateToken}
                    />
                  ) : (
                    <MonthView
                      centerDay={centerDay}
                      setCenterDay={navigateMonth}
                      tasks={tasks}
                      panelDate={panelDate}
                      onDayClick={setPanelDate}
                      onDayDoubleClick={isDrawerChrome ? undefined : openDayView}
                      highlightedItem={highlightedItem}
                      onHighlightItem={handleHighlightItem}
                      compact={isCompact}
                      locateToken={locateToken}
                    />
                  )}
                  {panelDate && (
                    <DayDetailPanel
                      date={panelDate}
                      tasks={tasks}
                      onClose={() => setPanelDate(null)}
                      highlightedItem={highlightedItem}
                      onHighlightItem={handleHighlightItem}
                      onOpenDay={openDayView}
                      asSheet={isDrawerChrome}
                      locateToken={locateToken}
                    />
                  )}
                </div>
              )}
              </CalendarZoomProvider>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Task Creation Card - Centered */}
      {editCardPos && editingTask && (isDrawerChrome ? (
        <CreateSheet
          open
          onClose={() => {
            setEditCardPos(null);
            setEditingTask(null);
          }}
        >
          <div ref={editCardRef}>
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
        </CreateSheet>
      ) : (
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
      ))}
      {conflict && (
        <CalendarConflictModal
          localCount={conflict.localItems.length}
          cloudCount={conflict.cloudItems.length}
          onKeepCloud={handleKeepCloud}
          onUseLocal={handleUseLocalCalendar}
          busy={conflictBusy}
        />
      )}
    </>
  );
};

export default App;
