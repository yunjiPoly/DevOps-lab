locals {
  services = toset([
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com"
  ])
}

resource "google_project_service" "required" {
  for_each           = local.services
  service            = each.value
  disable_on_destroy = false
}

resource "google_compute_network" "main" {
  name                    = "reliability-lab"
  auto_create_subnetworks = false

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "main" {
  name          = "reliability-lab-${var.region}"
  region        = var.region
  network       = google_compute_network.main.id
  ip_cidr_range = "10.10.0.0/20"

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.20.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.30.0.0/20"
  }
}

resource "google_container_cluster" "main" {
  name                = var.cluster_name
  location            = var.region
  enable_autopilot    = true
  network             = google_compute_network.main.id
  subnetwork          = google_compute_subnetwork.main.id
  deletion_protection = false

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  release_channel {
    channel = "REGULAR"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  depends_on = [google_project_service.required]
}

resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = "reliability-lab"
  format        = "DOCKER"
  description   = "Container images for the GKE reliability lab"
  depends_on    = [google_project_service.required]
}

resource "google_service_account" "github" {
  account_id   = "github-reliability-deploy"
  display_name = "GitHub deployer for reliability lab"
}

resource "google_project_iam_member" "github_roles" {
  for_each = toset([
    "roles/artifactregistry.writer",
    "roles/container.developer"
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-reliability"
  display_name              = "GitHub Reliability Lab"
  depends_on                = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub Actions"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }
  attribute_condition = "assertion.repository == '${var.github_repository}'"
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_workload_identity" {
  service_account_id = google_service_account.github.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}
