import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const inputs = [
  0, -0, 1, -1, 2, -2, 3, -3, 17, -17,
  100, 101, -100, -101, Number.MAX_SAFE_INTEGER,
  Number.MAX_SAFE_INTEGER - 1, Number.MIN_SAFE_INTEGER,
  Number.MIN_SAFE_INTEGER + 1, 2147483647, 2147483648,
];

export const inputLabel = (value) => Object.is(value, -0) ? "-0" : String(value);

export function numericOptions(defaults) {
  const result = { ...defaults };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]?.replace(/^--/, "");
    const value = Number(args[i + 1]);
    if (!args[i].startsWith("--") || !Object.hasOwn(result, name)
      || args[i + 1] === undefined || !Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Expected ${Object.keys(defaults).map((key) => `--${key} INTEGER`).join(" ")}.`);
    }
    result[name] = value;
  }
  return result;
}

export function percentile(sorted, probability) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
}

export function summarize(values) {
  if (!values.length) return { count: 0, meanMs: null, medianMs: null, p95Ms: null };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: values.length,
    meanMs: values.reduce((sum, value) => sum + value, 0) / values.length,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
  };
}

export function pairedSummary(pairs) {
  const eligible = pairs.filter(({ direct, baseline }) => direct.correct && baseline.correct);
  if (!eligible.length) return { count: 0, directWins: 0, ties: 0, meanSavingsMs: null, bootstrap95Ms: null };
  const savings = eligible.map(({ direct, baseline }) => baseline.durationMs - direct.durationMs);
  // Fixed seed makes the percentile bootstrap reproducible from saved raw data.
  let seed = 0x1a2b3c4d;
  function random() {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  }
  const bootstrap = [];
  if (savings.length > 1) {
    for (let resample = 0; resample < 10000; resample++) {
      let sum = 0;
      for (let i = 0; i < savings.length; i++) sum += savings[Math.floor(random() * savings.length)];
      bootstrap.push(sum / savings.length);
    }
    bootstrap.sort((a, b) => a - b);
  }
  return {
    count: eligible.length,
    directWins: savings.filter((value) => value > 0).length,
    ties: savings.filter((value) => value === 0).length,
    meanSavingsMs: savings.reduce((sum, value) => sum + value, 0) / savings.length,
    bootstrap95Ms: bootstrap.length ? [percentile(bootstrap, 0.025), percentile(bootstrap, 0.975)] : null,
    bootstrapResamples: bootstrap.length,
    bootstrapSeed: "0x1a2b3c4d",
  };
}

export async function provenance() {
  const directPath = join(root, "dist", "index.js");
  const baselinePath = fileURLToPath(import.meta.resolve("is-jeven"));
  async function describe(path, manifestPath) {
    const [source, manifest] = await Promise.all([
      readFile(path), readFile(manifestPath, "utf8"),
    ]);
    const { name, version } = JSON.parse(manifest);
    return {
      name, version,
      sourceSha256: createHash("sha256").update(source).digest("hex"),
      runtimeEntryBytes: source.length,
      runtimeEntryGzipBytes: gzipSync(source, { level: 9 }).length,
    };
  }
  const [direct, baseline, developmentSource] = await Promise.all([
    describe(directPath, join(root, "dist", "package.json")),
    describe(baselinePath, join(dirname(baselinePath), "package.json")),
    readFile(join(root, "index.js")),
  ]);
  direct.developmentSourceBytes = developmentSource.length;
  direct.developmentSourceGzipBytes = gzipSync(developmentSource, { level: 9 }).length;
  return { node: process.version, platform: process.platform, arch: process.arch, direct, baseline };
}

export const fmt = (value, digits = 2) => value === null || value === undefined ? "n/a" : value.toFixed(digits);

export async function saveReport(kind, report, markdown) {
  const directory = join(root, "benchmark", "results");
  await mkdir(directory, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, "-");
  const base = join(directory, `${kind}-${stamp}-${process.pid}`);
  await writeFile(`${base}.json`, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  await writeFile(`${base}.md`, markdown, { flag: "wx" });
  return { json: `${base}.json`, markdown: `${base}.md` };
}
