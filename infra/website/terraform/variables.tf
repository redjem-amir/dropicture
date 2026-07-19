# dropicture/infra/website/terraform/variables.tf
variable "aws_region" {
  type    = string
  default = "eu-west-3"
}

variable "project" {
  type = string
}

variable "site_bucket_name" {
  type = string
}

variable "domain_aliases" {
  type = list(string)
}

variable "cloudflare_zone_id" {
  type = string
}

variable "cloudflare_zone_name" {
  type = string
}

variable "index_document" {
  type    = string
  default = "index.html"
}

variable "not_found_document" {
  type    = string
  default = "404.html"
}

variable "price_class" {
  type    = string
  default = "PriceClass_100"
}

variable "monthly_budget_limit_usd" {
  type    = number
  default = 20
}

variable "budget_alert_emails" {
  type = list(string)
}

variable "budget_thresholds_percent" {
  type    = list(number)
  default = [50, 80, 100]
}

variable "default_tags" {
  type    = map(string)
  default = {}
}

variable "waf_rate_limit" {
  type    = number
  default = 1500
}