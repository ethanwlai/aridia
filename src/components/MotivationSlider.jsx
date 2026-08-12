import React, { useState } from 'react';

const MotivationSlider = ({ motivation, setMotivation }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(motivation);

  const getMotivationColor = (level) => {
    switch (level) {
      case 1: return '#4c1d95'; // dark purple
      case 2: return '#5b21b6'; // medium purple
      case 3: return '#6d28d9'; // light purple
      case 4: return '#7c3aed'; // bright purple
      case 5: return '#8b5cf6'; // light purple
      default: return '#6d28d9';
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragValue(motivation);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newValue = 1 + (percentage * 4); // Convert to 1-5 range
    setDragValue(newValue);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      // Snap to nearest whole number
      const snappedValue = Math.round(dragValue);
      setMotivation(snappedValue);
      setDragValue(snappedValue);
      setIsDragging(false);
    }
  };

  const handleChange = (e) => {
    // For keyboard navigation and accessibility
    const value = Number(e.target.value);
    setMotivation(value);
    setDragValue(value);
  };

  // Use dragValue for visual feedback during dragging, motivation for the actual value
  const displayValue = isDragging ? dragValue : motivation;

  return (
    <div 
      style={{
        marginBottom: '2rem',
        padding: '1rem',
        background: 'rgba(160, 132, 232, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(160, 132, 232, 0.2)',
        userSelect: 'none'
      }}
      tabIndex="-1"
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem'
      }}
      tabIndex="-1">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
        tabIndex="-1">
          <span style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: 'white',
            userSelect: 'none'
          }}
          tabIndex="-1">
            Motivation Level
          </span>
        </div>
      </div>
      
      <div 
        style={{
          position: 'relative',
          marginBottom: '0.5rem'
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        tabIndex="-1"
      >
        <input
          type="range"
          min="1"
          max="5"
          step="0.01"
          value={displayValue}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          style={{
            width: '100%',
            height: '8px',
            borderRadius: '4px',
            background: `linear-gradient(to right, ${getMotivationColor(Math.round(displayValue))} 0%, ${getMotivationColor(Math.round(displayValue))} ${(displayValue - 1) * 25}%, #4b5563 ${(displayValue - 1) * 25}%, #4b5563 100%)`,
            outline: 'none',
            cursor: 'pointer',
            WebkitAppearance: 'none',
            transition: isDragging ? 'none' : 'background 0.2s ease'
          }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '0.5rem',
          fontSize: '0.8rem',
          color: '#9ca3af',
          paddingLeft: '10px',
          paddingRight: '5px',
          userSelect: 'none'
        }}
        tabIndex="-1">
          <span tabIndex="-1">1</span>
          <span tabIndex="-1">2</span>
          <span tabIndex="-1">3</span>
          <span tabIndex="-1">4</span>
          <span tabIndex="-1">5</span>
        </div>
      </div>
    </div>
  );
};

export default MotivationSlider;
