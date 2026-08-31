import { useEffect, useState } from 'react';

export const LAYOUT = {
  compact: 'compact',
  medium: 'medium',
  wide: 'wide',
};

export const COMPACT_MAX = 719;
export const MEDIUM_MAX = 1099;

export function getLayoutMode(width = typeof window === 'undefined' ? 1280 : window.innerWidth) {
  if (width <= COMPACT_MAX) return LAYOUT.compact;
  if (width <= MEDIUM_MAX) return LAYOUT.medium;
  return LAYOUT.wide;
}

function getCoarsePointer() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

export function useLayoutMode() {
  const [mode, setMode] = useState(() => getLayoutMode());
  const [isCoarse, setIsCoarse] = useState(() => getCoarsePointer());

  useEffect(() => {
    const update = () => {
      setMode(getLayoutMode());
      setIsCoarse(getCoarsePointer());
    };

    const compactMq = window.matchMedia(`(max-width: ${COMPACT_MAX}px)`);
    const mediumMq = window.matchMedia(`(max-width: ${MEDIUM_MAX}px)`);
    const coarseMq = window.matchMedia('(pointer: coarse)');

    compactMq.addEventListener('change', update);
    mediumMq.addEventListener('change', update);
    coarseMq.addEventListener('change', update);
    window.addEventListener('resize', update);
    update();

    return () => {
      compactMq.removeEventListener('change', update);
      mediumMq.removeEventListener('change', update);
      coarseMq.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.layout = mode;
    root.classList.toggle('layout-compact', mode === LAYOUT.compact);
    root.classList.toggle('layout-medium', mode === LAYOUT.medium);
    root.classList.toggle('layout-wide', mode === LAYOUT.wide);
    root.classList.toggle('layout-drawer', mode !== LAYOUT.wide);
    root.classList.toggle('pointer-coarse', isCoarse);
  }, [mode, isCoarse]);

  return {
    mode,
    isCompact: mode === LAYOUT.compact,
    isMedium: mode === LAYOUT.medium,
    isWide: mode === LAYOUT.wide,
    isDrawerChrome: mode !== LAYOUT.wide,
    isCoarse,
  };
}
