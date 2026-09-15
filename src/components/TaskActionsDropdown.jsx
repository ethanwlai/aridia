// src/components/TaskActionsDropdown.jsx
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLayoutMode } from '../hooks/useLayoutMode';

// Global ref to track the currently open dropdown instance
const openDropdownRef = { current: null };

// Expose on window for other components to access
if (typeof window !== 'undefined') {
  window.openDropdownRef = openDropdownRef;
}

const SUBMENU_CLOSE_DELAY_MS = 180;
const MENU_ITEM_HOVER_BG = 'rgba(160, 132, 232, 0.3)';
const SUBMENU_MARGIN = 8;
const SUBMENU_OVERLAP = 4;
const SUBMENU_ESTIMATED_WIDTH = 158;
const SUBMENU_ESTIMATED_HEIGHT = {
  quickMove: 112,
  extendDuration: 220,
};

const TaskActionsDropdown = ({ 
  task, 
  onAutoSchedule, 
  onQuickMove, 
  onExtendDuration,
  isTask = true // true for tasks, false for events
}) => {
  // ADJUST THESE VALUES to fine-tune positioning
  const DROPDOWN_TOP_OFFSET = 0; // Negative moves up, positive moves down
  const DROPDOWN_LEFT_OFFSET = 20; // Negative moves left, positive moves right
  const FLIPPED_Y_EXTRA_OFFSET = 20; // Additional pixels to move up when flippedY is true (increase to move up more)
  const FLIPPED_X_LEFT_OFFSET = -20; // Additional pixels to move left when flippedX is true (negative moves left, positive moves right)
  
  const { isCoarse } = useLayoutMode();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState(null); // 'quickMove' | 'extendDuration' | null
  const [position, setPosition] = useState({ top: 0, left: 0, flippedX: false, flippedY: false });
  const [isPositionCalculated, setIsPositionCalculated] = useState(false);
  const [submenuPos, setSubmenuPos] = useState({ top: 0, left: 0, maxHeight: 0, ready: false });
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const quickMoveRowRef = useRef(null);
  const extendDurationRowRef = useRef(null);
  const submenuRef = useRef(null);
  const instanceRef = useRef({ setIsOpen, setActiveSubmenu });
  const submenuCloseTimerRef = useRef(null);
  const lockedFlipRef = useRef(null); // preserve flip while menu stays open
  const actionFiredRef = useRef(false); // avoid double-firing mousedown + click
  
  // Update instance ref when state setters change
  useEffect(() => {
    instanceRef.current = { setIsOpen, setActiveSubmenu };
  }, []);

  const clearSubmenuCloseTimer = useCallback(() => {
    if (submenuCloseTimerRef.current != null) {
      clearTimeout(submenuCloseTimerRef.current);
      submenuCloseTimerRef.current = null;
    }
  }, []);

  const openSubmenu = useCallback((submenu) => {
    clearSubmenuCloseTimer();
    setActiveSubmenu(submenu);
  }, [clearSubmenuCloseTimer]);

  const scheduleCloseSubmenu = useCallback(() => {
    clearSubmenuCloseTimer();
    submenuCloseTimerRef.current = setTimeout(() => {
      setActiveSubmenu(null);
      submenuCloseTimerRef.current = null;
    }, SUBMENU_CLOSE_DELAY_MS);
  }, [clearSubmenuCloseTimer]);

  useEffect(() => {
    return () => clearSubmenuCloseTimer();
  }, [clearSubmenuCloseTimer]);

  // Close dropdown when clicking outside or on other elements
  useEffect(() => {
    function handleClickOutside(event) {
      const target = event.target;
      
      // Don't close if clicking inside this dropdown or its trigger
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (target.closest('.task-actions-dropdown-menu')) return;

      // Calendar blocks handle dismiss themselves so the same mousedown
      // does not also select the cell (see CalendarGrid onMouseDown).
      if (target.closest('.calendar-time-block')) {
        return;
      }
      
      // Close this dropdown if it's open
      if (isOpen) {
        setIsOpen(false);
        setActiveSubmenu(null);
        openDropdownRef.current = null;
      }
      
      // If clicking on another dropdown trigger, close any open dropdown first
      if (target.closest('.task-actions-dropdown-trigger')) {
        if (openDropdownRef.current && openDropdownRef.current !== instanceRef.current) {
          openDropdownRef.current.setIsOpen(false);
          openDropdownRef.current.setActiveSubmenu(null);
          openDropdownRef.current = null;
        }
      }
      
      // Close dropdown when clicking on calendar grid or other interactive elements
      if (target.closest('.calendar-grid') ||
          target.closest('.task-list-item') ||
          target.closest('.task-card') ||
          target.closest('.event-card')) {
        if (openDropdownRef.current) {
          openDropdownRef.current.setIsOpen(false);
          openDropdownRef.current.setActiveSubmenu(null);
          openDropdownRef.current = null;
        }
      }
    }

    if (isOpen) {
      // Register this instance as the open dropdown
      openDropdownRef.current = instanceRef.current;
      
      // Use capture phase to catch clicks before they bubble
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside, true);
        if (openDropdownRef.current === instanceRef.current) {
          openDropdownRef.current = null;
        }
      };
    }
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setActiveSubmenu(null);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const closeDropdown = useCallback(() => {
    clearSubmenuCloseTimer();
    setIsOpen(false);
    setActiveSubmenu(null);
    openDropdownRef.current = null;
    lockedFlipRef.current = null;
  }, [clearSubmenuCloseTimer]);

  const handleQuickMove = (target, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (actionFiredRef.current) return;
    actionFiredRef.current = true;
    setTimeout(() => { actionFiredRef.current = false; }, 0);

    if (onQuickMove) {
      onQuickMove(task, target);
    }
    closeDropdown();
  };

  const handleExtendDuration = (deltaMinutes, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (actionFiredRef.current) return;
    actionFiredRef.current = true;
    setTimeout(() => { actionFiredRef.current = false; }, 0);

    if (onExtendDuration) {
      onExtendDuration(task, deltaMinutes);
    }
    closeDropdown();
  };

  const handleAutoSchedule = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (actionFiredRef.current) return;
    actionFiredRef.current = true;
    setTimeout(() => { actionFiredRef.current = false; }, 0);

    if (onAutoSchedule) {
      onAutoSchedule(task);
    }
    closeDropdown();
  };

  // Calculate position function (reusable)
  // Always use max height so opening a submenu does not re-flip the menu.
  const calculatePosition = useCallback((preserveFlip = null) => {
    if (!triggerRef.current) {
      return null;
    }
    
    const dropdownWidth = 200;
    const dropdownHeight = 200; // max height (with submenu) — stable across submenu open/close
    const margin = 8; // Margin from viewport edges
    
    // Use getBoundingClientRect to get viewport coordinates
    // This allows us to use position: fixed with a portal to escape parent opacity
    const triggerRect = triggerRef.current.getBoundingClientRect();
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate initial position (below trigger, right-aligned)
    // Align dropdown's top-right corner with button's bottom-right corner
    // Add small gap (4px) below button, then apply configurable offsets
    let top = triggerRect.bottom + 4 + DROPDOWN_TOP_OFFSET;
    let left = triggerRect.right - dropdownWidth + DROPDOWN_LEFT_OFFSET;
    
    // Determine flip states based on viewport boundaries
    let flippedX = false;
    let flippedY = false;
    
    // Check vertical line boundary (left edge of first date column at 80px from calendar grid left)
    // This is the boundary between the time column and the first date column
    const calendarGrid = document.querySelector('.calendar-grid');
    if (calendarGrid) {
      const gridRect = calendarGrid.getBoundingClientRect();
      const verticalLinePosition = gridRect.left + 80; // 80px is the time column width
      
      // If dropdown would cross the vertical line (left edge < vertical line position), flip X
      if (left < verticalLinePosition) {
        flippedX = true;
        // Left-align with trigger's left edge instead, then apply flipped X offset
        left = triggerRect.left + DROPDOWN_LEFT_OFFSET + FLIPPED_X_LEFT_OFFSET;
      }
    }
    
    // Check right edge: if dropdown would go off right edge, flip X (left-align instead)
    if (left + dropdownWidth > viewportWidth - margin) {
      flippedX = true;
      // Left-align with trigger's left edge instead, then apply flipped X offset
      left = triggerRect.left + DROPDOWN_LEFT_OFFSET + FLIPPED_X_LEFT_OFFSET;
    }
    
    // Check bottom edge: if dropdown would go off bottom, flip Y (show above)
    // When flippedY is true, we keep top as the "below" position and use translateY(-100%) to move it up
    if (top + dropdownHeight > viewportHeight - margin) {
      flippedY = true;
      // Keep top as the below position - translateY(-100%) will move it up
      // No need to adjust top here since transform handles the flip
    }
    
    // Check top edge: if flipped Y would go off top, try to fit it
    if (flippedY) {
      // Calculate where the top of the dropdown would be after translateY(-100%)
      const flippedTop = top - dropdownHeight;
      if (flippedTop < margin) {
        // If flipped position would go off top, try to position it below if there's space
        if (triggerRect.bottom + dropdownHeight <= viewportHeight - margin) {
          flippedY = false;
          // top is already set correctly for below position
        } else {
          // Clamp: position dropdown so its top is at margin after flip
          top = margin + dropdownHeight;
        }
      }
    } else if (top < margin) {
      // If not flipped and would go off top, clamp to margin
      top = margin;
    }
    
    // Check left edge: ensure dropdown doesn't go off left
    if (left < margin) {
      // If flipped X and still off left, try right-align if there's space
      if (flippedX && triggerRect.right - dropdownWidth >= margin) {
        flippedX = false;
        left = triggerRect.right - dropdownWidth + DROPDOWN_LEFT_OFFSET;
      } else {
        // Clamp to left margin
        left = margin;
      }
    }

    // Keep flip locked while the menu is open so submenu open does not jump
    if (preserveFlip) {
      flippedX = preserveFlip.flippedX;
      flippedY = preserveFlip.flippedY;
      if (flippedX) {
        left = triggerRect.left + DROPDOWN_LEFT_OFFSET + FLIPPED_X_LEFT_OFFSET;
      } else {
        left = triggerRect.right - dropdownWidth + DROPDOWN_LEFT_OFFSET;
      }
      if (left < margin) left = margin;
      if (left + dropdownWidth > viewportWidth - margin) {
        left = Math.max(margin, viewportWidth - margin - dropdownWidth);
      }
    }
    
    return { top, left, flippedX, flippedY };
  }, [DROPDOWN_TOP_OFFSET, DROPDOWN_LEFT_OFFSET, FLIPPED_X_LEFT_OFFSET]);

  const calculateSubmenuPosition = useCallback((rowEl, submenuEl, submenuKey, flippedX) => {
    if (!rowEl) return null;

    const rowRect = rowEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = SUBMENU_MARGIN;
    const overlap = SUBMENU_OVERLAP;
    const maxHeight = Math.max(0, viewportHeight - margin * 2);

    let width = SUBMENU_ESTIMATED_WIDTH;
    let naturalHeight = SUBMENU_ESTIMATED_HEIGHT[submenuKey] || SUBMENU_ESTIMATED_HEIGHT.quickMove;

    if (submenuEl) {
      const measuredWidth = submenuEl.offsetWidth;
      if (measuredWidth > 0) width = measuredWidth;
      const measuredHeight = submenuEl.scrollHeight || submenuEl.offsetHeight;
      if (measuredHeight > 0) naturalHeight = measuredHeight;
    }

    const height = Math.min(naturalHeight, maxHeight);
    const scrollable = naturalHeight > maxHeight;

    const preferRight = !flippedX;
    const rightLeft = rowRect.right - overlap;
    const leftLeft = rowRect.left - width + overlap;
    const rightFits = rightLeft >= margin && rightLeft + width <= viewportWidth - margin;
    const leftFits = leftLeft >= margin && leftLeft + width <= viewportWidth - margin;

    let left;
    if (preferRight) {
      left = rightFits ? rightLeft : (leftFits ? leftLeft : rightLeft);
    } else {
      left = leftFits ? leftLeft : (rightFits ? rightLeft : leftLeft);
    }

    const maxLeft = viewportWidth - margin - width;
    left = Math.max(margin, Math.min(left, maxLeft));

    let top = rowRect.top;
    if (top + height > viewportHeight - margin) {
      top = viewportHeight - margin - height;
    }
    if (top < margin) {
      top = margin;
    }

    // Parent menu uses transform (translateZ / flippedY), which would make
    // position:fixed a containing-block trap. Convert viewport coords to
    // offsets relative to the row so absolute positioning stays on-screen.
    return {
      top: top - rowRect.top,
      left: left - rowRect.left,
      maxHeight: scrollable ? maxHeight : 0,
    };
  }, []);

  const getActiveSubmenuRow = useCallback((submenu = activeSubmenu) => {
    if (submenu === 'quickMove') return quickMoveRowRef.current;
    if (submenu === 'extendDuration') return extendDurationRowRef.current;
    return null;
  }, [activeSubmenu]);

  const updateSubmenuPosition = useCallback(() => {
    if (!activeSubmenu) {
      setSubmenuPos({ top: 0, left: 0, maxHeight: 0, ready: false });
      return;
    }
    const next = calculateSubmenuPosition(
      getActiveSubmenuRow(),
      submenuRef.current,
      activeSubmenu,
      position.flippedX
    );
    if (next) {
      setSubmenuPos({ ...next, ready: true });
    }
  }, [activeSubmenu, calculateSubmenuPosition, getActiveSubmenuRow, position.flippedX]);

  // Calculate and update dropdown position when it opens (not when submenu toggles)
  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition({ top: 0, left: 0, flippedX: false, flippedY: false });
      setIsPositionCalculated(false);
      setSubmenuPos({ top: 0, left: 0, maxHeight: 0, ready: false });
      lockedFlipRef.current = null;
      return;
    }
    
    if (!triggerRef.current) {
      setIsPositionCalculated(false);
      return;
    }
    
    const preserveFlip = lockedFlipRef.current;
    const newPosition = calculatePosition(preserveFlip);
    if (newPosition) {
      if (!lockedFlipRef.current) {
        lockedFlipRef.current = { flippedX: newPosition.flippedX, flippedY: newPosition.flippedY };
      }
      setPosition(newPosition);
      setIsPositionCalculated(true);
    } else {
      setIsPositionCalculated(false);
    }
    
    // Use a single RAF to ensure any remaining layout is complete
    requestAnimationFrame(() => {
      if (!triggerRef.current) return;
      const updatedPosition = calculatePosition(lockedFlipRef.current);
      if (updatedPosition) {
        setPosition(updatedPosition);
        setIsPositionCalculated(true);
      }
    });
  }, [isOpen, calculatePosition]);

  // Position submenu independently so it stays inside the viewport
  useLayoutEffect(() => {
    if (!isOpen || !activeSubmenu) {
      setSubmenuPos({ top: 0, left: 0, maxHeight: 0, ready: false });
      return;
    }

    updateSubmenuPosition();

    const rafId = requestAnimationFrame(() => {
      updateSubmenuPosition();
    });
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, activeSubmenu, position.top, position.left, position.flippedX, updateSubmenuPosition]);

  // Recalculate position on scroll to keep dropdown aligned with trigger
  useEffect(() => {
    if (!isOpen || !isPositionCalculated) return;
    
    // Find the sidebar scroll container
    let scrollContainer = null;
    if (triggerRef.current) {
      let parent = triggerRef.current.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          scrollContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }
    }
    
    if (!scrollContainer) {
      scrollContainer = document.querySelector('[class*="sidebarContent"]') || 
                      document.querySelector('.sidebarContent');
    }
    
    if (!scrollContainer) return;
    
    let rafId = null;
    const handleScroll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        if (!triggerRef.current) return;
        const newPosition = calculatePosition(lockedFlipRef.current);
        if (newPosition) {
          setPosition(newPosition);
        }
        updateSubmenuPosition();
        rafId = null;
      });
    };
    
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll, { passive: true });
      }
    };
  }, [isOpen, isPositionCalculated, calculatePosition, updateSubmenuPosition]);

  // Recalculate submenu position on viewport changes
  useEffect(() => {
    if (!isOpen || !activeSubmenu) return;

    const handleViewportChange = () => {
      updateSubmenuPosition();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, [isOpen, activeSubmenu, updateSubmenuPosition]);

  const menuItemStyle = {
    padding: '8px 12px',
    cursor: 'pointer',
    color: '#ffffff',
    fontSize: '0.9rem',
    borderRadius: '4px',
    transition: 'background 0.2s ease',
  };

  const bindMenuItemHover = {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = MENU_ITEM_HOVER_BG;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = 'transparent';
    },
  };

  // Viewport-clamped flyout; overlap parent slightly so the pointer never leaves both surfaces
  const submenuStyle = {
    position: 'absolute',
    top: `${submenuPos.top}px`,
    left: `${submenuPos.left}px`,
    minWidth: '158px',
    maxHeight: submenuPos.maxHeight ? `${submenuPos.maxHeight}px` : undefined,
    overflowY: submenuPos.maxHeight ? 'auto' : undefined,
    zIndex: 10000,
    visibility: submenuPos.ready ? 'visible' : 'hidden',
    pointerEvents: 'auto',
  };

  const submenuInnerStyle = {
    background: '#2e0066',
    border: '1px solid #a084e8',
    borderRadius: '8px',
    padding: '4px',
    minWidth: '150px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  };

  return (
    <>
      {/* 3-dot trigger button */}
      <div
        ref={triggerRef}
        className="task-actions-dropdown-trigger"
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
          
          // Close any other open dropdown first
          if (openDropdownRef.current && openDropdownRef.current !== instanceRef.current) {
            openDropdownRef.current.setIsOpen(false);
            openDropdownRef.current.setActiveSubmenu(null);
          }
          
          // Toggle this dropdown
          const newIsOpen = !isOpen;
          setIsOpen(newIsOpen);
          setActiveSubmenu(null);
          clearSubmenuCloseTimer();
          if (!newIsOpen) {
            lockedFlipRef.current = null;
          }
          
          // Update global ref
          if (newIsOpen) {
            openDropdownRef.current = instanceRef.current;
          } else {
            openDropdownRef.current = null;
          }
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="12" cy="5" r="1"></circle>
          <circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>

      {/* Dropdown menu - rendered via portal to escape parent opacity */}
      {isOpen && isPositionCalculated && createPortal(
        <div
          ref={dropdownRef}
          className="task-actions-dropdown-menu"
          style={{
            position: 'fixed', // Fixed to break out of parent opacity context
            top: `${position.top}px`,
            left: `${position.left}px`,
            background: '#2e0066', // Solid opaque background
            border: '1px solid #a084e8',
            borderRadius: '8px',
            padding: '4px',
            zIndex: 9999, // Very high z-index to ensure it's on top
            opacity: 1, // Explicitly set to fully opaque
            minWidth: '180px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            transform: position.flippedY ? `translateY(calc(-100% - ${FLIPPED_Y_EXTRA_OFFSET}px))` : 'translateZ(0)', // Flip Y if needed, otherwise force hardware acceleration
            overflow: 'visible',
            pointerEvents: 'auto', // Ensure it can receive pointer events
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onMouseEnter={(e) => e.stopPropagation()}
          onMouseLeave={(e) => e.stopPropagation()}
        >
          {/* Auto-Schedule (tasks only) */}
          {isTask && onAutoSchedule && (
            <div
              style={{
                ...menuItemStyle,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              {...bindMenuItemHover}
              onMouseDown={(e) => handleAutoSchedule(e)}
              onClick={(e) => handleAutoSchedule(e)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Auto-Schedule</span>
            </div>
          )}

          {/* Quick Move */}
          {onQuickMove && (
            <div
              ref={quickMoveRowRef}
              style={{
                position: 'relative',
              }}
              onMouseEnter={() => { if (!isCoarse) openSubmenu('quickMove'); }}
              onMouseLeave={isCoarse ? undefined : scheduleCloseSubmenu}
            >
              <div
                style={{
                  ...menuItemStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  background: activeSubmenu === 'quickMove' ? MENU_ITEM_HOVER_BG : 'transparent',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openSubmenu('quickMove');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <span>Quick Move</span>
                </div>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>

              {/* Quick Move Submenu */}
              {activeSubmenu === 'quickMove' && (
                <div
                  ref={submenuRef}
                  data-quick-move-submenu
                  style={submenuStyle}
                  onMouseEnter={() => { if (!isCoarse) openSubmenu('quickMove'); }}
                  onMouseLeave={isCoarse ? undefined : scheduleCloseSubmenu}
                >
                  <div style={submenuInnerStyle}>
                    <div
                      style={menuItemStyle}
                      {...bindMenuItemHover}
                      onMouseDown={(e) => handleQuickMove('today', e)}
                      onClick={(e) => handleQuickMove('today', e)}
                    >
                      Move to Today
                    </div>
                    <div
                      style={menuItemStyle}
                      {...bindMenuItemHover}
                      onMouseDown={(e) => handleQuickMove('tomorrow', e)}
                      onClick={(e) => handleQuickMove('tomorrow', e)}
                    >
                      Move to Tomorrow
                    </div>
                    <div
                      style={menuItemStyle}
                      {...bindMenuItemHover}
                      onMouseDown={(e) => handleQuickMove('nextWeek', e)}
                      onClick={(e) => handleQuickMove('nextWeek', e)}
                    >
                      Move to Next Week
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Adjust Duration */}
          {onExtendDuration && (
            <div
              ref={extendDurationRowRef}
              style={{
                position: 'relative',
              }}
              onMouseEnter={() => { if (!isCoarse) openSubmenu('extendDuration'); }}
              onMouseLeave={isCoarse ? undefined : scheduleCloseSubmenu}
            >
              <div
                style={{
                  ...menuItemStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  background: activeSubmenu === 'extendDuration' ? MENU_ITEM_HOVER_BG : 'transparent',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openSubmenu('extendDuration');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>Adjust Duration</span>
                </div>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>

              {/* Adjust Duration Submenu */}
              {activeSubmenu === 'extendDuration' && (
                <div
                  ref={submenuRef}
                  data-extend-duration-submenu
                  style={submenuStyle}
                  onMouseEnter={() => { if (!isCoarse) openSubmenu('extendDuration'); }}
                  onMouseLeave={isCoarse ? undefined : scheduleCloseSubmenu}
                >
                  <div style={submenuInnerStyle}>
                    <div
                      style={menuItemStyle}
                      {...bindMenuItemHover}
                      onMouseDown={(e) => handleExtendDuration(15, e)}
                      onClick={(e) => handleExtendDuration(15, e)}
                    >
                      +15 min
                    </div>
                    <div
                      style={menuItemStyle}
                      {...bindMenuItemHover}
                      onMouseDown={(e) => handleExtendDuration(30, e)}
                      onClick={(e) => handleExtendDuration(30, e)}
                    >
                      +30 min
                    </div>
                    <div
                      style={menuItemStyle}
                      {...bindMenuItemHover}
                      onMouseDown={(e) => handleExtendDuration(60, e)}
                      onClick={(e) => handleExtendDuration(60, e)}
                    >
                      +60 min
                    </div>
                    <div
                      style={{
                        ...menuItemStyle,
                        borderTop: '1px solid rgba(160, 132, 232, 0.3)',
                        marginTop: '4px',
                      }}
                      {...bindMenuItemHover}
                      onMouseDown={(e) => handleExtendDuration(-15, e)}
                      onClick={(e) => handleExtendDuration(-15, e)}
                    >
                      -15 min
                    </div>
                    <div
                      style={menuItemStyle}
                      {...bindMenuItemHover}
                      onMouseDown={(e) => handleExtendDuration(-30, e)}
                      onClick={(e) => handleExtendDuration(-30, e)}
                    >
                      -30 min
                    </div>
                    <div
                      style={menuItemStyle}
                      {...bindMenuItemHover}
                      onMouseDown={(e) => handleExtendDuration(-60, e)}
                      onClick={(e) => handleExtendDuration(-60, e)}
                    >
                      -60 min
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

export default TaskActionsDropdown;
