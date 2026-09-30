import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './CreateSheet.css';

function sheetMaxHeight(peek) {
  const height = window.visualViewport?.height ?? window.innerHeight;
  if (peek) return `${Math.max(180, Math.round(height * 0.5))}px`;
  return `${Math.max(180, height - 24)}px`;
}

const PEEK_FADE_MS = 180;

export default function CreateSheet({ open, onClose, children, peek = false }) {
  const sheetRef = useRef(null);
  const contentRef = useRef(null);
  const shownRef = useRef(open);
  const [phase, setPhase] = useState(open ? 'open' : 'closed');
  const [sheetMax, setSheetMax] = useState(() => (peek ? sheetMaxHeight(true) : '90dvh'));

  if (children) contentRef.current = children;

  const visible = peek ? (open || phase !== 'closed') : open;

  useEffect(() => {
    if (!open) return undefined;

    const update = () => setSheetMax(sheetMaxHeight(peek));

    update();
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKey);
    if (!peek) document.body.classList.add('create-sheet-open');

    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('keydown', onKey);
      if (!peek) document.body.classList.remove('create-sheet-open');
    };
  }, [open, onClose, peek]);

  useEffect(() => {
    if (!peek) return undefined;
    if (open) {
      shownRef.current = true;
      setPhase('open');
      return undefined;
    }
    if (!shownRef.current) return undefined;
    setPhase('closing');
    const id = window.setTimeout(() => {
      shownRef.current = false;
      contentRef.current = null;
      setPhase('closed');
    }, PEEK_FADE_MS);
    return () => window.clearTimeout(id);
  }, [open, peek]);

  useEffect(() => {
    if (!peek || !visible) return undefined;
    document.body.classList.add('create-sheet-open');
    return () => document.body.classList.remove('create-sheet-open');
  }, [peek, visible]);

  useLayoutEffect(() => {
    if (!open || !peek) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const title = sheet.querySelector('.taskform-day-title-text')?.textContent?.trim() || '';
    if (!title.startsWith('Event')) return;
    sheet.style.height = 'auto';
    const max = Number.parseFloat(sheetMax);
    const next = Number.isFinite(max) ? Math.min(sheet.scrollHeight, max) : sheet.scrollHeight;
    sheet.style.height = `${next}px`;
  }, [open, peek, sheetMax, children]);

  if (!visible) return null;

  const overlayClass = `create-sheet-overlay${peek ? ' is-peek' : ''}${peek && phase === 'closing' ? ' is-closing' : ''}`;
  const sheetClass = `create-sheet${peek ? ' is-peek' : ''}${peek && phase === 'closing' ? ' is-closing' : ''}`;

  return createPortal(
    <div
      className={overlayClass}
      onClick={() => {
        if (window.__aridiaSuppressCreateDismiss) {
          window.__aridiaSuppressCreateDismiss = false;
          return;
        }
        onClose?.();
      }}
      role="presentation"
    >
      <div
        ref={sheetRef}
        className={sheetClass}
        style={{ maxHeight: sheetMax }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal={peek ? 'false' : 'true'}
      >
        {peek ? (open ? children : contentRef.current) : children}
      </div>
    </div>,
    document.body
  );
}
