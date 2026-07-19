# dropicture/infra/saas/terraform/terraform.tfvars
project_name = "dropicture"
os_image     = "ubuntu-24.04"
location     = "fsn1"
root_domain  = "dropicture.com"

aws_region         = "eu-west-3"
cdn_price_class    = "PriceClass_100"
cdn_waf_rate_limit = 5000
cdn_upload_origins = ["https://app.dropicture.com"]
cdn_dev_origins    = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]

cloudfront_key_versions       = ["v1"]
cloudfront_active_key_version = "v1"

db_backup_object_lock            = false
db_backup_lock_days              = 7
db_backup_daily_retention_days   = 35
db_backup_monthly_retention_days = 365

nodes = {
  proxy    = { server_type = "cpx32", private_ip = "10.0.0.10" }               # 4vcpu + 8go — mono-nœud
  db       = { server_type = "cpx32", private_ip = "10.0.0.20" }               # 4vcpu + 8go — mono-nœud
  backend  = { server_type = "cpx12", private_ip = "10.0.0.30", replicas = 1 } # 1vcpu + 2go — scalable
  frontend = { server_type = "cpx12", private_ip = "10.0.0.40", replicas = 1 } # 1vcpu + 2go — scalable
  jobs     = { server_type = "cpx12", private_ip = "10.0.0.50" }               # 1vcpu + 2go — mono-nœud
}