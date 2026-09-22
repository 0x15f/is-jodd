import https from 'node:https';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import os from 'node:os';

// Exploratory network experiment; these results do not establish a package speedup.
const endpoint = 'https://api.typesafe.ai/v1/systemone';
const options = { pairs: 6, warmup: 2, timeout: 10000 };
const limits = { pairs: 6, warmup: 2, timeout: 120000 };
const usage = `Usage: node --env-file=.env benchmark/transport.js [options]

Compares native fetch with node:https and a reusable keep-alive agent.
Each pair sends the same request through both transports, in alternating order.
Defaults: 12 measured requests plus 4 warmup requests. No retries.

  --pairs N    Measured pairs, 1–6 (default: 6)
  --warmup N   Warmup pairs, 1–2 (default: 2)
  --timeout N  Timeout per request in ms, 1–120000 (default: 10000)
  --help       Show this help without contacting the API

Requires TYPESAFE_API_KEY. Uses jev-1.13.0, or TYPESAFE_MODEL if set.
Raw responses and timings are saved in benchmark/results/transport-*.json.
This small sample includes network and provider variance.`;

function parseOptions(args) {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--help') return false;
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !Object.hasOwn(options, key)) {
      throw new Error(`Unknown option: ${args[i]}`);
    }
    const value = args[++i];
    if (!value || !/^[1-9]\d*$/.test(value)) {
      throw new Error(`--${key} must be an explicit positive integer.`);
    }
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number > limits[key]) {
      throw new Error(`--${key} must be between 1 and ${limits[key]}.`);
    }
    options[key] = number;
  }
  return true;
}

function summarize(samples) {
  const timings = samples.filter((sample) => sample.ok).map((sample) => sample.durationMs).sort((a, b) => a - b);
  const middle = Math.floor(timings.length / 2);
  return {
    attempted: samples.length,
    successful: timings.length,
    errors: samples.filter((sample) => !sample.ok).length,
    correctAnswers: samples.filter((sample) => sample.correct === true).length,
    meanMs: timings.length ? timings.reduce((sum, value) => sum + value, 0) / timings.length : null,
    medianMs: timings.length ? (timings.length % 2 ? timings[middle] : (timings[middle - 1] + timings[middle]) / 2) : null,
    minMs: timings.length ? timings[0] : null,
    maxMs: timings.length ? timings.at(-1) : null,
  };
}

