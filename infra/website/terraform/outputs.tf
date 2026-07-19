# dropicture/infra/website/terraform/outputs.tf
output "site_bucket" {
  value = aws_s3_bucket.site.bucket
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.site.domain_name
}

output "site_urls" {
  value = [for d in var.domain_aliases : "https://${d}"]
}

output "waf_web_acl_arn" {
  value = aws_wafv2_web_acl.site.arn
}