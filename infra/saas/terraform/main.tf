# dropicture/infra/saas/terraform/main.tf
terraform {
  required_version = ">= 1.10"
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
  backend "s3" {
    bucket       = "dropicture-tfstate-prod"
    key          = "terraform.tfstate"
    region       = "eu-west-3"
    use_lockfile = true
    encrypt      = true
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

provider "cloudflare" {}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      project   = var.project_name
      managedby = "terraform"
    }
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = {
      project   = var.project_name
      managedby = "terraform"
    }
  }
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
  network_zone = {
    fsn1 = "eu-central"
    nbg1 = "eu-central"
    hel1 = "eu-central"
    ash  = "us-east"
    hil  = "us-west"
    sin  = "ap-southeast"
  }[var.location]
  cloudflare_ipv4_cidrs = compact([for c in split("\n", data.http.cloudflare_ipv4.response_body) : trimspace(c) if trimspace(c) != ""])
  cloudflare_ipv6_cidrs = compact([for c in split("\n", data.http.cloudflare_ipv6.response_body) : trimspace(c) if trimspace(c) != ""])
  cloudflare_cidrs      = concat(local.cloudflare_ipv4_cidrs, local.cloudflare_ipv6_cidrs)
  servers = merge([
    for role, cfg in var.nodes : {
      for i in range(cfg.replicas) :
      "${role}-${i + 1}" => {
        server_type = cfg.server_type
        role        = role
        private_ip  = cidrhost("${cfg.private_ip}/24", parseint(split(".", cfg.private_ip)[3], 10) + i)
      }
    }
  ]...)
  proxy_key = one([for k, s in local.servers : k if s.role == "proxy"])
  proxy_subdomains = ["app", "grafana"]
  cdn_domain      = "cdn.${var.root_domain}"
  cdn_bucket_name = "${var.project_name}-cdn-prod"
  cdn_origin_id   = "s3-cdn"
  ssm_prefix      = "/${var.project_name}/cloudfront"
  db_backup_bucket_name = "${var.project_name}-db-backups-prod"
  backup_ssm_prefix     = "/${var.project_name}/backup"
}

resource "hcloud_ssh_key" "deploy" {
  name       = "${var.project_name}-deploy-key"
  public_key = base64decode(var.ssh_public_key_b64)
}

resource "hcloud_network" "swarm" {
  name     = "${var.project_name}-net"
  ip_range = var.network_ip_range
  labels   = { project = var.project_name }
}

resource "hcloud_network_subnet" "swarm" {
  network_id   = hcloud_network.swarm.id
  type         = "cloud"
  network_zone = local.network_zone
  ip_range     = var.network_ip_range
}

resource "hcloud_firewall" "app" {
  name   = "${var.project_name}-firewall"
  labels = { project = var.project_name }
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction  = "in"
    protocol   = "icmp"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = local.cloudflare_cidrs
  }
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = local.cloudflare_cidrs
  }
}

resource "hcloud_server" "node" {
  for_each = local.servers
  name        = "${var.project_name}-${each.key}"
  image       = var.os_image
  server_type = each.value.server_type
  location    = var.location
  ssh_keys     = [hcloud_ssh_key.deploy.id]
  firewall_ids = [hcloud_firewall.app.id]
  labels = {
    project = var.project_name
    role    = each.value.role
  }
  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }
  user_data = <<-EOT
    #cloud-config
    write_files:
      - path: /etc/netplan/60-dropicture-private.yaml
        permissions: "0600"
        content: |
          network:
            version: 2
            ethernets:
              dropicture-private:
                match:
                  name: "enp*"
                dhcp4: true
    runcmd:
      - netplan apply
  EOT
  depends_on = [hcloud_network_subnet.swarm]
  lifecycle {
    ignore_changes = [ssh_keys, image, location, user_data]
  }
}

resource "hcloud_server_network" "node" {
  for_each = local.servers
  server_id  = hcloud_server.node[each.key].id
  network_id = hcloud_network.swarm.id
  ip         = each.value.private_ip
  depends_on = [hcloud_network_subnet.swarm]
}

data "cloudflare_zone" "dropicture" {
  filter = { name = var.root_domain }
}

