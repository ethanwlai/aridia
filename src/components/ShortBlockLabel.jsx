import { useLayoutEffect, useRef, useState } from 'react';
import { SHORT_BLOCK } from '../utils/calendarItems';
import { availableTextWidth, findWeekBlock } from '../utils/blockTextGutter';

function readFont(el) {
  if (!el) return '700 13px Karla, sans-serif';
  const cs = window.getComputedStyle(el);
  return `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
}

function measureText(text, font) {
  if (!text) return 0;
  const canvas = measureText._canvas || (measureText._canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
}

/**
 * Shrink-wrapped inline title + optional time for short calendar blocks.
 * Time is hard-hidden when the full range does not fit after the title.
 */
export default function ShortBlockLabel({
  title,
  timeText,
  actionGutter = SHORT_BLOCK.weekActionGutter,
  className = '',
  titleClassName = 'short-block-label-title',
  timeClassName = 'short-block-label-time',
}) {
  const rootRef = useRef(null);
  const titleRef = useRef(null);
  const [showTime, setShowTime] = useState(Boolean(timeText));
  const [hoverMaxWidth, setHoverMaxWidth] = useState(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const measure = () => {
      const weekBlock = actionGutter <= 0 ? findWeekBlock(root) : null;
      const cap = weekBlock ? availableTextWidth(root, weekBlock) : null;
      setHoverMaxWidth((prev) => (prev === cap ? prev : cap));

      if (!timeText) {
        setShowTime(false);
        return;
      }

      const parent = root.parentElement;
      const parentWidth = parent?.clientWidth ?? root.clientWidth;
      const available = actionGutter > 0
        ? Math.max(0, parentWidth - actionGutter)
        : Math.max(0, cap ?? parentWidth);

      const titleFont = readFont(titleRef.current);
      // Time uses slightly smaller type (matches rendered time span)
      const timeFont = titleFont.replace(/(\d+(?:\.\d+)?)px/, (_, size) => {
        const px = Math.max(10, parseFloat(size) * 0.85);
        return `${px}px`;
      }).replace(/700|600|bold/i, '500');

      const titleNatural = measureText(String(title || ''), titleFont);
      const timeNatural = measureText(String(timeText), timeFont);
      const gap = SHORT_BLOCK.inlineGap;
      const fits = titleNatural + gap + timeNatural <= available + 0.5;
      setShowTime(fits);
    };

    const onHoverChange = () => {
      requestAnimationFrame(measure);
    };

    measure();
    const weekBlock = actionGutter <= 0 ? findWeekBlock(root) : null;
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => measure())
      : null;
    if (ro) {
      ro.observe(root);
      if (root.parentElement) ro.observe(root.parentElement);
      if (weekBlock) ro.observe(weekBlock);
    }
    weekBlock?.addEventListener('mouseenter', onHoverChange);
    weekBlock?.addEventListener('mouseleave', onHoverChange);
    const mo = weekBlock && typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => measure())
      : null;
    mo?.observe(weekBlock, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      mo?.disconnect();
      weekBlock?.removeEventListener('mouseenter', onHoverChange);
      weekBlock?.removeEventListener('mouseleave', onHoverChange);
      window.removeEventListener('resize', measure);
    };
  }, [title, timeText, actionGutter]);

  const tip = timeText ? `${title} · ${timeText}` : title;
  const maxWidth = actionGutter > 0
    ? `calc(100% - ${actionGutter}px)`
    : (hoverMaxWidth != null ? `${hoverMaxWidth}px` : '100%');

  return (
    <div
      ref={rootRef}
      className={`short-block-label${className ? ` ${className}` : ''}`}
      title={tip}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: SHORT_BLOCK.inlineGap,
        minWidth: 0,
        maxWidth,
        width: 'fit-content',
        overflow: 'hidden',
      }}
    >
      <span
        ref={titleRef}
        className={titleClassName}
        style={{
          flex: '0 1 auto',
          minWidth: `${SHORT_BLOCK.titleMinCh}rem`,
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </span>
      {showTime && timeText ? (
        <span
          className={timeClassName}
          style={{
            flex: '0 0 auto',
            whiteSpace: 'nowrap',
            fontSize: '0.72rem',
            fontWeight: 500,
            opacity: 0.95,
          }}
        >
          {timeText}
        </span>
      ) : null}
    </div>
  );
}
