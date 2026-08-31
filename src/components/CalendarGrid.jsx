import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'; 
import '../index.css';
import { startOfWeek, addDays, format, subDays, isSameDay, isBefore, isAfter, min as dateMin, max as dateMax } from 'date-fns';
import TaskCreationCard from './TaskCreationCard';
import TaskActionsDropdown from './TaskActionsDropdown';
import ShortBlockLabel from './ShortBlockLabel';
import StackedBlockLabel from './StackedBlockLabel';
import NowMarker from './NowMarker';
import CreateSheet from './CreateSheet';
import { assignOverlapLanes, getLanedBlockBounds, BLOCK_V_GAP, formatShortTimeRange, SHORT_BLOCK, getItemColor, snapMinutes, getItemDurationMinutes, formatMinutes, toggleCalendarHighlight, getCalendarHighlightOpacity } from '../utils/calendarItems';
import { useLayoutMode } from '../hooks/useLayoutMode';

// Global drag state to bypass getData() limitations
window.globalDragState = window.globalDragState || { 
  currentTask: null,
  startCustomDrag: false,
  startX: null,
  startY: null
};

const hours = Array.from({ length: 24 }, (_, i) => i);
const ROW_HEIGHT = 50;
const SNAP_MINUTES = 5;
const MAX_START_MINUTES = 24 * 60 - SNAP_MINUTES;

function getHoveredCalendarCell(e) {
  if (e?.target?.closest) {
    const fromTarget = e.target.closest('.calendar-cell');
    if (fromTarget && !fromTarget.classList.contains('time-column')) {
      return fromTarget;
    }
  }
  if (typeof document.elementsFromPoint !== 'function') return null;
  const stack = document.elementsFromPoint(e.clientX, e.clientY) || [];
  return stack.find((el) => el.classList?.contains('calendar-cell') && !el.classList.contains('time-column')) || null;
}

function snapStartFromPosition(position, clickOffsetY = 0) {
  const cursorMinutes = position.hour * 60 + position.minute;
  const offsetMinutes = (clickOffsetY / ROW_HEIGHT) * 60;
  const clamped = Math.max(0, Math.min(MAX_START_MINUTES, snapMinutes(cursorMinutes - offsetMinutes, SNAP_MINUTES)));
  return {
    startMinutes: clamped,
    hour: Math.floor(clamped / 60),
    minute: clamped % 60,
  };
}

function snapTotalMinutes(hour, minute) {
  const snapped = snapMinutes(hour * 60 + minute, SNAP_MINUTES);
  const clamped = Math.max(0, Math.min(MAX_START_MINUTES, snapped));
  return {
    hour: Math.floor(clamped / 60),
    minute: clamped % 60,
  };
}

