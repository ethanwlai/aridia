// src/components/TaskList.jsx
import React from 'react';
import { format } from 'date-fns';
import TaskActionsDropdown from './TaskActionsDropdown';
import { useLayoutMode } from '../hooks/useLayoutMode';

// Utility: Parse YYYY-MM-DD as local date (same as Sidebar)
function parseLocalDate(dateStr) {
  if (!dateStr) {
    return null;
  }
  
  // If it's already a Date object, return it directly
  if (dateStr instanceof Date) {
    return dateStr;
  }
  
  // If it's a string in yyyy-MM-dd format, parse it
  if (typeof dateStr === 'string') {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  return null;
}

const TaskList = ({ tasks, title = 'Task List', onDelete, onEdit, onUpdateStatus, onAutoSchedule, onQuickMove, onExtendDuration, onLocateItem, listFocus = null }) => {
  const { isCompact } = useLayoutMode();
  const filteredTasks = tasks || [];
  const focusInList = Boolean(
    listFocus && filteredTasks.some((task) => task.id === listFocus.id && task.type === listFocus.type)
  );
  
  const getPriorityColor = (level) => {
    switch (level) {
      case 1: return '#22c55e'; // green
      case 2: return '#eab308'; // yellow
      case 3: return '#f97316'; // orange
      case 4: return '#ef4444'; // red
      case 5: return '#dc2626'; // dark red
      default: return '#a084e8';
    }
  };

  const getEnergyColor = (level) => {
    switch (level) {
      case 1: return '#4ade80'; // bright green (Light)
      case 2: return '#22c55e'; // green (Easy)
      case 3: return '#fbbf24'; // bright yellow (Moderate)
      case 4: return '#f97316'; // orange-red (Hard)
      case 5: return '#dc2626'; // red (Intense)
      default: return '#a084e8';
    }
  };

  const getPriorityText = (level) => {
    switch (level) {
      case 1: return 'Very Low';
      case 2: return 'Low';
      case 3: return 'Medium';
      case 4: return 'High';
      case 5: return 'Very High';
      default: return 'Medium';
    }
  };

  const getEnergyText = (level) => {
    switch (level) {
      case 1: return 'Light';
      case 2: return 'Easy';
      case 3: return 'Moderate';
      case 4: return 'Hard';
      case 5: return 'Intense';
      default: return 'Moderate';
    }
  };

  const getTaskType = (task) => {
    // You can customize this based on your task structure
    // For now, I'll use a simple categorization
    if (task.title.toLowerCase().includes('study') || task.title.toLowerCase().includes('read')) {
      return 'Study';
    } else if (task.title.toLowerCase().includes('meet') || task.title.toLowerCase().includes('call')) {
      return 'Meeting';
    } else if (task.title.toLowerCase().includes('work') || task.title.toLowerCase().includes('project')) {
      return 'Work';
    } else if (task.title.toLowerCase().includes('exercise') || task.title.toLowerCase().includes('workout')) {
      return 'Exercise';
    } else {
      return 'Task';
    }
  };

  const getTimeFrame = (task) => {
    // Use the task's duration property (in minutes)
    if (task.duration) {
      const hours = Math.floor(task.duration / 60);
      const minutes = task.duration % 60;
      
      if (hours === 0) {
        return `${minutes}m`;
      } else if (minutes === 0) {
        return `${hours}h`;
      } else {
        return `${hours}h ${minutes}m`;
      }
    }
    
    // Fallback to startTime and endTime if duration is not available
    if (task.startTime && task.endTime) {
      return `${task.startTime} - ${task.endTime}`;
    }
    
    // Fallback to task.time if startTime/endTime are not available
    if (task.time && task.time !== 'Time not set') {
      return task.time;
    }
    
    // Default time frame if not specified
    return '30m';
  };

  return (
    <div style={{
      marginBottom: '2rem',
      padding: '1rem',
      background: 'rgba(160, 132, 232, 0.1)',
      borderRadius: '8px',
      border: '1px solid rgba(160, 132, 232, 0.2)',
      cursor: 'default',
      ...(isCompact ? { width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' } : {}),
    }}>
      {(!filteredTasks || filteredTasks.length === 0) ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#9ca3af',
          fontSize: '0.9rem',
          cursor: 'default'
        }}>
          <div style={{ cursor: 'default' }}>No tasks yet. Add one above!</div>
        </div>
      ) : (
        <div style={{ cursor: 'default' }}>
          <div style={{
            marginBottom: '1rem',
            fontSize: '1rem',
            fontWeight: 600,
            color: 'white',
            cursor: 'default'
          }}>
            {title}
          </div>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            cursor: 'default',
            ...(isCompact ? { minWidth: 0, paddingTop: 10, paddingLeft: 10 } : {}),
          }}>
            {filteredTasks.map((task, index) => {
              let formattedDate = 'Invalid';
              try {
                // Handle both string and Date object deadlines
                if (task.deadline instanceof Date) {
                  // If it's already a Date object (from sortTasks), format it directly
                  formattedDate = format(task.deadline, 'M/d/yyyy');
                } else if (task.deadline && typeof task.deadline === 'string') {
                  // If it's a string, parse it the same way as CalendarGrid
                  const [startYear, startMonth, startDay] = task.deadline.split('-').map(Number);
                  const startDate = new Date(startYear, startMonth - 1, startDay);
                  
                  if (!isNaN(startDate)) {
                    formattedDate = format(startDate, 'M/d/yyyy');
                  }
                }
              } catch (error) {
                console.error(`Error parsing date for ${task.title}:`, error);
              }

              const selected = Boolean(
                listFocus && listFocus.id === task.id && listFocus.type === task.type
              );

              return (
                <div 
                  key={task.id}
                  className="task-list-item"
                  onClick={(e) => {
                    if (e.target.closest('.task-delete-btn, .task-complete-btn, .task-edit-btn, .task-actions-dropdown-trigger, .task-actions-dropdown-menu, .task-actions-dropdown-submenu')) {
                      return;
                    }
                    onLocateItem?.(task);
                  }}
                  style={{
                    background: '#2e0066',
                    padding: '1rem',
                    paddingBottom: '1.25rem', // 4px more padding at bottom (16px + 4px = 20px)
                    borderRadius: '8px',
                    border: '1px solid #a084e8',
                    position: 'relative',
                    cursor: 'pointer',
                    opacity: focusInList && !selected ? 0.3 : 1,
                    transform: isCompact ? 'none' : (selected ? 'scale(1.02)' : 'scale(1)'),
                    transition: 'opacity 0.2s ease, transform 0.2s ease',
                    ...(isCompact ? { width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' } : {}),
                  }}
                >
                   {/* Task Number */}
                   <div style={{
                     position: 'absolute',
                     top: '-8px',
                     left: '-8px',
                     background: 'linear-gradient(135deg, #a084e8 0%, #8b5cf6 100%)',
                     color: 'white',
                     width: '24px',
                     height: '24px',
                     borderRadius: '50%',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     fontSize: '0.8rem',
                     fontWeight: 700,
                     cursor: 'default'
                   }}>
                     {index + 1}
                   </div>

                   {/* Actions Dropdown - Top Right */}
                   <div style={{
                     position: 'absolute',
                     top: '6px',
                     right: '2px', // Moved 4px more to the right (from 6px to 2px)
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'flex-end',
                     pointerEvents: 'none',
                   }}>
                     <TaskActionsDropdown
                       task={task}
                       onAutoSchedule={onAutoSchedule}
                       onQuickMove={onQuickMove}
                       onExtendDuration={onExtendDuration}
                       isTask={true}
                     />
                   </div>

                    {/* Task Title and Icons Row */}
                    <div style={{
                      display: 'flex',
                      alignItems: isCompact ? 'stretch' : 'center',
                      flexDirection: isCompact ? 'column' : 'row',
                      justifyContent: 'space-between',
                      marginBottom: '0.75rem',
                      paddingLeft: '1rem',
                      cursor: 'default',
                      ...(isCompact ? { gap: '0.5rem', minWidth: 0 } : {}),
                    }}>
                      <div style={{
                        fontSize: isCompact ? '1rem' : '1.1rem',
                        fontWeight: 600,
                        color: 'white',
                        cursor: 'default',
                        overflow: isCompact ? 'visible' : 'hidden',
                        textOverflow: isCompact ? 'clip' : 'ellipsis',
                        whiteSpace: isCompact ? 'normal' : 'nowrap',
                        overflowWrap: isCompact ? 'anywhere' : 'normal',
                        minWidth: 0,
                        flex: isCompact ? '0 0 auto' : 1,
                        marginRight: isCompact ? 0 : '0.5rem',
                        ...(isCompact ? { width: '100%', paddingRight: '2.75rem' } : {}),
                      }}>
                        {task.title}
                      </div>
                      
                                             {/* Energy, Priority, Time, and Date */}
                       <div style={{
                         display: 'flex',
                         alignItems: 'center',
                         gap: '0.5rem',
                         flexWrap: 'wrap',
                         justifyContent: isCompact ? 'flex-start' : 'flex-end',
                         cursor: 'default',
                         ...(isCompact ? { maxWidth: '100%', minWidth: 0 } : {}),
                       }}>
                         {task.type === 'task' && (
                         <>
                         {/* Energy Level */}
                         <span 
                           title={getEnergyText(task.energy)}
                           style={{
                             fontSize: '0.9rem',
                             color: getEnergyColor(task.energy),
                             fontWeight: 600,
                             display: 'inline-flex',
                             alignItems: 'center',
                             justifyContent: 'center',
                             padding: '0.25rem 0.5rem',
                             borderRadius: '999px',
                             border: '1px solid white',
                             background: 'transparent',
                             minWidth: '32px',
                             height: '24px',
                             cursor: 'default'
                           }}
                         >
                           <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                             <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
                           </svg>
                         </span>

                         {/* Priority Level */}
                         <span 
                           title={getPriorityText(task.priority)}
                           style={{
                             fontSize: '0.9rem',
                             color: getPriorityColor(task.priority),
                             fontWeight: 600,
                             display: 'inline-flex',
                             alignItems: 'center',
                             justifyContent: 'center',
                             padding: '0.25rem 0.5rem',
                             borderRadius: '999px',
                             border: '1px solid white',
                             background: 'transparent',
                             minWidth: '32px',
                             height: '24px',
                             cursor: 'default'
                           }}
                         >
                           ★
                         </span>
                         </>
                         )}

                                                  {/* Time Frame */}
                         <span style={{
                           fontSize: '0.8rem',
                           color: 'white',
                           fontWeight: 600,
                           padding: '0.25rem 0.5rem',
                           borderRadius: '999px',
                           border: '1px solid white',
                           background: 'transparent',
                           cursor: 'default',
                           overflow: 'hidden',
                           textOverflow: 'ellipsis',
                           whiteSpace: 'nowrap',
                           maxWidth: isCompact ? 'none' : '80px'
                         }}>
                           {getTimeFrame(task)}
                         </span>

                         {/* Deadline */}
                         <span style={{
                           fontSize: '0.8rem',
                           color: 'white',
                           fontWeight: 600,
                           padding: '0.25rem 0.5rem',
                           borderRadius: '999px',
                           border: '1px solid white',
                           background: 'transparent',
                           cursor: 'default',
                           overflow: 'hidden',
                           textOverflow: 'ellipsis',
                           whiteSpace: 'nowrap',
                           maxWidth: isCompact ? 'none' : '80px'
                         }}>
                           {formattedDate}
                         </span>
                       </div>
                    </div>

                    {/* Edit, Complete, and Delete Buttons - Bottom Right */}
                    <div style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      pointerEvents: 'none',
                    }}>
                      {/* Edit Button */}
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
                          if (onEdit && task) {
                            onEdit(task);
                          }
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                      </div>

                      {/* Complete Button */}
                      {onUpdateStatus && (
                        <div
                          className={`task-complete-btn ${task.status === 'completed' ? 'selected' : ''}`}
                          style={{
                            width: '14px',
                            height: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#ffffff',
                            opacity: task.status === 'completed' ? 1 : 0,
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
                            if (onUpdateStatus && task.id) {
                              const newStatus = task.status === 'completed' ? 'active' : 'completed';
                              onUpdateStatus(task.id, newStatus);
                            }
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20,6 9,17 4,12"></polyline>
                          </svg>
                        </div>
                      )}

                      {/* Delete Button */}
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
                          const taskElement = e.target.closest('.task-list-item');
                          if (taskElement) {
                            taskElement.style.transition = 'opacity 0.2s ease';
                            taskElement.style.opacity = '0';
                          }
                          
                          // Delete the task from data after the animation completes
                          setTimeout(() => {
                            if (onDelete && task.id) {
                              onDelete(task.id);
                            }
                          }, 200);
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                      </div>
                    </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskList;
