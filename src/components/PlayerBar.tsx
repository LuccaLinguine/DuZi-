/** Sticky bottom player bar for the reader (spec section 5, "Audio"). */

export const SPEEDS = [0.6, 0.8, 1, 1.2] as const;

interface Props {
  playing: boolean;
  rate: number;
  canPrev: boolean;
  canNext: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRateChange: (rate: number) => void;
}

export function PlayerBar({ playing, rate, canPrev, canNext, onPlayPause, onPrev, onNext, onRateChange }: Props) {
  const cycleRate = () => {
    const i = SPEEDS.indexOf(rate as (typeof SPEEDS)[number]);
    const next = SPEEDS[(i === -1 ? 0 : i + 1) % SPEEDS.length]!;
    onRateChange(next);
  };

  return (
    <div
      className="pb-safe shrink-0 border-t px-3"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="flex items-center justify-center gap-2 py-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Previous sentence"
          className="tap flex items-center justify-center rounded-full disabled:opacity-30"
        >
          <SkipIcon direction="prev" />
        </button>

        <button
          type="button"
          onClick={onPlayPause}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next sentence"
          className="tap flex items-center justify-center rounded-full disabled:opacity-30"
        >
          <SkipIcon direction="next" />
        </button>

        <button
          type="button"
          onClick={cycleRate}
          aria-label="Playback speed"
          className="tap ml-2 min-w-[52px] rounded-lg border text-[13px] font-medium"
          style={{ borderColor: 'var(--border)' }}
        >
          {rate.toFixed(1)}×
        </button>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 5.5v13l11-6.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function SkipIcon({ direction }: { direction: 'prev' | 'next' }) {
  const flip = direction === 'prev' ? 'scale(-1,1)' : undefined;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style={{ transform: flip }} aria-hidden="true">
      <path d="M6 5h2v14H6zM10 5v14l9-7z" />
    </svg>
  );
}
