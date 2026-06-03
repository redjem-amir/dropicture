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
  description = "Hetzner server type for Nomad servers/masters (cpx21 = 3 vCPU / 4 GB, cpx31 = 4 vCPU / 8 GB, cpx41 = 8 vCPU / 16 GB)"
  type        = string
  default     = "cpx31"
}

variable "client_server_type" {
  description = "Hetzner server type for Nomad clients/workers (run the actual workloads)"
  type        = string
  default     = "cpx31"
}

variable "location" {
  description = "Hetzner datacenter (fsn1, nbg1, hel1)"
  type        = string
  default     = "fsn1"
}

variable "volume_size" {
  description = "Size of the per-node object-storage volume, in GB (Hetzner minimum = 10)"
  type        = number
  default     = 50

  validation {
    condition     = var.volume_size >= 10
    error_message = "A Hetzner volume must be at least 10 GB."
  }
}

variable "cloudflare_zone_name" {
  description = "Cloudflare zone name (e.g. dropicture.com)"
  type        = string
  default     = "dropicture.com"
}

variable "admin_ips" {
  description = "IPs allowed for SSH (22) and the Nomad API (4646). CIDR format, e.g. ['203.0.113.42/32']. Provided via TF_VAR_admin_ips."
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.admin_ips) > 0
    error_message = "admin_ips must not be empty. Set at least your own IP, otherwise you will be locked out."
  }
}

variable "server_count" {
  description = "Number of Nomad servers (masters / Raft quorum). MUST be odd (1, 3, 5). 1 = single master (no control-plane HA), 3 = HA."
  type        = number
  default     = 1

  validation {
    condition     = var.server_count >= 1 && var.server_count % 2 == 1
    error_message = "server_count must be an odd number (1, 3, 5, ...) to keep a healthy Raft quorum."
  }
}

variable "client_count" {
  description = "Number of Nomad clients (workers). 0 = run workloads on the servers only. Freely scalable up or down."
  type        = number
  default     = 0

  validation {
    condition     = var.client_count >= 0
    error_message = "client_count must be >= 0."
  }
}

variable "network_ip_range" {
  description = "CIDR of the private network"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_ip_range" {
  description = "CIDR of the nodes subnet (within network_ip_range)"
  type        = string
  default     = "10.0.1.0/24"
}

variable "network_zone" {
  description = "Hetzner network zone (eu-central for fsn1/nbg1/hel1)"
  type        = string
  default     = "eu-central"
}