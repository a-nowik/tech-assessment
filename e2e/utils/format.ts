/** Formats a variance the way the page shows it: -0.1, 0, +0.1 */
export function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** Formats a share count the way the page shows it: 6,666 */
export function formatShares(value: number): string {
  return value.toLocaleString('en-US');
}
