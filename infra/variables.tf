variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Region for the GKE cluster and Artifact Registry."
  type        = string
  default     = "us-central1"
}

variable "cluster_name" {
  description = "GKE Autopilot cluster name."
  type        = string
  default     = "reliability-lab"
}

variable "github_repository" {
  description = "GitHub repository in owner/name format allowed to deploy."
  type        = string
}
