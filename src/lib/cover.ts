/**
 * Deterministic gradient for a story cover (spec section 7: "a generated
 * gradient + the story's first character... no image API"). Same id always
 * gives the same cover, so a card doesn't visibly change between renders.
 */

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export interface CoverGradient {
  from: string;
  to: string;
}

/** Hue-rotated pair of a warm accent colour, so every cover reads as "part of the same app". */
export function coverGradient(id: string): CoverGradient {
  const hue = hashString(id) % 360;
  return {
    from: `hsl(${hue} 55% 45%)`,
    to: `hsl(${(hue + 35) % 360} 60% 30%)`,
  };
}

/** The character a cover displays — the first Han character of the title. */
export function coverChar(titleZh: string): string {
  return [...titleZh].find((c) => /\p{Script=Han}/u.test(c)) ?? titleZh.charAt(0) ?? '读';
}
