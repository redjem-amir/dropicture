# dropicture/terraform/outputs.tf
output "manager_public_ip" {
  description = "Public IPv4 of the server"
  value       = hcloud_server.manager.ipv4_address
}

output "manager_public_ipv6" {
  description = "Public IPv6 of the server"
  value       = hcloud_server.manager.ipv6_address
}

output "ssh" {
  description = "SSH command to connect to the server"
  value       = "ssh root@${hcloud_server.manager.ipv4_address}"
}

output "docker_context" {
  description = "Command to manage the Swarm remotely over SSH from any machine"
  value       = "docker context create dropicture --docker \"host=ssh://root@${hcloud_server.manager.ipv4_address}\""
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