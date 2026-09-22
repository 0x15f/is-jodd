# Development

Use Node 24 or newer (`nvm use`), then `npm ci`. The package has no runtime dependencies; `is-jeven`, TypeScript, and esbuild are development tools only.

`npm run build` runs the mocked API tests and strict type checks, minifies the runtime into `dist/`, copies its declarations, README, and license, and runs the behavior tests against the build. The source checkout is marked private. Only `dist/` is publishable, with a minimal manifest and an explicit file allowlist.

## Live benchmarks

Copy `.env.example` to `.env` and set `TYPESAFE_API_KEY` using a key from the [TypeSafe console](https://console.typesafe.ai/). Both `.env` and `.npmrc` are ignored. Tests never call the API. Benchmark commands do, and use your API credits.

```sh
npm run build
npm run bench:offline
npm run bench
npm run bench:transport
```

The main benchmark compares the built `isOdd(n)` with `!(await isEven(n))` from pinned `is-jeven@1.0.0`. Its default is 20 measured pairs plus two warmup pairs: 44 requests total. It alternates which implementation runs first, checks answers against integer parity, records errors and timeouts, and saves all samples under `benchmark/results/`. No results are discarded or silently retried. Both packages request `jev-latest`, so the alias can change between dates; their public APIs do not expose the resolved server model.

The offline benchmark intercepts `fetch` to measure actual request sizes, runtime source sizes, and local wrapper work. Its synthetic timings do not measure Jev or network latency. The transport experiment holds the request body fixed and compares native `fetch` against `node:https` with a private keep-alive agent. It defaults to 16 requests including warmups and pins `jev-1.13.0`.

## API choices

[TypeSafe's Noul question](https://docs.typesafe.ai/primitives/noul) returns a probability, so `is-jodd` asks about oddness directly and returns true above 0.5 (a tie returns false). This omits the choice criteria and per-choice response distribution used by `is-jeven`. Input validation, API-key validation, status errors, response validation, and cancellation remain in the minified runtime. Non-success response bodies are cancelled to release resources.

One request per call, no caching, no retries, no arithmetic fallback. Pass `signal: AbortSignal.timeout(5000)` for a deadline. The model is an imperfect classifier: separate odd/even questions need not produce complementary answers. A shorter payload does not establish a general latency guarantee, and local Boolean negation is negligible beside an API call.

## Release

```sh
npm run build
npm pack ./dist --dry-run
npm login
npm whoami
npm publish ./dist --access public
```

If login used the ignored local `.npmrc`, npm automatically reads it from this repository. Check the authenticated username before publishing. Inspect the dry-run file list: only `index.js`, `index.d.ts`, `package.json`, `README.md`, and `LICENSE` belong in the tarball. Bump the root version and rebuild before any subsequent release.
