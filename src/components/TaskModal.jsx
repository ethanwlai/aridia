import React, { useState, useEffect } from 'react';

const TaskModal = ({ show, onClose, onSubmit, defaultDate }) => {
  const [taskName, setTaskName] = useState('');
  const [energy, setEnergy] = useState(1);
  const [priority, setPriority] = useState(1);
  const [deadline, setDeadline] = useState(defaultDate || '');

  // Add escape key handling
  useEffect(() => {
    if (!show) return;
    
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [show, onClose]);

  const handleSubmit = () => {
    if (!taskName.trim()) return;
    onSubmit({ name: taskName, energy, priority, deadline });
    setTaskName('');
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl relative font-sans">
        {/* + Close Icon */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-2xl text-gray-400 hover:text-black"
        >
          ×
        </button>

        {/* Header Title */}
        <h2 className="text-3xl font-semibold text-gray-800 mb-6">Add Task</h2>

        {/* Input Fields */}
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Task name"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 text-base"
          />

          <div className="flex gap-4">
            <input
              type="number"
              min="1"
              max="5"
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className="w-1/2 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Energy (1–5)"
            />
            <input
              type="number"
              min="1"
              max="5"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-1/2 border border-gray-300 rounded-lg p-3 text-base"
              placeholder="Priority (1–5)"
            />
          </div>

          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 text-base"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          className="w-full mt-6 bg-black text-white py-3 rounded-xl text-lg hover:bg-gray-800 transition"
        >
          Create Task
        </button>
      </div>
    </div>
  );
};

export default TaskModal;
