const target = process.env.TARGET_URL ?? "http://localhost:8080/api/work";
const total = Number(process.env.REQUESTS ?? 100);
const concurrency = Number(process.env.CONCURRENCY ?? 10);
let next = 0;
let succeeded = 0;
let failed = 0;
let networkErrors = 0;
const statusCodes = {};
const latencies = [];
const runStarted = performance.now();

async function worker() {
  while (next < total) {
    next += 1;
    const started = performance.now();
    try {
      const response = await fetch(target);
      statusCodes[response.status] = (statusCodes[response.status] ?? 0) + 1;
      response.ok ? succeeded += 1 : failed += 1;
    } catch {
      failed += 1;
      networkErrors += 1;
    } finally {
      latencies.push(performance.now() - started);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
const durationMs = performance.now() - runStarted;
latencies.sort((a, b) => a - b);
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))];
console.log(JSON.stringify({
  target,
  total,
  succeeded,
  failed,
  status_codes: statusCodes,
  network_errors: networkErrors,
  requests_per_second: Math.round(total / (durationMs / 1000)),
  p50_ms: Math.round(percentile(0.50)),
  p95_ms: Math.round(percentile(0.95)),
  p99_ms: Math.round(percentile(0.99))
}, null, 2));
