/**
 * Marks a story as AI-written (spec extension: every story in the content
 * pipeline is authored by Claude Code — see CONTENT.md — and this makes that
 * visible in the app rather than leaving it implicit). Shown on the library
 * card and in the reader header; omitted entirely for non-AI content (a
 * learner's own pasted text, still mid-enrichment).
 */
export function AiBadge() {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}
      title="Written by Claude Code"
    >
      AI
    </span>
  );
}
