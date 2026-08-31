import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './CreateSheet.css';

export default function CreateSheet({ open, onClose, children }) {
  const [sheetMax, setSheetMax] = useState('90dvh');

  useEffect(() => {
    if (!open) return undefined;

    const update = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      setSheetMax(`${Math.max(180, height - 24)}px`);
    };

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
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="create-sheet-overlay" onClick={onClose} role="presentation">
      <div
        className="create-sheet"
        style={{ maxHeight: sheetMax }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
