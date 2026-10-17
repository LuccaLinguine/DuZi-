/** Bottom tab bar. Sits above the home indicator via the safe-area inset. */

export const TABS = ['library', 'requests', 'review', 'stats', 'settings'] as const;
export type Tab = (typeof TABS)[number];

const LABELS: Record<Tab, string> = {
  library: 'Library',
  requests: 'Requests',
  review: 'Review',
  stats: 'Stats',
  settings: 'Settings',
};

/** Inline SVG rather than an icon dependency; 1.5px strokes read well at 24px. */
const ICONS: Record<Tab, React.ReactNode> = {
  library: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14z" />
    </>
  ),
  requests: (
    <>
      <path d="M5 6h14M5 12h14M5 18h8" />
      <path d="M17 15.5v5M14.5 18h5" />
    </>
  ),
  review: (
    <>
      <rect x="3" y="6" width="14" height="12" rx="2" />
      <path d="M7 10h6M7 14h4" />
      <path d="M20 9v8a2 2 0 0 1-2 2" />
    </>
  ),
  stats: (
    <>
      <path d="M4 20V10M10 20V5M16 20v-7M22 20H3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
};

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  /** Cards due today, shown as a badge on Review. */
  dueCount?: number;
}

export function TabBar({ active, onChange, dueCount = 0 }: Props) {
  return (
    <nav
      className="pb-safe shrink-0 border-t"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <ul className="flex">
        {TABS.map((tab) => {
          const isActive = tab === active;
          return (
            <li key={tab} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(tab)}
                aria-current={isActive ? 'page' : undefined}
                className="tap relative flex w-full flex-col items-center gap-1 py-2"
                style={{ color: isActive ? 'var(--accent)' : 'var(--ink-3)' }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {ICONS[tab]}
                </svg>
                <span className="text-[11px] leading-none">{LABELS[tab]}</span>
                {tab === 'review' && dueCount > 0 && (
                  <span
                    className="absolute top-1 right-[calc(50%-20px)] min-w-[18px] rounded-full px-1 text-[10px] leading-[18px] font-semibold"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {dueCount > 99 ? '99+' : dueCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
