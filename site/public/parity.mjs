// Inspect the last decimal digit, preserving integers larger than Number can hold.
export function classifyInteger(input) {
  const raw = String(input).trim();
  if (!/^[+-]?\d+$/.test(raw)) return { valid: false, error: 'Use a whole integer, such as 7, 0, or -42. Leave out decimal points, commas, and exponents.' };
  if (raw.replace(/^[+-]/, '').length > 1000) return { valid: false, error: 'Try an integer with 1,000 digits or fewer.' };
  const digits = raw.replace(/^[+-]/, '').replace(/^0+(?=\d)/, '');
  if (digits.length > 1000) return { valid: false, error: 'Try an integer with 1,000 digits or fewer.' };
  const odd = /[13579]$/.test(digits);
  const negative = raw.startsWith('-') && digits !== '0';
  const normalized = `${negative ? '-' : ''}${digits}`;
  const number = BigInt(normalized);
  // Euclidean form n = 2q + r, with r always 0 or 1, also for negative n.
  const remainder = odd ? 1n : 0n;
  return { valid: true, odd, normalized, lastDigit: digits.at(-1), quotient: String((number - remainder) / 2n), remainder: Number(remainder) };
}
