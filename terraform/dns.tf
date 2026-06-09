# dropicture/terraform/dns.tf
data "cloudflare_zone" "dropicture" {
  filter = {
    name = var.cloudflare_zone_name
  }
}

resource "cloudflare_dns_record" "apex" {
  zone_id = data.cloudflare_zone.dropicture.zone_id
  name    = "@"
  content = hcloud_server.manager.ipv4_address
  type    = "A"
  ttl     = 1
  proxied = true

  comment = "dropicture.com -> Hetzner manager-1 (Terraform-managed)"
}

resource "cloudflare_dns_record" "www" {
  zone_id = data.cloudflare_zone.dropicture.zone_id
  name    = "www"
  content = hcloud_server.manager.ipv4_address
  type    = "A"
  ttl     = 1
  proxied = true

  comment = "www.dropicture.com -> Hetzner manager-1 (Terraform-managed)"
}

resource "cloudflare_ruleset" "redirects" {
  zone_id     = data.cloudflare_zone.dropicture.zone_id
  name        = "redirects"
  description = "Redirections de la zone (Terraform-managed)"
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"
  rules = [{
    ref         = "www_to_apex"
    description = "www.${var.cloudflare_zone_name} -> ${var.cloudflare_zone_name} (301)"
    expression  = "(http.host eq \"www.${var.cloudflare_zone_name}\")"
    action      = "redirect"
    action_parameters = {
      from_value = {
        status_code           = 301
        preserve_query_string = true
        target_url = {
          expression = "concat(\"https://${var.cloudflare_zone_name}\", http.request.uri.path)"
        }
      }
    }
  }]
}

resource "cloudflare_zone_setting" "ssl" {
  zone_id    = data.cloudflare_zone.dropicture.zone_id
  setting_id = "ssl"
  value      = "strict"
}

resource "cloudflare_zone_setting" "always_use_https" {
  zone_id    = data.cloudflare_zone.dropicture.zone_id
  setting_id = "always_use_https"
  value      = "on"
}

resource "cloudflare_zone_setting" "min_tls_version" {
  zone_id    = data.cloudflare_zone.dropicture.zone_id
  setting_id = "min_tls_version"
  value      = "1.2"
}

resource "tls_private_key" "origin" {
  algorithm = "RSA"
  rsa_bits  = 2048

  lifecycle {
    prevent_destroy = true
  }
}

resource "tls_cert_request" "origin" {
  private_key_pem = tls_private_key.origin.private_key_pem

  subject {
    common_name  = var.cloudflare_zone_name
    organization = var.project_name
  }

  dns_names = [
    var.cloudflare_zone_name,
    "*.${var.cloudflare_zone_name}",
  ]
}

resource "cloudflare_origin_ca_certificate" "origin" {
  csr                = tls_cert_request.origin.cert_request_pem
  hostnames          = [var.cloudflare_zone_name, "*.${var.cloudflare_zone_name}"]
  request_type       = "origin-rsa"
  requested_validity = 5475

  lifecycle {
    ignore_changes = [csr, requested_validity, hostnames]
  }
}
