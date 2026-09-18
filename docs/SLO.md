# Service-level objectives

This lab treats reliability as a measurable product feature. Start with these
objectives, then replace them with evidence from load and failure tests.

## Initial SLOs

| Signal | Objective | Measurement |
| --- | --- | --- |
| Availability | 99.9% successful `/api/work` requests over 30 days | `2xx requests / all valid requests` |
| Latency | 99% of successful requests below 300 ms over 30 days | p99 request duration |
| Rollouts | No more than 0.1% failed requests during a deployment | Compare errors before, during, and after rollout |

A 99.9% monthly availability objective permits about 43 minutes 50 seconds of
unavailability in a 30-day window. Treat that allowance as an error budget.

## Suggested alerts

- **Fast burn:** page when the one-hour error rate would exhaust the monthly
  error budget in two days.
- **Slow burn:** create a ticket when the six-hour error rate would exhaust the
  budget in ten days.
- **Latency:** alert when p99 latency exceeds 300 ms for 15 minutes.
- **Capacity:** alert when desired replicas equal the HPA maximum for 10 minutes.

The sample `/metrics` endpoint exposes counters for learning. A later milestone
adds managed Prometheus collection and proper request-duration histograms.
