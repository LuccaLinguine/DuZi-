/** A themed confirm prompt, so destructive-ish in-app choices do not fall back to window.confirm. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="presentation"
      onClick={onCancel}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="pb-safe relative w-full max-w-sm rounded-t-2xl border p-5 sm:rounded-2xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h2 id="confirm-title" className="text-[17px] font-semibold">
          {title}
        </h2>
        {body && (
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {body}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="tap flex-1 rounded-lg border text-[15px] font-medium"
            style={{ borderColor: 'var(--border)' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="tap flex-1 rounded-lg text-[15px] font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
