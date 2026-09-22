import { isOdd, type IsOddOptions } from 'is-jodd';

const options: IsOddOptions = {
  apiKey: 'test-key',
  signal: new AbortController().signal,
};
const result: Promise<boolean> = isOdd(3);
const configured: Promise<boolean> = isOdd(3, options);
const emptyOptions: Promise<boolean> = isOdd(3, {});
const environmentKey: Promise<boolean> = isOdd(3, { signal: AbortSignal.timeout(1_000) });
void [result, configured, emptyOptions, environmentKey];

// @ts-expect-error The input is required.
isOdd();
// @ts-expect-error Numeric strings are not accepted.
isOdd('3');
// @ts-expect-error BigInts are not accepted.
isOdd(3n);
// @ts-expect-error Null is not a number.
isOdd(null);
// @ts-expect-error The key must be a string.
isOdd(3, { apiKey: 123 });
// @ts-expect-error Pass an AbortSignal, not its controller.
isOdd(3, { signal: new AbortController() });
// @ts-expect-error Unknown configuration is not part of the public API.
isOdd(3, { model: 'jev-latest' });
// @ts-expect-error The result is asynchronous.
const synchronous: boolean = isOdd(3);
// @ts-expect-error The awaited result is a boolean.
const textResult: Promise<string> = isOdd(3);
void [synchronous, textResult];
