import { useLayoutEffect, useRef, useState } from 'react';
import { availableTextWidth, findWeekBlock } from '../utils/blockTextGutter';

/**
 * Stacked title + optional time for taller calendar blocks.
 * Hides the time range entirely when it would be vertically clipped.
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

    if (!timeText) {
      setShowTime(false);
      applyGutters();
    }

    const measure = () => {
      applyGutters();
      if (!timeText) return;

      const block = root.closest(blockSelector);
      const titleEl = localTitleRef.current;
      const probe = probeRef.current;
      if (!block || !titleEl || !probe) {
        setShowTime(Boolean(timeText));
        return;
      }

      const blockRect = block.getBoundingClientRect();
      const titleRect = titleEl.getBoundingClientRect();
      const timeHeight = probe.offsetHeight + 2; // + gap/margin above time
      // Space from title bottom to block bottom must fit the full time line.
      const room = blockRect.bottom - titleRect.bottom;
      setShowTime(room + 0.5 >= timeHeight);
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
        gap: 2,
        flex: 1,
        width: 'auto',
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
          whiteSpace: 'normal',
          overflow: 'hidden',
          textOverflow: 'clip',
          minWidth: 0,
          maxWidth: '100%',
          wordBreak: 'break-word',
          ...titleStyle,
          ...(titleMaxWidth != null ? { maxWidth: `${titleMaxWidth}px` } : {}),
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
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                ...timeStyle,
                ...(timeMaxWidth != null ? { maxWidth: `${timeMaxWidth}px` } : {}),
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
