# Reliability API runbook

## Symptom: elevated 5xx responses

1. Confirm the incident window and current error rate.
2. Check rollout state: `kubectl rollout status deployment/reliability-api -n reliability-lab`.
3. Compare pod versions: `kubectl get pods -n reliability-lab -L app.kubernetes.io/name`.
4. Inspect recent events: `kubectl get events -n reliability-lab --sort-by=.lastTimestamp`.
5. Inspect logs: `kubectl logs -n reliability-lab deployment/reliability-api --tail=100`.
6. If a new version correlates with the errors, run:
   `kubectl rollout undo deployment/reliability-api -n reliability-lab`.
7. Verify recovery with the load script and record the timeline.

## Symptom: pods are not Ready

1. Run `kubectl describe pod -n reliability-lab <pod-name>`.
2. Test the readiness endpoint from inside the cluster.
3. Check `STARTUP_DELAY_MS`, resource pressure, image-pull failures, and events.
4. Do not weaken or remove probes to make the rollout turn green; fix the cause.

## Symptom: HPA does not scale

1. Run `kubectl describe hpa reliability-api -n reliability-lab`.
2. Confirm metrics are available with `kubectl top pods -n reliability-lab`.
3. Confirm CPU requests exist; utilization-based autoscaling depends on them.
4. Generate sustained load and observe rather than changing thresholds immediately.

## Incident record

For every exercise, capture impact, detection, timeline, root cause, mitigation,
and one prevention action. This turns a demo into evidence of SRE thinking.
