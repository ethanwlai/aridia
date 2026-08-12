// src/utils/taskSorter.js
export const sortTasks = (tasks, motivation) => {
  if (!Array.isArray(tasks)) {
    console.warn('sortTasks: tasks parameter is not an array');
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Weight configuration based on motivation level
  const weightConfigs = {
    1: { w1: 0.75, w2: 0.15, w3: 0.10 }, // Very Low Motivation
    2: { w1: 0.55, w2: 0.30, w3: 0.15 }, // Low Motivation
    3: { w1: 0.40, w2: 0.35, w3: 0.25 }, // Medium Motivation
    4: { w1: 0.30, w2: 0.45, w3: 0.25 }, // High Motivation
    5: { w1: 0.10, w2: 0.55, w3: 0.35 }  // Very High Motivation
  };

  const { w1, w2, w3 } = weightConfigs[motivation] || weightConfigs[3];

  const scoredTasks = tasks.map((task, index) => {
    if (!task || typeof task.deadline !== 'string') {
      console.warn(`sortTasks: Invalid task at index ${index}`, task);
      return null;
    }

    // Use the same local date parsing as CalendarGrid to avoid timezone issues
    const [year, month, day] = task.deadline.split('-').map(Number);
    const deadline = new Date(year, month - 1, day);
    
    if (isNaN(deadline.getTime())) {
      console.warn(`sortTasks: Invalid deadline for task at index ${index}`, task.deadline);
      return null;
    }

    // Set to noon to avoid timezone issues
    deadline.setHours(12, 0, 0, 0);

    const energy = Math.max(1, Math.min(5, Number(task.energy) || 1));
    const priority = Math.max(1, Math.min(5, Number(task.priority) || 1));

    const daysUntilDeadline = Math.max(
      1,
      Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))
    );

    const isDueToday = deadline.toDateString() === today.toDateString();
    const dueTodayBonus = isDueToday ? 0.05 : 0;

    // Calculate scores with bounds checking
    const mfit = Math.max(0, Math.min(1, 1 - (energy - motivation) / 4));
    const durgency = Math.max(0, Math.min(1, 1 / daysUntilDeadline));
    const p = Math.max(0, Math.min(1, priority / 5));

    const score = (w1 * mfit) + (w2 * durgency) + (w3 * p) + dueTodayBonus;

    return {
      ...task,
      deadline,
      score,
      mfit,
      durgency,
      isDueToday,
      w1,
      w2,
      w3,
    };
  });

  const result = scoredTasks
    .filter(task => task !== null)
    .sort((a, b) => b.score - a.score);
    
  return result;
};
