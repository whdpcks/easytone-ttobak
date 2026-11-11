/* 아래에서 올라오는 시트 (A 담당). B의 장 수 알림창도 이걸 쓰면 됩니다.
   <Sheet label="장 수" locked onDismiss={...}> ... </Sheet>
   locked: 바깥을 눌러도 닫히지 않음 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Sheet({ label, locked = false, onDismiss, children }) {
  useEffect(() => {
    if (locked || !onDismiss) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked, onDismiss]);

  return createPortal(
    <div
      className="dim"
      onClick={(e) => { if (e.target === e.currentTarget && !locked) onDismiss?.(); }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
