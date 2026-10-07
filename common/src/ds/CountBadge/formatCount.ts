/** Past this count a counter says "999+" */
const MAX_COUNT = 999

/** A counter as the sidebar shows it: the number, "999+" past 999 */
export function formatCount(count: number): string {
  return count > MAX_COUNT ? `${MAX_COUNT}+` : String(count)
}
