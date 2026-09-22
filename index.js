/**
 * Ask Jev whether a safe integer is odd.
 * @param {number} num
 * @param {import('./index.d.ts').IsOddOptions} [options]
 * @returns {Promise<boolean>}
 */
export async function isOdd(num, options = {}) {
  if (!Number.isSafeInteger(num)) throw new TypeError('Expected a safe integer.');
  const key = options.apiKey ?? globalThis.process?.env?.TYPESAFE_API_KEY;
  if (typeof key !== 'string' || !key.trim()) {
    throw new TypeError('Set TYPESAFE_API_KEY or pass options.apiKey.');
  }
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'jev-latest',
      state: String(num),
      questions: { odd: { type: 'noul', instructions: 'Is this integer odd?' } },
    }),
    signal: options.signal,
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`TypeSafe AI request failed (${res.status}).`);
  }
  const answer = (await res.json())?.answers?.odd;
  const p = answer?.noul;
  if (answer?.type !== 'noul' || typeof p !== 'number' || !(p >= 0 && p <= 1)) {
    throw new Error('TypeSafe AI returned an invalid oddness verdict.');
  }
  return p > 0.5;
}
