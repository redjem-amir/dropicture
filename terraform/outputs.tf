# dropicture/terraform/outputs.tf
output "server_public_ip" {
  description = "Public IPv4 of the primary server (server 0)"
  value       = hcloud_server.server[0].ipv4_address
}

output "server_public_ipv6" {
  description = "Public IPv6 of the primary server (server 0)"
  value       = hcloud_server.server[0].ipv6_address
}

output "ssh" {
  description = "SSH command to connect to the primary server (server 0)"
  value       = "ssh root@${hcloud_server.server[0].ipv4_address}"
}

output "nomad_ui" {
  description = "Nomad API on the primary server (reachable from admin_ips only)"
  value       = "http://${hcloud_server.server[0].ipv4_address}:4646"
}

output "server_public_ips" {
  description = "Public IPv4 of every Nomad server (master)"
  value       = hcloud_server.server[*].ipv4_address
}

output "server_private_ips" {
  description = "Private IPs of every Nomad server (Raft retry_join targets)"
  value       = local.server_private_ips
}

# --- Client (worker) addresses ---------------------------------------------
output "client_public_ips" {
  description = "Public IPv4 of every Nomad client (worker)"
  value       = hcloud_server.client[*].ipv4_address
}

output "client_private_ips" {
  description = "Private IPs of every Nomad client (worker)"
  value       = local.client_private_ips
}

# --- Combined (servers first, then clients) for convenience ----------------
output "node_public_ips" {
  description = "Public IPv4 of every node (servers first, then clients)"
  value       = concat(hcloud_server.server[*].ipv4_address, hcloud_server.client[*].ipv4_address)
}

output "node_private_ips" {
  description = "Private IPs of every node (servers first, then clients)"
  value       = concat(local.server_private_ips, local.client_private_ips)
}

output "media_volume_devices" {
  description = "Device path of each node's object-storage volume (auto-mounted under /mnt/HC_Volume_<id>)"
  value       = concat(hcloud_volume.server_media[*].linux_device, hcloud_volume.client_media[*].linux_device)
}

output "site_url" {
  description = "Public URL of the site"
  value       = "https://${var.cloudflare_zone_name}"
}

output "cloudflare_ipv4_count" {
  description = "Number of Cloudflare IPv4 ranges whitelisted in the firewall"
  value       = length(local.cloudflare_ipv4_cidrs)
}

output "origin_cert_pem" {
  description = "Cloudflare Origin CA certificate (PEM) for the reverse proxy"
  value       = cloudflare_origin_ca_certificate.origin.certificate
  sensitive   = true
}

output "origin_key_pem" {
  description = "Private key (PEM) matching the Origin CA certificate"
  value       = tls_private_key.origin.private_key_pem
  sensitive   = true
}