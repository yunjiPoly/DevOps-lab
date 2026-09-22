import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { createApp } from "../src/server.js";

let server;
let baseUrl;

before(async () => {
  server = http.createServer(createApp({ version: "test" }).handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("liveness endpoint reports alive", async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "alive" });
});

test("work endpoint returns the configured version", async () => {
  const response = await fetch(`${baseUrl}/api/work`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.version, "test");
});

test("unknown routes return 404", async () => {
  const response = await fetch(`${baseUrl}/missing`);
  assert.equal(response.status, 404);
});

test("metrics are Prometheus-compatible text", async () => {
  await fetch(`${baseUrl}/api/work`);
  await fetch(`${baseUrl}/missing`);
  const response = await fetch(`${baseUrl}/metrics`);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /reliability_requests_total \d+/);
  assert.match(body, /reliability_in_flight_requests \d+/);
  assert.match(body, /reliability_http_requests_total\{method="GET",route="\/api\/work",status_code="200"\} \d+/);
  assert.match(body, /reliability_http_requests_total\{method="GET",route="other",status_code="404"\} \d+/);
  assert.match(body, /reliability_http_request_duration_seconds_bucket\{method="GET",route="\/api\/work",le="0\.1"\} \d+/);
  assert.match(body, /reliability_http_request_duration_seconds_bucket\{method="GET",route="\/api\/work",le="\+Inf"\} \d+/);
  assert.match(body, /reliability_http_request_duration_seconds_count\{method="GET",route="\/api\/work"\} \d+/);
});

test("startup delay keeps a new instance out of service", async () => {
  const delayedServer = http.createServer(createApp({ startupDelayMs: 5000 }).handler);
  await new Promise((resolve) => delayedServer.listen(0, "127.0.0.1", resolve));
  const response = await fetch(`http://127.0.0.1:${delayedServer.address().port}/readyz`);
  assert.equal(response.status, 503);
  await new Promise((resolve, reject) => delayedServer.close((error) => error ? reject(error) : resolve()));
});

test("draining removes readiness without rejecting work on existing connections", async () => {
  const drainingApp = createApp({ version: "test" });
  const drainingServer = http.createServer(drainingApp.handler);
  await new Promise((resolve) => drainingServer.listen(0, "127.0.0.1", resolve));
  const drainingBaseUrl = `http://127.0.0.1:${drainingServer.address().port}`;

  drainingApp.beginDrain();

  const readinessResponse = await fetch(`${drainingBaseUrl}/readyz`);
  const workResponse = await fetch(`${drainingBaseUrl}/api/work`);
  assert.equal(readinessResponse.status, 503);
  assert.equal(workResponse.status, 200);

  await new Promise((resolve, reject) => drainingServer.close((error) => error ? reject(error) : resolve()));
});
