import { useLayoutEffect, useRef, useState } from 'react';

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
  titleRef: titleRefProp,
  blockSelector = '.calendar-time-block, .day-time-block',
}) {
  const rootRef = useRef(null);
  const localTitleRef = useRef(null);
  const probeRef = useRef(null);
  const [showTime, setShowTime] = useState(Boolean(timeText));

  const setTitleRef = (el) => {
    localTitleRef.current = el;
    if (typeof titleRefProp === 'function') titleRefProp(el);
    else if (titleRefProp) titleRefProp.current = el;
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    if (!timeText) {
      setShowTime(false);
      return undefined;
    }

    const measure = () => {
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

    measure();
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => measure())
      : null;
    if (ro) {
      ro.observe(root);
      const block = root.closest(blockSelector);
      if (block) ro.observe(block);
      if (localTitleRef.current) ro.observe(localTitleRef.current);
    }
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [title, timeText, blockSelector]);

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
        ref={setTitleRef}
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
              className={timeClassName}
              style={{
                fontSize: 11,
                fontWeight: 400,
                opacity: 0.9,
                marginTop: 2,
                whiteSpace: 'nowrap',
                ...timeStyle,
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