resource "cloudflare_dns_record" "proxy" {
  for_each = toset(local.proxy_subdomains)
  zone_id = data.cloudflare_zone.dropicture.zone_id
  name    = each.value
  content = hcloud_server.node[local.proxy_key].ipv4_address
  type    = "A"
  ttl     = 1
  proxied = true
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

resource "aws_s3_bucket" "cdn" {
  bucket        = local.cdn_bucket_name
  force_destroy = var.cdn_force_destroy
  tags          = { role = "cdn" }
}

resource "aws_s3_bucket_public_access_block" "cdn" {
  bucket                  = aws_s3_bucket.cdn.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "cdn" {
  bucket = aws_s3_bucket.cdn.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cdn" {
  bucket = aws_s3_bucket.cdn.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "cdn" {
  bucket = aws_s3_bucket.cdn.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cdn" {
  bucket     = aws_s3_bucket.cdn.id
  depends_on = [aws_s3_bucket_versioning.cdn]
  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 3
    }
  }
  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days           = 30
      newer_noncurrent_versions = 2
    }
  }
  rule {
    id     = "originals-to-infrequent-access"
    status = "Enabled"
    filter {
      prefix = "originals/"
    }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "cdn" {
  bucket = aws_s3_bucket.cdn.id
  cors_rule {
    allowed_methods = ["PUT", "POST", "GET", "HEAD"]
    allowed_origins = var.cdn_upload_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_acm_certificate" "cdn" {
  provider = aws.us_east_1
  domain_name       = local.cdn_domain
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_dns_record" "cdn_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.cdn.domain_validation_options :
    dvo.domain_name => {
      name  = trimsuffix(dvo.resource_record_name, ".")
      value = trimsuffix(dvo.resource_record_value, ".")
      type  = dvo.resource_record_type
    }
  }
  zone_id = data.cloudflare_zone.dropicture.zone_id
  name    = each.value.name
  content = each.value.value
  type    = each.value.type
  ttl     = 60
  proxied = false
}

resource "aws_acm_certificate_validation" "cdn" {
  provider = aws.us_east_1
  certificate_arn         = aws_acm_certificate.cdn.arn
  validation_record_fqdns = [for r in cloudflare_dns_record.cdn_cert_validation : r.name]
}

resource "tls_private_key" "cloudfront" {
  for_each = toset(var.cloudfront_key_versions)
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "aws_cloudfront_public_key" "cdn" {
  for_each = tls_private_key.cloudfront
  name        = "${var.project_name}-cdn-${each.key}"
  encoded_key = each.value.public_key_pem
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_cloudfront_key_group" "cdn" {
  name  = "${var.project_name}-cdn-signers"
  items = [for k in aws_cloudfront_public_key.cdn : k.id]
}

resource "aws_kms_key" "cdn_secrets" {
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "cdn_secrets" {
  name          = "alias/${var.project_name}-cdn-secrets"
  target_key_id = aws_kms_key.cdn_secrets.key_id
}

resource "aws_ssm_parameter" "cloudfront_private_key" {
  for_each = tls_private_key.cloudfront
  name   = "${local.ssm_prefix}/private_key_${each.key}"
  type   = "SecureString"
  key_id = aws_kms_key.cdn_secrets.key_id
  value  = each.value.private_key_pem_pkcs8
  tier   = "Standard"
}

resource "aws_ssm_parameter" "cloudfront_key_pair_id" {
  for_each = aws_cloudfront_public_key.cdn
  name  = "${local.ssm_prefix}/key_pair_id_${each.key}"
  type  = "String"
  value = each.value.id
}

resource "aws_ssm_parameter" "cloudfront_active_key_version" {
  name  = "${local.ssm_prefix}/active_key_version"
  type  = "String"
  value = var.cloudfront_active_key_version
  lifecycle {
    precondition {
      condition     = contains(var.cloudfront_key_versions, var.cloudfront_active_key_version)
      error_message = "cloudfront_active_key_version doit faire partie de cloudfront_key_versions."
    }
  }
}

resource "aws_ssm_parameter" "cdn_config" {
  for_each = {
    domain          = "https://${local.cdn_domain}"
    bucket          = aws_s3_bucket.cdn.id
    bucket_region   = var.aws_region
    distribution_id = aws_cloudfront_distribution.cdn.id
  }
  name  = "${local.ssm_prefix}/${each.key}"
  type  = "String"
  value = each.value
}

resource "aws_cloudfront_origin_access_control" "cdn" {
  name                              = "${var.project_name}-cdn-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "cdn_bucket" {
  statement {
    sid    = "AllowCloudFrontServicePrincipalReadOnly"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.cdn.arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.cdn.arn,
      "${aws_s3_bucket.cdn.arn}/*",
    ]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "cdn" {
  bucket = aws_s3_bucket.cdn.id
  policy = data.aws_iam_policy_document.cdn_bucket.json
  depends_on = [aws_s3_bucket_public_access_block.cdn]
}

resource "aws_wafv2_web_acl" "cdn" {
  provider = aws.us_east_1
  name  = "${var.project_name}-cdn"
  scope = "CLOUDFRONT"
  default_action {
    allow {}
  }
  rule {
    name     = "rate-limit-per-ip"
    priority = 10
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.cdn_waf_rate_limit
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit-per-ip"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "aws-ip-reputation"
    priority = 20
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-ip-reputation"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "aws-common-rules"
    priority = 30
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-common-rules"
      sampled_requests_enabled   = true
    }
  }
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-cdn"
    sampled_requests_enabled   = true
  }
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_origin_request_policy" "cors_s3" {
  name = "Managed-CORS-S3Origin"
}

resource "aws_cloudfront_response_headers_policy" "cdn" {
  name = "${var.project_name}-cdn-headers"
  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "no-referrer"
      override        = true
    }
  }
  custom_headers_config {
    items {
      header   = "Cache-Control"
      value    = "public, max-age=31536000, immutable"
      override = false
    }
  }
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled         = true
  is_ipv6_enabled = true
  http_version    = "http2and3"
  aliases         = [local.cdn_domain]
  price_class     = var.cdn_price_class
  web_acl_id      = aws_wafv2_web_acl.cdn.arn
  origin {
    domain_name              = aws_s3_bucket.cdn.bucket_regional_domain_name
    origin_id                = local.cdn_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.cdn.id
  }
  default_cache_behavior {
    target_origin_id       = local.cdn_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    compress               = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.cors_s3.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cdn.id
    trusted_key_groups = [aws_cloudfront_key_group.cdn.id]
  }
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cdn.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
  tags = { role = "cdn" }
}

