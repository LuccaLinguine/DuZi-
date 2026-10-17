import type { ReactNode } from 'react';

/** Shared screen chrome: a safe-area-aware sticky header over a scroll area. */
export function Screen({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header
        className="pt-safe shrink-0 border-b px-4"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-end justify-between gap-3 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] leading-tight font-semibold">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 truncate text-[13px]" style={{ color: 'var(--ink-3)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}

/** Centred empty state with an optional call to action. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="han mb-4 text-5xl" style={{ color: 'var(--ink-3)' }} aria-hidden="true">
        {icon}
      </div>
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <div className="mt-2 max-w-[42ch] text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
        {body}
      </div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Grouped settings-style list section. */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="px-4 py-3">
      {title && (
        <h2
          className="px-1 pb-2 text-[12px] font-semibold tracking-wide uppercase"
          style={{ color: 'var(--ink-3)' }}
        >
          {title}
        </h2>
      )}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        {children}
      </div>
    </section>
  );
}

export function Row({
  label,
  value,
  onClick,
  children,
}: {
  label: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const inner = (
    <>
      <div className="flex min-h-[44px] items-center justify-between gap-4 px-4 py-2">
        <span className="text-[15px]">{label}</span>
        {value !== undefined && (
          <span className="text-[15px]" style={{ color: 'var(--ink-3)' }}>
            {value}
          </span>
        )}
      </div>
      {children}
    </>
  );
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      {onClick ? (
        <button type="button" onClick={onClick} className="w-full text-left">
          {inner}
        </button>
      ) : (
        inner
      )}
    </div>
  );
}
