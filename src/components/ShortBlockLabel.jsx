import { useLayoutEffect, useRef, useState } from 'react';
import { SHORT_BLOCK } from '../utils/calendarItems';
import { availableTextWidth, findWeekBlock } from '../utils/blockTextGutter';
import { countWrappedLines, lineClampStyle, linesThatFit, readLineHeight } from '../utils/blockTextClamp';

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

const BLOCK_SELECTOR = '.calendar-time-block, .day-time-block, .day-time-block-preview';

/**
 * Title for a short calendar block.
 * One-line blocks keep title and time on one row when both fit.
 * Taller blocks wrap the title and place the time underneath.
 * An ellipsis appears only when the wrapped text exceeds the block height.
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
  const probeRef = useRef(null);
  const [showTime, setShowTime] = useState(Boolean(timeText));
  const [hoverMaxWidth, setHoverMaxWidth] = useState(null);
  const [stacked, setStacked] = useState(false);
  const [titleLines, setTitleLines] = useState(1);
  const [timeLines, setTimeLines] = useState(1);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const measure = () => {
      const weekBlock = actionGutter <= 0 ? findWeekBlock(root) : null;
      const cap = weekBlock ? availableTextWidth(root, weekBlock) : null;
      setHoverMaxWidth((prev) => (prev === cap ? prev : cap));

      const block = root.closest(BLOCK_SELECTOR);
      const titleEl = titleRef.current;
      const titleLine = readLineHeight(titleEl);
      const cs = block ? getComputedStyle(block) : null;
      const padTop = cs ? (parseFloat(cs.paddingTop) || 0) : 0;
      const padBottom = cs ? (parseFloat(cs.paddingBottom) || 0) : 0;
      const innerH = block ? block.clientHeight - padTop - padBottom : titleLine;
      const fitted = linesThatFit(innerH, titleLine);
      const nextStacked = fitted >= 2;
      setStacked((prev) => (prev === nextStacked ? prev : nextStacked));

      if (!nextStacked) {
        setTitleLines((prev) => (prev === 1 ? prev : 1));
        setTimeLines((prev) => (prev === 1 ? prev : 1));
        if (!timeText) {
          setShowTime(false);
          return;
        }
        const parent = root.parentElement;
        const parentWidth = parent?.clientWidth ?? root.clientWidth;
        const available = actionGutter > 0
          ? Math.max(0, parentWidth - actionGutter)
          : Math.max(0, cap ?? parentWidth);
        const titleFont = readFont(titleEl);
        const timeFont = titleFont.replace(/(\d+(?:\.\d+)?)px/, (_, size) => {
          const px = Math.max(10, parseFloat(size) * 0.85);
          return `${px}px`;
        }).replace(/700|600|bold/i, '500');
        const titleNatural = measureText(String(title || ''), titleFont);
        const timeNatural = measureText(String(timeText), timeFont);
        const fits = titleNatural + SHORT_BLOCK.inlineGap + timeNatural <= available + 0.5;
        setShowTime((prev) => (prev === fits ? prev : fits));
        return;
      }

      const probe = probeRef.current;
      const timeLine = probe ? Math.max(probe.offsetHeight, readLineHeight(probe)) : 0;
      const reserveTime = Boolean(timeText) && timeLine > 0
        && innerH + 0.5 >= titleLine + timeLine + SHORT_BLOCK.inlineGap;
      const titleBudget = reserveTime ? innerH - timeLine - SHORT_BLOCK.inlineGap : innerH;
      const maxTitleLines = linesThatFit(titleBudget, titleLine);
      const usedTitleLines = Math.min(countWrappedLines(titleEl, titleLine), maxTitleLines);
      setTitleLines((prev) => (prev === maxTitleLines ? prev : maxTitleLines));
      setShowTime((prev) => (prev === reserveTime ? prev : reserveTime));
      if (!reserveTime) return;
      const timeBudget = innerH - usedTitleLines * titleLine - SHORT_BLOCK.inlineGap;
      const maxTimeLines = linesThatFit(timeBudget, timeLine);
      setTimeLines((prev) => (prev === maxTimeLines ? prev : maxTimeLines));
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
      const block = root.closest(BLOCK_SELECTOR);
      if (block) ro.observe(block);
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
  }, [title, timeText, actionGutter, stacked, showTime]);

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
        display: 'flex',
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'stretch' : 'center',
        justifyContent: 'flex-start',
        gap: stacked ? 2 : SHORT_BLOCK.inlineGap,
        minWidth: 0,
        maxWidth,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <span
        ref={titleRef}
        className={titleClassName}
        style={{
          flex: stacked ? '0 1 auto' : '1 1 auto',
          minWidth: 0,
          maxWidth: '100%',
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1.2,
          ...lineClampStyle(titleLines),
        }}
      >
        {title}
      </span>
      {timeText ? (
        <span
          ref={probeRef}
          aria-hidden
          style={{
            position: 'absolute',
            visibility: 'hidden',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            fontSize: '0.72rem',
            fontWeight: 500,
          }}
        >
          {timeText}
        </span>
      ) : null}
      {showTime && timeText ? (
        <span
          className={timeClassName}
          style={stacked ? {
            flex: '0 1 auto',
            minWidth: 0,
            maxWidth: '100%',
            fontSize: '0.72rem',
            fontWeight: 500,
            opacity: 0.95,
            ...lineClampStyle(timeLines),
          } : {
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
