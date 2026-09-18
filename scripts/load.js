const target = process.env.TARGET_URL ?? "http://localhost:8080/api/work";
const total = Number(process.env.REQUESTS ?? 100);
const concurrency = Number(process.env.CONCURRENCY ?? 10);
let next = 0;
let succeeded = 0;
let failed = 0;
const latencies = [];

async function worker() {
  while (next < total) {
    next += 1;
    const started = performance.now();
    try {
      const response = await fetch(target);
      response.ok ? succeeded += 1 : failed += 1;
    } catch {
      failed += 1;
    } finally {
      latencies.push(performance.now() - started);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
latencies.sort((a, b) => a - b);
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))];
console.log(JSON.stringify({
  target,
  total,
  succeeded,
  failed,
  p50_ms: Math.round(percentile(0.50)),
  p95_ms: Math.round(percentile(0.95)),
  p99_ms: Math.round(percentile(0.99))
}, null, 2));
