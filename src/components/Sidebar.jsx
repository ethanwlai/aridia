import { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from 'react';
import styles from './Sidebar.module.css';
import { format, isToday } from 'date-fns';
import Header from './Header';
import AccountMenu from './AccountMenu';
import TaskActionsDropdown from './TaskActionsDropdown';

import { getItemColor, scrollHighlightedIntoView } from '../utils/calendarItems';

// Utility: Parse YYYY-MM-DD as local date
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const SIDEBAR_ACTION_SELECTOR = '.task-delete-btn, .task-complete-btn, .task-edit-btn, .task-actions-dropdown-trigger';

function isSidebarActionTarget(target) {
  return Boolean(target?.closest?.(SIDEBAR_ACTION_SELECTOR));
}

function closeOpenSidebarDropdown() {
  if (window.openDropdownRef && window.openDropdownRef.current) {
    window.openDropdownRef.current.setIsOpen(false);
    window.openDropdownRef.current.setActiveSubmenu(null);
    window.openDropdownRef.current = null;
  }
}

// Helper: check if a task is currently happening
function isTaskCurrent(task) {
  if (!task.startTime || !task.endTime) return false;
  const now = new Date();
  const [startHour, startMinute] = task.startTime.split(':').map(Number);
  const [endHour, endMinute] = task.endTime.split(':').map(Number);
  const start = new Date(now);
  start.setHours(startHour, startMinute, 0, 0);
  const end = new Date(now);
  end.setHours(endHour, endMinute, 0, 0);
  return now >= start && now <= end;
}

const Sidebar = ({ tasks = [], onDelete, onUpdateStatus, centerDay, onItemClick, highlightedItem, onAutoSchedule, onQuickMove, onExtendDuration, onEdit, allowCalendarDrag = true, pinTodayToken = 0, freezeAgendaToken = 0, viewMode = 'week' }) => {
  // Weather state
  const [coords, setCoords] = useState(null);
  const [weather, setWeather] = useState({}); // { [dateStr]: { high, low, icon, description } }
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(null);
  // Override map: undefined = default (open if the day has tasks), true = forced open, false = user-collapsed
  const [expandedDays, setExpandedDays] = useState({});
  const API_KEY = '10b3b3424c0a034c748c889bdcd8ee4e'; // <-- your API key

  // Weekly weather snapshot storage functions
  const storeWeeklyWeatherSnapshot = useCallback((weekStartDate, weatherData) => {
    try {
      const weeklySnapshots = JSON.parse(localStorage.getItem('aridia-weekly-weather-snapshots') || '{}');
      weeklySnapshots[weekStartDate] = {
        weather: weatherData,
        timestamp: Date.now()
      };
      localStorage.setItem('aridia-weekly-weather-snapshots', JSON.stringify(weeklySnapshots));
      
    } catch (error) {
      console.warn('Failed to store weekly weather snapshot:', error);
    }
  }, []);

  const getClosestWeeklySnapshot = useCallback((targetDate) => {
    try {
      const weeklySnapshots = JSON.parse(localStorage.getItem('aridia-weekly-weather-snapshots') || '{}');
      const snapshotDates = Object.keys(weeklySnapshots).sort();
      
      if (snapshotDates.length === 0) return null;
      
      // Find the closest snapshot date
      let closestDate = snapshotDates[0];
      let minDiff = Math.abs(new Date(targetDate) - new Date(closestDate));
      
      snapshotDates.forEach(dateStr => {
        const diff = Math.abs(new Date(targetDate) - new Date(dateStr));
        if (diff < minDiff) {
          minDiff = diff;
          closestDate = dateStr;
        }
      });
      
      const snapshot = weeklySnapshots[closestDate];
      return snapshot;
    } catch (error) {
      console.warn('Failed to retrieve weekly weather snapshot:', error);
      return null;
    }
  }, []);

  const cleanupWeeklySnapshots = useCallback(() => {
    try {
      const weeklySnapshots = JSON.parse(localStorage.getItem('aridia-weekly-weather-snapshots') || '{}');
      const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds
      let cleanedCount = 0;
      
      Object.keys(weeklySnapshots).forEach(weekStartDate => {
        if (weeklySnapshots[weekStartDate].timestamp < oneMonthAgo) {
          delete weeklySnapshots[weekStartDate];
          cleanedCount++;
        }
      });
      
      if (cleanedCount > 0) {
        localStorage.setItem('aridia-weekly-weather-snapshots', JSON.stringify(weeklySnapshots));
      }
    } catch (error) {
      console.warn('Failed to cleanup weekly weather snapshots:', error);
    }
  }, []);

  const getDayWeather = useCallback((dateStr) => {
    try {
      const dailyWeather = JSON.parse(localStorage.getItem('aridia-daily-weather') || '{}');
      return dailyWeather[dateStr] || null;
    } catch (error) {
      console.warn('Failed to retrieve daily weather:', error);
      return null;
    }
  }, []);

  // Get all dates to show in sidebar - now shows a range of days instead of just task dates
  const allTaskDates = useMemo(() => {
    // Create a range of days to show (e.g., 30 days before and after the current week)
    const days = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Start 30 days before today
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
    
    // End 30 days after today
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 30);
    
    // Generate all dates in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }, []); // No longer depends on tasks since we show all days

  // Memoize week dates for weather data - fetch calendar window + ensure today+future coverage
  const weekDays = useMemo(() => {
    const days = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Set to midnight
    
    if (!centerDay) {
      // Fallback to current week if centerDay is not provided
      for (let i = 0; i < 7; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() + i);
        days.push(date);
      }
      return days;
    }
    
    // Generate the calendar's 7-day window (centerDay is the third column, index 2)
    const calendarDays = [];
    for (let i = -2; i <= 4; i++) {
      const date = new Date(centerDay);
      date.setDate(centerDay.getDate() + i);
      calendarDays.push(date);
    }
    
    // Add today and next 7 days to ensure coverage
    const todayPlusFuture = [];
    for (let i = 0; i < 8; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      todayPlusFuture.push(date);
    }
    
    // Combine both sets, removing duplicates
    const allDates = [...calendarDays, ...todayPlusFuture];
    const uniqueDates = allDates.filter((date, index, self) => 
      index === self.findIndex(d => d.getTime() === date.getTime())
    );
    
    // Sort by date
    uniqueDates.sort((a, b) => a.getTime() - b.getTime());
    
    return uniqueDates;
  }, [centerDay]); // Depends on centerDay to include calendar window

  // Get user location on mount (only once)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        () => {
          // Fallback: New York City
          setCoords({ lat: 40.7128, lon: -74.0060 });
        }
      );
    } else {
      setCoords({ lat: 40.7128, lon: -74.0060 });
    }
  }, []); // Empty dependency array - only run once on mount

  // Cleanup weekly snapshots on mount
  useEffect(() => {
    cleanupWeeklySnapshots();
    

  }, [cleanupWeeklySnapshots]);

  // Fetch weather for calendar window + today+future coverage
  useEffect(() => {
    if (!coords || !weekDays.length) return;

    // Check if we already have weather data cached
    const cachedWeather = localStorage.getItem('aridia-weather-cache');
    const cacheTimestamp = localStorage.getItem('aridia-weather-timestamp');
    const now = Date.now();
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

    // Use cached data if it's still valid
    if (cachedWeather && cacheTimestamp && (now - parseInt(cacheTimestamp)) < CACHE_DURATION) {
      try {
        const parsedWeather = JSON.parse(cachedWeather);
        setWeather(parsedWeather);
        return;
      } catch (error) {
        console.warn('Failed to parse cached weather data:', error);
        // Continue to fetch fresh data
      }
    }

    // Fetch fresh weather data
    setWeatherLoading(true);
    setWeatherError(null);
    fetch(`https://api.openweathermap.org/data/3.0/onecall?lat=${coords.lat}&lon=${coords.lon}&exclude=minutely,hourly,alerts&units=imperial&appid=${API_KEY}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Weather API error: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.daily && data.current) {
          const newWeather = {};
          
          // Process all 7 days in the current weekDays
          weekDays.forEach((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysDiff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            
            // Check if we have weather data for this day
            if (daysDiff >= 0 && daysDiff < data.daily.length) {
              // Future day with available forecast
              const dayData = data.daily[daysDiff];
              const weatherData = {
                high: dayData.temp.max,
                low: dayData.temp.min,
                icon: dayData.weather[0].icon,
                description: dayData.weather[0].main
              };
              newWeather[dateStr] = weatherData;
            } else if (daysDiff === 0) {
              // Today - use current weather
              const weatherData = {
                high: data.daily[0].temp.max,
                low: data.daily[0].temp.min,
                icon: data.current.weather[0].icon,
                description: data.current.weather[0].main
              };
              newWeather[dateStr] = weatherData;
            } else {
              // Past day or day beyond forecast - check daily overrides first, then weekly snapshots
              const dailyOverride = getDayWeather(dateStr);
              if (dailyOverride) {
                newWeather[dateStr] = {
                  high: dailyOverride.high,
                  low: dailyOverride.low,
                  icon: dailyOverride.icon,
                  description: dailyOverride.description
                };
              } else {
                // Check weekly snapshots
                const weekStartDate = format(weekDays[0], 'yyyy-MM-dd');
                const weeklySnapshot = getClosestWeeklySnapshot(weekStartDate);
                if (weeklySnapshot && weeklySnapshot.weather[dateStr]) {
                  newWeather[dateStr] = weeklySnapshot.weather[dateStr];
                } else {
                  newWeather[dateStr] = null;
                }
              }
            }
          });
          
          // Store the entire week as a weekly snapshot
          const weekStartDate = format(weekDays[0], 'yyyy-MM-dd');
          storeWeeklyWeatherSnapshot(weekStartDate, newWeather);
          
          // Cache the weather data
          localStorage.setItem('aridia-weather-cache', JSON.stringify(newWeather));
          localStorage.setItem('aridia-weather-timestamp', now.toString());
          
          setWeather(newWeather);
        }
      })
      .catch(error => {
        console.error('Weather API error:', error);
        setWeatherError(error.message);
        // Fallback: set null weather for all days
        const fallbackWeather = {};
        weekDays.forEach(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          fallbackWeather[dateStr] = null;
        });
        setWeather(fallbackWeather);
      })
      .finally(() => {
        setWeatherLoading(false);
      });
  }, [coords, weekDays, storeWeeklyWeatherSnapshot, getClosestWeeklySnapshot, getDayWeather]); // Depends on coords and weekDays (no longer centerDay)

  // Memoize the getTasksForDay function to prevent unnecessary recalculations
  const getTasksForDay = useCallback((date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const filteredTasks = tasks.filter(task => {
      if (!task.deadline) return false;
      const d = parseLocalDate(task.deadline);
      return d && format(d, 'yyyy-MM-dd') === dateStr;
    });
    
    // Sort tasks/events chronologically
    return filteredTasks.sort((a, b) => {
      // For events, sort by start time
      if (a.type === 'event' && b.type === 'event') {
        const aStartTime = a.startTime || '';
        const bStartTime = b.startTime || '';
        return aStartTime.localeCompare(bStartTime);
      }
      // For tasks, sort by duration (shorter tasks first)
      if (a.type === 'task' && b.type === 'task') {
        const aDuration = a.duration || 0;
        const bDuration = b.duration || 0;
        return aDuration - bDuration;
      }
      // Events come before tasks
      if (a.type === 'event' && b.type === 'task') {
        return -1;
      }
      if (a.type === 'task' && b.type === 'event') {
        return 1;
      }
      return 0;
    });
  }, [tasks]);

  const datesWithTasks = useMemo(() => {
    const dates = new Set();
    tasks.forEach((task) => {
      if (!task.deadline) return;
      const d = parseLocalDate(task.deadline);
      if (d) dates.add(format(d, 'yyyy-MM-dd'));
    });
    return dates;
  }, [tasks]);

  // Auto-scroll sidebar to show current calendar days when navigation changes
  const sidebarContentRef = useRef(null);
  const hasSyncedCenterDayRef = useRef(false);
  const suppressCenterScrollRef = useRef(0);
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const scrollAgendaToToday = () => {
    const container = sidebarContentRef.current;
    if (!container) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const el = container.querySelector(`[data-date="${todayStr}"]`);
    if (!el) return;
    const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTop = top;
  };

  useLayoutEffect(() => {
    if (!pinTodayToken) return;
    scrollAgendaToToday();
    suppressCenterScrollRef.current = pinTodayToken;
  }, [pinTodayToken]);

  useLayoutEffect(() => {
    if (!freezeAgendaToken) return;
    suppressCenterScrollRef.current = freezeAgendaToken;
  }, [freezeAgendaToken]);
  const prevDatesWithTasksRef = useRef(new Set());

  const expandDay = useCallback((dateStr) => {
    if (!dateStr) return;
    setExpandedDays((prev) => (prev[dateStr] === true ? prev : { ...prev, [dateStr]: true }));
  }, []);

  const toggleDayExpanded = useCallback((dateStr, hasTasks) => {
    setExpandedDays((prev) => {
      const currentlyExpanded = hasTasks ? prev[dateStr] !== false : !!prev[dateStr];
      return { ...prev, [dateStr]: !currentlyExpanded };
    });
  }, []);

  // If a date newly gains tasks, drop a collapsed override so it opens by default
  useEffect(() => {
    const prevDates = prevDatesWithTasksRef.current;
    const newlyAdded = [];
    datesWithTasks.forEach((dateStr) => {
      if (!prevDates.has(dateStr)) newlyAdded.push(dateStr);
    });
    if (newlyAdded.length > 0) {
      setExpandedDays((prev) => {
        let next = prev;
        newlyAdded.forEach((dateStr) => {
          if (prev[dateStr] === false) {
            if (next === prev) next = { ...prev };
            delete next[dateStr];
          }
        });
        return next;
      });
    }
    prevDatesWithTasksRef.current = datesWithTasks;
  }, [datesWithTasks]);
  
  useEffect(() => {
    if (suppressCenterScrollRef.current) {
      const token = suppressCenterScrollRef.current;
      queueMicrotask(() => {
        if (suppressCenterScrollRef.current === token) suppressCenterScrollRef.current = 0;
      });
      hasSyncedCenterDayRef.current = true;
      return;
    }
    if (highlightedItem) return;
    // Year navigation moves centerDay by a full year, outside the agenda's
    // rendered range. Read the mode from a ref so switching views does not
    // re-run this effect and scroll on its own.
    if (viewModeRef.current === 'year') return;
    if (sidebarContentRef.current && centerDay) {
      // Calculate the leftmost day of the current calendar week (centerDay - 2)
      const leftmostDay = new Date(centerDay);
      leftmostDay.setDate(centerDay.getDate() - 2);
      const leftmostDayStr = format(leftmostDay, 'yyyy-MM-dd');

      // On later navigation, expand the leftmost calendar day; tasked days already default open
      if (hasSyncedCenterDayRef.current) {
        expandDay(leftmostDayStr);
      } else {
        hasSyncedCenterDayRef.current = true;
      }
      
      // Find the day block that matches the leftmost day
      const dayBlocks = sidebarContentRef.current.querySelectorAll(`[data-date="${leftmostDayStr}"]`);
      
      if (dayBlocks.length > 0) {
        // Scroll to the leftmost day block
        dayBlocks[0].scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      } else {
        // If leftmost day not found, scroll to the first day block (current week)
        const firstDayBlock = sidebarContentRef.current.querySelector(`.${styles.dayBlock}`);
        if (firstDayBlock) {
          firstDayBlock.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
          });
        }
      }
    }
  }, [centerDay, expandDay, highlightedItem]); // Trigger when centerDay changes (navigation)

  // Expand the highlighted task's day, then scroll it into view
  useEffect(() => {
    if (!highlightedItem) return;

    const task = tasks.find((t) => t.id === highlightedItem.id);
    if (task?.deadline) {
      const d = parseLocalDate(task.deadline);
      if (d) {
        expandDay(format(d, 'yyyy-MM-dd'));
      }
    }

    // Wait a frame so the task list can mount after expand
    const frameId = requestAnimationFrame(() => {
      scrollHighlightedIntoView(
        sidebarContentRef.current,
        `[data-task-id="${highlightedItem.id}"]`
      );
    });

    return () => cancelAnimationFrame(frameId);
  }, [highlightedItem, tasks, expandDay, expandedDays]);

  return (
    <div className={styles.sidebar}>
      <AccountMenu />
      <Header />
      <div className={styles.sidebarContent} ref={sidebarContentRef}>
        {allTaskDates.map((date, index) => {
          const isCurrent = isToday(date);
          const label = isCurrent ? 'Today' : format(date, 'EEEE');
          const month = format(date, 'M'); // Changed to numeric month
          const day = format(date, 'd');
          const year = format(date, 'yyyy');

          const tasksForDay = getTasksForDay(date);
          const dateStr = format(date, 'yyyy-MM-dd');
          const hasTasks = tasksForDay.length > 0;
          const isExpanded = hasTasks ? expandedDays[dateStr] !== false : !!expandedDays[dateStr];

          return (
            <div key={index} className={styles.dayBlock} data-date={dateStr}>
              <div className={styles.dayLabelPillRow}>
                <button
                  type="button"
                  className={`${styles.dayToggle} ${isExpanded ? styles.dayToggleExpanded : ''}`}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleDayExpanded(dateStr, hasTasks);
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <polygon points="5,3 11,8 5,13" />
                  </svg>
                </button>
                <div className={styles.dayLabel}>{label}</div>
                <div className={styles.pills}>
                  <span className={styles.pill}>{month}</span>
                  <span className={styles.pill}>{day}</span>
                  <span className={styles.pill}>{year}</span>
                </div>
                {/* Weather info */}
                {(() => {
                  const w = weather[dateStr];
                  
                  // Show loading indicator for the first day while weather is loading
                  if (weatherLoading && index === 0) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4, gap: 2 }}>
                        <div style={{ 
                          width: 16, 
                          height: 16, 
                          borderRadius: '50%', 
                          border: '2px solid #fff', 
                          borderTop: '2px solid transparent',
                          animation: 'spin 1s linear infinite'
                        }} />
                        <span style={{ fontWeight: 600, fontSize: '0.7rem', color: '#ccc', textTransform: 'uppercase' }}>Loading...</span>
                      </div>
                    );
                  }
                  
                  // Show error indicator for the first day if there's an error
                  if (weatherError && index === 0) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4, gap: 2 }}>
                        <span style={{ color: '#ff6b6b', fontSize: '0.7rem' }}>⚠️</span>
                        <span style={{ fontWeight: 600, fontSize: '0.7rem', color: '#ccc', textTransform: 'uppercase' }}>Error</span>
                      </div>
                    );
                  }
                  
                  // Show weather data if available, otherwise show "No weather information available"
                  if (w) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4, gap: 2 }}>
                        <img src={`https://openweathermap.org/img/wn/${w.icon}.png`} alt={w.description} style={{ width: 16, height: 16 }} />
                        <span style={{ fontWeight: 600, fontSize: '0.7rem', color: 'white', textTransform: 'uppercase' }}>{Math.round(w.high)}°/{Math.round(w.low)}°</span>
                      </div>
                    );
                  } else {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4, gap: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.7rem', color: '#ccc', textTransform: 'uppercase' }}>Weather unavailable</span>
                      </div>
                    );
                  }
                })()}
              </div>
              {isExpanded && (
              <div className={styles.tasks}>
                {hasTasks ? (
                  tasksForDay.map((task, i) => {
                    const dotColor = task.taskType ? getItemColor(task) : '#bbb';
                    const isCurrent = isTaskCurrent(task);
                    const statusClass = task.status === 'completed' ? 'completed' : task.status === 'incompleted' ? 'incompleted' : '';
                    return (
                      <div 
                        key={`${task.id}-${i}`} 
                        data-task-id={task.id}
                        className={`${task.type === 'event' ? styles.eventCard : styles.taskCard} ${isCurrent ? styles.currentTask : ''} ${statusClass}`}
                        draggable={false}
                        style={{
                          opacity: highlightedItem && highlightedItem.id !== task.id ? 0.3 : 1,
                          transition: 'opacity 0.2s ease',
                          transform: highlightedItem && highlightedItem.id === task.id ? 'scale(1.02)' : 'scale(1)',
                          boxShadow: 'none',
                        }}

                        onClick={(e) => {
                          if (window.globalDragState?.suppressClick) {
                            window.globalDragState.suppressClick = false;
                            return;
                          }
                          if (isSidebarActionTarget(e.target)) return;

                          closeOpenSidebarDropdown();

                          if (onItemClick) {
                            onItemClick({ id: task.id, type: task.type });
                          }
                        }}

                        onMouseDown={(e) => {
                          if (viewMode === 'month') {
                            if (isSidebarActionTarget(e.target)) return;
                            e.stopPropagation();
                            closeOpenSidebarDropdown();
                            onItemClick?.({ id: task.id, type: task.type });
                            return;
                          }
                          if (!allowCalendarDrag) return;
                          // Start custom drag for sidebar tasks and events
                          e.preventDefault();
                          e.stopPropagation();
                          
                          window.globalDragState.currentTask = task;
                          window.globalDragState.startCustomDrag = true;
                          window.globalDragState.startX = e.clientX;
                          window.globalDragState.startY = e.clientY;
                        }}
                        onMouseEnter={(e) => {
                          const deleteBtn = e.currentTarget.querySelector('.task-delete-btn');
                          const completeBtn = e.currentTarget.querySelector('.task-complete-btn');
                          const editBtn = e.currentTarget.querySelector('.task-edit-btn');
                          const dropdownTrigger = e.currentTarget.querySelector('.task-actions-dropdown-trigger');
                          if (deleteBtn) deleteBtn.style.opacity = '1';
                          if (completeBtn) completeBtn.style.opacity = '1';
                          if (editBtn) editBtn.style.opacity = '1';
                          if (dropdownTrigger) dropdownTrigger.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                          const deleteBtn = e.currentTarget.querySelector('.task-delete-btn');
                          const completeBtn = e.currentTarget.querySelector('.task-complete-btn');
                          const editBtn = e.currentTarget.querySelector('.task-edit-btn');
                          const dropdownTrigger = e.currentTarget.querySelector('.task-actions-dropdown-trigger');
                          if (deleteBtn && !deleteBtn.closest('.task-actions-dropdown')) deleteBtn.style.opacity = '0';
                          if (completeBtn && !completeBtn.closest('.task-actions-dropdown')) completeBtn.style.opacity = '0';
                          if (editBtn && !editBtn.closest('.task-actions-dropdown')) editBtn.style.opacity = '0';
                          if (dropdownTrigger && !dropdownTrigger.closest('.task-actions-dropdown')) dropdownTrigger.style.opacity = '0';
                                                 }}
                       >
                         {/* Actions Dropdown - Top Right Corner */}
                         <div style={{
                           position: 'absolute',
                           top: '6px',
                           right: '10px',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'flex-end',
                           pointerEvents: 'none',
                           zIndex: 10,
                         }}>
                           <TaskActionsDropdown
                             task={task}
                             onAutoSchedule={onAutoSchedule && task.type === 'task' ? onAutoSchedule : null}
                             onQuickMove={onQuickMove}
                             onExtendDuration={onExtendDuration}
                             isTask={task.type === 'task'}
                           />
                         </div>
                         
                         {/* Type badge - to the left of dropdown */}
                         <div
                           style={{
                             position: 'absolute',
                             top: '6px',
                             right: '30px',
                             background: task.type === 'event' ? 'rgba(108, 99, 255, 0.9)' : 'rgba(95, 51, 177, 0.9)',
                             color: 'white',
                             fontSize: '0.6rem',
                             fontWeight: 'bold',
                             padding: '2px 6px',
                             borderRadius: '8px',
                             textTransform: 'uppercase',
                             letterSpacing: '0.5px',
                             zIndex: 5,
                           }}
                         >
                           {task.type === 'event' ? 'Event' : 'Task'}
                         </div>
                         
                                                  {/* Trash can button - moved to bottom-right */}
                         <div
                           className="task-delete-btn"
                           style={{
                             position: 'absolute',
                             bottom: '4px',
                             right: '8px',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#ffffff',
                            opacity: 0,
                            transition: 'opacity 0.2s ease',
                            zIndex: 10,
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onDelete && task.id) {
                              onDelete(task.id);
                            }
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                          </svg>
                        </div>

                                                 {/* Green checkmark button - only visible on hover */}
                         <div
                           className={`task-complete-btn ${task.status === 'completed' ? 'selected' : ''}`}
                           style={{
                             position: 'absolute',
                             bottom: '4px',
                             right: '28px',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#ffffff',
                            opacity: task.status === 'completed' ? 1 : 0,
                            transition: 'opacity 0.2s ease',
                            zIndex: 10,
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onUpdateStatus && task.id) {
                              // If already completed, toggle back to active
                              onUpdateStatus(task.id, task.status === 'completed' ? 'active' : 'completed');
                            }
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20,6 9,17 4,12"></polyline>
                          </svg>
                        </div>

                        {/* Edit button - only visible on hover */}
                        {onEdit && (
                          <div
                            className="task-edit-btn"
                            style={{
                              position: 'absolute',
                              bottom: '4px',
                              right: '48px',
                              width: '14px',
                              height: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#ffffff',
                              opacity: 0,
                              transition: 'opacity 0.2s ease',
                              zIndex: 10,
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (onEdit && task) {
                                onEdit(task);
                              }
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                            </svg>
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className={styles.time}>
                            {task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : (task.duration ? `${task.duration}m` : 'No time set')}
                          </div>
                          <span style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: dotColor,
                            marginLeft: 2,
                            marginRight: 2,
                          }} />
                        </div>
                        <div className={styles.title}>{task.title}</div>
                        {task.description && (
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            marginTop: '4px',
                            lineHeight: '1.3',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            wordBreak: 'break-word'
                          }}>
                            {task.description}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.noTask}>No Tasks/Events</div>
                )}
              </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;
