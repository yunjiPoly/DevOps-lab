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

  const hasStarted = () => Date.now() - startedAt >= startupDelayMs;
  const isReady = () => acceptingTraffic && hasStarted();

  const sendJson = (response, statusCode, body) => {
    response.writeHead(statusCode, { "content-type": "application/json" });
    response.end(`${JSON.stringify(body)}\n`);
  };

  const handler = async (request, response) => {
    const requestStartedAt = Date.now();
    requestsTotal += 1;
    inFlight += 1;

    response.on("finish", () => {
      inFlight -= 1;
    });

    const url = new URL(request.url, "http://localhost");

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
        ""
      ];
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
        duration_ms: Date.now() - requestStartedAt
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
