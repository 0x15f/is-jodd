import { performance } from "node:perf_hooks";
import { isOdd } from "../dist/index.js";
import { isEven } from "is-jeven";
import { inputs, inputLabel, numericOptions, summarize, pairedSummary, provenance, fmt, saveReport } from "./shared.js";

async function main() {
  const options = numericOptions({ pairs: 20, "warmup-pairs": 2, "timeout-ms": 15000 });
  if (options.pairs < 2 || options.pairs > 1000 || options["warmup-pairs"] > 100 || options["timeout-ms"] < 1) {
    throw new Error("Use 2–1000 pairs, 0–100 warmup pairs, and a positive timeout in milliseconds.");
  }
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("Set TYPESAFE_API_KEY in your environment or .env before running npm run bench. This benchmark makes real, potentially billed API requests.");
  }
  const startedAt = new Date().toISOString();
  const environment = await provenance();
  const requestBudget = 2 * (options.pairs + options["warmup-pairs"]);
  console.log(`Live Jev benchmark: ${requestBudget} total requests, including ${2 * options["warmup-pairs"]} warmup requests. No retries.`);
  const runs = [];
  let attemptedRequests = 0;
  let stoppingReason = null;
  const functions = {
    direct: (num, requestOptions) => isOdd(num, requestOptions),
    baseline: async (num, requestOptions) => !(await isEven(num, requestOptions)),
  };

  async function measure(method, num) {
    attemptedRequests++;
    const signal = AbortSignal.timeout(options["timeout-ms"]);
    const start = performance.now();
    try {
      const value = await functions[method](num, { apiKey, signal });
      const durationMs = performance.now() - start;
      return { durationMs, value, correct: value === (num % 2 !== 0), status: "success" };
    } catch (error) {
      const durationMs = performance.now() - start;
      const timedOut = signal.aborted || error?.name === "TimeoutError";
      // Only expose sanitized errors; never persist credentials or request headers.
      const message = String(error?.message ?? error).split(apiKey).join("[REDACTED]")
        .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
      const blockingStatus = message.match(/\b(401|403|429|529)\b/)?.[1];
      return { durationMs, value: null, correct: false, status: timedOut ? "timeout" : "error", blockingHttpStatus: blockingStatus ? Number(blockingStatus) : null, error: { name: error?.name ?? "Error", message } };
    }
  }

  const measured = [];
  for (let index = 0; index < options["warmup-pairs"] + options.pairs; index++) {
    const warmup = index < options["warmup-pairs"];
    const phaseIndex = warmup ? index : index - options["warmup-pairs"];
    const num = inputs[phaseIndex % inputs.length];
    const order = phaseIndex % 2 === 0 ? ["direct", "baseline"] : ["baseline", "direct"];
    const pair = { index: phaseIndex, phase: warmup ? "warmup" : "measured", input: inputLabel(num), expectedOdd: num % 2 !== 0, order };
    for (const method of order) {
      if (stoppingReason) {
        pair[method] = { durationMs: null, value: null, correct: false, status: "skipped" };
        continue;
      }
      pair[method] = await measure(method, num);
      if (pair[method].blockingHttpStatus) stoppingReason = `Stopped after HTTP ${pair[method].blockingHttpStatus} to avoid repeating an authorization, quota, or capacity failure.`;
    }
    runs.push(pair);
    if (!warmup) measured.push(pair);
    console.log(`${pair.phase} ${phaseIndex + 1}/${warmup ? options["warmup-pairs"] : options.pairs}: ${pair.input}; is-jodd ${fmt(pair.direct.durationMs)} ms (${pair.direct.status}${pair.direct.status === "success" ? pair.direct.correct ? ", correct" : ", INCORRECT" : ""}); !is-jeven ${fmt(pair.baseline.durationMs)} ms (${pair.baseline.status}${pair.baseline.status === "success" ? pair.baseline.correct ? ", correct" : ", INCORRECT" : ""})`);
    if (stoppingReason) break;
  }

  const methods = {};
  for (const method of ["direct", "baseline"]) {
    const results = measured.map((pair) => pair[method]);
    const successful = results.filter(({ status }) => status === "success");
    methods[method] = {
      attempts: results.filter(({ status }) => status !== "skipped").length,
      skipped: results.filter(({ status }) => status === "skipped").length,
      correct: results.filter(({ correct }) => correct).length,
      incorrect: successful.filter(({ correct }) => !correct).length,
      errors: results.filter(({ status }) => status === "error").length,
      timeouts: results.filter(({ status }) => status === "timeout").length,
      successfulLatency: summarize(successful.map(({ durationMs }) => durationMs)),
    };
  }
  const paired = pairedSummary(measured);
  const disagreements = measured.filter(({ direct, baseline }) => direct.status === "success" && baseline.status === "success" && direct.value !== baseline.value).length;
  const report = {
    kind: "live", startedAt, finishedAt: new Date().toISOString(), environment,
    configuredModel: "jev-latest", resolvedModel: null,
    endpoint: "https://api.typesafe.ai/v1/systemone",
    options, requestBudget, attemptedRequests, stoppingReason,
    methodology: "Sequential matched input pairs; alternated first method per pair; warmups excluded from summaries but retained in raw results; no retries. Paired comparison includes only pairs where both methods return the mathematically correct answer. Percentile bootstrap is exploratory and does not model network autocorrelation.",
    methods, disagreements, paired, runs,
  };
  const interval = paired.bootstrap95Ms ? `[${fmt(paired.bootstrap95Ms[0])}, ${fmt(paired.bootstrap95Ms[1])}] ms` : "n/a";
  const rows = [["is-jodd", methods.direct], ["!is-jeven", methods.baseline]].map(([name, method]) =>
    `| ${name} | ${method.attempts} | ${method.correct} | ${method.incorrect} | ${method.errors} | ${method.timeouts} | ${fmt(method.successfulLatency.meanMs)} | ${fmt(method.successfulLatency.medianMs)} | ${fmt(method.successfulLatency.p95Ms)} |`).join("\n");
  const noFailures = !stoppingReason && Object.values(methods).every(({ incorrect, errors, timeouts, skipped }) => incorrect + errors + timeouts + skipped === 0);
  const conclusion = paired.bootstrap95Ms && noFailures
    ? paired.bootstrap95Ms[0] > 0 ? "is-jodd was faster in this run's paired comparison. This run does not establish universal speed superiority."
      : paired.bootstrap95Ms[1] < 0 ? "!is-jeven was faster in this run's paired comparison."
      : "This run does not establish a consistent speed advantage: the paired interval includes zero."
    : "Accuracy failures, request errors, timeouts, or too few valid pairs prevent a clean speed conclusion.";
  const markdown = `# Live Jev benchmark\n\n${conclusion}${stoppingReason ? ` ${stoppingReason}` : ""}\n\nStarted: ${startedAt}. Node ${environment.node}, ${environment.platform}/${environment.arch}.\n\nis-jodd ${environment.direct.version}; is-jeven ${environment.baseline.version}. Both request the alias \`jev-latest\`; the resolved server model is not available through these package APIs.\n\n${attemptedRequests} attempted requests (budget ${requestBudget}), including ${runs.filter(({ phase }) => phase === "warmup").reduce((count, pair) => count + Number(pair.direct.status !== "skipped") + Number(pair.baseline.status !== "skipped"), 0)} warmup requests; ${options["timeout-ms"]} ms timeout per request; no retries. Inputs and call order are stored in the accompanying JSON.\n\n| Method | Attempts | Correct | Incorrect | Errors | Timeouts | Mean ms | Median ms | p95 ms |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${rows}\n\nLatency columns include successful responses; correctness is measured independently against integer parity. There were ${disagreements} answer disagreements.\n\nAmong ${paired.count} pairs where both answers were correct, is-jodd won ${paired.directWins} pairs (${paired.ties} ties). Mean paired savings (!is-jeven minus is-jodd): ${fmt(paired.meanSavingsMs)} ms. Exploratory 95% percentile-bootstrap interval: ${interval}, from ${paired.bootstrapResamples ?? 0} resamples with a fixed seed.\n\nPairs run sequentially with alternating first method. Network conditions, service load, caching, the model alias, and correlated timing noise may affect results. A short run and this bootstrap interval are not proof of a general performance claim. Request and output schemas differ between packages, so any difference cannot be attributed solely to JavaScript negation.\n`;
  const files = await saveReport("live", report, markdown);
  console.log(`\n${conclusion}\nReports: ${files.json}\n${files.markdown}`);
  if (!noFailures) process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
