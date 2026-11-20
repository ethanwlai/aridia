import { createContext, createElement, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export const BASE_HOUR_HEIGHT = 50;
export const MIN_HOUR_HEIGHT = 25;
export const MAX_HOUR_HEIGHT = 150;

const WHEEL_SENSITIVITY = 0.002;
const WHEEL_GESTURE_IDLE_MS = 200;

const CalendarZoomContext = createContext(null);

function clampHourHeight(value) {
  return Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, value));
}

export function CalendarZoomProvider({ children }) {
  const [rowHeight, setRowHeightState] = useState(BASE_HOUR_HEIGHT);
  const rowHeightRef = useRef(BASE_HOUR_HEIGHT);

  const setRowHeight = useCallback((next) => {
    const clamped = clampHourHeight(next);
    rowHeightRef.current = clamped;
    setRowHeightState(clamped);
  }, []);

  const value = useMemo(
    () => ({ rowHeight, rowHeightRef, setRowHeight }),
    [rowHeight, setRowHeight]
  );

  return createElement(CalendarZoomContext.Provider, { value }, children);
}

function useCalendarZoom() {
  const ctx = useContext(CalendarZoomContext);
  if (!ctx) {
    throw new Error('useCalendarPinchZoom must be used within CalendarZoomProvider');
  }
  return ctx;
}

function normalizedDeltaY(event, el) {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * (el?.clientHeight || 800);
  return event.deltaY;
}

function touchDistance(touches) {
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

function touchMidY(touches) {
  return (touches[0].clientY + touches[1].clientY) / 2;
}

function mobilePinchFactor(factor) {
  if (!Number.isFinite(factor) || factor <= 0) return factor;
  if (!document.documentElement.classList.contains('layout-compact')) return factor;
  return factor ** 2;
}

export function useCalendarPinchZoom(scrollRef, { onPinchStartRef, ignoreScrollRef } = {}) {
  const { rowHeight, rowHeightRef, setRowHeight } = useCalendarZoom();
  const pendingRef = useRef(null);
  const pinchActiveRef = useRef(false);

  const queueZoom = useCallback((scrollEl, focalY, factor) => {
    if (!scrollEl || !Number.isFinite(factor) || factor <= 0 || factor === 1) return;
    let pending = pendingRef.current;
    if (!pending || pending.scrollEl !== scrollEl) {
      pending = {
        scrollEl,
        baseHeight: rowHeightRef.current,
        baseScroll: scrollEl.scrollTop,
        factor: 1,
        focalY,
        applied: rowHeightRef.current,
      };
      pendingRef.current = pending;
    }
    pending.factor *= factor;
    pending.focalY = focalY;
    const next = clampHourHeight(pending.baseHeight * pending.factor);
    pending.factor = pending.baseHeight > 0 ? next / pending.baseHeight : 1;
    pending.applied = next;
    if (Math.abs(next - pending.baseHeight) < 0.05) {
      pendingRef.current = null;
      return;
    }
    rowHeightRef.current = next;
    setRowHeight(next);
  }, [rowHeightRef, setRowHeight]);

  useLayoutEffect(() => {
    const pending = pendingRef.current;
    const el = scrollRef.current;
    if (!pending || !el || pending.scrollEl !== el) return;
    const ratio = pending.baseHeight > 0 ? pending.applied / pending.baseHeight : 1;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    const nextTop = (pending.baseScroll + pending.focalY) * ratio - pending.focalY;
    pendingRef.current = null;
    if (ignoreScrollRef) ignoreScrollRef.current = true;
    el.scrollTop = Math.max(0, Math.min(max, nextTop));
    if (ignoreScrollRef) ignoreScrollRef.current = false;
  }, [rowHeight, scrollRef, ignoreScrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    let pinchDist = 0;
    let gestureScale = 1;
    let lastGestureAt = 0;
    let wheelTimer = 0;
    let usingGesture = false;

    const focalInScroller = (clientY) => {
      const rect = el.getBoundingClientRect();
      return Math.min(Math.max(0, clientY - rect.top), rect.height);
    };

    const beginPinch = () => {
      if (pinchActiveRef.current) return;
      pinchActiveRef.current = true;
      onPinchStartRef?.current?.();
    };

    const endPinch = () => {
      pinchActiveRef.current = false;
      pinchDist = 0;
      gestureScale = 1;
    };

    const onWheel = (event) => {
      if (!event.ctrlKey || !el.contains(event.target)) return;
      if (Date.now() - lastGestureAt < 40) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      beginPinch();
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(endPinch, WHEEL_GESTURE_IDLE_MS);
      const delta = normalizedDeltaY(event, el);
      queueZoom(el, focalInScroller(event.clientY), Math.exp(-delta * WHEEL_SENSITIVITY));
    };

    const onTouchStart = (event) => {
      if (event.touches.length !== 2 || !el.contains(event.target)) return;
      pinchDist = touchDistance(event.touches);
      beginPinch();
    };

    const onTouchMove = (event) => {
      if (!pinchActiveRef.current || event.touches.length < 2) return;
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      if (usingGesture) return;
      const dist = touchDistance(event.touches);
      if (pinchDist > 0 && dist > 0) {
        queueZoom(el, focalInScroller(touchMidY(event.touches)), mobilePinchFactor(dist / pinchDist));
        pinchDist = dist;
      }
    };

    const onTouchEnd = (event) => {
      if (event.touches.length >= 2 || usingGesture) return;
      endPinch();
    };

    const onGestureStart = (event) => {
      if (!el.contains(event.target)) return;
      event.preventDefault();
      lastGestureAt = Date.now();
      usingGesture = true;
      gestureScale = event.scale || 1;
      beginPinch();
    };

    const onGestureChange = (event) => {
      if (!el.contains(event.target)) return;
      event.preventDefault();
      lastGestureAt = Date.now();
      const scale = event.scale || 1;
      const factor = gestureScale > 0 ? scale / gestureScale : 1;
      gestureScale = scale;
      const clientY = typeof event.clientY === 'number'
        ? event.clientY
        : el.getBoundingClientRect().top + el.clientHeight / 2;
      queueZoom(el, focalInScroller(clientY), mobilePinchFactor(factor));
    };

    const onGestureEnd = (event) => {
      if (!el.contains(event.target)) return;
      event.preventDefault();
      lastGestureAt = Date.now();
      usingGesture = false;
      endPinch();
    };

    document.addEventListener('wheel', onWheel, { capture: true, passive: false });
    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    el.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    document.addEventListener('gesturestart', onGestureStart, { capture: true, passive: false });
    document.addEventListener('gesturechange', onGestureChange, { capture: true, passive: false });
    document.addEventListener('gestureend', onGestureEnd, { capture: true, passive: false });

    return () => {
      window.clearTimeout(wheelTimer);
      document.removeEventListener('wheel', onWheel, { capture: true });
      el.removeEventListener('touchstart', onTouchStart, { capture: true });
      el.removeEventListener('touchmove', onTouchMove, { capture: true });
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('gesturestart', onGestureStart, { capture: true });
      document.removeEventListener('gesturechange', onGestureChange, { capture: true });
      document.removeEventListener('gestureend', onGestureEnd, { capture: true });
    };
  }, [scrollRef, queueZoom, onPinchStartRef, ignoreScrollRef]);

  return { rowHeight, rowHeightRef, pinchActiveRef };
}
