# is-jodd 1.0.0 versus is-jeven 1.0.0

Measured September 22, 2026 UTC, on macOS arm64 with Node 24.7.0. The shipped runtime is smaller and its request body is shorter. The live package comparison did **not** establish a latency advantage.

## Size

| Measurement | is-jodd | is-jeven | Difference |
| --- | ---: | ---: | ---: |
| Published JavaScript entry | 861 B | 1,437 B | 40.1% smaller |
| Entry gzip, level 9 | 562 B | 748 B | 24.9% smaller |
| Request JSON for `3` | 108 B | 159 B | 32.1% smaller |
| Whole npm tarball | 2,870 B | 1,803 B | 59.2% larger |
| Whole unpacked npm package | 4,885 B | 3,557 B | 37.3% larger |

Module size is distinct from npm download size. Our complete archive includes the custom JODD-1T license, repository metadata, credit, and benchmark documentation; the upstream tarball omits a license file. Both have zero runtime dependencies. Entry minification contributes to the runtime reduction. At every tested safe integer, the actual serialized request body saved 51 bytes, excluding headers and TLS.

[Node 24 offline report](recorded/offline-2026-09-22T01-52-09-635Z-82804.md) · [raw observations](recorded/offline-2026-09-22T01-52-09-635Z-82804.json). An earlier exploratory [Node 22 run](recorded/offline-2026-09-22T01-50-45-359Z-79768.md) is also retained; its timings are synthetic and below the declared supported Node version.

## Live package comparison

20 paired inputs plus two warmup pairs: 44 actual API requests. Both packages use `jev-latest`; the resolved model is not exposed by their APIs. Each pair uses the same number, with alternating order. No retries, caching, or arithmetic shortcuts. Zero errors, timeouts, or answer disagreements; both packages returned all 20 measured answers correctly, including negative and safe-integer boundary inputs.

| Call | Mean | Median | p95 |
| --- | ---: | ---: | ---: |
| `await isOdd(n)` | 157.51 ms | 152.87 ms | 189.21 ms |
| `!(await isEven(n))` | 155.62 ms | 147.08 ms | 213.25 ms |

is-jodd won 9 of 20 pairs. Mean paired savings were **-1.90 ms**, with an exploratory 95% bootstrap interval of **[-18.09, 12.89] ms**. The interval crosses zero: this run does not support a general “faster” claim. Network timing varies, and a short bootstrap does not model correlated service noise.

[Full live report](recorded/live-2026-09-22T01-50-30-600Z-79214.md) · [all raw pairs, including warmups](recorded/live-2026-09-22T01-50-30-600Z-79214.json).

## Lower-level HTTP experiment

A separate six-pair transport pilot used the same compact Noul request for native `fetch` and `node:https` with keep-alive, pinned to `jev-1.13.0`. It used 12 measured calls plus four warmups. HTTPS averaged **141.30 ms** versus **176.20 ms** for fetch; medians were **139.53 ms** and **157.04 ms**. All answers were correct. This small pilot mixes transport, connection, and provider variance and does not establish a robust speedup.

The release retains native fetch to keep the runtime small and cancellation simple. The transport runner remains available for further investigation. [Raw transport observations](recorded/transport-2026-09-22T01-47-56-491Z.json).

## Reproduce

```sh
npm ci
npm run build
npm run bench:offline
npm run bench
npm run bench:transport
npm pack ./dist --json
```

Use Node 24+ and set `TYPESAFE_API_KEY` for live runs. See [methodology and options](README.md). Local mock timings are not API performance measurements. Neither removing `!` nor reducing JSON establishes an end-to-end speedup; the defensible benefits here are smaller executable code and request bodies.
