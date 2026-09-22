import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("deployment includes core reliability controls", async () => {
  const manifest = await read("k8s/base/deployment.yaml");
  for (const expected of [
    "replicas: 3",
    "maxUnavailable: 0",
    "startupProbe:",
    "readinessProbe:",
    "livenessProbe:",
    "terminationGracePeriodSeconds: 30",
    "topologySpreadConstraints:"
  ]) {
    assert.match(manifest, new RegExp(expected));
  }
});

test("container runs without root privileges", async () => {
  const dockerfile = await read("Dockerfile");
  const manifest = await read("k8s/base/deployment.yaml");
  assert.match(dockerfile, /USER node/);
  assert.match(manifest, /runAsNonRoot: true/);
  assert.match(manifest, /readOnlyRootFilesystem: true/);
});

test("deployment workflow uses short-lived workload identity", async () => {
  const workflow = await read(".github/workflows/deploy.yml");
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /workload_identity_provider/);
  assert.doesNotMatch(workflow, /credentials_json/);
});

test("managed Prometheus scrapes the application metrics endpoint", async () => {
  const kustomization = await read("k8s/base/kustomization.yaml");
  const monitoring = await read("k8s/base/podmonitoring.yaml");
  assert.match(kustomization, /podmonitoring.yaml/);
  assert.match(monitoring, /kind: PodMonitoring/);
  assert.match(monitoring, /app.kubernetes.io\/name: reliability-api/);
  assert.match(monitoring, /port: http/);
  assert.match(monitoring, /path: \/metrics/);
  assert.match(monitoring, /interval: 30s/);
});
