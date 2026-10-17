/**
 * The Requests screen's quick-pick topic chips (spec section 4). Topic is
 * still free text everywhere it's stored — these are just a fast start, not
 * an enum — so a batch's `topic` field and a request's `topic` field can both
 * be anything, and matching (lib/request-match.ts) treats them loosely.
 */
export const TOPIC_CHIPS = [
  'Daily life',
  'Food',
  'Travel',
  'Work',
  'Romance',
  'Mystery',
  'Funny',
  'History',
  'Culture',
  'Folk tale',
  'News-style',
] as const;
