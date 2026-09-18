# Project roadmap

## Milestone 1 — reliable container

- Run the service and tests locally.
- Build the non-root container.
- Explain liveness versus readiness and graceful termination.

## Milestone 2 — local Kubernetes

- Deploy to a `kind` cluster.
- Observe three replicas and topology constraints.
- Delete pods during load and measure user-visible failures.
- Perform a rolling update and verify `maxUnavailable: 0`.

## Milestone 3 — GKE foundation

- Create a dedicated Google Cloud project with a billing budget alert.
- Provision GKE Autopilot, VPC, Artifact Registry, and GitHub workload identity.
- Record `terraform plan` in a pull request before applying.
- Destroy nonessential infrastructure after each learning session.

## Milestone 4 — continuous delivery

- Configure the repository variables documented in the README.
- Deploy an immutable commit-SHA image from GitHub Actions.
- Add an approval gate to the GitHub `production` environment.
- Prove rollback using the runbook.

## Milestone 5 — observability and failure testing

- Add Managed Service for Prometheus and a request-duration histogram.
- Build availability, latency, traffic, saturation, and rollout dashboards.
- Run pod-deletion, latency, and 5xx fault exercises.
- Write a short incident review and quantify SLO impact.

## Portfolio proof

Publish the architecture, one dashboard screenshot, a failed experiment, the
incident review, and the improvement that followed. Interviewers learn more
from the reasoning and evidence than from a long tool list.
