import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './CreateSheet.css';

function sheetMaxHeight(peek) {
  const height = window.visualViewport?.height ?? window.innerHeight;
  if (peek) return `${Math.max(180, Math.round(height * 0.5))}px`;
  return `${Math.max(180, height - 24)}px`;
}

export default function CreateSheet({ open, onClose, children, peek = false }) {
  const sheetRef = useRef(null);
  const [sheetMax, setSheetMax] = useState(() => (peek ? sheetMaxHeight(true) : '90dvh'));

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
    document.body.classList.add('create-sheet-open');

    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('create-sheet-open');
    };
  }, [open, onClose, peek]);

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

  if (!open) return null;

  return createPortal(
    <div
      className={`create-sheet-overlay${peek ? ' is-peek' : ''}`}
      onClick={peek ? undefined : onClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        className={`create-sheet${peek ? ' is-peek' : ''}`}
        style={{ maxHeight: sheetMax }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal={peek ? 'false' : 'true'}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
