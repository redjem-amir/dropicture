# dropicture/terraform/compute.tf
resource "hcloud_ssh_key" "deploy" {
  name       = "${var.project_name}-deploy-key"
  public_key = base64decode(var.ssh_public_key_b64)
}

data "http" "cloudflare_ipv4" {
  url             = "https://www.cloudflare.com/ips-v4/#"
  request_headers = { Accept = "text/plain" }
}

data "http" "cloudflare_ipv6" {
  url             = "https://www.cloudflare.com/ips-v6/#"
  request_headers = { Accept = "text/plain" }
}

locals {
  cloudflare_ipv4_cidrs = compact([
    for cidr in split("\n", data.http.cloudflare_ipv4.response_body) :
    trimspace(cidr) if trimspace(cidr) != ""
  ])

  cloudflare_ipv6_cidrs = compact([
    for cidr in split("\n", data.http.cloudflare_ipv6.response_body) :
    trimspace(cidr) if trimspace(cidr) != ""
  ])

  cloudflare_all_cidrs = concat(local.cloudflare_ipv4_cidrs, local.cloudflare_ipv6_cidrs)
}

resource "hcloud_firewall" "app" {
  name = "${var.project_name}-firewall"

  labels = {
    project = var.project_name
    purpose = "ingress-protection"
  }

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips  = ["0.0.0.0/0", "::/0"]
    description = "SSH from anywhere (key-only auth enforced by Ansible)"
  }

  rule {
    direction   = "in"
    protocol    = "icmp"
    source_ips  = ["0.0.0.0/0", "::/0"]
    description = "ICMP (ping)"
  }

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "443"
    source_ips  = local.cloudflare_all_cidrs
    description = "HTTPS via Cloudflare only"
  }

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "80"
    source_ips  = local.cloudflare_all_cidrs
    description = "HTTP via Cloudflare only (80 -> 443 redirect)"
  }
}

resource "hcloud_server" "manager" {
  name         = "${var.project_name}-manager-1"
  image        = var.os_image
  server_type  = var.server_type
  location     = var.location
  ssh_keys     = [hcloud_ssh_key.deploy.id]
  firewall_ids = [hcloud_firewall.app.id]

  labels = {
    project = var.project_name
    role    = "swarm-manager"
  }

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }
}