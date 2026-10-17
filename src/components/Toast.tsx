import { useEffect } from 'react';

interface Props {
  message: string;
  onDone: () => void;
  /** When set, the toast stays until tapped rather than auto-dismissing — for anything the user must act on, not just notice. */
  action?: { label: string; onClick: () => void };
  /** Stack position: 'low' is the default (just above the tab bar); 'high' sits above a 'low' toast so both stay readable at once. */
  position?: 'low' | 'high';
}

/** Brief message, e.g. "5 new stories" after a content sync — or, with `action`, a prompt the user needs to act on. */
export function Toast({ message, onDone, action, position = 'low' }: Props) {
  useEffect(() => {
    if (action) return;
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [message, onDone, action]);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 ${position === 'high' ? 'bottom-32' : 'bottom-20'}`}
    >
      <div
        role="status"
        className="pointer-events-auto flex max-w-[90%] items-center gap-3 rounded-full px-4 py-2 text-[14px] shadow-lg"
        style={{ background: 'var(--ink)', color: 'var(--bg)' }}
      >
        <span>{message}</span>
        {action && (
          <button type="button" onClick={action.onClick} className="shrink-0 font-semibold" style={{ color: 'var(--accent)' }}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
