import http from "node:http";
import { fileURLToPath } from "node:url";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createApp(options = {}) {
  const startedAt = Date.now();
  const startupDelayMs = Number(options.startupDelayMs ?? process.env.STARTUP_DELAY_MS ?? 0);
  const failureRate = Number(options.failureRate ?? process.env.FAILURE_RATE ?? 0);
  const latencyMs = Number(options.latencyMs ?? process.env.LATENCY_MS ?? 0);
  const version = options.version ?? process.env.APP_VERSION ?? "dev";
  let acceptingTraffic = true;
  let requestsTotal = 0;
  let failuresTotal = 0;
  let inFlight = 0;
  const httpRequests = new Map();
  const requestDurations = new Map();
  const durationBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 1, 2.5, 5];

  const hasStarted = () => Date.now() - startedAt >= startupDelayMs;
  const isReady = () => acceptingTraffic && hasStarted();

  // Use a fixed route set so arbitrary URLs cannot create unbounded metric labels.
  const metricRoute = (pathname) => {
    if (["/", "/api/work", "/healthz", "/readyz", "/metrics"].includes(pathname)) {
      return pathname;
    }
    return "other";
  };

  const labels = (values) => Object.entries(values)
    .map(([name, value]) => `${name}="${String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`)
    .join(",");

  const observeRequest = ({ method, route, statusCode, durationSeconds }) => {
    const requestKey = JSON.stringify([method, route, statusCode]);
    const requestMetric = httpRequests.get(requestKey) ?? { method, route, statusCode, count: 0 };
    requestMetric.count += 1;
    httpRequests.set(requestKey, requestMetric);

    const durationKey = JSON.stringify([method, route, statusCode]);
    const durationMetric = requestDurations.get(durationKey) ?? {
      method,
      route,
      statusCode,
      count: 0,
      sum: 0,
      buckets: durationBuckets.map(() => 0)
    };
    durationMetric.count += 1;
    durationMetric.sum += durationSeconds;
    durationBuckets.forEach((upperBound, index) => {
      if (durationSeconds <= upperBound) durationMetric.buckets[index] += 1;
    });
    requestDurations.set(durationKey, durationMetric);
  };

  const sendJson = (response, statusCode, body) => {
    response.writeHead(statusCode, { "content-type": "application/json" });
    response.end(`${JSON.stringify(body)}\n`);
  };

  const handler = async (request, response) => {
    const requestStartedAt = process.hrtime.bigint();
    requestsTotal += 1;
    inFlight += 1;

    const url = new URL(request.url, "http://localhost");
    const route = metricRoute(url.pathname);

    response.on("finish", () => {
      inFlight -= 1;
      observeRequest({
        method: request.method ?? "UNKNOWN",
        route,
        statusCode: response.statusCode,
        durationSeconds: Number(process.hrtime.bigint() - requestStartedAt) / 1_000_000_000
      });
    });

    if (url.pathname === "/healthz") {
      return sendJson(response, 200, { status: "alive" });
    }

    if (url.pathname === "/readyz") {
      return sendJson(response, isReady() ? 200 : 503, {
        status: isReady() ? "ready" : "not-ready"
      });
    }

    if (url.pathname === "/metrics") {
      const lines = [
        "# HELP reliability_requests_total Total HTTP requests received.",
        "# TYPE reliability_requests_total counter",
        `reliability_requests_total ${requestsTotal}`,
        "# HELP reliability_failures_total Total intentionally failed work requests.",
        "# TYPE reliability_failures_total counter",
        `reliability_failures_total ${failuresTotal}`,
        "# HELP reliability_in_flight_requests Current in-flight HTTP requests.",
        "# TYPE reliability_in_flight_requests gauge",
        `reliability_in_flight_requests ${inFlight}`,
        "# HELP reliability_http_requests_total Completed HTTP requests by method, route, and status code.",
        "# TYPE reliability_http_requests_total counter"
      ];
      for (const metric of [...httpRequests.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))) {
        lines.push(`reliability_http_requests_total{${labels({ method: metric.method, route: metric.route, status_code: metric.statusCode })}} ${metric.count}`);
      }
      lines.push(
        "# HELP reliability_http_request_duration_seconds HTTP request duration by method and route.",
        "# TYPE reliability_http_request_duration_seconds histogram"
      );
      for (const metric of [...requestDurations.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))) {
        durationBuckets.forEach((upperBound, index) => {
          lines.push(`reliability_http_request_duration_seconds_bucket{${labels({ method: metric.method, route: metric.route, status_code: metric.statusCode, le: upperBound })}} ${metric.buckets[index]}`);
        });
        lines.push(`reliability_http_request_duration_seconds_bucket{${labels({ method: metric.method, route: metric.route, status_code: metric.statusCode, le: "+Inf" })}} ${metric.count}`);
        lines.push(`reliability_http_request_duration_seconds_sum{${labels({ method: metric.method, route: metric.route, status_code: metric.statusCode })}} ${metric.sum}`);
        lines.push(`reliability_http_request_duration_seconds_count{${labels({ method: metric.method, route: metric.route, status_code: metric.statusCode })}} ${metric.count}`);
      }
      lines.push("");
      response.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
      return response.end(lines.join("\n"));
    }

    if (url.pathname === "/api/work") {
      if (!hasStarted()) {
        return sendJson(response, 503, { error: "instance is starting" });
      }

      if (latencyMs > 0) await sleep(latencyMs);

      if (Math.random() < failureRate) {
        failuresTotal += 1;
        return sendJson(response, 500, { error: "simulated failure" });
      }

      return sendJson(response, 200, {
        ok: true,
        version,
        duration_ms: Number(process.hrtime.bigint() - requestStartedAt) / 1_000_000
      });
    }

    if (url.pathname === "/") {
      return sendJson(response, 200, {
        service: "gke-reliability-lab",
        version,
        endpoints: ["/api/work", "/healthz", "/readyz", "/metrics"]
      });
    }

    return sendJson(response, 404, { error: "not found" });
  };

  return {
    handler,
    beginDrain: () => {
      acceptingTraffic = false;
    }
  };
}

export function startServer() {
  const port = Number(process.env.PORT ?? 8080);
  const drainDelayMs = Number(process.env.DRAIN_DELAY_MS ?? 5000);
  const app = createApp();
  const server = http.createServer(app.handler);

  server.listen(port, "0.0.0.0", () => {
    console.log(JSON.stringify({ level: "info", message: "server started", port }));
  });

  const shutdown = () => {
    app.beginDrain();
    console.log(JSON.stringify({ level: "info", message: "draining connections" }));
    const forceCloseTimer = setTimeout(() => {
      server.closeAllConnections();
    }, drainDelayMs);
    forceCloseTimer.unref();

    server.close((error) => {
      clearTimeout(forceCloseTimer);
      if (error) {
        console.error(JSON.stringify({ level: "error", message: error.message }));
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
