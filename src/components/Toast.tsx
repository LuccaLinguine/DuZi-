import { useEffect } from 'react';

/** Brief non-blocking message, e.g. "5 new stories" after a content sync. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto max-w-[90%] rounded-full px-4 py-2 text-[14px] shadow-lg"
        style={{ background: 'var(--ink)', color: 'var(--bg)' }}
      >
        {message}
      </div>
    </div>
  );
}
