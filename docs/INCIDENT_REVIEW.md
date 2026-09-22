# Incident review: request failures during pod termination

## Summary

During a controlled GKE pod-deletion experiment, 2,278 of 30,000 requests to
`/api/work` failed. The observed availability was 92.41%, well below the
99.9% objective. A change to the application's shutdown behavior eliminated
the failures in a repeated experiment.

## Impact

- Requests attempted: 30,000
- Successful requests: 27,722
- Failed requests: 2,278
- Observed availability: 92.41%
- Error allowance at 99.9%: 30 requests
- Error allowance consumed: approximately 76 times the permitted amount

The original latency percentiles included failed responses, so they were not
used to evaluate the successful-request latency objective.

## Detection

The failure was detected by the lab load generator while one of three API pods
was deliberately deleted. Kubernetes replaced the pod and the Horizontal Pod
Autoscaler added capacity, but those controls did not prevent application-level
request failures during termination.

## Root cause

On `SIGTERM`, the application immediately marked itself unready and rejected
`/api/work` requests with HTTP 503. It then waited five seconds before closing
the HTTP server. Existing keep-alive connections could continue sending
requests to the terminating pod during that interval, producing a burst of
failures even after Kubernetes began removing the pod from service routing.

## Contributing factors

- The first load generator reported only aggregate failures, so it could not
  distinguish HTTP errors from network errors.
- The first load generator ran inside an application pod, adding its CPU usage
  to the deployment's HPA signal.
- Replica replacement and autoscaling preserve capacity, but they cannot
  compensate for incorrect connection-draining behavior inside the process.

## Remediation

- Mark the process unready when shutdown begins.
- Stop accepting new connections immediately with `server.close()`.
- Allow requests already using established connections to finish successfully.
- Use the drain timeout only as a deadline for force-closing connections.
- Report HTTP status counts, network errors, and throughput in load-test output.
- Run load from a dedicated pod so generator CPU does not affect application
  autoscaling.
- Add a regression test proving that a draining instance is unready without
  rejecting work on an existing connection.

## Validation

The same class of experiment was repeated after deployment of the fix:

- Requests attempted: 30,000
- Successful requests: 30,000
- Failed requests: 0
- HTTP status codes: 30,000 responses with status 200
- Network errors: 0
- Throughput: 584 requests per second
- p50 latency: 24 ms
- p95 latency: 103 ms
- p99 latency: 205 ms

One application pod was deleted during the run. Kubernetes replaced the pod,
the HPA scaled the deployment, availability remained 100%, and p99 latency
remained below the 300 ms objective.

## Follow-up work

- Collect request rate, failure rate, and duration histograms with Managed
  Service for Prometheus.
- Build availability, latency, traffic, and saturation dashboards.
- Repeat the experiment during a rolling deployment.
- Add controlled latency and HTTP 500 fault experiments and compare their SLO
  impact.
- Keep long-lived identity resources separate from short-lived, billable lab
  infrastructure.
