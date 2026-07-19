# dropicture/infra/saas/terraform/variables.tf
variable "hcloud_token" {
  type      = string
  sensitive = true
}

variable "ssh_public_key_b64" {
  type      = string
  sensitive = true
}

variable "project_name" {
  type    = string
  default = "dropicture"
}

variable "os_image" {
  type    = string
  default = "ubuntu-24.04"
}

variable "location" {
  type    = string
  default = "fsn1"
}

variable "network_ip_range" {
  type    = string
  default = "10.0.0.0/16"
}

variable "root_domain" {
  type    = string
  default = "dropicture.com"
}

variable "aws_region" {
  type    = string
  default = "eu-west-3"
}

variable "cdn_force_destroy" {
  type    = bool
  default = false
}

variable "cdn_upload_origins" {
  type    = list(string)
  default = ["https://app.dropicture.com"]
}

variable "cdn_price_class" {
  type    = string
  default = "PriceClass_100"
  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.cdn_price_class)
    error_message = "PriceClass_100, PriceClass_200 ou PriceClass_All."
  }
}

variable "cdn_waf_rate_limit" {
  type    = number
  default = 5000
  validation {
    condition     = var.cdn_waf_rate_limit >= 100
    error_message = "Le minimum accepte par WAFv2 pour une rate-based rule est 100."
  }
}

variable "cloudfront_key_versions" {
  type    = list(string)
  default = ["v1"]
  validation {
    condition     = length(var.cloudfront_key_versions) >= 1 && length(var.cloudfront_key_versions) <= 5
    error_message = "Un key group CloudFront accepte entre 1 et 5 cles publiques."
  }
  validation {
    condition     = length(distinct(var.cloudfront_key_versions)) == length(var.cloudfront_key_versions)
    error_message = "Les versions de cles doivent etre uniques."
  }
}

variable "cloudfront_active_key_version" {
  type    = string
  default = "v1"
}

variable "db_backup_force_destroy" {
  type    = bool
  default = false
}

variable "db_backup_object_lock" {
  type    = bool
  default = false
}

variable "db_backup_lock_days" {
  type    = number
  default = 7
  validation {
    condition     = var.db_backup_lock_days >= 1
    error_message = "La retention Object Lock doit etre d'au moins 1 jour."
  }
}

variable "db_backup_daily_retention_days" {
  type    = number
  default = 35
  validation {
    condition     = var.db_backup_daily_retention_days > 30
    error_message = "L'expiration doit depasser la transition vers STANDARD_IA (30 jours)."
  }
}

variable "db_backup_monthly_retention_days" {
  type    = number
  default = 365
  validation {
    condition     = var.db_backup_monthly_retention_days > 30
    error_message = "L'expiration doit depasser la transition vers GLACIER_IR (30 jours)."
  }
}

variable "nodes" {
  type = map(object({
    server_type = string
    private_ip  = string
    replicas    = optional(number, 1)
  }))
  validation {
    condition     = alltrue([for r in ["proxy", "db", "jobs", "backend", "frontend"] : contains(keys(var.nodes), r)])
    error_message = "Roles proxy, db, jobs, backend and frontend are all required."
  }
  validation {
    condition = alltrue([
      for role, cfg in var.nodes :
      cfg.replicas >= 1 && (contains(["proxy", "db", "jobs"], role) ? cfg.replicas == 1 : true)
    ])
    error_message = "Every role needs at least 1 node; proxy, db and jobs must have exactly 1. Only backend and frontend scale out."
  }
  validation {
    condition     = alltrue([for role, cfg in var.nodes : can(cidrhost("${cfg.private_ip}/32", 0))])
    error_message = "Every role needs a valid private_ip (e.g. 10.0.0.10)."
  }
  validation {
    condition = length(distinct(flatten([
      for role, cfg in var.nodes : [
        for i in range(cfg.replicas) :
        cidrhost("${cfg.private_ip}/24", parseint(split(".", cfg.private_ip)[3], 10) + i)
      ]
    ]))) == sum([for role, cfg in var.nodes : cfg.replicas])
    error_message = "Private IP ranges overlap between roles: a role's replicas take consecutive IPs from its private_ip, so leave enough gap between roles."
  }
}