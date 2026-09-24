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

## PromQL reference

Use a short window while testing and a 30-day window when evaluating the SLO.
The `cluster`, `namespace`, and `job` selectors keep queries scoped to this
service when the metrics scope contains multiple workloads.

### Availability

The percentage of valid work requests that returned a successful status:

```promql
100 *
sum(increase(reliability_http_requests_total{
  cluster="reliability-lab",
  namespace="reliability-lab",
  job="reliability-api",
  route="/api/work",
  status_code=~"2.."
}[30d]))
/
sum(increase(reliability_http_requests_total{
  cluster="reliability-lab",
  namespace="reliability-lab",
  job="reliability-api",
  route="/api/work"
}[30d]))
```

### Latency compliance

The percentage of successful work requests completed within the 300 ms SLO:

```promql
100 *
sum(increase(reliability_http_request_duration_seconds_bucket{
  cluster="reliability-lab",
  namespace="reliability-lab",
  job="reliability-api",
  route="/api/work",
  status_code=~"2..",
  le="0.3"
}[30d]))
/
sum(increase(reliability_http_request_duration_seconds_count{
  cluster="reliability-lab",
  namespace="reliability-lab",
  job="reliability-api",
  route="/api/work",
  status_code=~"2.."
}[30d]))
```

### p99 latency

The estimated p99 latency in milliseconds for successful work requests:

```promql
1000 * histogram_quantile(
  0.99,
  sum by (le) (
    rate(reliability_http_request_duration_seconds_bucket{
      cluster="reliability-lab",
      namespace="reliability-lab",
      job="reliability-api",
      route="/api/work",
      status_code=~"2.."
    }[5m])
  )
)
```

The application exposes a fixed route label set to prevent arbitrary request
paths from creating unbounded metric cardinality. The latency histogram also
includes an exact 300 ms bucket so the SLO threshold is measured directly
instead of inferred between wider buckets.
