# dropicture/terraform/dns.tf
data "cloudflare_zone" "dropicture" {
  filter = {
    name = var.cloudflare_zone_name
  }
}

resource "cloudflare_dns_record" "apex" {
  zone_id = data.cloudflare_zone.dropicture.zone_id
  name    = "@"
  content = hcloud_server.server[0].ipv4_address
  type    = "A"
  ttl     = 1
  proxied = true

  comment = "dropicture.com -> Hetzner server (Terraform-managed)"
}

resource "cloudflare_dns_record" "www" {
  zone_id = data.cloudflare_zone.dropicture.zone_id
  name    = "www"
  content = hcloud_server.server[0].ipv4_address
  type    = "A"
  ttl     = 1
  proxied = true

  comment = "www.dropicture.com -> Hetzner server (Terraform-managed)"
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