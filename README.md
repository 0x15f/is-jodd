# is-jodd

Is it odd? Ask Jev. The odd companion to [is-jeven](https://www.npmjs.com/package/is-jeven).

```sh
npm install is-jodd
export TYPESAFE_API_KEY="your-key"
```

```js
import { isOdd } from 'is-jodd';

await isOdd(3); // true (probably)
await isOdd(2, { signal: AbortSignal.timeout(5000) });
```

Node 24+. Accepts safe integers, including zero and negatives. Pass `apiKey` to override the environment. Each call asks TypeSafe's Jev model; a probability above 0.5 means `true`. Invalid inputs, API errors, and malformed answers reject.

Zero runtime dependencies. An 861-byte runtime (40% smaller than is-jeven 1.0.0) and 51 fewer request-body bytes. A 20-pair live test found no consistent latency win. Always await before negating `isEven`.

[Benchmarks and raw results](https://github.com/0x15f/is-jodd/blob/main/benchmark/RESULTS.md).

This is a joke package. AI can get math wrong. For reliable parity, use `n % 2 !== 0`.

Licensed under [JODD-1T](LICENSE): **$1,000,000,000,000 USD** and written permission before use. No startup discount. Custom restrictive terms; see the license.

Name by [@aurelienbobenrieth](https://github.com/aurelienbobenrieth). By Jake Casto.
