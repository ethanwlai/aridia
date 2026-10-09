import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const EDGE_PX = 24;
const SLOP_PX = 10;
const OPEN_PROGRESS = 0.4;
const FLICK_PX_PER_MS = 0.4;
const BLOCKED_START = '.create-sheet, .create-sheet-overlay, .day-detail-panel--sheet';
const INTERACTIVE = 'button, a, input, textarea, select, [role="slider"]';
const MENU_BUTTON = '.calendar-menu-btn';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function drawerWidth(overlay) {
  const drawer = overlay?.querySelector('.app-drawer');
  if (drawer && drawer.offsetWidth > 0) return drawer.offsetWidth;
  return Math.min(360, window.innerWidth - 40);
}

function clampOffset(dx, fromOpen, width) {
  const raw = fromOpen ? width + dx : dx;
  return Math.max(0, Math.min(width, raw));
}

function applyDrag(overlay, offset, width) {
  const drawer = overlay?.querySelector('.app-drawer');
  if (!overlay || !drawer || width <= 0) return false;
  const progress = offset / width;
  overlay.style.transition = 'none';
  drawer.style.transition = 'none';
  overlay.style.opacity = String(progress);
  drawer.style.transform = `translateX(${offset - width}px)`;
  return true;
}

function touchById(event, id) {
  const lists = [event.changedTouches, event.touches];
  for (const list of lists) {
    if (!list) continue;
    for (const touch of list) {
      if (touch.identifier === id) return touch;
    }
  }
  return null;
}

export default function useDrawerEdgeSwipe({
  enabled,
  isOpen,
  drawerMounted,
  overlayRef,
  onPreview,
  onCommitOpen,
  onCommitClose,
  onRevert,
}) {
  const suppressOverlayClickRef = useRef(false);
  const sessionRef = useRef(null);
  const settleRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  const onPreviewRef = useRef(onPreview);
  const onCommitOpenRef = useRef(onCommitOpen);
  const onCommitCloseRef = useRef(onCommitClose);
  const onRevertRef = useRef(onRevert);
  const [gestureActive, setGestureActive] = useState(false);

  isOpenRef.current = isOpen;
  onPreviewRef.current = onPreview;
  onCommitOpenRef.current = onCommitOpen;
  onCommitCloseRef.current = onCommitClose;
  onRevertRef.current = onRevert;

  useLayoutEffect(() => {
    const session = sessionRef.current;
    if (gestureActive) {
      if (session?.captured && session.pendingOffset != null) {
        applyDrag(overlayRef.current, session.pendingOffset, session.width);
      }
      return;
    }
    if (!settleRef.current) return;
    settleRef.current = false;
    const overlay = overlayRef.current;
    const drawer = overlay?.querySelector('.app-drawer');
    if (!overlay || !drawer) return;
    overlay.style.transition = '';
    drawer.style.transition = '';
    void drawer.offsetWidth;
    requestAnimationFrame(() => {
      if (!overlay.isConnected) return;
      overlay.style.opacity = '';
      drawer.style.transform = '';
    });
  }, [gestureActive, drawerMounted, overlayRef]);

  useEffect(() => {
    if (!enabled) return undefined;

    const finish = (point, cancelled, event) => {
      const session = sessionRef.current;
      if (!session || !point || point.identifier !== session.id) return;
      sessionRef.current = null;

      if (!session.captured) return;

      suppressOverlayClickRef.current = true;
      if (event?.cancelable) event.preventDefault();

      const dx = point.clientX - session.startX;
      const width = session.width;
      const offset = clampOffset(Number.isFinite(dx) ? dx : 0, session.fromOpen, width);
      const progress = width > 0 ? offset / width : 0;
      const flickOpen = session.velocity > FLICK_PX_PER_MS;
      const flickClose = session.velocity < -FLICK_PX_PER_MS;
      const open = cancelled
        ? session.fromOpen
        : flickOpen || (!flickClose && progress > OPEN_PROGRESS);
      const reduced = prefersReducedMotion();

      if (!reduced && overlayRef.current) {
        applyDrag(overlayRef.current, offset, width);
        settleRef.current = true;
      }

      setGestureActive(false);

      if (open) {
        if (session.fromOpen) onRevertRef.current();
        else onCommitOpenRef.current();
      } else if (session.fromOpen || session.previewed) {
        onCommitCloseRef.current();
      }
    };

    const onStart = (event) => {
      if (sessionRef.current || event.touches.length !== 1) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(BLOCKED_START)) return;

      const fromOpen = isOpenRef.current;
      const onMenuButton = !fromOpen && Boolean(target.closest(MENU_BUTTON));
      if (target.closest(INTERACTIVE) && !onMenuButton) return;

      const point = event.touches[0];
      if (!fromOpen) {
        if (!onMenuButton && point.clientX > EDGE_PX) return;
      } else if (!overlayRef.current?.contains(target)) {
        return;
      }

      suppressOverlayClickRef.current = false;
      sessionRef.current = {
        id: point.identifier,
        startX: point.clientX,
        startY: point.clientY,
        lastX: point.clientX,
        lastT: event.timeStamp,
        velocity: 0,
        fromOpen,
        captured: false,
        previewed: false,
        width: drawerWidth(overlayRef.current),
        pendingOffset: null,
      };
    };

    const onMove = (event) => {
      const session = sessionRef.current;
      if (!session) return;
      const point = touchById(event, session.id);
      if (!point) return;
      const dx = point.clientX - session.startX;
      const dy = point.clientY - session.startY;

      if (!session.captured) {
        if (Math.hypot(dx, dy) < SLOP_PX) return;
        const horizontal = Math.abs(dx) > Math.abs(dy);
        const correctDir = session.fromOpen ? dx < 0 : dx > 0;
        if (!horizontal || !correctDir) {
          sessionRef.current = null;
          return;
        }
        session.captured = true;
        session.width = drawerWidth(overlayRef.current);
        if (!prefersReducedMotion()) {
          session.previewed = true;
          onPreviewRef.current();
          setGestureActive(true);
        }
      }

      const dt = event.timeStamp - session.lastT;
      if (dt > 0 && dt < 80) {
        session.velocity = (point.clientX - session.lastX) / dt;
      }
      session.lastX = point.clientX;
      session.lastT = event.timeStamp;

      if (!session.captured || prefersReducedMotion()) return;
      if (event.cancelable) event.preventDefault();

      const offset = clampOffset(dx, session.fromOpen, session.width);
      session.pendingOffset = offset;
      applyDrag(overlayRef.current, offset, session.width);
    };

    const onEnd = (event) => {
      const session = sessionRef.current;
      if (!session) return;
      finish(touchById(event, session.id), false, event);
    };

    const onCancel = (event) => {
      const session = sessionRef.current;
      if (!session) return;
      finish(touchById(event, session.id), true, event);
    };

    const onClickCapture = (event) => {
      if (!suppressOverlayClickRef.current) return;
      suppressOverlayClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: false });
    document.addEventListener('touchcancel', onCancel);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [enabled, overlayRef]);

  return suppressOverlayClickRef;
}