resource "cloudflare_dns_record" "cdn" {
  zone_id = data.cloudflare_zone.dropicture.zone_id
  name    = "cdn"
  content = aws_cloudfront_distribution.cdn.domain_name
  type    = "CNAME"
  ttl     = 300
  proxied = false
}

resource "aws_s3_bucket" "db_backups" {
  bucket              = local.db_backup_bucket_name
  force_destroy       = var.db_backup_force_destroy
  object_lock_enabled = var.db_backup_object_lock
  tags                = { role = "db-backups" }
}

resource "aws_s3_bucket_public_access_block" "db_backups" {
  bucket                  = aws_s3_bucket.db_backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "db_backups" {
  count  = var.db_backup_object_lock ? 1 : 0
  bucket = aws_s3_bucket.db_backups.id
  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = var.db_backup_lock_days
    }
  }
  depends_on = [aws_s3_bucket_versioning.db_backups]
}

resource "aws_s3_bucket_lifecycle_configuration" "db_backups" {
  bucket     = aws_s3_bucket.db_backups.id
  depends_on = [aws_s3_bucket_versioning.db_backups]
  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 3
    }
  }
  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
  rule {
    id     = "daily-tiering-and-expiry"
    status = "Enabled"
    filter {
      prefix = "daily/"
    }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    expiration {
      days = var.db_backup_daily_retention_days
    }
  }
  rule {
    id     = "monthly-archive"
    status = "Enabled"
    filter {
      prefix = "monthly/"
    }
    transition {
      days          = 30
      storage_class = "GLACIER_IR"
    }
    expiration {
      days = var.db_backup_monthly_retention_days
    }
  }
}

data "aws_iam_policy_document" "db_backups" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.db_backups.arn,
      "${aws_s3_bucket.db_backups.arn}/*",
    ]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "db_backups" {
  bucket     = aws_s3_bucket.db_backups.id
  policy     = data.aws_iam_policy_document.db_backups.json
  depends_on = [aws_s3_bucket_public_access_block.db_backups]
}

resource "aws_ssm_parameter" "db_backup_config" {
  for_each = {
    bucket = aws_s3_bucket.db_backups.id
    region = var.aws_region
  }
  name  = "${local.backup_ssm_prefix}/${each.key}"
  type  = "String"
  value = each.value
}