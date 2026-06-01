# dropicture/terraform/main.tf
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
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
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