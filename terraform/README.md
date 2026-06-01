# Dropicture — Infrastructure

Infrastructure as Code for **Dropicture**, a self-hosted photo SaaS running on a
single Hetzner Cloud server orchestrated with Nomad, fronted by Cloudflare DNS.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.10
- An AWS account (used only for the remote Terraform state in S3)
- A Hetzner Cloud project and API token
- A Cloudflare account managing the `dropicture.com` zone

## Setup

### 1. Configure environment variables

Create a `.env` file in the `terraform/` directory:

```bash
cat <<'EOF' > .env
# AWS — Terraform remote state (S3 backend)
export AWS_ACCESS_KEY_ID=""
export AWS_SECRET_ACCESS_KEY=""
export AWS_REGION="eu-west-3"

# Hetzner Cloud
export TF_VAR_hcloud_token=""
export TF_VAR_ssh_public_key_b64=""   # base64 -w0 ~/.ssh/id_ed25519.pub

# Cloudflare
export CLOUDFLARE_API_TOKEN=""

# Allowed admin IPs for SSH (22) and the Nomad UI (4646)
export TF_VAR_admin_ips="[\"$(curl -s ifconfig.me)/32\"]"
EOF
```

Fill in the values, then load them:

```bash
source .env
```

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS access key (S3 backend) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_REGION` | Primary AWS region (`eu-west-3`) |
| `TF_VAR_hcloud_token` | Hetzner Cloud API token |
| `TF_VAR_ssh_public_key_b64` | Public SSH key, base64-encoded |
| `TF_VAR_admin_ips` | JSON list of CIDRs allowed for SSH and the Nomad UI |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (`Zone:Read` + `DNS:Edit` on `dropicture.com`) |

> `.env` is listed in `.gitignore` — never commit it.

### 2. (Optional) Corporate proxy with TLS interception

If you work behind a corporate proxy that intercepts HTTPS (Zscaler, Netskope,
etc.), `aws` and `terraform` will fail with `CERTIFICATE_VERIFY_FAILED`.

Export your machine's CA bundle (macOS example):

```bash
security find-certificate -a -p /Library/Keychains/System.keychain > ~/corp-ca-bundle.pem
security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain >> ~/corp-ca-bundle.pem
```

Add the following lines to `.env` and reload it:

```bash
export AWS_CA_BUNDLE="$HOME/corp-ca-bundle.pem"
export SSL_CERT_FILE="$HOME/corp-ca-bundle.pem"
```

### 3. Create the S3 state bucket (one-time)

The Terraform backend stores its state in S3. The bucket must exist **before**
the first `terraform init`.

```bash
BUCKET=dropicture-tfstate-prod

aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"

aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

aws s3api put-bucket-lifecycle-configuration \
  --bucket "$BUCKET" \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-old-versions",
      "Status": "Enabled",
      "Filter": {},
      "NoncurrentVersionExpiration": { "NoncurrentDays": 90 }
    }]
  }'
```

## Usage

```bash
terraform init      # initialize providers and the S3 backend
terraform plan      # preview changes
terraform apply     # provision the infrastructure
terraform output    # show server IP, SSH command, Nomad UI URL, etc.
```

To tear everything down:

```bash
terraform destroy
```

> Note: the photo volume and the server have no `prevent_destroy` guard in this
> configuration. Make sure your data is backed up before running `destroy`.

## License

Released under the [MIT License](../LICENSE).