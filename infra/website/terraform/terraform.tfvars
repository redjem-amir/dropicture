# dropicture/infra/website/terraform/terraform.tfvars
project          = "dropicture-website"
aws_region       = "eu-west-3"
site_bucket_name = "dropicture-website-prod"

domain_aliases       = ["dropicture.com", "www.dropicture.com"]
cloudflare_zone_name = "dropicture.com"

price_class = "PriceClass_100"

monthly_budget_limit_usd  = 20
budget_alert_emails       = ["a.redjem@outlook.com"]
budget_thresholds_percent = [50, 80, 100]

default_tags = {
  Project   = "dropicture-website"
  Env       = "prod"
  ManagedBy = "terraform"
}