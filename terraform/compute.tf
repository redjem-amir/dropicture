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

  server_private_ips = [for i in range(var.server_count) : cidrhost(var.subnet_ip_range, 10 + i)]
  client_private_ips = [for i in range(var.client_count) : cidrhost(var.subnet_ip_range, 100 + i)]
}

resource "hcloud_network" "main" {
  name     = "${var.project_name}-net"
  ip_range = var.network_ip_range

  labels = {
    project = var.project_name
  }
}

resource "hcloud_network_subnet" "nodes" {
  network_id   = hcloud_network.main.id
  type         = "cloud"
  network_zone = var.network_zone
  ip_range     = var.subnet_ip_range
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
    source_ips  = var.admin_ips
    description = "SSH admin"
  }

  rule {
    direction   = "in"
    protocol    = "icmp"
    source_ips  = var.admin_ips
    description = "ICMP admin (ping)"
  }

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "4646"
    source_ips  = var.admin_ips
    description = "Nomad API (admin only)"
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

resource "hcloud_server" "server" {
  count        = var.server_count
  name         = "${var.project_name}-server-${count.index + 1}"
  image        = var.os_image
  server_type  = var.server_type
  location     = var.location
  ssh_keys     = [hcloud_ssh_key.deploy.id]
  firewall_ids = [hcloud_firewall.app.id]

  labels = {
    project = var.project_name
    role    = "nomad-server"
  }

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  network {
    network_id = hcloud_network.main.id
    ip         = local.server_private_ips[count.index]
  }

  depends_on = [hcloud_network_subnet.nodes]
}

resource "hcloud_server" "client" {
  count        = var.client_count
  name         = "${var.project_name}-worker-${count.index + 1}"
  image        = var.os_image
  server_type  = var.client_server_type
  location     = var.location
  ssh_keys     = [hcloud_ssh_key.deploy.id]
  firewall_ids = [hcloud_firewall.app.id]

  labels = {
    project = var.project_name
    role    = "nomad-client"
  }

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  network {
    network_id = hcloud_network.main.id
    ip         = local.client_private_ips[count.index]
  }

  depends_on = [hcloud_network_subnet.nodes]
}

resource "hcloud_volume" "server_media" {
  count    = var.server_count
  name     = "${var.project_name}-media-server-${count.index + 1}"
  size     = var.volume_size
  location = var.location
  format   = "ext4"

  labels = {
    project = var.project_name
    purpose = "object-storage"
  }
}

resource "hcloud_volume_attachment" "server_media" {
  count     = var.server_count
  volume_id = hcloud_volume.server_media[count.index].id
  server_id = hcloud_server.server[count.index].id
  automount = true
}

resource "hcloud_volume" "client_media" {
  count    = var.client_count
  name     = "${var.project_name}-media-worker-${count.index + 1}"
  size     = var.volume_size
  location = var.location
  format   = "ext4"

  labels = {
    project = var.project_name
    purpose = "object-storage"
  }
}

resource "hcloud_volume_attachment" "client_media" {
  count     = var.client_count
  volume_id = hcloud_volume.client_media[count.index].id
  server_id = hcloud_server.client[count.index].id
  automount = true
}