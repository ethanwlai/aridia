import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const EDGE_PX = 24;
const SLOP_PX = 10;
const OPEN_PROGRESS = 0.4;
const FLICK_PX_PER_MS = 0.4;
const BLOCKED_START = '.create-sheet, .create-sheet-overlay, .day-detail-panel--sheet';
const INTERACTIVE = 'button, a, input, textarea, select, [role="slider"], .motivation-slider';
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
  drawer.style.transform = `translate3d(${offset - width}px, 0, 0)`;
  return true;
}

function eventElement(target) {
  if (target instanceof Element) return target;
  if (target?.parentElement instanceof Element) return target.parentElement;
  return null;
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
        const drawer = overlayRef.current?.querySelector('.app-drawer');
        if (drawer && drawer.offsetWidth > 0) {
          session.width = drawer.offsetWidth;
          session.pendingOffset = clampOffset(session.lastDx || 0, session.fromOpen, session.width);
        }
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

    const releaseCapture = (session) => {
      if (!session?.pointerCaptured) return;
      try {
        document.documentElement.releasePointerCapture(session.id);
      } catch {
        /* Pointer capture was already released. */
      }
    };

    const finish = (id, clientX, cancelled, event) => {
      const session = sessionRef.current;
      if (!session || id !== session.id) return;
      releaseCapture(session);
      sessionRef.current = null;

      if (!session.captured) return;

      suppressOverlayClickRef.current = true;
      if (event?.cancelable) event.preventDefault();

      const dx = clientX - session.startX;
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

    const arm = (target, clientX, clientY, timeStamp, kind, id) => {
      const element = eventElement(target);
      if (!element || element.closest(BLOCKED_START)) return;

      const fromOpen = isOpenRef.current;
      const onMenuButton = !fromOpen && Boolean(element.closest(MENU_BUTTON));
      if (element.closest(INTERACTIVE) && !onMenuButton) return;
      if (!fromOpen) {
        if (!onMenuButton && clientX > EDGE_PX) return;
      } else if (!overlayRef.current?.contains(element)) {
        return;
      }

      suppressOverlayClickRef.current = false;
      sessionRef.current = {
        id,
        kind,
        startX: clientX,
        startY: clientY,
        lastX: clientX,
        lastT: timeStamp,
        lastDx: 0,
        velocity: 0,
        fromOpen,
        captured: false,
        previewed: false,
        pointerCaptured: false,
        width: drawerWidth(overlayRef.current),
        pendingOffset: null,
      };
    };

    const track = (session, clientX, clientY, timeStamp) => {
      const dx = clientX - session.startX;
      const dy = clientY - session.startY;

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

      const dt = timeStamp - session.lastT;
      if (dt > 0 && dt < 80) {
        session.velocity = (clientX - session.lastX) / dt;
      }
      session.lastX = clientX;
      session.lastT = timeStamp;
      session.lastDx = dx;

      if (!session.captured || prefersReducedMotion()) return;
      const offset = clampOffset(dx, session.fromOpen, session.width);
      session.pendingOffset = offset;
      applyDrag(overlayRef.current, offset, session.width);
    };

    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse' || !event.isPrimary || sessionRef.current) return;
      arm(event.target, event.clientX, event.clientY, event.timeStamp, 'pointer', event.pointerId);
    };

    const onPointerMove = (event) => {
      const session = sessionRef.current;
      if (!session || session.kind !== 'pointer' || event.pointerId !== session.id) return;
      track(session, event.clientX, event.clientY, event.timeStamp);
      const current = sessionRef.current;
      if (!current?.captured || current.pointerCaptured) return;
      try {
        document.documentElement.setPointerCapture(event.pointerId);
        current.pointerCaptured = true;
      } catch {
        current.pointerCaptured = false;
      }
    };

    const onPointerUp = (event) => {
      const session = sessionRef.current;
      if (!session || session.kind !== 'pointer' || event.pointerId !== session.id) return;
      finish(session.id, event.clientX, false, event);
    };

    const onPointerCancel = (event) => {
      const session = sessionRef.current;
      if (!session || session.kind !== 'pointer' || event.pointerId !== session.id) return;
      finish(session.id, event.clientX, true, event);
    };

    const onTouchStart = (event) => {
      if (sessionRef.current || event.touches.length !== 1) return;
      const point = event.touches[0];
      arm(event.target, point.clientX, point.clientY, event.timeStamp, 'touch', point.identifier);
    };

    const onTouchMove = (event) => {
      const session = sessionRef.current;
      if (!session) return;
      if (session.kind === 'pointer') {
        if (!session.captured || !event.cancelable) return;
        const point = event.touches[0];
        if (!point) return;
        const dx = point.clientX - session.startX;
        const dy = point.clientY - session.startY;
        if (Math.abs(dx) > Math.abs(dy)) event.preventDefault();
        return;
      }
      const point = touchById(event, session.id);
      if (!point) return;
      track(session, point.clientX, point.clientY, event.timeStamp);
      if (sessionRef.current?.captured && event.cancelable) event.preventDefault();
    };

    const onTouchEnd = (event) => {
      const session = sessionRef.current;
      if (!session || session.kind !== 'touch') return;
      const point = touchById(event, session.id);
      if (!point) return;
      finish(session.id, point.clientX, false, event);
    };

    const onTouchCancel = (event) => {
      const session = sessionRef.current;
      if (!session || session.kind !== 'touch') return;
      const point = touchById(event, session.id);
      if (!point) return;
      finish(session.id, point.clientX, true, event);
    };

    const onClickCapture = (event) => {
      if (!suppressOverlayClickRef.current) return;
      suppressOverlayClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    window.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchCancel);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerCancel, true);
      document.removeEventListener('touchstart', onTouchStart, { capture: true });
      window.removeEventListener('touchmove', onTouchMove, { capture: true });
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [enabled, overlayRef]);

  return suppressOverlayClickRef;
}
