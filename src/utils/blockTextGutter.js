const WEEK_BLOCK_SELECTOR = '.calendar-time-block';
const TEXT_BUTTON_GAP = 4;

const CONTROL_SELECTORS = [
  '.task-action-buttons-inline .task-edit-btn',
  '.task-action-buttons-inline .task-complete-btn',
  '.task-action-buttons-inline .task-delete-btn',
  '.task-action-buttons-inline .task-actions-dropdown-trigger',
  '.task-action-buttons-long .task-edit-btn',
  '.task-action-buttons-long .task-complete-btn',
  '.task-action-buttons-long .task-delete-btn',
  '.task-actions-dropdown-trigger',
].join(', ');

function isLegacyHiddenControl(el) {
  const legacy = el.closest('.task-action-buttons');
  if (!legacy) return false;
  return !legacy.classList.contains('task-action-buttons-inline')
    && !legacy.classList.contains('task-action-buttons-long');
}

function rectsOverlapVertically(a, b) {
  return a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
}

export function collectBlockActionControls(block) {
  if (!block) return [];
  const hovering = typeof block.matches === 'function' && block.matches(':hover');
  const nodes = [...block.querySelectorAll(CONTROL_SELECTORS)];
  const seen = new Set();
  const out = [];
  for (const el of nodes) {
    if (seen.has(el) || isLegacyHiddenControl(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (!hovering && !el.classList.contains('selected')) continue;
    out.push(el);
  }
  return out;
}

/**
 * Leftover width for a text line before overlapping action controls.
 * Returns null when nothing overlaps (caller should leave the line unconstrained).
 */
export function availableTextWidth(textEl, block) {
  if (!textEl || !block) return null;
  const controls = collectBlockActionControls(block);
  if (!controls.length) return null;

  const textRect = textEl.getBoundingClientRect();
  let leftmost = Infinity;
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (rectsOverlapVertically(textRect, r) && r.left < leftmost) {
      leftmost = r.left;
    }
  }
  if (!Number.isFinite(leftmost)) return null;
  return Math.max(0, leftmost - textRect.left - TEXT_BUTTON_GAP);
}

export function findWeekBlock(el) {
  return el?.closest?.(WEEK_BLOCK_SELECTOR) ?? null;
}