async function main() {
  if (!parseOptions(process.argv.slice(2))) {
    console.log(usage);
    return;
  }

  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new Error('TYPESAFE_API_KEY is required; no API requests were sent.');
  const model = process.env.TYPESAFE_MODEL || 'jev-1.13.0';
  const agent = new https.Agent({ keepAlive: true, maxSockets: 1, maxFreeSockets: 1 });
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Encoding': 'identity',
    'User-Agent': 'is-jodd-transport-benchmark',
  };
  const redact = (value) => value.replaceAll(apiKey, '[REDACTED]');
  const samples = [];
  const startedAt = new Date().toISOString();

  async function nativeFetch(body, signal) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { ...headers, 'Content-Length': String(Buffer.byteLength(body)) },
      body,
      signal,
      redirect: 'error',
    });
    return { status: response.status, text: await response.text() };
  }

  function nativeHttps(body, signal) {
    return new Promise((resolve, reject) => {
      const request = https.request(endpoint, {
        method: 'POST',
        headers: { ...headers, 'Content-Length': String(Buffer.byteLength(body)) },
        agent,
        signal,
      }, (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { text += chunk; });
        response.on('error', reject);
        response.on('aborted', () => reject(new Error('Response body was interrupted.')));
        response.on('end', () => resolve({
          status: response.statusCode,
          text,
          reusedSocket: request.reusedSocket,
        }));
      });
      request.on('error', reject);
      request.end(body);
    });
  }

  const transports = [
    { name: 'fetch', run: nativeFetch },
    { name: 'https-keepalive', run: nativeHttps },
  ];

  async function measure(transport, body, number, phase, pair, position) {
    const sample = {
      phase,
      pair,
      position,
      transport: transport.name,
      number,
      requestBody: JSON.parse(body),
      expectedOdd: Math.abs(number % 2) === 1,
      ok: false,
    };
    const start = performance.now();
    try {
      const result = await transport.run(body, AbortSignal.timeout(options.timeout));
      sample.durationMs = performance.now() - start;
      sample.status = result.status;
      if (result.reusedSocket !== undefined) sample.reusedSocket = result.reusedSocket;
      // Both transports finish reading the body before the timer stops.
      sample.rawBody = redact(result.text);
      try {
        sample.response = JSON.parse(sample.rawBody);
      } catch {
        throw new Error(`HTTP ${sample.status}: response was not valid JSON.`);
      }
      if (sample.status < 200 || sample.status >= 300) {
        throw new Error(`HTTP ${sample.status}`);
      }
      const answer = sample.response?.answers?.is_odd;
      if (answer?.type !== 'noul' || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) {
        throw new Error('Response did not contain a valid answers.is_odd Noul probability.');
      }
      sample.probability = answer.noul;
      sample.actualOdd = answer.noul > 0.5;
      sample.correct = sample.actualOdd === sample.expectedOdd;
      sample.ok = true;
    } catch (error) {
      sample.durationMs ??= performance.now() - start;
      sample.error = { name: error.name, message: redact(String(error.message)) };
    }
    samples.push(sample);
    console.log(`${phase} ${pair + 1}, ${transport.name}: ${sample.durationMs.toFixed(1)} ms${sample.ok ? '' : ` (${sample.error.message})`}`);
    return sample;
  }

  let stoppedReason = null;
  console.log(`Transport experiment: up to ${options.pairs * 2} measured + ${options.warmup * 2} warmup API calls, no retries.`);
  try {
    phases: for (const [phase, count] of [['warmup', options.warmup], ['measured', options.pairs]]) {
      for (let pair = 0; pair < count; pair += 1) {
        const number = [41, 42, 99, 100, 1001, 1002][pair];
        const body = JSON.stringify({
          model,
          state: String(number),
          questions: { is_odd: { type: 'noul', instructions: 'Is this number odd?' } },
        });
        const order = pair % 2 === 0 ? transports : [...transports].reverse();
        for (const [position, transport] of order.entries()) {
          const sample = await measure(transport, body, number, phase, pair, position);
          if ([401, 403, 429, 529].includes(sample.status)) {
            stoppedReason = `Stopped after HTTP ${sample.status}; no retries or further requests.`;
            break phases;
          }
        }
      }
    }
  } finally {
    agent.destroy();
  }

  const measured = samples.filter((sample) => sample.phase === 'measured');
  const summary = Object.fromEntries(transports.map(({ name }) => [
    name, summarize(measured.filter((sample) => sample.transport === name)),
  ]));
  const completedPairs = [];
  for (let pair = 0; pair < options.pairs; pair += 1) {
    const a = measured.find((sample) => sample.pair === pair && sample.transport === 'fetch' && sample.ok);
    const b = measured.find((sample) => sample.pair === pair && sample.transport === 'https-keepalive' && sample.ok);
    if (a && b) completedPairs.push({ pair, fetchMinusHttpsMs: a.durationMs - b.durationMs });
  }
  const result = {
    experiment: 'Native fetch versus native HTTPS with keep-alive',
    startedAt,
    finishedAt: new Date().toISOString(),
    environment: { node: process.version, platform: process.platform, arch: process.arch, release: os.release() },
    endpoint,
    model,
    options,
    methodology: 'Sequential paired calls; identical body per pair; alternating order, exactly balanced for even pair counts; both response bodies fully read; no retries; warmup excluded from summary.',
    limitation: 'Exploratory small sample includes network, connection, and provider variance. It does not establish a package speedup or isolate Boolean negation cost.',
    stoppedReason,
    summary,
    completedPairs,
    samples,
  };
  const directory = new URL('./results/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const output = new URL(`transport-${startedAt.replaceAll(':', '-').replaceAll('.', '-')}.json`, directory);
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  console.table(summary);
  console.log(result.limitation);
  console.log(`Raw results: ${fileURLToPath(output)}`);
  if (stoppedReason) console.error(stoppedReason);
  if (stoppedReason || samples.some((sample) => !sample.ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
