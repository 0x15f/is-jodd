import assert from 'node:assert/strict';
import { test } from 'node:test';
const { isOdd } = await import(process.env.IS_JODD_ENTRY || '../index.js');

const apiKey = 'test-key';

function verdict(noul, type = 'noul') {
  return Response.json({ answers: { odd: { type, noul } } });
}

function setEnvironmentKey(t, value) {
  const original = process.env.TYPESAFE_API_KEY;
  t.after(() => {
    if (original === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = original;
  });
  if (value === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = value;
}

test('safe integers make exactly one Jev noul request with a string state', async (t) => {
  const controller = new AbortController();
  const fetch = t.mock.method(globalThis, 'fetch', async () => verdict(1));
  const values = [
    -Number.MAX_SAFE_INTEGER, -3, -2, -1, -0, 0, 1, 2, 3,
    Number.MAX_SAFE_INTEGER,
  ];

  for (const value of values) {
    assert.equal(await isOdd(value, { apiKey, signal: controller.signal }), true);
  }

  assert.equal(fetch.mock.callCount(), values.length);
  for (const [index, call] of fetch.mock.calls.entries()) {
    const [url, options] = call.arguments;
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(options.method, 'POST');
    assert.deepEqual(options.headers, {
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
    });
    assert.deepEqual(JSON.parse(options.body), {
      model: 'jev-latest',
      state: String(values[index]),
      questions: { odd: { type: 'noul', instructions: 'Is this integer odd?' } },
    });
    assert.equal(options.signal, controller.signal);
  }
});

test('invalid input rejects before fetching', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => verdict(1));
  for (const value of [
    '3', 3n, null, undefined, true, {}, [], 1.5, -0.5, NaN,
    Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1,
    Number.MIN_SAFE_INTEGER - 1,
  ]) {
    await assert.rejects(isOdd(value, { apiKey }), {
      name: 'TypeError', message: 'Expected a safe integer.',
    });
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('an omitted API key uses the environment, and an explicit key overrides it', async (t) => {
  setEnvironmentKey(t, 'environment-key');
  const fetch = t.mock.method(globalThis, 'fetch', async () => verdict(1));

  await isOdd(3);
  await isOdd(3, { apiKey: undefined });
  await isOdd(3, { apiKey: 'explicit-key' });

  assert.deepEqual(fetch.mock.calls.map(({ arguments: [, options] }) => options.headers.Authorization), [
    'Bearer environment-key', 'Bearer environment-key', 'Bearer explicit-key',
  ]);
});

test('missing or blank credentials reject before fetching', async (t) => {
  setEnvironmentKey(t, undefined);
  const fetch = t.mock.method(globalThis, 'fetch', async () => verdict(1));
  const expected = { name: 'TypeError', message: 'Set TYPESAFE_API_KEY or pass options.apiKey.' };

  await assert.rejects(isOdd(3), expected);
  process.env.TYPESAFE_API_KEY = ' \t\n ';
  await assert.rejects(isOdd(3), expected);
  process.env.TYPESAFE_API_KEY = 'valid-environment-key';
  for (const key of ['', ' ', '\t\n', 123, {}, false]) {
    await assert.rejects(isOdd(3, { apiKey: key }), expected);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('only a noul probability strictly above 0.5 returns true', async (t) => {
  const probabilities = [0, 0.25, 0.5, 0.5000000000000001, 0.75, 1];
  let next = 0;
  t.mock.method(globalThis, 'fetch', async () => verdict(probabilities[next++]));

  for (const probability of probabilities) {
    // An even input deliberately receives both verdicts: Jev determines the result.
    assert.equal(await isOdd(2, { apiKey }), probability > 0.5);
  }
});

test('malformed or out-of-range verdicts reject', async (t) => {
  const payloads = [
    null, {}, [], { answers: null }, { answers: {} },
    { answers: { odd: null } },
    ...[undefined, null, '0.9', true, {}, [], -0.01, 1.01, NaN, Infinity, -Infinity]
      .map((noul) => ({ answers: { odd: { type: 'noul', noul } } })),
    ...[undefined, null, 'boolean', 'text', 'NOUL', 1]
      .map((type) => ({ answers: { odd: { type, noul: 1 } } })),
  ];
  let next = 0;
  // A direct json() stub also exercises non-finite values unavailable in JSON text.
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => payloads[next++],
  }));

  for (const _payload of payloads) {
    await assert.rejects(isOdd(3, { apiKey }), {
      message: 'TypeSafe AI returned an invalid oddness verdict.',
    });
  }
});

test('HTTP errors cancel the response body and reject with the status without parsing', async (t) => {
  let status = 401;
  const json = t.mock.fn(async () => {
    throw new Error('The error body must not be parsed.');
  });
  const cancel = t.mock.fn(async () => {});
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status, json, body: { cancel } }));

  for (status of [400, 401, 429, 500, 503]) {
    await assert.rejects(isOdd(3, { apiKey }), {
      message: `TypeSafe AI request failed (${status}).`,
    });
  }
  assert.equal(cancel.mock.callCount(), 5);
  assert.equal(json.mock.callCount(), 0);
});

test('body cancellation failures do not hide the HTTP error', async (t) => {
  const cancel = t.mock.fn(async () => { throw new Error('Cleanup failed'); });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503, body: { cancel } }));
  await assert.rejects(isOdd(3, { apiKey }), {
    message: 'TypeSafe AI request failed (503).',
  });
  assert.equal(cancel.mock.callCount(), 1);
});

test('HTTP errors with no response body preserve their status', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  await assert.rejects(isOdd(3, { apiKey }), {
    message: 'TypeSafe AI request failed (503).',
  });
});

test('a successful response containing non-JSON data rejects', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('not JSON'));
  await assert.rejects(isOdd(3, { apiKey }), SyntaxError);
});

test('network failures propagate unchanged', async (t) => {
  const failure = new TypeError('Network unavailable');
  t.mock.method(globalThis, 'fetch', async () => { throw failure; });
  await assert.rejects(isOdd(3, { apiKey }), (error) => error === failure);
});

test('cancellation propagates the caller signal and reason without mutating options', async (t) => {
  const controller = new AbortController();
  const reason = new Error('Caller cancelled');
  const options = Object.freeze({ apiKey, signal: controller.signal });
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, request) => {
    assert.equal(request.signal, controller.signal);
    request.signal.throwIfAborted();
    return new Promise((_resolve, reject) => {
      request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true });
    });
  });

  const pending = isOdd(3, options);
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  await assert.rejects(isOdd(3, options), (error) => error === reason);
  assert.equal(fetch.mock.callCount(), 2);
  assert.deepEqual(options, { apiKey, signal: controller.signal });
});
