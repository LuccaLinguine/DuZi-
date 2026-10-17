import { coverGradient, coverChar } from '../lib/cover.ts';

export function Cover({ id, titleZh, size = 64 }: { id: string; titleZh: string; size?: number }) {
  const { from, to } = coverGradient(id);
  return (
    <div
      className="han-serif flex shrink-0 items-center justify-center rounded-lg text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: size * 0.52,
      }}
      aria-hidden="true"
    >
      {coverChar(titleZh)}
    </div>
  );
}
