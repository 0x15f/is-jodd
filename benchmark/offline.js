import { performance } from "node:perf_hooks";
import { isOdd } from "../dist/index.js";
import { isEven } from "is-jeven";
import { inputs, inputLabel, numericOptions, summarize, pairedSummary, provenance, fmt, saveReport } from "./shared.js";

async function main() {
  const options = numericOptions({ rounds: 12, iterations: 1000, "warmup-iterations": 250 });
  if (options.rounds < 2 || options.rounds > 1000 || options.iterations < 1 || options.iterations > 1000000) {
    throw new Error("Use 2–1000 rounds and 1–1000000 iterations per round.");
  }
  const startedAt = new Date().toISOString();
  const environment = await provenance();
  const apiKey = "offline-benchmark-placeholder";
  const originalFetch = globalThis.fetch;
  const functions = {
    direct: (num) => isOdd(num, { apiKey }),
    baseline: async (num) => !(await isEven(num, { apiKey })),
  };
  const serializedResponse = (method, num) => method === "direct"
    ? JSON.stringify({ answers: { odd: { type: "noul", noul: num % 2 !== 0 ? 1 : 0 } } })
    : JSON.stringify({ answers: { category: { type: "choice", choice: num % 2 === 0 ? "true" : "false" } } });
  const requests = [];
  const pairs = [];
  console.log("Offline synthetic benchmark: mocked fetch, no network requests or API credentials. Timing is not evidence of real Jev API speed.");
  try {
    for (const num of inputs) {
      const record = { input: inputLabel(num) };
      for (const method of ["direct", "baseline"]) {
        const responseJson = serializedResponse(method, num);
        let captured;
        globalThis.fetch = async (url, request) => {
          // Capture only non-secret data. Headers are deliberately excluded.
          captured = { endpoint: String(url), method: request.method, requestBody: request.body, requestBodyBytes: Buffer.byteLength(request.body), mockResponseBodyBytes: Buffer.byteLength(responseJson) };
          return new Response(responseJson, { status: 200, headers: { "Content-Type": "application/json" } });
        };
        const result = await functions[method](num);
        if (result !== (num % 2 !== 0) || !captured) throw new Error(`Mock validation failed for ${method}(${inputLabel(num)}).`);
        record[method] = captured;
      }
      record.requestBodySavedBytes = record.baseline.requestBodyBytes - record.direct.requestBodyBytes;
      record.requestBodyReductionPercent = 100 * record.requestBodySavedBytes / record.baseline.requestBodyBytes;
      requests.push(record);
    }

    // Keep mock response selection and request inspection outside timed loops.
    // Each invocation still allocates and parses a fresh standard Response.
    async function batch(method, count) {
      const responseJson = serializedResponse(method, 17);
      globalThis.fetch = async () => new Response(responseJson, {
        status: 200, headers: { "Content-Type": "application/json" },
      });
      let trueCount = 0;
      const start = performance.now();
      for (let i = 0; i < count; i++) trueCount += Number(await functions[method](17));
      const durationMs = performance.now() - start;
      if (trueCount !== count) throw new Error(`Mock returned an unexpected parity answer for ${method}.`);
      return { durationMs, perCallMs: durationMs / count, correct: true };
    }

    for (const method of ["direct", "baseline"]) await batch(method, options["warmup-iterations"]);
    for (let round = 0; round < options.rounds; round++) {
      const order = round % 2 === 0 ? ["direct", "baseline"] : ["baseline", "direct"];
      const pair = { round, order };
      for (const method of order) pair[method] = await batch(method, options.iterations);
      pairs.push(pair);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  const methods = Object.fromEntries(["direct", "baseline"].map((method) => [method, {
    batchLatency: summarize(pairs.map((pair) => pair[method].durationMs)),
    perCallLatency: summarize(pairs.map((pair) => pair[method].perCallMs)),
  }]));
  const paired = pairedSummary(pairs);
  const entryBytesSaved = environment.baseline.runtimeEntryBytes - environment.direct.runtimeEntryBytes;
  const entryGzipBytesSaved = environment.baseline.runtimeEntryGzipBytes - environment.direct.runtimeEntryGzipBytes;
  const report = {
    kind: "offline-synthetic", startedAt, finishedAt: new Date().toISOString(), environment, options,
    methodology: "Actual package calls use mocked fetch returning fresh standard Response objects containing deterministic schema-matched answers. Full calls include validation, request serialization, promise/negation overhead, Response allocation, and JSON parsing. Timed batches repeatedly use input 17 and alternate first method. This is a synthetic local microbenchmark, not network/API performance. Request sizes are exact UTF-8 JSON body bytes, excluding headers/TLS. Gzip uses level 9 and measures the runtime entry alone, not npm tarballs.",
    entryBytesSaved, entryGzipBytesSaved, methods, paired, requests, pairs,
  };
  const sizeRows = requests.map(({ input, direct, baseline, requestBodySavedBytes, requestBodyReductionPercent }) =>
    `| ${input} | ${direct.requestBodyBytes} | ${baseline.requestBodyBytes} | ${requestBodySavedBytes} | ${fmt(requestBodyReductionPercent, 1)}% |`).join("\n");
  const runtimeRows = [["is-jodd (published dist)", environment.direct], ["is-jeven", environment.baseline]].map(([name, entry]) =>
    `| ${name} | ${entry.runtimeEntryBytes} | ${entry.runtimeEntryGzipBytes} |`).join("\n");
  const timingRows = [["is-jodd", methods.direct], ["!is-jeven", methods.baseline]].map(([name, method]) =>
    `| ${name} | ${fmt(method.perCallLatency.meanMs * 1000, 3)} | ${fmt(method.perCallLatency.medianMs * 1000, 3)} | ${fmt(method.perCallLatency.p95Ms * 1000, 3)} |`).join("\n");
  const markdown = `# Offline size and synthetic timing benchmark\n\nThese measurements use mocked fetch. They do not demonstrate faster real Jev requests.\n\nStarted: ${startedAt}. Node ${environment.node}, ${environment.platform}/${environment.arch}. is-jodd ${environment.direct.version}; is-jeven ${environment.baseline.version}.\n\n## Runtime entry sizes\n\n| Package | Entry bytes | Gzip bytes (level 9) |\n| --- | ---: | ---: |\n${runtimeRows}\n\nis-jodd development source: ${environment.direct.developmentSourceBytes} bytes (${environment.direct.developmentSourceGzipBytes} gzip bytes). Published entry savings against is-jeven: ${entryBytesSaved} bytes, or ${entryGzipBytesSaved} gzip bytes. These are module sizes, not complete npm tarball sizes. Minification contributes to the published entry difference.\n\n## Actual serialized request bodies\n\n| Integer | is-jodd bytes | is-jeven bytes | Bytes saved | Reduction |\n| --- | ---: | ---: | ---: | ---: |\n${sizeRows}\n\nSizes are UTF-8 JSON body bytes captured from actual function calls; headers, TLS overhead, and network compression are excluded. Mock response sizes are recorded in JSON and are synthetic examples, not measured API response sizes.\n\n## Synthetic local timings\n\n${options.rounds} rounds × ${options.iterations} calls per method, after ${options["warmup-iterations"]} warmup calls per method; first method alternates by round. Each call uses input 17, validates the input, serializes the request, awaits a fresh mocked Response, parses JSON, and interprets the answer. Baseline includes the caller's awaited negation.\n\n| Method | Mean µs/call | Median µs/call | p95 µs/call |\n| --- | ---: | ---: | ---: |\n${timingRows}\n\nThese statistics summarize per-batch average call times; p95 is not individual-call p95. Runtime warmup, garbage collection, Response construction, differing mock payloads, and local scheduling affect these numbers. They must not be advertised as actual network latency savings. Raw batch durations, request bodies, source hashes, and environment metadata are included in the accompanying JSON.\n`;
  const files = await saveReport("offline", report, markdown);
  console.log(`Entry size: is-jodd ${environment.direct.runtimeEntryBytes} bytes; is-jeven ${environment.baseline.runtimeEntryBytes} bytes (${entryBytesSaved} bytes saved).`);
  console.log(`Request body savings: ${Math.min(...requests.map(({ requestBodySavedBytes }) => requestBodySavedBytes))}–${Math.max(...requests.map(({ requestBodySavedBytes }) => requestBodySavedBytes))} bytes across ${requests.length} inputs.`);
  console.log(`Reports: ${files.json}\n${files.markdown}`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
