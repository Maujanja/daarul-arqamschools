/**
 * Normalize any Tanzanian number to the 255XXXXXXXXX form providers require.
 * Accepts +255..., 255..., 0..., or bare 7.../6... numbers.
 */
export function normalizeTzPhone(raw: string): string | null {
  let p = String(raw).trim().replace(/[^0-9+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0') && p.length === 10) p = '255' + p.slice(1);
  if ((p.startsWith('7') || p.startsWith('6')) && p.length === 9) p = '255' + p;
  return /^255\d{9}$/.test(p) ? p : null;
}

/** Split a pasted blob of numbers on commas, spaces, new lines, semicolons, pipes and slashes. */
export function splitPhoneBlob(text: string): string[] {
  return text
    .split(/[\s,;|/\\\n\r\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
