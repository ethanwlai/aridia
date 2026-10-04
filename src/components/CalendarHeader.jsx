import { useState, useEffect, useRef } from 'react';
import aridiaLogo from '../assets/aridia-logo.png';
import { requestShowLanding } from '../lib/guest';

// ═══════════════════════════════════════════════════════════════
// 🔧 ADJUSTABLE GAP SETTING - Change this number to adjust the gap!
// ═══════════════════════════════════════════════════════════════
const SEARCH_BAR_GAP = 20; // Gap between the rightmost button (Year) and the search bar (in pixels)
const LOGO_HEIGHT = 44;
const LOGO_WIDTH = Math.round(LOGO_HEIGHT * (286 / 138)); // native 286×138, keep aspect ratio
const LOGO_LEFT_INSET = 32;
const LOGO_BUTTON_GAP = 12;
const HIDDEN_LOGO_LEFT_INSET = 12;
const SEARCH_BAR_RIGHT_OFFSET = 24;
// ═══════════════════════════════════════════════════════════════

const CalendarHeader = ({
  viewMode,
  setViewMode,
  tasks = [],
  onSearch,
  onHighlightItem,
  sidebarWidth = 0,
  dashboardFullyOpen = false,
  compactChrome = false,
  isCompact = false,
  onOpenDrawer,
  drawerOpen = false,
}) => {
  const [visibleButtons, setVisibleButtons] = useState(4); // Start with all 4 buttons visible
  const [buttonStartIndex, setButtonStartIndex] = useState(0); // Start index for visible buttons
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [, setSearchResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [popularSearches, setPopularSearches] = useState({});
  const [showNoResults, setShowNoResults] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ left: '50%', transform: 'translateX(-50%)' });
  const [searchBarPosition, setSearchBarPosition] = useState({ 
    right: `${SEARCH_BAR_RIGHT_OFFSET}px`, 
    left: 'auto',
    top: '50%',
    transform: 'translateY(-50%)'
  });
  const [searchBarWidth, setSearchBarWidth] = useState(240); // Track search bar width for dropdown
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [logoVisible, setLogoVisible] = useState(true);
  const headerRef = useRef();
  const searchInputRef = useRef();
  const searchContainerRef = useRef();
  const dropdownRef = useRef();
  const skipNextSearchRef = useRef(false);
  const logoVisibleRef = useRef(true);
  const logoRef = useRef(null);
  const lastVisibleButtonsRef = useRef(4);
  const appliedLayoutRef = useRef({ numButtons: 4, startIndex: 0 });
  const lastButtonPositionRef = useRef({ left: '50%', transform: 'translateX(-50%)' });


  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('aridia-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading recent searches:', error);
      }
    }

    const savedPopular = localStorage.getItem('aridia-popular-searches');
    if (savedPopular) {
      try {
        setPopularSearches(JSON.parse(savedPopular));
      } catch (error) {
        console.error('Error loading popular searches:', error);
      }
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearch = (query) => {
    if (!query.trim()) return;
    
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('aridia-recent-searches', JSON.stringify(updated));

    // Update popular searches
    const updatedPopular = { ...popularSearches };
    updatedPopular[query] = (updatedPopular[query] || 0) + 1;
    setPopularSearches(updatedPopular);
    localStorage.setItem('aridia-popular-searches', JSON.stringify(updatedPopular));
  };

  // Search function
  const performSearch = (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      // Don't call onSearch automatically - only when user selects a suggestion
      return;
    }

    const results = tasks.filter(task => {
      const searchLower = query.toLowerCase();
      const titleMatch = task.title?.toLowerCase().includes(searchLower);
      const descriptionMatch = task.description?.toLowerCase().includes(searchLower);
      return titleMatch || descriptionMatch;
    });

    setSearchResults(results);
    // Don't call onSearch automatically - only when user selects a suggestion
    // This prevents automatic red highlighting while typing
  };

  // Debounced search
  useEffect(() => {
    // Skip search if we just selected a suggestion
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, tasks]);

  // Generate suggestions
  const getSuggestions = () => {
    const suggestions = [];
    
    // Add task name suggestions
    if (searchQuery.trim()) {
      const matchingTasks = tasks.filter(task => 
        task.title?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5);
      
      suggestions.push(...matchingTasks.map(task => ({
        type: 'task',
        text: task.title,
        id: task.id
      })));
    }

    // Add recent searches
    if (searchQuery.trim() === '') {
      const recent = recentSearches.slice(0, 3);
      suggestions.push(...recent.map(search => ({
        type: 'recent',
        text: search,
        id: `recent-${search}`
      })));
    }

    // Add popular searches
    if (searchQuery.trim() === '') {
      const popular = Object.entries(popularSearches)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2)
        .map(([search]) => ({
          type: 'popular',
          text: search,
          id: `popular-${search}`
        }));
      suggestions.push(...popular);
    }

    return suggestions.slice(0, 5);
  };

  const suggestions = getSuggestions();

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        // If dropdown is open and a suggestion is selected, click it
        if (showDropdown && selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else {
          // Otherwise, always perform search (even when just typing)
          handleSearch();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
      case 'ArrowDown':
        if (!showDropdown) {
          // Open dropdown if it's closed
          setShowDropdown(true);
        }
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        if (!showDropdown) {
          // Open dropdown if it's closed
          setShowDropdown(true);
        }
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    // Skip the next debounced search to prevent re-highlighting
    skipNextSearchRef.current = true;
    setSearchQuery(suggestion.text);
    setShowDropdown(false);
    setSelectedIndex(-1);
    saveRecentSearch(suggestion.text);
    // Clear search results to remove red highlight from sidebar
    setSearchResults([]);
    if (onSearch) onSearch(null);
    
    // Highlight the task if it's a task suggestion
    if (suggestion.type === 'task' && suggestion.id && onHighlightItem) {
      // Find the task to get its type
      const task = tasks.find(t => t.id === suggestion.id);
      if (task) {
        onHighlightItem({ id: task.id, type: task.type || 'task' });
      }
    } else if (suggestion.type === 'recent' || suggestion.type === 'popular') {
      // For recent/popular searches, find matching tasks and highlight the first one
      const matchingTasks = tasks.filter(task => 
        task.title?.toLowerCase().includes(suggestion.text.toLowerCase())
      );
      if (matchingTasks.length > 0 && onHighlightItem) {
        const firstMatch = matchingTasks[0];
        onHighlightItem({ id: firstMatch.id, type: firstMatch.type || 'task' });
      }
    }
  };

  // Handle search (when Enter is pressed)
  const handleSearch = () => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery);
      // Perform search and show results when Enter is pressed
      const results = tasks.filter(task => {
        const searchLower = searchQuery.toLowerCase();
        const titleMatch = task.title?.toLowerCase().includes(searchLower);
        const descriptionMatch = task.description?.toLowerCase().includes(searchLower);
        return titleMatch || descriptionMatch;
      });
      if (onSearch && results.length > 0) {
        onSearch(results);
        setShowNoResults(false);
      } else if (onSearch) {
        onSearch(null);
        setShowNoResults(true); // Show "no results found" when no results
      }
    }
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  // Handle input change
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowDropdown(true);
    setSelectedIndex(-1);
    setShowNoResults(false); // Hide "no results found" when user types
  };

  // Handle input focus
  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
    setShowNoResults(false);
    if (onSearch) onSearch(null);
  };

  // Check available space and adjust visible buttons and search bar width
  useEffect(() => {
    if (compactChrome) return undefined;
    lastVisibleButtonsRef.current = 4;
    let lastHeaderWidth = 0; // Track the last header width to detect changes
    
    const checkSpace = () => {
      if (!headerRef.current) return;
      
             const headerWidth = headerRef.current.offsetWidth;
       const buttonWidth = 70; // Fixed width of each button
       const buttonGap = 8; // Gap between buttons
       const maxSearchBarWidth = 240; // Maximum width of search bar
      
      // Get calendar content element for centering (works for all view modes)
      let calendarContent = document.querySelector('.calendar-grid, .day-view, .year-view, .month-view, .overview-shell');
      // If still not found, try to find the parent container that holds the calendar content
      if (!calendarContent && headerRef.current) {
        // Find the next sibling or parent that contains the calendar content
        const headerParent = headerRef.current.parentElement;
        if (headerParent) {
          // Look for the main content area (usually the next sibling after header)
          const mainContent = headerParent.querySelector('.calendar-grid, .day-view, .year-view, .month-view, .overview-shell') || 
                              Array.from(headerParent.children).find(child => 
                                child !== headerRef.current && child.offsetWidth > 0
                              );
          if (mainContent) {
            calendarContent = mainContent;
          }
        }
      }
      
      // If no calendar content found, use header width as fallback (for month/year views)
      let contentRect, gridCenterX, gridRightEdge;
      const headerRect = headerRef.current.getBoundingClientRect();
      
      if (calendarContent) {
        contentRect = calendarContent.getBoundingClientRect();
        // Calculate calendar content center relative to header
        gridCenterX = contentRect.left + contentRect.width / 2 - headerRect.left;
        // Search bar is right-aligned with 24px gap from calendar content right edge
        gridRightEdge = contentRect.right - headerRect.left;
      } else {
        // Fallback: use header width for month/year views or when content not found
        // Center buttons in the header, search bar on the right
        gridCenterX = headerWidth / 2;
        gridRightEdge = headerWidth;
      }
      const searchBarRightOffset = SEARCH_BAR_RIGHT_OFFSET; // 24px gap from calendar grid right edge
      // searchBarRightPosition is the right edge position relative to header left edge
      const searchBarRightPosition = gridRightEdge - searchBarRightOffset;
      
      // Calculate buttons first (they're centered, so they'll naturally fit or hide)
      // Buttons are centered at gridCenterX
      // Priority: Always keep the selected button visible
      const buttonKeys = ['day', 'week', 'month', 'year'];
      const selectedButtonIndex = buttonKeys.indexOf(viewMode);
      const hysteresisBuffer = 10;

      const groupWidthFor = (numButtons) => (
        numButtons * buttonWidth + Math.max(0, (numButtons - 1) * buttonGap)
      );
      const findBestFit = (minLeft, maxRight, protectLeft = false) => {
        let fit = null;
        for (let numButtons = 4; numButtons >= 1; numButtons--) {
          for (let startIndex = 0; startIndex <= 4 - numButtons; startIndex++) {
            const endIndex = startIndex + numButtons - 1;
            if (selectedButtonIndex < startIndex || selectedButtonIndex > endIndex) continue;
            const buttonAreaWidth = groupWidthFor(numButtons);
            const buttonGroupLeftEdge = gridCenterX - buttonAreaWidth / 2;
            const buttonGroupRightEdge = buttonGroupLeftEdge + buttonAreaWidth;
            let maxAllowed = maxRight;
            let minAllowed = minLeft;
            if (numButtons > lastVisibleButtonsRef.current) {
              maxAllowed -= hysteresisBuffer;
              minAllowed += hysteresisBuffer;
            } else if (numButtons < lastVisibleButtonsRef.current) {
              maxAllowed += hysteresisBuffer;
              if (!protectLeft) minAllowed -= hysteresisBuffer;
            }
            if (buttonGroupLeftEdge >= minAllowed && buttonGroupRightEdge <= maxAllowed) {
              fit = { numButtons, startIndex, endIndex };
              break;
            }
          }
          if (fit) break;
        }
        return fit || { numButtons: 1, startIndex: selectedButtonIndex, endIndex: selectedButtonIndex };
      };

      const metricsFor = (fit) => {
        const width = groupWidthFor(fit.numButtons);
        const left = gridCenterX - width / 2;
        const rightmost = left + (fit.endIndex - fit.startIndex) * (buttonWidth + buttonGap) + buttonWidth;
        return {
          fit,
          numButtons: fit.numButtons,
          startIndex: fit.startIndex,
          endIndex: fit.endIndex,
          left,
          center: left + width / 2,
          rightmost,
        };
      };

      const layoutHeader = (minLeft, protectLeft) => {
        const activeOnly = { numButtons: 1, startIndex: selectedButtonIndex, endIndex: selectedButtonIndex };
        let result = metricsFor(
          dashboardFullyOpen
            ? activeOnly
            : findBestFit(minLeft, searchBarRightPosition - SEARCH_BAR_GAP, protectLeft)
        );
        const maxSearchBarLeftPosition = searchBarRightPosition - maxSearchBarWidth;
        const minSearchBarLeftPosition = result.rightmost + SEARCH_BAR_GAP;
        let searchBarLeftPosition = Math.max(maxSearchBarLeftPosition, minSearchBarLeftPosition);
        let finalSearchBarWidth = Math.max(0, searchBarRightPosition - searchBarLeftPosition);
        if (finalSearchBarWidth < 100) {
          finalSearchBarWidth = 0;
          if (!dashboardFullyOpen) {
            const expanded = metricsFor(findBestFit(minLeft, searchBarRightPosition, protectLeft));
            if (expanded.numButtons > result.numButtons || expanded.startIndex !== result.startIndex) {
              result = expanded;
            }
          }
        }
        return { ...result, finalSearchBarWidth };
      };

      const applyLayout = (layout) => {
        lastVisibleButtonsRef.current = layout.numButtons;
        if (
          layout.numButtons !== appliedLayoutRef.current.numButtons ||
          layout.startIndex !== appliedLayoutRef.current.startIndex
        ) {
          appliedLayoutRef.current = { numButtons: layout.numButtons, startIndex: layout.startIndex };
          setVisibleButtons(layout.numButtons);
          setButtonStartIndex(layout.startIndex);
        }
        const roundedCenter = Math.round(layout.center * 100) / 100;
        const newButtonPosition = {
          left: `${roundedCenter}px`,
          transform: 'translateX(-50%)',
        };
        if (newButtonPosition.left !== lastButtonPositionRef.current.left || newButtonPosition.transform !== lastButtonPositionRef.current.transform) {
          setButtonPosition(newButtonPosition);
          lastButtonPositionRef.current = newButtonPosition;
        }

        if (searchInputRef.current) {
          searchInputRef.current.style.width = `${layout.finalSearchBarWidth}px`;
          setSearchBarWidth(layout.finalSearchBarWidth);
          if (layout.finalSearchBarWidth === 0) {
            searchInputRef.current.style.opacity = '0';
            searchInputRef.current.style.pointerEvents = 'none';
          } else {
            searchInputRef.current.style.opacity = '1';
            searchInputRef.current.style.pointerEvents = 'auto';
          }
        }
        if (dropdownRef.current) {
          dropdownRef.current.style.width = `${layout.finalSearchBarWidth}px`;
        }
        setSearchBarPosition({
          left: 'auto',
          right: `${headerWidth - searchBarRightPosition}px`,
          top: '50%',
          transform: 'translateY(-50%)',
        });
      };

      const logoBox = logoRef.current?.querySelector('img') || logoRef.current;
      const logoRightPx = logoBox
        ? logoBox.getBoundingClientRect().right - headerRect.left
        : LOGO_LEFT_INSET + LOGO_WIDTH;
      const clashAt = logoRightPx + LOGO_BUTTON_GAP;

      const withLogo = layoutHeader(clashAt, true);
      const hideLogo = logoVisibleRef.current
        ? withLogo.left < clashAt
        : withLogo.left < clashAt + hysteresisBuffer;
      if (hideLogo) {
        if (logoVisibleRef.current) {
          logoVisibleRef.current = false;
          setLogoVisible(false);
        }
        applyLayout(layoutHeader(HIDDEN_LOGO_LEFT_INSET, true));
      } else {
        if (!logoVisibleRef.current) {
          logoVisibleRef.current = true;
          setLogoVisible(true);
        }
        applyLayout(withLogo);
      }

      if (headerWidth !== lastHeaderWidth) {
        lastHeaderWidth = headerWidth;
      }
    };

    checkSpace();
    
    // Listen for window resize
    window.addEventListener('resize', checkSpace);
    
    // Listen for header element size changes (for dashboard dragging)
    let headerResizeObserver;
    if (headerRef.current) {
      headerResizeObserver = new ResizeObserver(() => {
        // Use requestAnimationFrame for smoother updates during dashboard dragging
        requestAnimationFrame(checkSpace);
      });
      headerResizeObserver.observe(headerRef.current);
    }
    
    // Also observe calendar content element (calendar-grid or day-view) for responsive updates
    // This is crucial because when dashboard opens, the calendar content shrinks, not the header
    let contentResizeObserver;
    const observeCalendarContent = () => {
      // Try to find calendar content element
      let calendarContent = document.querySelector('.calendar-grid, .day-view, .year-view, .month-view, .overview-shell');
      
      if (calendarContent && contentResizeObserver) {
        // Disconnect old observer if content changed
        contentResizeObserver.disconnect();
      }
      
      if (calendarContent) {
        contentResizeObserver = new ResizeObserver(() => {
          // Use requestAnimationFrame for smoother updates during dashboard dragging
          requestAnimationFrame(checkSpace);
        });
        contentResizeObserver.observe(calendarContent);
      }
    };
    
    // Initial observation
    observeCalendarContent();
    
    // Also check periodically to catch calendar content that appears later
    const contentCheckInterval = setInterval(() => {
      observeCalendarContent();
      checkSpace();
    }, 100);
    
    // Initial width setup
    setTimeout(checkSpace, 0);
    
    return () => {
      window.removeEventListener('resize', checkSpace);
      if (headerResizeObserver) {
        headerResizeObserver.disconnect();
      }
      if (contentResizeObserver) {
        contentResizeObserver.disconnect();
      }
      clearInterval(contentCheckInterval);
    };
  }, [viewMode, sidebarWidth, dashboardFullyOpen, compactChrome]);

  // Sync dropdown width with search bar width. On phones the panel is
  // already full width, and a leftover pixel width can spill past it.
  useEffect(() => {
    if (isCompact) return undefined;
    if (dropdownRef.current && searchBarWidth > 0) {
      dropdownRef.current.style.width = `${searchBarWidth}px`;
    }
  }, [searchBarWidth, showDropdown, isCompact]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buttons = [
    { key: 'day', label: 'Day', disabled: false },
    { key: 'week', label: 'Week', disabled: false },
    { key: 'month', label: 'Month', disabled: false },
    { key: 'year', label: 'Year', disabled: false }
  ];

  // Calculate the width of the button container based on visible buttons
  const buttonContainerWidth = visibleButtons * 70 + Math.max(0, (visibleButtons - 1) * 8); // Fixed button width + gaps
  
  const searchDropdown = showDropdown && (suggestions.length > 0 || searchQuery.trim() === '') && (
          <div
            ref={dropdownRef}
            className="calendar-search-dropdown"
            style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              width: compactChrome ? '100%' : `${searchBarWidth}px`,
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 10000,
              opacity: 1,
              marginTop: '4px',
              transition: 'width 0.05s ease-out'
            }}
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className="calendar-search-suggestion"
                onClick={() => handleSuggestionClick(suggestion)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: selectedIndex === index ? '#f5f5f5' : 'white',
                  borderBottom: index < suggestions.length - 1 ? '1px solid #eee' : 'none',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <span style={{
                  color: suggestion.type === 'task' ? '#333' : '#666'
                }}>
                  {suggestion.text}
                </span>
              </div>
            ))}
          </div>
  );

  if (compactChrome) {
    const headerClass = isCompact ? 'calendar-header calendar-header--compact' : 'calendar-header calendar-header--medium';
    return (
      <div className={headerClass} ref={headerRef}>
        <button
          type="button"
          className={`calendar-menu-btn${drawerOpen ? ' is-open' : ''}`}
          onClick={onOpenDrawer}
          aria-label={drawerOpen ? 'Close agenda' : 'Open agenda'}
          aria-expanded={drawerOpen}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
        <button
          type="button"
          ref={logoRef}
          className="calendar-brand-logo"
          onClick={requestShowLanding}
          aria-label="Go to Aridia home"
        >
          <img src={aridiaLogo} alt="Aridia" width={LOGO_WIDTH} height={LOGO_HEIGHT} />
        </button>
        <div className="calendar-controls">
          {buttons.map((button) => (
            <button
              key={button.key}
              className={viewMode === button.key ? 'active' : ''}
              onClick={() => setViewMode(button.key)}
            >
              {button.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="calendar-search-toggle"
          onClick={() => {
            setSearchExpanded((open) => !open);
            setShowDropdown(true);
          }}
          aria-label="Search"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </button>
        {searchExpanded && (
          <div className="calendar-search-panel" ref={searchContainerRef}>
            <input
              ref={searchInputRef}
              className="calendar-search"
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button
              type="button"
              className="calendar-search-toggle"
              onClick={() => {
                handleClearSearch();
                setSearchExpanded(false);
              }}
              aria-label="Close search"
            >
              ×
            </button>
            {searchDropdown}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="calendar-header" ref={headerRef}>
      <button
        type="button"
        ref={logoRef}
        className={`calendar-brand-logo${logoVisible ? '' : ' is-hidden'}`}
        onClick={requestShowLanding}
        aria-label="Go to Aridia home"
        aria-hidden={!logoVisible}
        tabIndex={logoVisible ? 0 : -1}
      >
        <img
          src={aridiaLogo}
          alt="Aridia"
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
        />
      </button>
      {/* Button container - positioned absolutely to center over calendar grid */}
      {visibleButtons > 0 && (
        <div 
          className="calendar-controls"
          style={{
            position: 'absolute',
            ...buttonPosition,
            width: `${buttonContainerWidth}px`,
            display: 'flex',
            justifyContent: 'center',
            zIndex: 10,
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {buttons.slice(buttonStartIndex, buttonStartIndex + visibleButtons).map((button) => (
            <button
              key={button.key}
              className={viewMode === button.key ? 'active' : ''}
              onClick={() => !button.disabled && setViewMode(button.key)}
              disabled={button.disabled}
              style={button.key === 'year' ? { borderTopRightRadius: '8px', borderBottomRightRadius: '8px' } : {}}
            >
              {button.label}
            </button>
          ))}
        </div>
      )}

      {/* Search bar container - positioned dynamically based on available space */}
      <div 
        ref={searchContainerRef}
        style={{ 
          position: 'absolute',
          ...searchBarPosition,
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'flex-end',
          transition: 'left 0.05s ease-out, right 0.05s ease-out, transform 0.05s ease-out',
          zIndex: 10001
        }}
      >
        <input 
          ref={searchInputRef}
          className="calendar-search" 
          type="text" 
          placeholder="Search tasks..." 
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          style={{
            width: '240px', // Default width, will be updated by checkSpace function
            transition: 'width 0.05s ease-out',
            minWidth: '100px',
            maxWidth: '240px',
            borderTopLeftRadius: '6px',
            borderBottomLeftRadius: '6px'
          }}
        />
        
        {showNoResults && (
          <span
            style={{
              position: 'absolute',
              right: searchQuery ? '28px' : '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '12px',
              color: '#ff6b6b',
              pointerEvents: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            No results found
          </span>
        )}
        
        {searchQuery && (
          <button
            onClick={handleClearSearch}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#666',
              padding: '2px',
              borderRadius: '50%',
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        )}


        {searchDropdown}
      </div>
    </div>
  );
};

export default CalendarHeader;


