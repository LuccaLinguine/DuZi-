/** Swipe-left-to-delete wrapper for a list item (spec section 7). */
import { useRef, useState } from 'react';

const THRESHOLD = -72;
const MAX_DRAG = -96;

export function SwipeToDelete({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startDragX = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    startDragX.current = dragX;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = e.clientX - startX.current;
    const next = Math.max(MAX_DRAG, Math.min(0, startDragX.current + delta));
    setDragX(next);
  };

  const onPointerUp = () => {
    setDragging(false);
    if (dragX <= THRESHOLD) {
      onDelete();
    }
    setDragX(0);
  };

  const revealed = Math.min(1, dragX / MAX_DRAG);

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute inset-y-0 right-0 flex items-center px-4 text-[13px] font-medium text-white"
        style={{ background: 'var(--accent)', opacity: revealed }}
        aria-hidden="true"
      >
        Delete
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 200ms ease-out',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
