import { useState, useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// 🔧 ADJUSTABLE GAP SETTING - Change this number to adjust the gap!
// ═══════════════════════════════════════════════════════════════
const SEARCH_BAR_GAP = 20; // Gap between the rightmost button (Year) and the search bar (in pixels)
// ═══════════════════════════════════════════════════════════════

const CalendarHeader = ({ viewMode, setViewMode, tasks = [], onSearch, onHighlightItem }) => {
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
    right: '16px', 
    left: 'auto',
    top: '50%',
    transform: 'translateY(-50%)'
  });
  const [searchBarWidth, setSearchBarWidth] = useState(240); // Track search bar width for dropdown
  const headerRef = useRef();
  const searchInputRef = useRef();
  const searchContainerRef = useRef();
  const dropdownRef = useRef();
  const skipNextSearchRef = useRef(false);


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
    let lastHeaderWidth = 0; // Track the last header width to detect changes
    const lastVisibleButtonsRef = { current: 4 }; // Track last visible button count for hysteresis (use ref to persist)
    let lastButtonPosition = { left: '50%', transform: 'translateX(-50%)' }; // Track last button position to prevent unnecessary updates
    
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
      const searchBarRightOffset = 24; // 24px gap from calendar grid right edge
      // searchBarRightPosition is the right edge position relative to header left edge
      const searchBarRightPosition = gridRightEdge - searchBarRightOffset;
      
      // Calculate buttons first (they're centered, so they'll naturally fit or hide)
      // Buttons are centered at gridCenterX
      // Priority: Always keep the selected button visible
      const buttonKeys = ['day', 'week', 'month', 'year'];
      const selectedButtonIndex = buttonKeys.indexOf(viewMode);
      
      // Add hysteresis to prevent rapid toggling: use a threshold buffer
      const hysteresisBuffer = 10; // Extra buffer to prevent rapid toggling
      
      // Determine how many buttons can fit, then ensure selected button is included
      // Strategy: Try different button configurations that include the selected button
      let newVisibleButtons = 4;
      let bestFit = null;
      
      // Try different button counts, prioritizing configurations that include the selected button
      for (let numButtons = 4; numButtons >= 1; numButtons--) {
        // Try different starting positions to find the best fit that includes selected button
        // We want to show buttons around the selected one when space is limited
        for (let startIndex = 0; startIndex <= 4 - numButtons; startIndex++) {
          const endIndex = startIndex + numButtons - 1;
          
          // Skip if selected button is not in this range
          if (selectedButtonIndex < startIndex || selectedButtonIndex > endIndex) {
            continue;
          }
          
          // Calculate button area width for this configuration
          const buttonAreaWidth = numButtons * buttonWidth + Math.max(0, (numButtons - 1) * buttonGap);
          const buttonAreaHalfWidth = buttonAreaWidth / 2;
          
          // Calculate where this button group would be positioned (centered on selected button)
          // Position selected button at gridCenterX, then arrange others around it
          const selectedButtonOffset = selectedButtonIndex - startIndex; // Offset of selected button within this group
          const selectedButtonLeftEdge = gridCenterX - buttonAreaHalfWidth + (selectedButtonOffset * (buttonWidth + buttonGap));
          const buttonGroupLeftEdge = selectedButtonLeftEdge - (selectedButtonOffset * (buttonWidth + buttonGap));
          const buttonGroupRightEdge = buttonGroupLeftEdge + buttonAreaWidth;
          
          // Check if buttons fit
          let maxAllowedButtonRightEdge = searchBarRightPosition - SEARCH_BAR_GAP;
          
          // Add hysteresis
          if (numButtons > lastVisibleButtonsRef.current) {
            maxAllowedButtonRightEdge -= hysteresisBuffer;
          } else if (numButtons < lastVisibleButtonsRef.current) {
            maxAllowedButtonRightEdge += hysteresisBuffer;
          }
          
          if (buttonGroupRightEdge <= maxAllowedButtonRightEdge) {
            // This configuration fits! Use it
            bestFit = { numButtons, startIndex, endIndex };
            newVisibleButtons = numButtons;
            break;
          }
        }
        
        if (bestFit) break;
      }
      
      // If no configuration fits, show at least the selected button
      if (!bestFit) {
        newVisibleButtons = 1;
        bestFit = { numButtons: 1, startIndex: selectedButtonIndex, endIndex: selectedButtonIndex };
      }
      
      // Store the button range for later use (use let so it can be updated when search bar disappears)
      let calculatedButtonStartIndex = bestFit ? bestFit.startIndex : selectedButtonIndex;
      let calculatedButtonEndIndex = bestFit ? bestFit.endIndex : selectedButtonIndex;
      
      // Only update if the count or start index actually changed
      if (newVisibleButtons !== lastVisibleButtonsRef.current || calculatedButtonStartIndex !== buttonStartIndex) {
        setVisibleButtons(newVisibleButtons);
        setButtonStartIndex(calculatedButtonStartIndex);
        lastVisibleButtonsRef.current = newVisibleButtons;
      }
      
      // Calculate button container position - center the selected button
      const currentButtonAreaWidthFinal = newVisibleButtons * buttonWidth + Math.max(0, (newVisibleButtons - 1) * buttonGap);
      const buttonAreaHalfWidth = currentButtonAreaWidthFinal / 2;
      
      // Calculate position so selected button is centered at gridCenterX
      const selectedButtonOffset = selectedButtonIndex - calculatedButtonStartIndex; // Offset within visible button group
      const selectedButtonLeftEdge = gridCenterX - buttonAreaHalfWidth + (selectedButtonOffset * (buttonWidth + buttonGap));
      const buttonGroupLeftEdge = selectedButtonLeftEdge - (selectedButtonOffset * (buttonWidth + buttonGap));
      const buttonGroupCenterX = buttonGroupLeftEdge + buttonAreaHalfWidth;
      
      // Round to avoid tiny floating point differences
      const roundedButtonCenterX = Math.round(buttonGroupCenterX * 100) / 100;
      const newButtonPosition = {
        left: `${roundedButtonCenterX}px`,
        transform: 'translateX(-50%)'
      };
      
      // Only update position if it actually changed (prevents unnecessary re-renders and stuttering)
      if (newButtonPosition.left !== lastButtonPosition.left || newButtonPosition.transform !== lastButtonPosition.transform) {
        setButtonPosition(newButtonPosition);
        lastButtonPosition = newButtonPosition;
      }
      
      // Calculate the rightmost visible button's right edge (for search bar positioning)
      const rightmostVisibleButtonIndex = calculatedButtonEndIndex;
      const rightmostButtonLeftEdge = buttonGroupLeftEdge + (rightmostVisibleButtonIndex - calculatedButtonStartIndex) * (buttonWidth + buttonGap);
      let finalYearButtonRightEdge = rightmostButtonLeftEdge + buttonWidth;
      
      // Calculate search bar left edge position
      // The search bar is right-aligned, so its left edge should be:
      // - At most: searchBarRightPosition - maxSearchBarWidth (to respect max width when there's space)
      // - At least: buttons right edge + gap (to maintain gap from buttons when space is limited)
      // Priority: Search bar should shrink/disappear FIRST before buttons hide
      const maxSearchBarLeftPosition = searchBarRightPosition - maxSearchBarWidth;
      const minSearchBarLeftPosition = finalYearButtonRightEdge + SEARCH_BAR_GAP;
      // Use the rightmost position (larger value = more to the right = narrower search bar) that still maintains the gap
      // This ensures we use max width when there's space, but shrink to maintain gap when needed
      let searchBarLeftPosition = Math.max(maxSearchBarLeftPosition, minSearchBarLeftPosition);
      
      // If search bar would be too small, hide it completely and let buttons use that space
      const calculatedSearchBarWidthTemp = searchBarRightPosition - searchBarLeftPosition;
      if (calculatedSearchBarWidthTemp < 100) {
        // Search bar disappears - buttons can use space up to searchBarRightPosition (no gap needed)
        searchBarLeftPosition = searchBarRightPosition;
      }
      
      // Calculate search bar width based on available space
      const calculatedSearchBarWidth = searchBarRightPosition - searchBarLeftPosition;
      
      // Ensure search bar maintains the configured gap and doesn't go negative
      let finalSearchBarWidth = Math.max(0, calculatedSearchBarWidth);
      
      // If width is very small (less than 100px), set to 0 to effectively hide it
      if (finalSearchBarWidth < 100) {
        finalSearchBarWidth = 0;
      }
      
      // If search bar is hidden, recalculate buttons with more space (they can use space up to searchBarRightPosition)
      if (finalSearchBarWidth === 0) {
        // Search bar is gone - recalculate buttons without reserving space for search bar
        // Use the same range logic to ensure selected button is included
        let newVisibleButtonsAfterSearchBarGone = 4;
        let bestFitAfter = null;
        
        for (let numButtons = 4; numButtons >= 1; numButtons--) {
          // Try different starting positions to find the best fit that includes selected button
          for (let startIndex = 0; startIndex <= 4 - numButtons; startIndex++) {
            const endIndex = startIndex + numButtons - 1;
            
            // Skip if selected button is not in this range
            if (selectedButtonIndex < startIndex || selectedButtonIndex > endIndex) {
              continue;
            }
            
            const buttonAreaWidth = numButtons * buttonWidth + Math.max(0, (numButtons - 1) * buttonGap);
            const buttonAreaHalfWidth = buttonAreaWidth / 2;
            
            // Calculate position centered on selected button
            const selectedButtonOffset = selectedButtonIndex - startIndex;
            const selectedButtonLeftEdge = gridCenterX - buttonAreaHalfWidth + (selectedButtonOffset * (buttonWidth + buttonGap));
            const buttonGroupLeftEdge = selectedButtonLeftEdge - (selectedButtonOffset * (buttonWidth + buttonGap));
            const buttonGroupRightEdge = buttonGroupLeftEdge + buttonAreaWidth;
            
            // Buttons can use space up to searchBarRightPosition (no gap needed since search bar is gone)
            let maxAllowedButtonRightEdgeAfter = searchBarRightPosition;
            
            // Add hysteresis
            if (numButtons > lastVisibleButtonsRef.current) {
              maxAllowedButtonRightEdgeAfter -= hysteresisBuffer;
            } else if (numButtons < lastVisibleButtonsRef.current) {
              maxAllowedButtonRightEdgeAfter += hysteresisBuffer;
            }
            
            if (buttonGroupRightEdge <= maxAllowedButtonRightEdgeAfter) {
              bestFitAfter = { numButtons, startIndex, endIndex };
              newVisibleButtonsAfterSearchBarGone = numButtons;
              break;
            }
          }
          if (bestFitAfter) break;
        }
        
        // If no configuration fits, show at least the selected button
        if (!bestFitAfter) {
          newVisibleButtonsAfterSearchBarGone = 1;
          bestFitAfter = { numButtons: 1, startIndex: selectedButtonIndex, endIndex: selectedButtonIndex };
        }
        
        // Only update if we can show more buttons now that search bar is gone
        if (newVisibleButtonsAfterSearchBarGone > newVisibleButtons || 
            (bestFitAfter && bestFitAfter.startIndex !== calculatedButtonStartIndex)) {
          newVisibleButtons = newVisibleButtonsAfterSearchBarGone;
          const recalcButtonStartIndex = bestFitAfter.startIndex;
          const recalcButtonEndIndex = bestFitAfter.endIndex;
          
          // Recalculate button position centered on selected button
          const recalcButtonAreaWidth = newVisibleButtons * buttonWidth + Math.max(0, (newVisibleButtons - 1) * buttonGap);
          const recalcButtonAreaHalfWidth = recalcButtonAreaWidth / 2;
          const recalcSelectedButtonOffset = selectedButtonIndex - recalcButtonStartIndex;
          const recalcSelectedButtonLeftEdge = gridCenterX - recalcButtonAreaHalfWidth + (recalcSelectedButtonOffset * (buttonWidth + buttonGap));
          const recalcButtonGroupLeftEdge = recalcSelectedButtonLeftEdge - (recalcSelectedButtonOffset * (buttonWidth + buttonGap));
          const recalcButtonGroupCenterX = recalcButtonGroupLeftEdge + recalcButtonAreaHalfWidth;
          const recalcRoundedButtonCenterX = Math.round(recalcButtonGroupCenterX * 100) / 100;
          
          // Calculate rightmost button edge
          const recalcRightmostButtonLeftEdge = recalcButtonGroupLeftEdge + (recalcButtonEndIndex - recalcButtonStartIndex) * (buttonWidth + buttonGap);
          finalYearButtonRightEdge = recalcRightmostButtonLeftEdge + buttonWidth;
          
          // Update visible buttons and start index
          if (newVisibleButtons !== lastVisibleButtonsRef.current || recalcButtonStartIndex !== buttonStartIndex) {
            setVisibleButtons(newVisibleButtons);
            setButtonStartIndex(recalcButtonStartIndex);
            lastVisibleButtonsRef.current = newVisibleButtons;
          }
          
          // Update button position
          const recalcNewButtonPosition = {
            left: `${recalcRoundedButtonCenterX}px`,
            transform: 'translateX(-50%)'
          };
          if (recalcNewButtonPosition.left !== lastButtonPosition.left || recalcNewButtonPosition.transform !== lastButtonPosition.transform) {
            setButtonPosition(recalcNewButtonPosition);
            lastButtonPosition = recalcNewButtonPosition;
          }
          
          // Update calculatedButtonStartIndex for use in search bar calculation below
          calculatedButtonStartIndex = recalcButtonStartIndex;
          calculatedButtonEndIndex = recalcButtonEndIndex;
        }
      }
      
      // Update search bar width
      if (searchInputRef.current) {
        searchInputRef.current.style.width = `${finalSearchBarWidth}px`;
        // Update state for dropdown width synchronization
        setSearchBarWidth(finalSearchBarWidth);
        // Hide search bar if width is 0
        if (finalSearchBarWidth === 0) {
          searchInputRef.current.style.opacity = '0';
          searchInputRef.current.style.pointerEvents = 'none';
        } else {
          searchInputRef.current.style.opacity = '1';
          searchInputRef.current.style.pointerEvents = 'auto';
        }
      }
      
      // Update dropdown width directly to match search bar
      if (dropdownRef.current) {
        dropdownRef.current.style.width = `${finalSearchBarWidth}px`;
      }
      
      // Set search bar position - right-aligned with fixed gap from calendar grid right edge
      // Right edge stays fixed, width shrinks from the left
      // Convert searchBarRightPosition (relative to left) to right position (relative to right)
      const searchBarRightPositionCss = headerWidth - searchBarRightPosition;
      setSearchBarPosition({
        left: 'auto',
        right: `${searchBarRightPositionCss}px`, // Right edge position (8px from calendar grid right edge)
        top: '50%',
        transform: 'translateY(-50%)'
      });
      
      // Track header width changes
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
  }, [viewMode]); // Re-run when viewMode changes to observe the correct calendar content element

  // Sync dropdown width with search bar width
  useEffect(() => {
    if (dropdownRef.current && searchBarWidth > 0) {
      dropdownRef.current.style.width = `${searchBarWidth}px`;
    }
  }, [searchBarWidth, showDropdown]);

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
  
  return (
    <div className="calendar-header" ref={headerRef}>
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


        {/* Dropdown */}
        {showDropdown && (suggestions.length > 0 || searchQuery.trim() === '') && (
          <div 
            ref={dropdownRef}
            style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              width: `${searchBarWidth}px`,
              maxHeight: '300px',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 10000,
              opacity: 1,
              marginTop: '4px',
              overflow: 'hidden',
              transition: 'width 0.05s ease-out'
            }}
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  backgroundColor: selectedIndex === index ? '#f5f5f5' : 'white',
                  borderBottom: index < suggestions.length - 1 ? '1px solid #eee' : 'none',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <span style={{ 
                  fontSize: '14px',
                  color: suggestion.type === 'task' ? '#333' : '#666'
                }}>
                  {suggestion.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarHeader;


