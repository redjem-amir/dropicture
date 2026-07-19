# dropicture/infra/saas/terraform/outputs.tf
output "nodes_public_ipv4" {
  value = { for k, s in hcloud_server.node : k => s.ipv4_address }
}

output "nodes_public_ipv6" {
  value = { for k, s in hcloud_server.node : k => s.ipv6_address }
}

output "nodes_private_ip" {
  value = { for k, n in hcloud_server_network.node : k => n.ip }
}

output "proxy_public_ip" {
  value = hcloud_server.node[local.proxy_key].ipv4_address
}

output "ssh" {
  value = { for k, s in hcloud_server.node : k => "ssh root@${s.ipv4_address}" }
}

output "docker_context" {
  value = "docker context create ${var.project_name} --docker \"host=ssh://root@${hcloud_server.node[local.proxy_key].ipv4_address}\""
}

output "site_url" {
  value = "https://app.${var.root_domain}"
}

output "grafana_url" {
  value = "https://grafana.${var.root_domain}"
}

output "cloudflare_ipv4_count" {
  value = length(local.cloudflare_ipv4_cidrs)
}

output "cloudflare_cidrs" {
  value = local.cloudflare_cidrs
}

output "cdn_url" {
  value = "https://${local.cdn_domain}"
}

output "cdn_bucket" {
  value = aws_s3_bucket.cdn.id
}

output "cdn_public_prefix" {
  value = local.cdn_public_prefix
}

output "cdn_cloudfront_domain" {
  value = aws_cloudfront_distribution.cdn.domain_name
}

output "cdn_distribution_id" {
  value = aws_cloudfront_distribution.cdn.id
}

output "cdn_ssm_prefix" {
  value = local.ssm_prefix
}

output "db_backup_bucket" {
  value = aws_s3_bucket.db_backups.id
}

output "db_backup_ssm_prefix" {
  value = local.backup_ssm_prefix
}

output "cdn_cors_origins" {
  value = concat(var.cdn_upload_origins, var.cdn_dev_origins)
}
