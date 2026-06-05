# dropicture/terraform/variables.tf
variable "hcloud_token" {
  description = "Hetzner Cloud API token (env: TF_VAR_hcloud_token)"
  type        = string
  sensitive   = true
}

variable "ssh_public_key_b64" {
  description = "Base64-encoded public SSH key (env: TF_VAR_ssh_public_key_b64)"
  type        = string
  sensitive   = true
}

variable "project_name" {
  description = "Prefix used to name all resources"
  type        = string
  default     = "dropicture"
}

variable "os_image" {
  description = "Server OS image"
  type        = string
  default     = "ubuntu-24.04"
}

variable "server_type" {
  description = "Hetzner server type (cpx22 = 2 vCPU / 4 GB, cpx32 = 4 vCPU / 8 GB, cpx42 = 8 vCPU / 16 GB)"
  type        = string
  default     = "cpx32"
}

variable "location" {
  description = "Hetzner datacenter (fsn1, nbg1, hel1)"
  type        = string
  default     = "fsn1"
}

variable "cloudflare_zone_name" {
  description = "Cloudflare zone name (e.g. dropicture.com)"
  type        = string
  default     = "dropicture.com"
}