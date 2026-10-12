import { useLayoutEffect, useRef, useState } from 'react';
import { availableTextWidth, findWeekBlock } from '../utils/blockTextGutter';
import {
  blockContentBottom,
  countWrappedLines,
  lineClampStyle,
  linesThatFit,
  readLineHeight,
} from '../utils/blockTextClamp';

const STACK_GAP = 2;

/**
 * Space this label may use inside its block.
 * Several labels in one block split the content box evenly.
 */
function labelBudget(block, titleEl) {
  const fromTitle = blockContentBottom(block) - titleEl.getBoundingClientRect().top;
  const labels = block.querySelectorAll('.stacked-block-label');
  if (labels.length <= 1) return Math.max(0, fromTitle);
  const cs = getComputedStyle(block);
  const padTop = parseFloat(cs.paddingTop) || 0;
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  const share = (block.clientHeight - padTop - padBottom) / labels.length;
  return Math.max(0, Math.min(fromTitle, share));
}

/**
 * Stacked title + optional time for taller calendar blocks.
 * Title wraps to the block width. An ellipsis appears only when the
 * wrapped text is taller than the block. The time line is hidden when
 * there is not a full line left under the title.
 */
export default function StackedBlockLabel({
  title,
  timeText,
  titleClassName = 'task-text-element',
  timeClassName = 'stacked-block-label-time',
  titleStyle,
  timeStyle,
  blockSelector = '.calendar-time-block, .day-time-block',
}) {
  const rootRef = useRef(null);
  const localTitleRef = useRef(null);
  const probeRef = useRef(null);
  const timeElRef = useRef(null);
  const [showTime, setShowTime] = useState(Boolean(timeText));
  const [titleMaxWidth, setTitleMaxWidth] = useState(null);
  const [timeMaxWidth, setTimeMaxWidth] = useState(null);
  const [titleLines, setTitleLines] = useState(1);
  const [timeLines, setTimeLines] = useState(1);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const applyGutters = () => {
      const weekBlock = findWeekBlock(root);
      const titleEl = localTitleRef.current;
      const timeEl = timeElRef.current;
      const nextTitle = weekBlock && titleEl ? availableTextWidth(titleEl, weekBlock) : null;
      const nextTime = weekBlock && timeEl ? availableTextWidth(timeEl, weekBlock) : null;
      setTitleMaxWidth((prev) => (prev === nextTitle ? prev : nextTitle));
      setTimeMaxWidth((prev) => (prev === nextTime ? prev : nextTime));
    };

    const measure = () => {
      applyGutters();
      const block = root.closest(blockSelector);
      const titleEl = localTitleRef.current;
      if (!block || !titleEl) return;

      const titleLine = readLineHeight(titleEl);
      const available = labelBudget(block, titleEl);
      const probe = probeRef.current;
      const timeLine = probe ? Math.max(probe.offsetHeight, readLineHeight(probe)) : 0;
      const reserveTime = Boolean(timeText) && timeLine > 0
        && available + 0.5 >= titleLine + timeLine + STACK_GAP;
      const titleBudget = reserveTime ? available - timeLine - STACK_GAP : available;
      const maxTitleLines = linesThatFit(titleBudget, titleLine);
      const naturalTitleLines = countWrappedLines(titleEl, titleLine);
      const usedTitleLines = Math.min(naturalTitleLines, maxTitleLines);

      setShowTime((prev) => (prev === reserveTime ? prev : reserveTime));
      setTitleLines((prev) => (prev === maxTitleLines ? prev : maxTitleLines));

      if (!reserveTime) return;
      const timeEl = timeElRef.current;
      const timeLineHeight = timeEl ? readLineHeight(timeEl) : timeLine;
      const timeBudget = available - usedTitleLines * titleLine - STACK_GAP;
      const maxTimeLines = linesThatFit(timeBudget, timeLineHeight);
      setTimeLines((prev) => (prev === maxTimeLines ? prev : maxTimeLines));
    };

    const onHoverChange = () => {
      requestAnimationFrame(measure);
    };

    measure();
    const weekBlock = findWeekBlock(root);
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => measure())
      : null;
    if (ro) {
      ro.observe(root);
      const block = root.closest(blockSelector);
      if (block) ro.observe(block);
      if (localTitleRef.current) ro.observe(localTitleRef.current);
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
  }, [title, timeText, blockSelector, showTime]);

  const tip = timeText ? `${title} · ${timeText}` : title;

  return (
    <div
      ref={rootRef}
      className="stacked-block-label"
      title={tip}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: STACK_GAP,
        flex: 1,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        ref={localTitleRef}
        className={titleClassName}
        style={{
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1.2,
          minWidth: 0,
          maxWidth: '100%',
          ...titleStyle,
          ...(titleMaxWidth != null ? { maxWidth: `${titleMaxWidth}px` } : {}),
          ...lineClampStyle(titleLines),
        }}
      >
        {title}
      </div>
      {timeText ? (
        <>
          <div
            ref={probeRef}
            aria-hidden
            style={{
              position: 'absolute',
              visibility: 'hidden',
              pointerEvents: 'none',
              fontSize: 11,
              fontWeight: 400,
              marginTop: 2,
              whiteSpace: 'nowrap',
              ...timeStyle,
            }}
          >
            {timeText}
          </div>
          {showTime ? (
            <div
              ref={timeElRef}
              className={timeClassName}
              style={{
                fontSize: 11,
                fontWeight: 400,
                opacity: 0.9,
                marginTop: 2,
                minWidth: 0,
                maxWidth: '100%',
                ...timeStyle,
                ...(timeMaxWidth != null ? { maxWidth: `${timeMaxWidth}px` } : {}),
                ...lineClampStyle(timeLines),
              }}
            >
              {timeText}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
