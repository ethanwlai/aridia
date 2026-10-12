/** Pixel line-height for a rendered element. */
export function readLineHeight(el) {
  if (!el) return 16;
  const cs = getComputedStyle(el);
  const lineHeight = parseFloat(cs.lineHeight);
  if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
  const fontSize = parseFloat(cs.fontSize);
  return (Number.isFinite(fontSize) ? fontSize : 13) * 1.2;
}

/** Bottom of a block's content box, inside its padding. */
export function blockContentBottom(block) {
  const rect = block.getBoundingClientRect();
  const pad = parseFloat(getComputedStyle(block).paddingBottom) || 0;
  return rect.bottom - pad;
}

/**
 * How many wrapped lines `el` would use if it were not line-clamped.
 * Restores inline styles before returning.
 */
export function countWrappedLines(el, lineHeight) {
  if (!el || !(lineHeight > 0)) return 1;
  const snapshot = {
    display: el.style.display,
    webkitLineClamp: el.style.webkitLineClamp,
    webkitBoxOrient: el.style.webkitBoxOrient,
    overflow: el.style.overflow,
    maxHeight: el.style.maxHeight,
    whiteSpace: el.style.whiteSpace,
  };
  el.style.display = 'block';
  el.style.webkitLineClamp = 'unset';
  el.style.webkitBoxOrient = 'unset';
  el.style.overflow = 'visible';
  el.style.maxHeight = 'none';
  el.style.whiteSpace = 'normal';
  const lines = Math.max(1, Math.round(el.scrollHeight / lineHeight));
  el.style.display = snapshot.display;
  el.style.webkitLineClamp = snapshot.webkitLineClamp;
  el.style.webkitBoxOrient = snapshot.webkitBoxOrient;
  el.style.overflow = snapshot.overflow;
  el.style.maxHeight = snapshot.maxHeight;
  el.style.whiteSpace = snapshot.whiteSpace;
  return lines;
}

/** Clamp wrapped text. Ellipsis appears only past `lines`. */
export function lineClampStyle(lines) {
  const count = Math.max(1, lines || 1);
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: String(count),
    overflow: 'hidden',
    whiteSpace: 'normal',
    overflowWrap: 'break-word',
    minWidth: 0,
    minHeight: 0,
  };
}

/** Whole lines of `lineHeight` that fit in `budget` pixels. At least one. */
export function linesThatFit(budget, lineHeight) {
  if (!(lineHeight > 0)) return 1;
  return Math.max(1, Math.floor(budget / lineHeight));
}
