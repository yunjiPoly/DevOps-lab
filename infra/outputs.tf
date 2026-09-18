output "cluster_name" {
  value = google_container_cluster.main.name
}

output "region" {
  value = var.region
}

output "artifact_registry_repository" {
  value = google_artifact_registry_repository.app.name
}

output "github_service_account" {
  value = google_service_account.github.email
}

output "workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}
