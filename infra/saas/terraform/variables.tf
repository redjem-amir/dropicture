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
  validation {
    condition     = alltrue([for o in var.cdn_upload_origins : can(regex("^https?://[^/]+$", o))])
    error_message = "A CORS origin must be of the form scheme://host[:port], with no trailing slash."
  }
}

variable "cdn_price_class" {
  type    = string
  default = "PriceClass_100"
  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.cdn_price_class)
    error_message = "Must be PriceClass_100, PriceClass_200 or PriceClass_All."
  }
}

variable "cdn_waf_rate_limit" {
  type    = number
  default = 5000
  validation {
    condition     = var.cdn_waf_rate_limit >= 100
    error_message = "The minimum accepted by WAFv2 for a rate-based rule is 100."
  }
}

variable "cdn_dev_origins" {
  type    = list(string)
  default = []
  validation {
    condition     = alltrue([for o in var.cdn_dev_origins : can(regex("^https?://[^/]+$", o))])
    error_message = "A CORS origin must be of the form scheme://host[:port], with no trailing slash."
  }
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
    error_message = "Object Lock retention must be at least 1 day."
  }
}

variable "db_backup_daily_retention_days" {
  type    = number
  default = 35
  validation {
    condition     = var.db_backup_daily_retention_days > 30
    error_message = "Expiration must exceed the transition to STANDARD_IA (30 days)."
  }
}

variable "db_backup_monthly_retention_days" {
  type    = number
  default = 365
  validation {
    condition     = var.db_backup_monthly_retention_days > 30
    error_message = "Expiration must exceed the transition to GLACIER_IR (30 days)."
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
