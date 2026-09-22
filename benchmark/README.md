# Reproduce the benchmarks

Use Node.js 24 or newer and install the pinned dependencies with `npm ci`. Run `npm run build` first: both comparison scripts import the actual release entry in `dist/index.js` and compare it with `is-jeven@1.0.0`.

```sh
npm run bench:offline
npm run bench
```

The live benchmark reads `TYPESAFE_API_KEY` from the environment or `.env`. Its default budget is **44 real API requests**: two warmup pairs and twenty measured pairs. Requests can consume API credits. It makes no retries and stops early on HTTP 401, 403, 429, or 529. Credentials and request headers are excluded from reports.

To explicitly choose a different sample size or timeout:

```sh
npm run bench -- --pairs 40 --warmup-pairs 2 --timeout-ms 15000
npm run bench:offline -- --rounds 12 --iterations 1000 --warmup-iterations 250
```

Every completed run writes a timestamped JSON report and Markdown report to `benchmark/results/`. JSON includes raw observations, input labels, method order, versions, source hashes, and the runtime environment. Preserve all runs used to evaluate a change; do not select only favorable results.

The live comparison uses the same integer for both methods and alternates which runs first. It includes positive and negative values, both signed zeros, and safe-integer boundaries. Reported accuracy comes from mathematical integer parity. Latencies summarize successful responses; the paired speed comparison includes only pairs where both answers are correct. The fixed-seed bootstrap describes variation in this small sample and does not account for network autocorrelation or guarantee future performance.

The offline comparison captures the exact UTF-8 JSON bodies from actual package calls, measures source and shipped module bytes plus gzip sizes, and times full package calls through a mocked `fetch`. Fresh standard `Response` objects preserve JSON parsing. Those timings include local mock overhead and are explicitly synthetic. Module gzip sizes are not npm tarball sizes; shorter requests do not prove lower real API latency.

The benchmark compares different request and answer schemas. It cannot isolate the cost of JavaScript's `!` operator from serialization, service behavior, and network effects.
