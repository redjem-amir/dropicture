# dropicture/terraform/outputs.tf
output "server_public_ip" {
  description = "Public IPv4 of the primary node (node 0)"
  value       = hcloud_server.app[0].ipv4_address
}

output "server_public_ipv6" {
  description = "Public IPv6 of the primary node (node 0)"
  value       = hcloud_server.app[0].ipv6_address
}

output "ssh" {
  description = "SSH command to connect to the primary node (node 0)"
  value       = "ssh root@${hcloud_server.app[0].ipv4_address}"
}

output "nomad_ui" {
  description = "Nomad UI on node 0 (reachable from admin_ips only)"
  value       = "http://${hcloud_server.app[0].ipv4_address}:4646"
}

output "node_public_ips" {
  description = "Public IPv4 of every Nomad node"
  value       = hcloud_server.app[*].ipv4_address
}

output "node_private_ips" {
  description = "Private IPs of every node (use as Nomad retry_join targets)"
  value       = local.node_private_ips
}

output "media_volume_devices" {
  description = "Device path of each node's object-storage volume (auto-mounted under /mnt/HC_Volume_<id>)"
  value       = hcloud_volume.media[*].linux_device
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