function CalendarGrid({ onAdd, tasks = [], visibleCols: _visibleCols, onDelete, onUpdateStatus, onUpdateTask, centerDay, setCenterDay, highlightedItem, onHighlightItem, isNavigating = false, searchResults = null, onAutoSchedule, onQuickMove, onExtendDuration, clearActiveBlockTrigger, isQuickMoving, onEdit, focusNowToken = 0 }) {
  const { isCompact, isCoarse, isDrawerChrome } = useLayoutMode();
  const condensedWeek = isCompact;
  const tapToCreate = isCompact || isCoarse;

  // Responsive visible columns state
  const [visibleCols, setVisibleCols] = useState(7);
  const gridRef = useRef();

  // Minimum column width (matches .calendar-cell min-width or actual width)
  const MIN_COL_WIDTH = 120; // px, adjust as needed for your design
  const TIME_COL_WIDTH = condensedWeek ? 48 : 80;

  // Responsive logic: update visibleCols on grid resize
  useEffect(() => {
    if (!gridRef.current) return;
    function updateVisibleCols() {
      if (!gridRef.current) return;
      if (condensedWeek) {
        setVisibleCols(7);
        return;
      }
      const gridWidth = gridRef.current.offsetWidth;
      const availableWidth = gridWidth - TIME_COL_WIDTH;
      const cols = Math.max(1, Math.floor(availableWidth / MIN_COL_WIDTH));
      setVisibleCols(cols);
    }
    updateVisibleCols();
    const observer = new window.ResizeObserver(updateVisibleCols);
    observer.observe(gridRef.current);
    return () => {
      observer.disconnect();
    };
  }, [condensedWeek, TIME_COL_WIDTH]);

  // Generate rolling 7-day window with centerDay as the third column (index 2)
  const days = Array.from({ length: 7 }, (_, i) => addDays(centerDay, i - 2));
  const [cardPos, setCardPos] = useState(null); // {x, y, flippedX, flippedY} or null
  const [cardKey, setCardKey] = useState(0); // Key to force component reset
  const cardRef = useRef();
  const [cardWidth, setCardWidth] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  

  // Cursor state
  const [cursorStyle, setCursorStyle] = useState('default');
  // Ref to store the closeDatePicker method
  const closeDatePickerRef = useRef(null);
  // Ref to store the closeTimePicker method
  const closeTimePickerRef = useRef(null);
  const scrollWrapperRef = useRef();
  const ignoreScrollRef = useRef(false);
  // State for debug red dot
  const [debugDot, setDebugDot] = useState(null);
  // Track if user has scrolled
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  // Replace activeFrontHighlight state with activeBlockKey
  const [activeBlockKey, setActiveBlockKey] = useState(null); // key of the active block
  const ignoreActiveBlockKeyRef = useRef(false); // Flag to temporarily ignore activeBlockKey during Quick Move
  

  

  



  // Reset all block opacities when activeBlockKey changes
  useEffect(() => {
    const blocks = document.querySelectorAll('.calendar-time-block');
    blocks.forEach(block => {
      // Reset to default opacity (1) when no active block
      if (activeBlockKey === null) {
        block.style.opacity = '1';
      }
    });
  }, [activeBlockKey]);

  // Clear activeBlockKey when clearActiveBlockTrigger changes (triggered by Quick Move)
  // Use useLayoutEffect to clear synchronously before browser paint, preventing flicker
  useLayoutEffect(() => {
    if (clearActiveBlockTrigger > 0) {
      // Set flag to ignore activeBlockKey during this render cycle
      ignoreActiveBlockKeyRef.current = true;
      setActiveBlockKey(null);
      // Reset flag after a brief delay to allow render to complete
      requestAnimationFrame(() => {
        ignoreActiveBlockKeyRef.current = false;
      });
    }
  }, [clearActiveBlockTrigger]);

  // Measure card width and height after it renders
  useEffect(() => {
    if (cardPos && cardRef.current) {
      setCardWidth(cardRef.current.offsetWidth);
      setCardHeight(cardRef.current.offsetHeight);
    }
  }, [cardPos]);

  // Dismiss on Escape or outside click
  useEffect(() => {
    if (!cardPos) return;
    
    function handleKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        
        // Close any open date picker using the proper method
        if (closeDatePickerRef.current) {
          closeDatePickerRef.current();
        }
        // Close any open time picker using the proper method
        if (closeTimePickerRef.current) {
          closeTimePickerRef.current();
        }
        // Close the task creation card
        setCardPos(null);
      }
    }
    
    function handleClick(e) {
      // Only prevent closing if clicking inside the card itself or its pickers
      if (cardRef.current && cardRef.current.contains(e.target)) return;
      if (document.querySelector('.aridia-datepicker-popper')?.contains(e.target)) return;
      if (document.querySelector('.custom-time-picker-modal')?.contains(e.target)) return;
      
      // Close any open time picker using the proper method
      if (closeTimePickerRef.current) {
        closeTimePickerRef.current();
      }
      
      // Close the task creation card - this will happen for ANY click outside the card
      setCardPos(null);
    }
    
    document.addEventListener('keydown', handleKey, true); // Use capture phase
    document.addEventListener('mousedown', handleClick);
    
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [cardPos]);

  // Dismiss highlight on outside click
  useEffect(() => {
    function handleClick(e) {
      // Keep selection when interacting with the portaled actions menu
      if (e.target.closest('.task-actions-dropdown-menu') || e.target.closest('.task-actions-dropdown-trigger')) {
        return;
      }
      // Only reset if not clicking a calendar-time-block
      if (!e.target.closest('.calendar-time-block')) {
        setActiveBlockKey(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Helper to check if the card can fit at a given clientX/clientY
  function canCardFitAt(clientX, clientY) {
    const grid = gridRef.current;
    if (!grid) return false;
    const gridRect = grid.getBoundingClientRect();
    const cardWidthPx = 420;
    const cardHeightPx = 240;
    const flipOptions = [
      { flippedX: false, flippedY: false },
      { flippedX: true, flippedY: false },
      { flippedX: false, flippedY: true },
      { flippedX: true, flippedY: true },
    ];
    for (const { flippedX, flippedY } of flipOptions) {
      const left = flippedX ? clientX - cardWidthPx : clientX;
      const top = flippedY ? clientY - cardHeightPx : clientY;
      if (
        left >= gridRect.left &&
        left + cardWidthPx <= gridRect.right &&
        top >= gridRect.top &&
        top + cardHeightPx <= gridRect.bottom
      ) {
        return true;
      }
    }
    return false;
  }

  // Mouse move handler for cursor change
  function handleGridMouseMove(e) {
    if (canCardFitAt(e.clientX, e.clientY)) {
      setCursorStyle('default');
    } else {
      setCursorStyle('not-allowed');
    }
  }

  // Mouse leave handler to reset cursor
  function handleGridMouseLeave() {
    setCursorStyle('default');
  }

  // On grid single click - handle escape/clear functionality
  function handleGridSingleClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (cardPos) {
      setCardPos(null);
      return;
    }

    if (tapToCreate && !e.target.closest('.calendar-time-block')) {
      const cell = e.target.closest('.calendar-cell');
      if (cell && !cell.classList.contains('time-column')) {
        openCreateFromEvent(e);
        return;
      }
    }

    if (!e.target.closest('.calendar-time-block')) {
      setActiveBlockKey(null);
    }
  }

  // On grid double click, show card at click position
  function openCreateFromEvent(e) {
    if (cardRef.current && cardRef.current.contains(e.target)) return;
    const cell = e.target.closest('.calendar-cell');
    if (!cell || cell.classList.contains('time-column')) return;

    // Use data attributes for row and col
    const rowIdx = parseInt(cell.getAttribute('data-row'), 10);
    const colIdx = parseInt(cell.getAttribute('data-col'), 10);
    if (isNaN(rowIdx) || isNaN(colIdx)) return;

    // Calculate snapped minute based on click position within the cell
    const cellRect = cell.getBoundingClientRect();
    let minute = Math.round(((e.clientY - cellRect.top) / cellRect.height) * 60);
    const snapped = snapTotalMinutes(rowIdx, minute);
    const hour = snapped.hour;
    minute = snapped.minute;

    const day = days[colIdx];
    const start = new Date(day);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    const defaultStartTime = start;
    const defaultEndTime = end;
    const defaultDeadline = day;

    // Card positioning logic (unchanged)
    const scrollArea = scrollWrapperRef.current;
    const scrollTop = scrollArea ? scrollArea.scrollTop : 0;
    const headerHeight = 60; // Height of the fixed header
    const gridElement = gridRef.current;
    if (!gridElement) return;
    const gridRect = gridElement.getBoundingClientRect();
    const scrollRect = e.currentTarget.getBoundingClientRect();
    const xOffset = 0;
    const yOffsetNormal = 30;
    const yOffsetFlipped = 45;
    const x = e.clientX - scrollRect.left + xOffset;
    const y = e.clientY - scrollRect.top + yOffsetNormal;
    const cardWidthPx = 420;
    const cardHeightPx = 240;
    let chosenFlip = { flippedX: false, flippedY: false };
    let chosenPos = { x, y };
    const cardLeft = e.clientX;
    const cardTop = e.clientY;
    const cardRight = cardLeft + cardWidthPx;
    const cardBottom = cardTop + cardHeightPx;
    if (cardRight > scrollRect.right) {
      chosenFlip.flippedX = true;
    }
    if (cardBottom > scrollRect.bottom) {
      chosenFlip.flippedY = true;
    }
    const finalYOffset = chosenFlip.flippedY ? yOffsetFlipped : yOffsetNormal;
    const adjustedY = e.clientY - scrollRect.top + finalYOffset;
    if (chosenFlip.flippedX && (e.clientX - cardWidthPx) < scrollRect.left) {
      return;
    }
    if (chosenFlip.flippedY && (e.clientY - cardHeightPx) < scrollRect.top) {
      return;
    }
    setCardKey(prev => prev + 1);
    setCardPos({ 
      x: chosenPos.x, 
      y: adjustedY, 
      flippedX: chosenFlip.flippedX, 
      flippedY: chosenFlip.flippedY, 
      defaultStartTime, 
      defaultEndTime, 
      defaultDeadline 
    });
    if (document.activeElement) document.activeElement.blur();
  }

  function handleGridDoubleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (tapToCreate) return;
    openCreateFromEvent(e);
  }

  useEffect(() => {
    if (onAdd) {
      // Handle any additional side effects when onAdd changes
    }
  }, [onAdd]);

  // Helper: get vertical position for current time in px
  const rowHeight = 50; // px, matches .calendar-row min-height
  const getCurrentTimePosition = () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    return hour * rowHeight + (minute / 60) * rowHeight;
  };

  // Auto-scroll to current time on mount and when time changes, unless user has scrolled
  useEffect(() => {
    if (userHasScrolled) return;
    const scrollToCurrentTime = () => {
      if (!scrollWrapperRef.current) return;
      const pos = getCurrentTimePosition();
      // Center the indicator, but keep some offset from the top
      const offset = 120; // px from top
      scrollWrapperRef.current.scrollTop = Math.max(0, pos - offset);
    };
    scrollToCurrentTime();
    // Also scroll every minute to keep in view, unless user has scrolled
    const interval = setInterval(() => {
      if (!userHasScrolled) scrollToCurrentTime();
    }, 60000);
    return () => clearInterval(interval);
  }, [userHasScrolled]);

  useLayoutEffect(() => {
    if (!focusNowToken) return;
    setUserHasScrolled(false);
    ignoreScrollRef.current = true;
    const apply = () => {
      if (!scrollWrapperRef.current) return;
      const pos = getCurrentTimePosition();
      scrollWrapperRef.current.scrollTop = Math.max(0, pos - 120);
    };
    apply();
    const id = requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(() => {
        ignoreScrollRef.current = false;
      });
    });
    return () => cancelAnimationFrame(id);
  }, [focusNowToken]);

  // Navigation handlers with smooth transitions
  const handlePrevDay = () => {
    const prevDay = addDays(centerDay, -1);
    setCenterDay(prevDay);
  };
  const handleNextDay = () => {
    const nextDay = addDays(centerDay, 1);
    setCenterDay(nextDay);
  };

  // Helper: get index of today in the window
  const getTodayColumnIndex = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    for (let i = 0; i < days.length; i++) {
      if (isSameDay(days[i], today)) {
        return i;
      }
    }
    return -1;
  };

  // Determine which columns to show: prioritize keeping "today" visible
  // When navigated, prioritize centerDay (index 2) instead
  let colStart = 0;
  let colEnd = days.length;
  if (typeof visibleCols === 'number' && visibleCols < days.length) {
    // Determine priority column: today if it exists in window, otherwise centerDay (index 2)
    const todayIndex = getTodayColumnIndex();
    const priorityCol = todayIndex !== -1 ? todayIndex : 2; // centerDay is always at index 2
    
    // Try to center the priority column, ensuring it's always visible
    // Calculate how many columns can fit on each side
    const colsBefore = Math.floor((visibleCols - 1) / 2);
    const colsAfter = Math.ceil((visibleCols - 1) / 2);
    
    // Start from priority column, trying to center it
    colStart = Math.max(0, priorityCol - colsBefore);
    colEnd = Math.min(days.length, colStart + visibleCols);
    
    // If we hit the right edge, adjust start to fit all visibleCols
    if (colEnd - colStart < visibleCols) {
      colStart = Math.max(0, colEnd - visibleCols);
    }
    
    // Ensure priority column is always visible
    if (priorityCol < colStart) {
      colStart = priorityCol;
      colEnd = Math.min(days.length, colStart + visibleCols);
    } else if (priorityCol >= colEnd) {
      colEnd = priorityCol + 1;
      colStart = Math.max(0, colEnd - visibleCols);
    }
  }

  // Calculate the number of visible columns (including time column)
  const numDayCols = colEnd - colStart;
  const numGridCols = numDayCols + 1; // +1 for the time column

  // Refactored: Efficient drag state management
  const dragTaskRef = useRef(null); // Store task data (doesn't trigger re-renders)
  const [dragState, setDragState] = useState({
    isActive: false,
    position: null
  });
  
  // Step 2: Visual Preview - Drag preview state
  const [dragPreview, setDragPreview] = useState(null); // { left, top, width, height, opacity }
  const previewUpdateRef = useRef(null);
  const lastPreviewUpdateRef = useRef(0);
  
  // Track which task is being moved and whether it should be hidden
  const [movedTaskId, setMovedTaskId] = useState(null); // ID of the task being moved
  const [isMovingTask, setIsMovingTask] = useState(false); // Whether we're in move mode
  
  // Custom drag system state (parallel to HTML5 drag)
  const [customDragState, setCustomDragState] = useState({
    isActive: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    taskData: null,
    isFromSidebar: false,
    isMovingExistingTask: false,
    clickOffsetY: 0 // Track where user clicked within the time block
  });
  
  // Cleanup effect to clear drag preview when drag states are inactive
  useEffect(() => {
    if (!dragState.isActive && !customDragState.isActive) {
      setDragPreview(null);
    }
  }, [dragState.isActive, customDragState.isActive]);
  
  // Handler for user scroll
  const handleUserScroll = () => {
    if (ignoreScrollRef.current) return;
    setUserHasScrolled(true);
    
    // Update drag preview position when scrolling
    if (dragState.isActive && dragTaskRef.current && dragState.position) {
      const preview = calculateDragPreview(dragState.position, dragTaskRef.current);
      setDragPreview(preview);
    }
  };
  
  // Handle wheel events during drag to enable scrolling
  const handleWheel = useCallback((e) => {
    if (dragState.isActive && scrollWrapperRef.current) {
      e.preventDefault();
      e.stopPropagation();
      const scrollAmount = e.deltaY;
      const currentScrollTop = scrollWrapperRef.current.scrollTop;
      scrollWrapperRef.current.scrollTop = currentScrollTop + scrollAmount;
      
      // Update drag preview position after scroll
      if (dragTaskRef.current && dragState.position) {
        const preview = calculateDragPreview(dragState.position, dragTaskRef.current);
        setDragPreview(preview);
      }
    }
    // If not dragging, let the normal scroll behavior work
  }, [dragState.isActive, dragState.position, dragTaskRef]);
  
  // Add a more aggressive wheel handler that works during drag
  useEffect(() => {
    const handleWheelDuringDrag = (e) => {
      if (customDragState.isActive && scrollWrapperRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const scrollAmount = e.deltaY;
        const currentScrollTop = scrollWrapperRef.current.scrollTop;
        scrollWrapperRef.current.scrollTop = currentScrollTop + scrollAmount;
        
        // Update custom drag preview position after scroll
        if (customDragState.taskData) {
          // Use a small delay to ensure scroll has been applied
          requestAnimationFrame(() => {
                      // Recalculate position based on current mouse position
          const position = calculatePosition(e, getHoveredCalendarCell(e));
          if (position) {
            const preview = calculateDragPreview(position, customDragState.taskData, customDragState.clickOffsetY);
            setDragPreview(preview);
          }
          });
        }
      }
    };
    
    if (dragState.isActive) {
      document.addEventListener('wheel', handleWheelDuringDrag, { passive: false, capture: true });
      return () => {
        document.removeEventListener('wheel', handleWheelDuringDrag, { passive: false, capture: true });
      };
    }
  }, [dragState.isActive]); // Only depend on isActive, not position
  
  // Alternative: Use keyboard events for scrolling during drag
  useEffect(() => {
    const handleKeyDownDuringDrag = (e) => {
      if (dragState.isActive && scrollWrapperRef.current) {
        const scrollAmount = 50; // pixels per key press
        let newScrollTop = scrollWrapperRef.current.scrollTop;
        
        if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          newScrollTop -= scrollAmount;
        } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          e.preventDefault();
          newScrollTop += scrollAmount;
        }
        
        if (newScrollTop !== scrollWrapperRef.current.scrollTop) {
          scrollWrapperRef.current.scrollTop = newScrollTop;
          
          // Update drag preview position after scroll
          if (dragTaskRef.current && dragState.position) {
            const preview = calculateDragPreview(dragState.position, dragTaskRef.current);
            setDragPreview(preview);
          }
        }
      }
    };
    
    if (dragState.isActive) {
      document.addEventListener('keydown', handleKeyDownDuringDrag);
      return () => {
        document.removeEventListener('keydown', handleKeyDownDuringDrag);
      };
    }
  }, [dragState.isActive]); // Only depend on isActive, not position
  
  // Handle edge scrolling during drag
  const handleDragScroll = useCallback((e) => {
    if (dragState.isActive && scrollWrapperRef.current) {
      const scrollContainer = scrollWrapperRef.current;
      const rect = scrollContainer.getBoundingClientRect();
      const baseScrollSpeed = 20; // Increased from 10
      const edgeThreshold = 100; // Increased from 50 - triggers scrolling sooner
      
      // Check if mouse is near the top or bottom edge
      const distanceFromTop = e.clientY - rect.top;
      const distanceFromBottom = rect.bottom - e.clientY;
      
      if (distanceFromTop < edgeThreshold) {
        // Progressive scroll speed - faster when closer to edge
        const speedMultiplier = Math.max(1, (edgeThreshold - distanceFromTop) / 20);
        const scrollSpeed = Math.round(baseScrollSpeed * speedMultiplier);
        scrollContainer.scrollTop -= scrollSpeed;
      } else if (distanceFromBottom < edgeThreshold) {
        // Progressive scroll speed - faster when closer to edge
        const speedMultiplier = Math.max(1, (edgeThreshold - distanceFromBottom) / 20);
        const scrollSpeed = Math.round(baseScrollSpeed * speedMultiplier);
        scrollContainer.scrollTop += scrollSpeed;
      }
      
      // Update drag preview position after scroll
      if (dragTaskRef.current && dragState.position) {
        const preview = calculateDragPreview(dragState.position, dragTaskRef.current);
        setDragPreview(preview);
      }
    }
  }, [dragState.isActive, dragState.position, dragTaskRef]);
  
  // Optimized position update using requestAnimationFrame for smoother updates
  const positionUpdateRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const debouncedSetPosition = useCallback(
    (position) => {
      const now = performance.now();
      const throttleInterval = 16; // ~60fps
      
      // Throttle updates to prevent excessive re-renders
      if (now - lastUpdateTimeRef.current < throttleInterval) {
        if (positionUpdateRef.current) {
          cancelAnimationFrame(positionUpdateRef.current);
        }
        positionUpdateRef.current = requestAnimationFrame(() => {
          lastUpdateTimeRef.current = performance.now();
          setDragState(prev => ({
            ...prev,
            position
          }));
        });
      } else {
        lastUpdateTimeRef.current = now;
        setDragState(prev => ({
          ...prev,
          position
        }));
      }
    },
    []
  );
  
  // Optimized position calculation function with caching
  const calculatePosition = useCallback((e, cell) => {
    const hoveredCell = cell && !cell.classList.contains('time-column')
      ? cell
      : getHoveredCalendarCell(e);
    
    if (hoveredCell && !hoveredCell.classList.contains('time-column')) {
      // Cell-based calculation (preferred) - most efficient
      const rowIdx = parseInt(hoveredCell.getAttribute('data-row'), 10);
      const colIdx = parseInt(hoveredCell.getAttribute('data-col'), 10);
      
      if (!isNaN(rowIdx) && !isNaN(colIdx)) {
        const cellRect = hoveredCell.getBoundingClientRect();
        const minuteInCell = Math.round(((e.clientY - cellRect.top) / cellRect.height) * 60);
        const snapped = snapTotalMinutes(rowIdx, minuteInCell);
        const clampedColIdx = Math.max(colStart, Math.min(colEnd - 1, colIdx));
        
        return {
          x: e.clientX,
          y: e.clientY,
          hour: snapped.hour,
          minute: snapped.minute,
          colIdx: clampedColIdx,
          cellRect: cellRect,
          rowIdx,
        };
      }
    }
    
    // Fallback calculation if not over a cell - optimized
    let rect;
    if (!e.currentTarget) {
      // If no currentTarget, try to find the calendar grid
      const calendarGrid = document.querySelector('.calendar-scroll-area');
      if (!calendarGrid) {
        return null;
      }
      rect = calendarGrid.getBoundingClientRect();
    } else {
      rect = e.currentTarget.getBoundingClientRect();
    }
    
    // Ensure we have a valid rect
    if (!rect) {
      return null;
    }
    
    // Optimized calculations with fewer operations
    const relativeY = e.clientY - rect.top;
    const relativeX = e.clientX - rect.left;
    const timeColumnWidth = TIME_COL_WIDTH;
    const dayColumnWidth = (rect.width - timeColumnWidth) / (colEnd - colStart);
    
    const hour = Math.floor(relativeY / ROW_HEIGHT);
    const minute = Math.floor((relativeY % ROW_HEIGHT) / (ROW_HEIGHT / 60));
    const colIdx = Math.floor((relativeX - timeColumnWidth) / dayColumnWidth) + colStart;
    const snapped = snapTotalMinutes(Math.max(0, hour), minute);
    
    return {
      x: e.clientX,
      y: e.clientY,
      hour: snapped.hour,
      minute: snapped.minute,
      colIdx: Math.max(colStart, Math.min(colEnd - 1, colIdx))
    };
  }, [colStart, colEnd, TIME_COL_WIDTH]);
  
  // Step 2: Visual Preview - Calculate drag preview dimensions
  const calculateDragPreview = useCallback((position, taskData, clickOffsetY = 0) => {
    if (!position || !taskData || !scrollWrapperRef.current) {
      return null;
    }
    
    // Ensure we have valid position data
    if (typeof position.hour !== 'number' || typeof position.minute !== 'number' || typeof position.colIdx !== 'number') {
      return null;
    }
    
    const scrollRect = scrollWrapperRef.current.getBoundingClientRect();
    const timeColumnWidth = TIME_COL_WIDTH;
    const availableWidth = scrollRect.width - timeColumnWidth;
    const dayColumnWidth = availableWidth / (colEnd - colStart);
    
    // Calculate position - match the exact calculation used for real blocks
    const left = timeColumnWidth + (position.colIdx - colStart) * dayColumnWidth;
    const duration = getItemDurationMinutes(taskData);
    const height = Math.max((duration / 60) * ROW_HEIGHT, 10);
    const snappedStart = snapStartFromPosition(position, clickOffsetY);
    const gridRect = gridRef.current?.getBoundingClientRect();
    const headerHeight = 60;
    let top;
    if (position.cellRect && gridRect && typeof position.rowIdx === 'number') {
      top = position.cellRect.top - gridRect.top
        + ((snappedStart.startMinutes - position.rowIdx * 60) / 60) * ROW_HEIGHT;
    } else {
      const scrollAreaTop = gridRect ? scrollRect.top - gridRect.top : headerHeight;
      top = scrollAreaTop + (snappedStart.startMinutes / 60) * ROW_HEIGHT - scrollWrapperRef.current.scrollTop;
    }
    
    // Check if this is a short block (less than 48px height, which is roughly 36 minutes)
    const isShortBlock = height < 48;
    
    // For events, allow extending past midnight for cross-day events
    // Only apply boundary constraints for tasks, not events
    const minTop = gridRect ? (scrollRect.top - gridRect.top) : headerHeight;
    if (taskData.type !== 'event') {
      const maxTop = (gridRect ? scrollRect.bottom - gridRect.top : scrollRect.height) - 10;
      top = Math.max(minTop, Math.min(maxTop, top));
    } else {
      top = Math.max(minTop, top);
    }
    
    // Ensure left position is within bounds
    const minLeft = timeColumnWidth;
    const maxLeft = scrollRect.width - dayColumnWidth;
    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, left));
    
    // Width is already calculated above
    const width = dayColumnWidth;
    
    // Get the correct color for the task type
    const color = getItemColor(taskData);
    
    const result = {
      left: clampedLeft,
      top,
      width,
      height,
      color,
      opacity: 0.5,
      isShortBlock,
      startHour: snappedStart.hour,
      startMinute: snappedStart.minute,
      startMinutes: snappedStart.startMinutes,
      duration,
    };
    
    return result;
  }, [colStart, colEnd, TIME_COL_WIDTH]);
  
  // Optimized drag handlers with smoother updates
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    
    // Set drag as active
    if (!dragState.isActive) {
      setDragState(prev => ({ ...prev, isActive: true }));
    }
    
    // Handle edge scrolling during drag
    handleDragScroll(e);
    
    // Calculate position
    const cell = e.target.closest('.calendar-cell');
    const position = calculatePosition(e, cell);
    
    // Update position with optimized debouncing
    debouncedSetPosition(position);
    
    // Step 2: Update drag preview with optimized throttling
    if (dragTaskRef.current && position) {
      const now = performance.now();
      const throttleInterval = 16; // ~60fps
      
      if (now - lastPreviewUpdateRef.current < throttleInterval) {
        if (previewUpdateRef.current) {
          cancelAnimationFrame(previewUpdateRef.current);
        }
        previewUpdateRef.current = requestAnimationFrame(() => {
          lastPreviewUpdateRef.current = performance.now();
          const preview = calculateDragPreview(position, dragTaskRef.current);
          setDragPreview(preview);
        });
      } else {
        lastPreviewUpdateRef.current = now;
        const preview = calculateDragPreview(position, dragTaskRef.current);
        setDragPreview(preview);
      }
    }
    
    // Ensure we have task data - try multiple sources (only once)
    if (!dragTaskRef.current) {
      if (window.globalDragState.currentTask) {
        dragTaskRef.current = window.globalDragState.currentTask;
      } else {
        try {
          const taskData = e.dataTransfer.getData('application/json');
          if (taskData) {
            dragTaskRef.current = JSON.parse(taskData);
          }
        } catch (error) {
          // Silently handle error
        }
      }
    }
  }, [dragState.isActive, calculatePosition, debouncedSetPosition, calculateDragPreview, handleDragScroll]);
  
  // Enable scrolling during drag by preventing the default drag behavior from blocking wheel events
  const handleDragStart = useCallback((e) => {
    // Allow wheel events during drag
    e.dataTransfer.effectAllowed = 'move';
  }, []);
  
  const handleDragLeave = useCallback((e) => {
    // Only clear drag state if we're actually leaving the calendar grid entirely
    // and not just moving between child elements
    if (!e.currentTarget.contains(e.relatedTarget)) {
      // Hide the preview when leaving the grid, but keep the drag state active
      setDragPreview(null);
      
      // If we're moving a task and leaving the grid, keep the original task hidden
      // The original task should remain hidden until we re-enter the grid
      // (this is already handled by the shouldHide logic in the rendering)
      
      // Don't clear the drag state immediately - let it persist
      // The drag state will be cleared in handleDragEnd if the drop doesn't happen
    }
  }, [isMovingTask, movedTaskId]);
  
  const handleDragEnd = useCallback((e) => {
    // Only clear drag state if we're not dropping within the calendar grid
    // The handleDrop function will handle clearing the state if the drop is successful
    if (!e.currentTarget.contains(e.target)) {
      
      // If we're moving a task and ending outside the grid, restore the original task
      if (isMovingTask && movedTaskId) {
        setIsMovingTask(false);
        setMovedTaskId(null);
      }
      
    setDragState({ isActive: false, position: null });
    setDragPreview(null);
    dragTaskRef.current = null;
    window.globalDragState.currentTask = null;
    
    // Cancel any pending animation frames
    if (positionUpdateRef.current) {
      cancelAnimationFrame(positionUpdateRef.current);
      positionUpdateRef.current = null;
    }
    if (previewUpdateRef.current) {
      cancelAnimationFrame(previewUpdateRef.current);
      previewUpdateRef.current = null;
    }
    }
  }, [isMovingTask, movedTaskId]);
  
  const handleDragEnter = useCallback((e) => {
    
    // Use global drag state instead of getData()
    if (!dragTaskRef.current && window.globalDragState.currentTask) {
      dragTaskRef.current = window.globalDragState.currentTask;
    } else if (!dragTaskRef.current) {
      // Fallback to getData() if global state is not available
      try {
        const taskData = e.dataTransfer.getData('application/json');
        if (taskData) {
          dragTaskRef.current = JSON.parse(taskData);
        }
      } catch (error) {
        // Silently handle error
      }
    }
    
    // Check if we're moving an existing task (has startTime and endTime)
    if (dragTaskRef.current && dragTaskRef.current.startTime && dragTaskRef.current.endTime) {
      setIsMovingTask(true);
      setMovedTaskId(dragTaskRef.current.id);
    } else {
      setIsMovingTask(false);
      setMovedTaskId(null);
    }
    
    // Always restore the preview when entering the grid, regardless of position state
    if (dragTaskRef.current && dragState.isActive) {
      // If we don't have a position, calculate it from the current mouse position
      let position = dragState.position;
      if (!position) {
        const cell = e.target.closest('.calendar-cell');
        if (cell) {
          position = calculatePosition(e, cell);
        }
      }
      
      if (position) {
        const preview = calculateDragPreview(position, dragTaskRef.current);
        setDragPreview(preview);
      }
      
      // If we're moving an existing task, ensure the moving state is set
      if (dragTaskRef.current.startTime && dragTaskRef.current.endTime) {
        setIsMovingTask(true);
        setMovedTaskId(dragTaskRef.current.id);
      }
    }
  }, [dragState.isActive, dragState.position, calculateDragPreview, calculatePosition, setIsMovingTask, setMovedTaskId]);
  
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    
    if (!dragTaskRef.current || !dragState.position) {
      return;
    }
    
    const task = dragTaskRef.current;
    const position = dragState.position;
    
    // Calculate end time based on task duration
    const totalMinutes = task.duration || 30;
    const endTime = new Date(0, 0, 0, position.hour, position.minute + totalMinutes);
    const endHour = endTime.getHours();
    const endMinute = endTime.getMinutes();
    
    // Format times
    const startTimeStr = `${String(position.hour).padStart(2, '0')}:${String(position.minute).padStart(2, '0')}`;
    const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    
    // Get the date for the column
    const date = days[position.colIdx];
    const deadline = format(date, 'yyyy-MM-dd');
    
    
    // Update the task
    if (onUpdateTask) {
      onUpdateTask(task.id, {
        deadline,
        startTime: startTimeStr,
        endTime: endTimeStr,
      });
      

    }
    
    // Reset drag state
    setDragState({ isActive: false, position: null });
    setDragPreview(null);
    dragTaskRef.current = null;
    window.globalDragState.currentTask = null;
    
    // Clear move state
    setIsMovingTask(false);
    setMovedTaskId(null);
  }, [dragState.position, days, onUpdateTask]);
  

  // Custom drag handlers (parallel to HTML5 drag system)
  const startCustomDrag = useCallback((e, taskData, isFromSidebar = false) => {
    e.preventDefault();
    e.stopPropagation();
    

    
    // Calculate click offset within the time block
    let clickOffsetY = 0;
    if (!isFromSidebar) {
      // For existing tasks, calculate where in the block the user clicked
      const blockElement = e.currentTarget;
      const blockRect = blockElement.getBoundingClientRect();
      clickOffsetY = e.clientY - blockRect.top;
    }
    
    setCustomDragState({
      isActive: true,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      taskData: taskData,
      isFromSidebar: isFromSidebar,
      isMovingExistingTask: !isFromSidebar && taskData.startTime && taskData.endTime,
      clickOffsetY: clickOffsetY
    });
    
    // If moving an existing task, hide the original
    if (!isFromSidebar && taskData.startTime && taskData.endTime) {
      setIsMovingTask(true);
      setMovedTaskId(taskData.id);
    }
  }, []);

  const handleCustomDragMove = useCallback((e) => {
    if (!customDragState.isActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    

    
    // Use requestAnimationFrame for smoother state updates
    requestAnimationFrame(() => {
      setCustomDragState(prev => ({
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY
      }));
    });
    
    // Calculate position and update preview with optimized timing
    const position = calculatePosition(e, getHoveredCalendarCell(e));
    
    // Update preview immediately for responsiveness, then optimize with requestAnimationFrame
    if (position && customDragState.taskData) {
      const preview = calculateDragPreview(position, customDragState.taskData, customDragState.clickOffsetY);
      setDragPreview(preview);
    }
    
    // Handle edge scrolling
    if (scrollWrapperRef.current) {
      const rect = scrollWrapperRef.current.getBoundingClientRect();
      const baseScrollSpeed = 20; // Increased from 10
      const edgeThreshold = 100; // Increased from 50 - triggers scrolling sooner
      const distanceFromTop = e.clientY - rect.top;
      const distanceFromBottom = rect.bottom - e.clientY;
      
      if (distanceFromTop < edgeThreshold) {
        // Progressive scroll speed - faster when closer to edge
        const speedMultiplier = Math.max(1, (edgeThreshold - distanceFromTop) / 20);
        const scrollSpeed = Math.round(baseScrollSpeed * speedMultiplier);
        scrollWrapperRef.current.scrollTop -= scrollSpeed;
      } else if (distanceFromBottom < edgeThreshold) {
        // Progressive scroll speed - faster when closer to edge
        const speedMultiplier = Math.max(1, (edgeThreshold - distanceFromBottom) / 20);
        const scrollSpeed = Math.round(baseScrollSpeed * speedMultiplier);
        scrollWrapperRef.current.scrollTop += scrollSpeed;
      }
      
      // Update preview after scroll to ensure it stays with cursor
      requestAnimationFrame(() => {
        if (customDragState.isActive && customDragState.taskData) {
          const updatedPosition = calculatePosition(e, getHoveredCalendarCell(e));
          if (updatedPosition) {
            const updatedPreview = calculateDragPreview(updatedPosition, customDragState.taskData, customDragState.clickOffsetY);
            setDragPreview(updatedPreview);
          }
        }
      });
    }
  }, [customDragState.isActive, customDragState.taskData, customDragState.clickOffsetY, calculatePosition, calculateDragPreview]);

  const handleCustomDragEnd = useCallback((e) => {
    if (!customDragState.isActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Cancel any pending animation frames
    if (positionUpdateRef.current) {
      cancelAnimationFrame(positionUpdateRef.current);
      positionUpdateRef.current = null;
    }
    if (previewUpdateRef.current) {
      cancelAnimationFrame(previewUpdateRef.current);
      previewUpdateRef.current = null;
    }
    
    // Check if we're over a valid drop area and use the current preview position
    if (dragPreview && customDragState.taskData) {
      const task = customDragState.taskData;
      const duration = typeof dragPreview.duration === 'number'
        ? dragPreview.duration
        : getItemDurationMinutes(task);

      const position = calculatePosition(e, getHoveredCalendarCell(e));
      const snappedStart = typeof dragPreview.startMinutes === 'number'
        ? {
            startMinutes: dragPreview.startMinutes,
            hour: dragPreview.startHour,
            minute: dragPreview.startMinute,
          }
        : snapStartFromPosition(position || { hour: 0, minute: 0 }, customDragState.clickOffsetY);

      const startMinutes = snappedStart.startMinutes;
      const endTotalMinutes = startMinutes + duration;
      const startTimeStr = formatMinutes(startMinutes);
      const endTimeStr = endTotalMinutes >= 24 * 60
        ? formatMinutes(endTotalMinutes - 24 * 60)
        : formatMinutes(endTotalMinutes);

      const date = position ? days[position.colIdx] : days[0];
      const deadline = format(date, 'yyyy-MM-dd');
      
      if (customDragState.isFromSidebar) {
        // Update existing task from sidebar (don't create new task)
        if (onUpdateTask && task.id) {
          onUpdateTask(task.id, {
            deadline,
            startTime: startTimeStr,
            endTime: endTimeStr,
          });
        }
      } else {
        // Update existing task
        if (onUpdateTask) {
          onUpdateTask(task.id, {
            deadline,
            startTime: startTimeStr,
            endTime: endTimeStr,
          });
        }
      }
    }
    
    // Reset all states
    setCustomDragState({
      isActive: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      taskData: null,
      isFromSidebar: false,
      isMovingExistingTask: false,
      clickOffsetY: 0
    });
    setDragPreview(null);
    setIsMovingTask(false);
    setMovedTaskId(null);
    setActiveBlockKey(null); // Clear highlighting after drag
  }, [customDragState.isActive, customDragState.taskData, customDragState.isFromSidebar, customDragState.clickOffsetY, dragPreview, calculatePosition, days, onUpdateTask]);

  const handleCustomDragLeave = useCallback((e) => {
    if (!customDragState.isActive) return;
    
    // Only cancel if we're leaving the entire grid
    if (!e.currentTarget.contains(e.relatedTarget)) {
      // Hide the preview when leaving the grid, but keep the drag state active
      setDragPreview(null);
      
      // If we're moving a task and leaving the grid, keep the original task hidden
      // The original task should remain hidden until we re-enter the grid
      // (this is already handled by the shouldHide logic in the rendering)
      
      // Don't clear the custom drag state immediately - let it persist
      // The drag state will be cleared in handleCustomDragEnd if the drop doesn't happen
    }
  }, [customDragState.isActive, customDragState.isMovingExistingTask]);

  const handleCustomDragEnter = useCallback((e) => {
    if (!customDragState.isActive) return;
    
    // Always restore the preview when entering the grid
    if (customDragState.taskData) {
      // Calculate position from current mouse position
      const position = calculatePosition(e, getHoveredCalendarCell(e));
      
      if (position) {
        const preview = calculateDragPreview(position, customDragState.taskData, customDragState.clickOffsetY);
        setDragPreview(preview);
      }
      
      // If we're moving an existing task, ensure the moving state is set
      if (customDragState.isMovingExistingTask) {
        setIsMovingTask(true);
        setMovedTaskId(customDragState.taskData.id);
      }
    }
  }, [customDragState.isActive, customDragState.taskData, customDragState.clickOffsetY, customDragState.isMovingExistingTask, calculatePosition, calculateDragPreview, setIsMovingTask, setMovedTaskId]);

  // Global mouse event listener to detect sidebar drag start
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      // Check if we should start a custom drag from sidebar
      if (window.globalDragState.startCustomDrag && window.globalDragState.currentTask) {
        // Check if mouse has moved enough to start drag (prevent accidental triggers)
        const startX = window.globalDragState.startX || 0;
        const startY = window.globalDragState.startY || 0;
        const distance = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));
        
        if (distance > 5) { // Only start drag if mouse has moved at least 5px
          // Check if mouse is over the calendar grid
          const calendarGrid = document.querySelector('.calendar-grid');
          if (calendarGrid && e.target && calendarGrid.contains(e.target)) {
            // Start custom drag
            startCustomDrag(e, window.globalDragState.currentTask, true);
            // Clear the flag
            window.globalDragState.startCustomDrag = false;
            window.globalDragState.startX = null;
            window.globalDragState.startY = null;
          }
        }
      }
    };

    const handleGlobalMouseUp = (e) => {
      // Clear sidebar drag state if mouse is released outside calendar
      if (window.globalDragState.startCustomDrag) {
        const calendarGrid = document.querySelector('.calendar-grid');
        if (!calendarGrid || !e.target || !calendarGrid.contains(e.target)) {
          window.globalDragState.startCustomDrag = false;
          window.globalDragState.startX = null;
          window.globalDragState.startY = null;
          window.globalDragState.currentTask = null;
        }
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      
      // Clean up any pending animation frames
      if (positionUpdateRef.current) {
        cancelAnimationFrame(positionUpdateRef.current);
        positionUpdateRef.current = null;
      }
      if (previewUpdateRef.current) {
        cancelAnimationFrame(previewUpdateRef.current);
        previewUpdateRef.current = null;
      }
    };
  }, [startCustomDrag]);

  // Helper: check if a block is currently happening
  function isBlockCurrent(block) {
    const now = new Date();
    const [startHour, startMinute] = (block._group ? block.tasks[0].startTime : block.startTime).split(':').map(Number);
    const [endHour, endMinute] = (block._group ? block.tasks[0].endTime : block.endTime).split(':').map(Number);
    const start = new Date(now);
    start.setHours(startHour, startMinute, 0, 0);
    const end = new Date(now);
    end.setHours(endHour, endMinute, 0, 0);
    return now >= start && now <= end;
  }

  // Helper: check if a task is in search results
  function isTaskInSearchResults(taskId) {
    if (!searchResults) return false;
    return searchResults.some(task => task.id === taskId);
  }

  return (
    <div
      className={`calendar-grid ${isNavigating ? 'calendar-grid-transition' : ''}${condensedWeek ? ' calendar-grid--condensed' : ''}`}
      ref={gridRef}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        flex: 1,
        background: 'white',
        cursor: cursorStyle,
      }}
    >
      {/* Navigation bar - fixed at top */}
      <div className="calendar-nav-bar">
        <button
          className="calendar-nav-arrow left"
          onClick={handlePrevDay}
          aria-label="Previous day"
          onDoubleClick={e => { e.preventDefault(); e.currentTarget.blur(); }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" style={{display:'block',margin:'auto'}} fill="black" xmlns="http://www.w3.org/2000/svg">
            <polygon points="11,3 5,8 11,13" />
          </svg>
        </button>
        <button
          className="calendar-nav-arrow right"
          onClick={handleNextDay}
          aria-label="Next day"
          onDoubleClick={e => { e.preventDefault(); e.currentTarget.blur(); }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" style={{display:'block',margin:'auto'}} fill="black" xmlns="http://www.w3.org/2000/svg">
            <polygon points="5,3 11,8 5,13" />
          </svg>
        </button>
      </div>

      {/* Fixed header row */}
      <div className={`header-row ${isNavigating ? 'header-row-transition' : ''}`} style={{ 
        display: 'grid', 
        gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${numDayCols}, 1fr)`,
        height: '60px',
        background: 'white',
        borderBottom: '1px solid #e0e0e0',
        zIndex: 2,
        position: 'sticky',
        top: 0
      }}>
        <div className="day-header time-column"></div>
        {days.slice(colStart, colEnd).map((date, idx) => {
          const realIdx = colStart + idx;
          const isToday = realIdx === getTodayColumnIndex();
          return (
            <div key={realIdx} className={isToday ? "day-header current-day-header" : "day-header"}>
              <div className={isToday ? "weekday-label" : "weekday-label"}>{format(date, condensedWeek ? 'EEEEE' : 'EEE')}</div>
              <div className={isToday ? "day-number" : "day-number"}>{format(date, 'd')}</div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid content */}
      <div 
        className={`calendar-scroll-area ${isNavigating ? 'calendar-scroll-area-transition' : ''}`}
        style={{
          flex: 1,
          overflowY: 'auto',
          position: 'relative',
        }}
        onScroll={handleUserScroll}
        ref={scrollWrapperRef}
        onClick={handleGridSingleClick}
        onDoubleClick={handleGridDoubleClick}
        onMouseMove={(e) => {
          handleGridMouseMove(e);
          handleCustomDragMove(e);
        }}
        onMouseLeave={(e) => {
          handleGridMouseLeave(e);
          handleCustomDragLeave(e);
        }}
        onMouseEnter={(e) => {
          handleCustomDragEnter(e);
        }}
        onMouseUp={handleCustomDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragEnd={handleDragEnd}
        onDragEnter={handleDragEnter}
        onDrop={handleDrop}
        onWheel={handleWheel}
      >
        <div
          className={isNavigating ? 'calendar-grid-content-transition' : ''}
          style={{
            display: 'grid',
            gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${numDayCols}, 1fr)`,
            gridAutoRows: 'minmax(50px, auto)',
            position: 'relative',
          }}
        >
          {/* Calendar rows as grid rows */}
          {hours.map((hour, rowIdx) => (
            <React.Fragment key={rowIdx}>
              <div
                className="calendar-cell time-column"
                style={{
                  outline: 'none',
                  userSelect: 'none',
                  caretColor: 'transparent',
                  pointerEvents: 'auto',
                }}
                onMouseDown={e => e.preventDefault()}
              >
                {condensedWeek
                  ? (hour === 0 || hour === 12 ? '12' : String(hour % 12))
                  : format(new Date(0, 0, 0, hour), 'h aa')}
              </div>
              {days.slice(colStart, colEnd).map((_, idx) => {
                const realIdx = colStart + idx;
                return (
                  <div 
                    key={realIdx} 
                    className={realIdx === getTodayColumnIndex() ? "calendar-cell current-day-col" : "calendar-cell"} 
                    style={{outline: 'none', userSelect: 'none', pointerEvents: 'auto'}} 
                    onMouseDown={e => e.preventDefault()} 
                    data-row={rowIdx} 
                    data-col={realIdx}

                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* Current time indicator */}
        <CurrentTimeIndicator
          getCurrentTimePosition={getCurrentTimePosition}
          rowHeight={50}
          todayColIndex={getTodayColumnIndex()}
          colStart={colStart}
          colEnd={colEnd}
          visibleCols={visibleCols}
          days={days}
          timeColWidth={TIME_COL_WIDTH}
        />



        {/* Render time blocks for each task (absolutely positioned) */}
        {(() => {
          // Only consider visible days for rendering blocks
          const visibleDays = days.slice(colStart, colEnd);
          // Group tasks by visible day index
          const tasksByDay = visibleDays.map(day => []);
          tasks.forEach((task, idx) => {
            if (!task.deadline) return;
            
            // Ensure task has startTime and endTime for dragging
            let startTime = task.startTime;
            let endTime = task.endTime;
            
            // If task doesn't have startTime/endTime, calculate them from duration
            if (!startTime || !endTime) {
              const duration = task.duration || 30; // Default 30 minutes
              const [year, month, day] = task.deadline.split('-').map(Number);
              const taskDate = new Date(year, month - 1, day);
              
              // Default to 9 AM start time
              const defaultStartHour = 9;
              const defaultStartMinute = 0;
              
              startTime = `${String(defaultStartHour).padStart(2, '0')}:${String(defaultStartMinute).padStart(2, '0')}`;
              
              // Calculate end time based on duration
              const endTotalMinutes = defaultStartHour * 60 + defaultStartMinute + duration;
              const endHour = Math.floor(endTotalMinutes / 60);
              const endMinute = endTotalMinutes % 60;
              endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
            }
            
            // Parse start and end times and dates
            const [startYear, startMonth, startDay] = task.deadline.split('-').map(Number);
            const startDate = new Date(startYear, startMonth - 1, startDay);
            const [startHour, startMinute] = startTime.split(':').map(Number);
            let [endHour, endMinute] = endTime.split(':').map(Number);
            // Use endDeadline if present (for cross-day tasks)
            let endDate = new Date(startDate);
            if (task.endDeadline) {
              const [endYear, endMonth, endDay] = task.endDeadline.split('-').map(Number);
              endDate = new Date(endYear, endMonth - 1, endDay);
            } else if (endHour < startHour || (endHour === startHour && endMinute <= startMinute)) {
              endDate.setDate(endDate.getDate() + 1);
            }
            // #region agent log
            if (endDate.getTime() < startDate.getTime()) {
              fetch('http://127.0.0.1:7371/ingest/2eed45bb-2200-47aa-912e-5e702c03d5d8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f391a9'},body:JSON.stringify({sessionId:'f391a9',runId:'pre-fix',hypothesisId:'D',location:'CalendarGrid.jsx:spanCheck',message:'invalid span end before start',data:{taskId:task.id,deadline:task.deadline,endDeadline:task.endDeadline||null,startDate:startDate.toDateString(),endDate:endDate.toDateString()},timestamp:Date.now()})}).catch(()=>{});
            }
            // #endregion
            let placedOnVisible = false;
            // Find all days this task spans in visibleDays
            visibleDays.forEach((dayObj, dayIdx) => {
              // If dayObj is between startDate and endDate (inclusive)
              const isAfterOrSameStart = dayObj >= startDate;
              const isBeforeOrSameEnd = dayObj <= endDate;
              if (isAfterOrSameStart && isBeforeOrSameEnd) {
                placedOnVisible = true;
                // For the first day, use the real start time
                // For the last day, use the real end time
                // For middle days, use 00:00 to 23:59
                let blockStartHour = 0, blockStartMinute = 0, blockEndHour = 23, blockEndMinute = 59;
                if (dayObj.getTime() === startDate.getTime()) {
                  blockStartHour = startHour;
                  blockStartMinute = startMinute;
                }
                if (dayObj.getTime() === endDate.getTime()) {
                  blockEndHour = endHour;
                  blockEndMinute = endMinute;
                }
                // If this is the first day but not the last day, end at 23:59
                if (dayObj.getTime() === startDate.getTime() && dayObj.getTime() !== endDate.getTime()) {
                  blockEndHour = 23;
                  blockEndMinute = 59;
                }
                // If this is the last day but not the first day, start at 00:00
                if (dayObj.getTime() === endDate.getTime() && dayObj.getTime() !== startDate.getTime()) {
                  blockStartHour = 0;
                  blockStartMinute = 0;
                }
                // For middle days (not first or last), 00:00 to 23:59
                if (dayObj.getTime() !== startDate.getTime() && dayObj.getTime() !== endDate.getTime()) {
                  blockStartHour = 0;
                  blockStartMinute = 0;
                  blockEndHour = 23;
                  blockEndMinute = 59;
                }
                // Push a virtual block for this day
                tasksByDay[dayIdx].push({
                  ...task,
                  startTime: startTime, // Use calculated startTime
                  endTime: endTime, // Use calculated endTime
                  _originalIdx: idx,
                  _multiDay: true,
                  _blockStartHour: blockStartHour,
                  _blockStartMinute: blockStartMinute,
                  _blockEndHour: blockEndHour,
                  _blockEndMinute: blockEndMinute,
                  _blockDayObj: dayObj,
                  _blockStartDate: startDate,
                  _blockEndDate: endDate,
                  _blockShowTime: `${startTime} - ${endTime}`,
                });
              }
            });
            // #region agent log
            if (!placedOnVisible) {
              const visibleHasStart = visibleDays.some(d => d.getTime() === startDate.getTime());
              if (visibleHasStart || endDate.getTime() < startDate.getTime()) {
                fetch('http://127.0.0.1:7371/ingest/2eed45bb-2200-47aa-912e-5e702c03d5d8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f391a9'},body:JSON.stringify({sessionId:'f391a9',runId:'pre-fix',hypothesisId:'D',location:'CalendarGrid.jsx:notPlaced',message:'task not placed on visible days',data:{taskId:task.id,deadline:task.deadline,endDeadline:task.endDeadline||null,visibleHasStart,spanInvalid:endDate.getTime()<startDate.getTime(),visibleDayCount:visibleDays.length},timestamp:Date.now()})}).catch(()=>{});
              }
            }
            // #endregion
          });
          // For each visible day, sort and render blocks
          return tasksByDay.flatMap((dayTasks, dayIdx) => {
            // Group by BOTH start and end time (string)
            const groups = {};
            dayTasks.forEach(task => {
              const key = `${task.startTime}|${task.endTime}`;
              if (!groups[key]) groups[key] = [];
              groups[key].push(task);
            });
            // For each group, sort by creation order (older first)
            const blocks = [];
            Object.values(groups).forEach(group => {
              if (group.length === 1) {
                blocks.push(group[0]);
              } else {
                // Only group if ALL start and end times are the same
                const allSameTime = group.every(t => t.startTime === group[0].startTime && t.endTime === group[0].endTime);
                if (allSameTime) {
                  // Group into a single block
                  blocks.push({
                    _group: true,
                    tasks: group,
                    startTime: group[0].startTime,
                    endTime: group[0].endTime,
                    taskType: group[0].taskType,
                    dayIdx, // Use visible day index
                    _originalIdx: group[0]._originalIdx,
                  });
                } else {
                  group.forEach(t => blocks.push(t));
                }
              }
            });
            // Sort blocks by duration (longest first, so shortest is rendered last/on top)
            blocks.sort((a, b) => {
              const aDur = (() => {
                if (a._group) {
                  // Use the shortest duration in the group
                  return Math.min(...a.tasks.map(t => {
                    const [sh, sm] = t.startTime.split(':').map(Number);
                    const [eh, em] = t.endTime.split(':').map(Number);
                    return (eh * 60 + em) - (sh * 60 + sm);
                  }));
                } else {
                  const [sh, sm] = a.startTime.split(':').map(Number);
                  const [eh, em] = a.endTime.split(':').map(Number);
                  return (eh * 60 + em) - (sh * 60 + sm);
                }
              })();
              const bDur = (() => {
                if (b._group) {
                  return Math.min(...b.tasks.map(t => {
                    const [sh, sm] = t.startTime.split(':').map(Number);
                    const [eh, em] = t.endTime.split(':').map(Number);
                    return (eh * 60 + em) - (sh * 60 + sm);
                  }));
                } else {
                  const [sh, sm] = b.startTime.split(':').map(Number);
                  const [eh, em] = b.endTime.split(':').map(Number);
                  return (eh * 60 + em) - (sh * 60 + sm);
                }
              })();
              // Longest first
              return bDur - aDur;
            });
            // Side-by-side lanes for concurrent overlaps + edge padding
            const lanedBlocks = assignOverlapLanes(blocks);
            // Render blocks
            return lanedBlocks.map((block, idx) => {
              // Use visible day index for colIdx
              const colIdx = block._group ? block.dayIdx : dayIdx;
              // Use split block times for multi-day blocks
              let startHour, startMinute, endHour, endMinute;
              if (block._multiDay) {
                startHour = block._blockStartHour;
                startMinute = block._blockStartMinute;
                endHour = block._blockEndHour;
                endMinute = block._blockEndMinute;
              } else {
                [startHour, startMinute] = (block._group ? block.tasks[0].startTime : block.startTime).split(':').map(Number);
                [endHour, endMinute] = (block._group ? block.tasks[0].endTime : block.endTime).split(':').map(Number);
              }
              const startY = (startHour + startMinute / 60) * rowHeight;
              const endY = (endHour + endMinute / 60) * rowHeight;
              const rawHeight = Math.max(endY - startY, 10);
              const blockHeight = Math.max(rawHeight - BLOCK_V_GAP, SHORT_BLOCK.weekMinHeight);
              const isShort = blockHeight < SHORT_BLOCK.weekInlineBelow;
              // Calculate left and width
              const grid = document.querySelector('.calendar-grid');
              let colLeft = TIME_COL_WIDTH;
              let colWidth = 0;
              if (grid) {
                const gridRect = grid.getBoundingClientRect();
                const timeColumnWidth = TIME_COL_WIDTH;
                colWidth = (gridRect.width - timeColumnWidth) / (colEnd - colStart);
                colLeft = timeColumnWidth + (colIdx) * colWidth;
              } else {
                colLeft = 80 + colIdx * 160;
                colWidth = 160;
              }
              const { left, width } = getLanedBlockBounds(
                colLeft,
                colWidth,
                block._lane || 0,
                block._laneCount || 1
              );
              // Get color for task type
              const color = getItemColor(block._group ? block.tasks[0] : block);
              // Generate a unique key for the block - include day index and block index to ensure uniqueness
              const blockKey = block._group 
                ? `group-${dayIdx}-${idx}-${block.tasks.map(t => t._originalIdx).join('-')}` 
                : `${dayIdx}-${idx}-${block._originalIdx}`;
              // Get task ID first (needed for highlighting logic)
              const taskId = block._group ? block.tasks[0].id : block.id;
              
              // Determine opacity: if activeBlockKey is set, only that block is opaque, all others are transparent
              // Ignore activeBlockKey if Quick Move is in progress to prevent flicker
              let customOpacity = 1;
              if (activeBlockKey !== null && !isQuickMoving && !ignoreActiveBlockKeyRef.current) {
                customOpacity = (activeBlockKey === blockKey) ? 1 : 0.2; // Lower opacity for better focus on highlighted task
              }
              
              // Add visual feedback for highlighted blocks
              const isHighlighted = activeBlockKey === blockKey;
              const highlightSource = block._group ? block.tasks[0] : block;
              if (highlightedItem) {
                customOpacity = getCalendarHighlightOpacity(highlightedItem, highlightSource);
              }
              

              const isCurrent = isBlockCurrent(block);
              const taskStatus = block._group ? block.tasks[0].status : block.status;
              const statusClass = taskStatus === 'completed' ? 'completed' : taskStatus === 'incompleted' ? 'incompleted' : '';
              
              // Hide the block if it's the moved task OR if there's a drag preview being shown
              const shouldHide = (isMovingTask && movedTaskId === taskId) || 
                                (dragPreview && customDragState.isActive && customDragState.taskData && customDragState.taskData.id === taskId);
              

              
              return (
                <div
                  key={blockKey}
                  className={`calendar-time-block ${statusClass}${isShort ? ' short-block' : ''}${isHighlighted ? ' is-selected' : ''}`}
                  style={{
                    position: 'absolute',
                    left,
                    width,
                    top: startY,
                    height: blockHeight,
                    background: color,
                    opacity: shouldHide ? 0 : customOpacity,
                    borderRadius: 8,
                    zIndex: 5,
                    color: '#fff',
                    padding: isShort ? '2px 6px' : '8px 8px',
                    cursor: isHighlighted ? 'grab' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: isShort ? 'center' : 'flex-start',
                    boxShadow: '0 2px 8px 0 rgba(0,0,0,0.15)',
                    transition: 'all 0.2s ease',
                    overflow: 'hidden',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    lineHeight: 1.2,
                    userSelect: 'none',
                    caretColor: 'transparent',
                  }}
                  onPointerDown={e => {
                    // Don't set active block if clicking on buttons / actions menu
                    if (
                      e.target.closest('.task-complete-btn') ||
                      e.target.closest('.task-delete-btn') ||
                      e.target.closest('.task-edit-btn') ||
                      e.target.closest('.task-actions-dropdown-trigger') ||
                      e.target.closest('.task-actions-dropdown-menu')
                    ) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }

                    // While an actions dropdown is open, don't select/drag  -  menu owns the gesture
                    if (window.openDropdownRef && window.openDropdownRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      window.openDropdownRef.current.setIsOpen(false);
                      window.openDropdownRef.current.setActiveSubmenu(null);
                      window.openDropdownRef.current = null;
                      return;
                    }

                    e.preventDefault();
                    e.stopPropagation();
                    
                    toggleCalendarHighlight(
                      highlightedItem,
                      onHighlightItem,
                      block._group ? block.tasks[0] : block
                    );

                    if (condensedWeek || tapToCreate) {
                      if (activeBlockKey === blockKey) {
                        const editTask = block._group ? block.tasks[0] : block;
                        if (onEdit) onEdit(editTask);
                      } else {
                        setActiveBlockKey(blockKey);
                      }
                      if (e.pointerType && e.pointerType !== 'mouse') {
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const taskData = {
                          ...block,
                          id: block._group ? block.tasks[0].id : block.id,
                          title: block._group ? block.tasks[0].title : block.title,
                          startTime: block._group ? block.tasks[0].startTime : block.startTime,
                          endTime: block._group ? block.tasks[0].endTime : block.endTime,
                          deadline: block._group ? block.tasks[0].deadline : block.deadline,
                          taskType: block._group ? block.tasks[0].taskType : block.taskType,
                          duration: block._group ? block.tasks[0].duration : block.duration,
                          type: block._group ? block.tasks[0].type : block.type,
                        };
                        const timer = window.setTimeout(() => {
                          startCustomDrag(e, taskData, false);
                        }, 400);
                        const cancel = (moveEvent) => {
                          if (moveEvent.type === 'pointermove' && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 8) {
                            return;
                          }
                          window.clearTimeout(timer);
                          window.removeEventListener('pointermove', cancel);
                          window.removeEventListener('pointerup', cancel);
                          window.removeEventListener('pointercancel', cancel);
                        };
                        window.addEventListener('pointermove', cancel);
                        window.addEventListener('pointerup', cancel);
                        window.addEventListener('pointercancel', cancel);
                      }
                      return;
                    }
                    
                    // Check if this block was already highlighted (second click)
                    if (activeBlockKey === blockKey) {
                      // Start custom drag for highlighted blocks (both tasks and events)
                      const taskData = {
                        ...block,
                        id: block._group ? block.tasks[0].id : block.id,
                        title: block._group ? block.tasks[0].title : block.title,
                        startTime: block._group ? block.tasks[0].startTime : block.startTime,
                        endTime: block._group ? block.tasks[0].endTime : block.endTime,
                        deadline: block._group ? block.tasks[0].deadline : block.deadline,
                        taskType: block._group ? block.tasks[0].taskType : block.taskType,
                        duration: block._group ? block.tasks[0].duration : block.duration,
                        type: block._group ? block.tasks[0].type : block.type, // Add type for events
                      };
                      startCustomDrag(e, taskData, false);
                    } else {
                      // First click - just highlight the block
                      setActiveBlockKey(blockKey);
                    }
                  }}
                                     onMouseEnter={e => {
                     // Show dropdown on hover
                     const dropdownTrigger = e.currentTarget.querySelector('.task-actions-dropdown-trigger');
                     if (dropdownTrigger) dropdownTrigger.style.opacity = '1';
                     
                     // Show edit button on hover for long blocks
                     if (blockHeight >= 48) {
                       const editBtn = e.currentTarget.querySelector('.task-edit-btn');
                       if (editBtn) editBtn.style.opacity = '1';
                     }
                     
                     // Let the shouldHide logic handle opacity - don't override it
                     // Show inline buttons for short blocks (only non-selected ones)
                     if (blockHeight < 48) {
                       const deleteBtn = e.currentTarget.querySelector('.task-action-buttons-inline .task-delete-btn');
                       const completeBtn = e.currentTarget.querySelector('.task-action-buttons-inline .task-complete-btn');
                       const editBtn = e.currentTarget.querySelector('.task-action-buttons-inline .task-edit-btn');
                       const dropdownTrigger = e.currentTarget.querySelector('.task-action-buttons-inline .task-actions-dropdown-trigger');
                       
                       // Show all buttons on hover, selected ones will stay visible due to CSS
                       if (deleteBtn) deleteBtn.style.opacity = '1';
                       if (completeBtn) completeBtn.style.opacity = '1';
                       if (editBtn) editBtn.style.opacity = '1';
                       if (dropdownTrigger) dropdownTrigger.style.opacity = '1';
                     }
                     // Show buttons on hover for short blocks
                     if (blockHeight < 48) {
                       const buttonContainer = e.currentTarget.querySelector('.task-action-buttons-inline');
                       if (buttonContainer) {
                         // Buttons are now absolutely positioned, so we just need to make them visible
                         buttonContainer.style.opacity = '1';
                       }
                     }
                     // Show buttons on hover for long blocks
                     if (blockHeight >= 48) {
                       const buttonContainer = e.currentTarget.querySelector('.task-action-buttons-long');
                       const editBtn = e.currentTarget.querySelector('.task-action-buttons-long .task-edit-btn');
                       if (buttonContainer) {
                         // Show the horizontal button row
                         buttonContainer.style.opacity = '1';
                       }
                       if (editBtn) {
                         editBtn.style.opacity = '1';
                       }
                     }
                   }}
                   onMouseLeave={e => {
                     // Hide dropdown on mouse leave
                     const dropdownTrigger = e.currentTarget.querySelector('.task-actions-dropdown-trigger');
                     if (dropdownTrigger && !dropdownTrigger.closest('.task-actions-dropdown')) {
                       dropdownTrigger.style.opacity = '0';
                     }
                     
                     // Let the shouldHide logic handle opacity - don't override it
                     // Hide inline buttons for short blocks (only non-selected ones)
                     if (blockHeight < 48) {
                       const deleteBtn = e.currentTarget.querySelector('.task-action-buttons-inline .task-delete-btn');
                       const completeBtn = e.currentTarget.querySelector('.task-action-buttons-inline .task-complete-btn');
                       const editBtn = e.currentTarget.querySelector('.task-action-buttons-inline .task-edit-btn');
                       const dropdownTrigger = e.currentTarget.querySelector('.task-action-buttons-inline .task-actions-dropdown-trigger');
                       
                       // Only hide non-selected buttons on mouse leave
                       if (deleteBtn && !deleteBtn.classList.contains('selected')) deleteBtn.style.opacity = '0';
                       if (completeBtn && !completeBtn.classList.contains('selected')) completeBtn.style.opacity = '0';
                       if (editBtn && !editBtn.classList.contains('selected')) editBtn.style.opacity = '0';
                       if (dropdownTrigger && !dropdownTrigger.closest('.task-actions-dropdown')) dropdownTrigger.style.opacity = '0';
                     }
                     // Hide buttons on mouse leave for short blocks
                     if (blockHeight < 48) {
                       const buttonContainer = e.currentTarget.querySelector('.task-action-buttons-inline');
                       
                       // Check if any buttons are selected
                       const hasSelectedButtons = buttonContainer && (
                         buttonContainer.querySelector('.task-complete-btn.selected')
                       );
                       
                       if (buttonContainer && !hasSelectedButtons) {
                         // Only hide container if no buttons are selected
                         buttonContainer.style.opacity = '0';
                       }
                     }
                     // Hide buttons on mouse leave for long blocks (only non-selected ones)
                     if (blockHeight >= 48) {
                       const buttonContainer = e.currentTarget.querySelector('.task-action-buttons-long');
                       const editBtn = e.currentTarget.querySelector('.task-action-buttons-long .task-edit-btn');
                       
                       // Check if any buttons are selected
                       const hasSelectedButtons = buttonContainer && (
                         buttonContainer.querySelector('.task-complete-btn.selected')
                       );
                       
                       if (buttonContainer && !hasSelectedButtons) {
                         // Only hide container if no buttons are selected
                         buttonContainer.style.opacity = '0';
                       }
                       if (editBtn && !editBtn.classList.contains('selected')) {
                         editBtn.style.opacity = '0';
                       }
                     }
                   }}
                >
                  {/* Actions Dropdown - Top Right (Only for long blocks) */}
                  {blockHeight >= 48 && (
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      pointerEvents: 'none',
                      zIndex: 15,
                    }}>
                      <div style={{ pointerEvents: 'auto' }}>
                        <TaskActionsDropdown
                          task={block._group ? block.tasks[0] : block}
                          onAutoSchedule={onAutoSchedule && (block._group ? block.tasks[0].type === 'task' : block.type === 'task') ? onAutoSchedule : null}
                          onQuickMove={onQuickMove}
                          onExtendDuration={onExtendDuration}
                          isTask={block._group ? block.tasks[0].type === 'task' : block.type === 'task'}
                        />
                      </div>
                    </div>
                  )}

                  {/* Action buttons container - hidden for short blocks and long blocks (since we have new button system) */}
                  <div className="task-action-buttons" style={{
                    display: 'none', // Hide the old button system completely
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                  }}>
                    {/* Green check mark button - only visible on hover */}
                    <div
                      className={`task-complete-btn ${(block._group ? block.tasks[0].status === 'completed' : block.status === 'completed') ? 'selected' : ''}`}
                      data-task-status={block._group ? block.tasks[0].status : block.status}
                      data-is-selected={(block._group ? block.tasks[0].status === 'completed' : block.status === 'completed') ? 'true' : 'false'}
                      style={{
                        position: blockHeight < 48 ? 'relative' : 'absolute',
                        bottom: blockHeight < 48 ? 'auto' : '4px',
                        right: blockHeight < 48 ? 'auto' : '4px',
                        width: '16px',
                        height: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#ffffff',
                        opacity: 0, // Let CSS handle visibility
                        transition: 'opacity 0.2s ease',
                        zIndex: 10,
                        marginLeft: blockHeight < 48 ? '4px' : 'auto',
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const taskId = block._group ? block.tasks[0].id : block.id;
                        if (onUpdateStatus && taskId) {
                          const currentStatus = block._group ? block.tasks[0].status : block.status;
                          const newStatus = currentStatus === 'completed' ? 'active' : 'completed';
                          // If already completed, toggle back to active
                          onUpdateStatus(taskId, newStatus);
                        }
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20,6 9,17 4,12"></polyline>
                      </svg>
                    </div>

                    {/* Delete button - only visible on hover */}
                    <div
                      className="task-delete-btn"
                      data-task-status={block._group ? block.tasks[0].status : block.status}
                      data-is-selected="false"
                      style={{
                        position: blockHeight < 48 ? 'relative' : 'absolute',
                        top: blockHeight < 48 ? 'auto' : '4px',
                        right: blockHeight < 48 ? 'auto' : '4px',
                        width: '16px',
                        height: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#fff',
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                        zIndex: 10,
                        marginLeft: blockHeight < 48 ? '4px' : 'auto',
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Apply fade out animation first
                        const blockElement = e.target.closest('.calendar-time-block');
                        if (blockElement) {
                          blockElement.style.transition = 'opacity 0.2s ease';
                          blockElement.style.opacity = '0';
                        }
                        
                        // Delete the task from data after the animation completes
                        setTimeout(() => {
                          const taskId = block._group ? block.tasks[0].id : block.id;
                          if (onDelete && taskId) {
                            onDelete(taskId);
                          }
                        }, 600); // Wait for the full animation duration
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                    </div>
                  </div>
                  
                  {/* Long block horizontal button row at bottom right */}
                  {blockHeight >= 48 && (
                    <div className="task-action-buttons-long" style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      pointerEvents: 'none',
                      transition: 'all 0.2s ease',
                      opacity: 0,
                    }}>
                      {/* Edit button for long blocks */}
                      {onEdit && (
                        <div
                          className="task-edit-btn"
                          style={{
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
                            pointerEvents: 'auto',
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const task = block._group ? block.tasks[0] : block;
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
                      {/* Green check mark button for long blocks */}
                      <div
                        className={`task-complete-btn ${(block._group ? block.tasks[0].status === 'completed' : block.status === 'completed') ? 'selected' : ''}`}
                        style={{
                          width: '14px',
                          height: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#ffffff',
                          opacity: 0, // Let CSS handle visibility
                          transition: 'opacity 0.2s ease',
                          zIndex: 10,
                          pointerEvents: 'auto',
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const taskId = block._group ? block.tasks[0].id : block.id;
                          if (onUpdateStatus && taskId) {
                            const currentStatus = block._group ? block.tasks[0].status : block.status;
                            onUpdateStatus(taskId, currentStatus === 'completed' ? 'active' : 'completed');
                          }
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                      </div>
                      
                      {/* Delete button for long blocks */}
                      <div
                        className="task-delete-btn"
                        data-task-status={block._group ? block.tasks[0].status : block.status}
                        data-is-selected="false"
                        style={{
                          width: '14px',
                          height: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          color: '#fff',
                          opacity: 0,
                          transition: 'opacity 0.2s ease',
                          zIndex: 10,
                          pointerEvents: 'auto',
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          
                          // Apply fade out animation first
                          const blockElement = e.target.closest('.calendar-time-block');
                          if (blockElement) {
                            blockElement.style.transition = 'opacity 0.2s ease';
                            blockElement.style.opacity = '0';
                          }
                          
                          // Delete the task from data after the animation completes
                          setTimeout(() => {
                            const taskId = block._group ? block.tasks[0].id : block.id;
                            if (onDelete && taskId) {
                              onDelete(taskId);
                            }
                          }, 600);
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                      </div>
                    </div>
                  )}
                  
                  {block._group ? (
                    (() => {
                      if (block.tasks.length === 1) {
                                                return (
                          <div style={{
                            display: 'flex', 
                            flexDirection: isShort ? 'row' : 'column', 
                            gap: isShort ? 8 : 2,
                            alignItems: isShort ? 'center' : 'flex-start',
                            justifyContent: 'flex-start',
                            width: '100%',
                            height: isShort ? '100%' : 'auto',
                            paddingLeft: '0px',
                            paddingRight: '0px'
                          }}>
                            {isShort ? (
                              <ShortBlockLabel
                                titleClassName="task-text-element"
                                title={block.tasks[0].name || block.tasks[0].title}
                                timeText={formatShortTimeRange(block.tasks[0].startTime, block.tasks[0].endTime)}
                                actionGutter={0}
                              />
                            ) : (
                            <StackedBlockLabel
                              title={block.tasks[0].name || block.tasks[0].title}
                              timeText={
                                block.tasks[0].startTime && block.tasks[0].endTime
                                  ? `${block.tasks[0].startTime} - ${block.tasks[0].endTime}`
                                  : ''
                              }
                              titleStyle={{
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                wordBreak: 'normal',
                              }}
                            />
                            )}
                            {isShort && (
                              <div className="task-action-buttons-inline" style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '4px',
                                paddingRight: '8px',
                                pointerEvents: 'none',
                                transition: 'all 0.2s ease',
                                opacity: 0,
                              }}>
                                {/* Edit button for short blocks */}
                                {onEdit && (
                                  <div
                                    className="task-edit-btn"
                                    style={{
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
                                      pointerEvents: 'auto',
                                    }}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const task = block._group ? block.tasks[0] : block;
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
                                {/* Complete button for short blocks */}
                                <div
                                  className={`task-complete-btn ${(block._group ? block.tasks[0].status === 'completed' : block.status === 'completed') ? 'selected' : ''}`}
                                  style={{
                                    width: '14px',
                                    height: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#ffffff',
                                    opacity: 0, // Let CSS handle visibility
                                    transition: 'opacity 0.2s ease',
                                    zIndex: 10,
                                    pointerEvents: 'auto',
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const taskId = block._group ? block.tasks[0].id : block.id;
                                    if (onUpdateStatus && taskId) {
                                      const currentStatus = block._group ? block.tasks[0].status : block.status;
                                      onUpdateStatus(taskId, currentStatus === 'completed' ? 'active' : 'completed');
                                    }
                                  }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20,6 9,17 4,12"></polyline>
                                  </svg>
                                </div>
                                {/* Delete button for short blocks */}
                                <div
                                  className="task-delete-btn"
                                  data-task-status={block._group ? block.tasks[0].status : block.status}
                                  data-is-selected="false"
                                  style={{
                                    width: '14px',
                                    height: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    color: '#fff',
                                    opacity: 0,
                                    transition: 'opacity 0.2s ease',
                                    zIndex: 10,
                                    pointerEvents: 'auto',
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    // Apply fade out animation first
                                    const blockElement = e.target.closest('.calendar-time-block');
                                    if (blockElement) {
                                      blockElement.style.transition = 'opacity 0.2s ease';
                                      blockElement.style.opacity = '0';
                                    }
                                    
                                    // Delete the task from data after the animation completes
                                    setTimeout(() => {
                                      const taskId = block._group ? block.tasks[0].id : block.id;
                                      if (onDelete && taskId) {
                                        onDelete(taskId);
                                      }
                                    }, 600);
                                  }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                  </svg>
                                </div>
                                {/* TaskActionsDropdown for short blocks */}
                                <div style={{ pointerEvents: 'auto' }}>
                                  <TaskActionsDropdown
                                    task={block._group ? block.tasks[0] : block}
                                    onAutoSchedule={onAutoSchedule && (block._group ? block.tasks[0].type === 'task' : block.type === 'task') ? onAutoSchedule : null}
                                    onQuickMove={onQuickMove}
                                    onExtendDuration={onExtendDuration}
                                    isTask={block._group ? block.tasks[0].type === 'task' : block.type === 'task'}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div style={{display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', maxHeight: '100%'}}>
                          {block.tasks.map((t, i) => (
                            <StackedBlockLabel
                              key={i}
                              title={t.name}
                              timeText={t.startTime && t.endTime ? `${t.startTime} - ${t.endTime}` : ''}
                              titleStyle={{
                                borderTop: i !== 0 ? '1px solid #ffffff33' : 'none',
                                paddingTop: i !== 0 ? 2 : 0,
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                wordBreak: 'normal',
                              }}
                            />
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                                            <>
                                              <div style={{
                          display: 'flex',
                          flexDirection: isShort ? 'row' : 'column',
                          gap: isShort ? 8 : 0,
                          alignItems: isShort ? 'center' : 'flex-start',
                          justifyContent: 'flex-start',
                          width: '100%',
                          height: isShort ? '100%' : 'auto',
                          paddingLeft: '0px',
                          paddingRight: '0px'
                        }}>
                          {isShort ? (
                            <ShortBlockLabel
                              titleClassName="task-text-element"
                              title={block.name || block.title}
                              timeText={formatShortTimeRange(block.startTime, block.endTime)}
                              actionGutter={0}
                            />
                          ) : (
                          <StackedBlockLabel
                            title={block.name || block.title}
                            timeText={
                              block.startTime && block.endTime
                                ? `${block.startTime} - ${block.endTime}`
                                : ''
                            }
                            titleStyle={{
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              wordBreak: 'normal',
                            }}
                          />
                          )}
                        {isShort && (
                          <div className="task-action-buttons-inline" style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px',
                            paddingRight: '8px',
                            pointerEvents: 'none',
                            transition: 'all 0.2s ease',
                            opacity: 0,
                          }}>
                            {/* Edit button for short blocks */}
                            {onEdit && (
                              <div
                                className="task-edit-btn"
                                style={{
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
                                  pointerEvents: 'auto',
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const task = block._group ? block.tasks[0] : block;
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
                            {/* Complete button for short blocks */}
                            <div
                              className={`task-complete-btn ${(block._group ? block.tasks[0].status === 'completed' : block.status === 'completed') ? 'selected' : ''}`}
                              style={{
                                width: '14px',
                                height: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#ffffff',
                                opacity: (block._group ? block.tasks[0].status === 'completed' : block.status === 'completed') ? 1 : 0,
                                transition: 'opacity 0.2s ease',
                                zIndex: 10,
                                pointerEvents: 'auto',
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const taskId = block._group ? block.tasks[0].id : block.id;
                                if (onUpdateStatus && taskId) {
                                  const currentStatus = block._group ? block.tasks[0].status : block.status;
                                  onUpdateStatus(taskId, currentStatus === 'completed' ? 'active' : 'completed');
                                }
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20,6 9,17 4,12"></polyline>
                              </svg>
                            </div>
                            {/* Delete button for short blocks */}
                            <div
                              className="task-delete-btn"
                              style={{
                                width: '14px',
                                height: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                color: '#fff',
                                opacity: 0,
                                transition: 'opacity 0.2s ease',
                                zIndex: 10,
                                pointerEvents: 'auto',
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Apply fade out animation first
                                const blockElement = e.target.closest('.calendar-time-block');
                                if (blockElement) {
                                  blockElement.style.transition = 'opacity 0.2s ease';
                                  blockElement.style.opacity = '0';
                                }
                                
                                // Delete the task from data after the animation completes
                                setTimeout(() => {
                                  const taskId = block._group ? block.tasks[0].id : block.id;
                                  if (onDelete && taskId) {
                                    onDelete(taskId);
                                  }
                                }, 600);
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                              </svg>
                            </div>
                            {/* TaskActionsDropdown for short blocks */}
                            <div style={{ pointerEvents: 'auto' }}>
                              <TaskActionsDropdown
                                task={block._group ? block.tasks[0] : block}
                                onAutoSchedule={onAutoSchedule && (block._group ? block.tasks[0].type === 'task' : block.type === 'task') ? onAutoSchedule : null}
                                onQuickMove={onQuickMove}
                                onExtendDuration={onExtendDuration}
                                isTask={block._group ? block.tasks[0].type === 'task' : block.type === 'task'}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            });
          });
        })()}
      </div>


      {dragPreview && (dragState.isActive || customDragState.isActive) && (
        <div
          style={{
            position: 'absolute',
            left: dragPreview.left,
            top: dragPreview.top,
            width: dragPreview.width,
            height: dragPreview.height,
            background: dragPreview.color || '#ff6b81',
            opacity: dragPreview.opacity || 0.5,
            borderRadius: 8,
            zIndex: 9999,
            pointerEvents: 'none',
            color: '#fff',
            padding: '8px 8px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: dragPreview.isShortBlock ? 'center' : 'flex-start',
            alignItems: 'flex-start',
            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.15)',
            fontSize: '0.85rem',
            fontWeight: 600,
            lineHeight: 1.2,
            userSelect: 'none',
            caretColor: 'transparent',
            // CSS optimizations for smoother rendering
            willChange: 'transform, left, top',
            transform: 'translateZ(0)', // Force hardware acceleration
            backfaceVisibility: 'hidden',
            perspective: 1000,
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            alignItems: 'flex-start',
            justifyContent: dragPreview.isShortBlock ? 'center' : 'flex-start',
            width: '100%',
            height: dragPreview.isShortBlock ? '100%' : 'auto'
          }}>
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {customDragState.taskData?.title || dragTaskRef.current?.title || 'Task'}
            </div>
            {(
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                lineHeight: 1.1,
                opacity: 0.9,
                marginTop: '2px',
              }}>
            {(() => {
              if (dragPreview && customDragState.isActive && typeof dragPreview.startMinutes === 'number') {
                const duration = typeof dragPreview.duration === 'number'
                  ? dragPreview.duration
                  : getItemDurationMinutes(customDragState.taskData || dragTaskRef.current);
                const endTotalMinutes = dragPreview.startMinutes + duration;
                const startTimeStr = formatMinutes(dragPreview.startMinutes);
                const endTimeStr = endTotalMinutes >= 24 * 60
                  ? formatMinutes(endTotalMinutes - 24 * 60)
                  : formatMinutes(endTotalMinutes);
                return `${startTimeStr} - ${endTimeStr}`;
              }
              return '';
            })()}
            </div>
            )}
          </div>
        </div>
      )}


      {/* Phase 2: Position calculation indicator */}
      {dragState.isActive && dragState.position && (
        <>
          {/* Red dot at actual mouse cursor position */}
          <div
            style={{
              position: 'fixed',
              left: dragState.position.x - 5,
              top: dragState.position.y - 5,
              width: 10,
              height: 10,
              background: 'red',
              borderRadius: '50%',
              border: '2px solid white',
              zIndex: 3000,
              pointerEvents: 'none',
              boxShadow: '0 0 4px rgba(0,0,0,0.5)',
              transform: 'translate(-50%, -50%)',
            }}
          />
          {/* Time indicator at calculated grid position */}
          <div
            style={{
              position: 'absolute',
              left: TIME_COL_WIDTH + (dragState.position.colIdx - colStart) * ((gridRef.current?.offsetWidth || 800) - TIME_COL_WIDTH) / (colEnd - colStart),
              top: dragState.position.hour * 50 + (dragState.position.minute / 60) * 50,
              width: 4,
              height: 4,
              background: 'lime',
              borderRadius: '50%',
              zIndex: 3001,
              pointerEvents: 'none',
              boxShadow: '0 0 4px rgba(0,255,0,0.8)',
            }}
          />
        </>
      )}
      
      {/* Phase 2: Position calculation indicator */}
      {dragState.isActive && (
        <div
          style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: 'green',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          ðŸŽ¯ Step 2 - Dragging: {dragTaskRef.current ? dragTaskRef.current.title : 'Unknown task'} | Preview: {dragPreview ? 'ON' : 'OFF'}
          {dragState.position && (
            <div style={{ marginTop: '2px', fontSize: '10px' }}>
              Time: {String(dragState.position.hour).padStart(2, '0')}:{String(dragState.position.minute).padStart(2, '0')}
              <br />
              Day: {dragState.position.colIdx - colStart + 1}
            </div>
          )}
        </div>
      )}

      {/* Task creation card */}
      {isDrawerChrome && cardPos ? (
        <CreateSheet open onClose={() => setCardPos(null)}>
          <TaskCreationCard
            key={cardKey}
            showPlusCircle={false}
            onCancel={() => setCardPos(null)}
            onAdd={(task) => {
              if (task.startTime && task.endTime && task.startTime === task.endTime) return;
              if (onAdd) onAdd(task);
              setCardPos(null);
            }}
            flippedX={false}
            flippedY={false}
            onDatePickerClose={(closeMethod) => {
              closeDatePickerRef.current = closeMethod;
            }}
            onTimePickerClose={(closeMethod) => {
              closeTimePickerRef.current = closeMethod;
            }}
            defaultStartTime={cardPos?.defaultStartTime}
            defaultEndTime={cardPos?.defaultEndTime}
            defaultDeadline={cardPos?.defaultDeadline}
          />
        </CreateSheet>
      ) : (
      <div
        ref={cardRef}
        style={{
          position: 'absolute',
          display: cardPos ? 'block' : 'none',
          left: cardPos ? (cardPos.flippedX ? cardPos.x - 430 : cardPos.x) : 0,
          top: cardPos ? cardPos.y : 0,
          zIndex: 100,
          transform: cardPos?.flippedY ? 'translateY(-240px)' : 'none',
        }}
      >

        <TaskCreationCard
          key={cardKey}
          onCancel={() => {
            setCardPos(null);
          }}
          onAdd={(task) => {
            if (task.startTime && task.endTime && task.startTime === task.endTime) {
              return;
            }
            if (onAdd) onAdd(task);
            setCardPos(null);
          }}
          flippedX={cardPos ? cardPos.flippedX : false}
          flippedY={cardPos ? cardPos.flippedY : false}
          onDatePickerClose={(closeMethod) => {
            closeDatePickerRef.current = closeMethod;
          }}
          onTimePickerClose={(closeMethod) => {
            closeTimePickerRef.current = closeMethod;
          }}
          defaultStartTime={cardPos?.defaultStartTime}
          defaultEndTime={cardPos?.defaultEndTime}
          defaultDeadline={cardPos?.defaultDeadline}
        />
      </div>
      )}
    </div>
  );
}

function CurrentTimeIndicator({ getCurrentTimePosition, rowHeight, todayColIndex, colStart, colEnd, visibleCols, days, timeColWidth = 80 }) {
  const [pos, setPos] = useState(getCurrentTimePosition());
  const [left, setLeft] = useState(80); // default time column width
  const [colWidth, setColWidth] = useState(0);

  // Update position every 10 seconds for smoothness
  useEffect(() => {
    const interval = setInterval(() => {
      setPos(getCurrentTimePosition());
    }, 10000);
    setPos(getCurrentTimePosition());
    return () => clearInterval(interval);
  }, [getCurrentTimePosition]);

  // Calculate left and width after DOM is painted, and on resize
  useLayoutEffect(() => {
    if (todayColIndex === -1) return;
    
    // Check if today's column is actually visible
    const isTodayVisible = todayColIndex >= colStart && todayColIndex < colEnd;
    if (!isTodayVisible) return;
    
    const updatePosition = () => {
      const grid = document.querySelector('.calendar-grid');
      let newLeft = timeColWidth;
      let newColWidth = 0;
      if (grid) {
        const gridRect = grid.getBoundingClientRect();
        const timeColumnWidth = timeColWidth;
        const numVisibleDayCols = colEnd - colStart;
        newColWidth = (gridRect.width - timeColumnWidth) / numVisibleDayCols;
        // Calculate position relative to visible columns
        const visibleTodayIndex = todayColIndex - colStart;
        newLeft = timeColumnWidth + visibleTodayIndex * newColWidth;
      } else {
        newLeft = 80 + todayColIndex * 160;
        newColWidth = 160;
      }
      setLeft(newLeft);
      setColWidth(newColWidth);
    };

    // Initial calculation
    updatePosition();

    // Set up ResizeObserver to watch for grid size changes
    const grid = document.querySelector('.calendar-grid');
    if (grid) {
      const observer = new ResizeObserver(() => {
        updatePosition();
      });
      observer.observe(grid);
      
      return () => {
        observer.disconnect();
      };
    }
  }, [todayColIndex, colStart, colEnd, visibleCols, timeColWidth]);

  if (todayColIndex === -1) return null;

  // Check if today's column is actually visible
  const isTodayVisible = todayColIndex >= colStart && todayColIndex < colEnd;
  if (!isTodayVisible) return null;

  return (
    <div
      className="current-time-indicator"
      style={{
        position: 'absolute',
        left: left,
        width: colWidth,
        top: pos,
        height: 0,
        pointerEvents: 'none',
        zIndex: 10,
        display: colWidth > 0 ? 'block' : 'none',
      }}
    >
      <NowMarker />
    </div>
  );
}

export default CalendarGrid;
