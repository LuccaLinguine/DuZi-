/** Plain inline SVG bar chart — spec section 9 asks for no chart library. */
import type { DailyChars } from '../lib/stats.ts';

export function BarChart({ data }: { data: DailyChars[] }) {
  const max = Math.max(1, ...data.map((d) => d.chars));
  const w = 320;
  const h = 100;
  const gap = 2;
  const barW = data.length > 0 ? (w - gap * (data.length - 1)) / data.length : 0;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Characters read per day, last 30 days">
      {data.map((d, i) => {
        const barH = (d.chars / max) * (h - 4);
        const x = i * (barW + gap);
        const y = h - barH;
        return (
          <rect
            key={d.date}
            x={x}
            y={y}
            width={Math.max(0.5, barW)}
            height={Math.max(d.chars > 0 ? 1 : 0, barH)}
            rx={1}
            fill={d.chars > 0 ? 'var(--accent)' : 'var(--border)'}
          >
            <title>
              {d.date}: {d.chars} characters
            </title>
          </rect>
        );
      })}
    </svg>
  );
}
