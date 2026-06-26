## Development setup

The playbook reads the server IP from the Terraform remote state (S3) and
configures the single-node Docker Swarm over SSH: Docker Engine (CE) with
log rotation, key-only SSH hardening, `swarm init` on the public IP (safe:
the Hetzner firewall only lets 22, 80, 443 and ICMP in, so the Swarm ports
stay unreachable), the Cloudflare Origin CA certificate and key stored as a
Swarm config/secret, and the data directories laid out on the server's local
SSD. It is idempotent — re-run it after every `terraform apply`. It needs
only three environment variables — the SSH key is decoded by the playbook
itself, so no ssh-agent setup is required.

> **Migrating from the old multi-node/volume setup?** The playbook refuses to
> run while `/opt/dropicture/data` is still a symlink to the old Hetzner
> volume. Copy the data to the local disk first (e.g.
> `rsync -a /mnt/HC_Volume_*/ /opt/dropicture/data-new/`, then swap), remove
> the link, and re-run.

1. Create a `.env` file at the repository root (next to `playbook.yml`):

````bash
cat <<'EOF' > .env
export AWS_ACCESS_KEY_ID=""
export AWS_SECRET_ACCESS_KEY=""
export SSH_PRIVATE_KEY_B64=""
EOF
````

2. Install the Ansible prerequisites:

````bash
pip install ansible boto3 botocore
ansible-galaxy collection install community.docker amazon.aws community.general ansible.posix
````

3. Fill in the values, then load them into your shell:

````bash
source .env
````

4. Run the playbook:

````bash
ansible-playbook playbook.yml
````

> `.env` is listed in `.gitignore` — never commit it.

### Corporate proxy (optional)

The playbook makes no HTTP call to the server: provisioning, `swarm init`,
configs and secrets all go over SSH (port 22), which is not affected by
`http_proxy` / `https_proxy`. The only HTTP traffic from the control machine
is the Terraform state download from S3, which goes through a corporate proxy
normally. No `no_proxy` exclusions are needed.

## Requirements

- SSH (22) is open to the world in the firewall; authentication is key-only
  (enforced by the playbook), so `SSH_PRIVATE_KEY_B64` must match the public
  key declared in `hcloud_ssh_key.deploy` — there is no other way in.
- The AWS credentials only need read access to the state bucket
  (`s3:GetObject` on `dropicture-tfstate-prod/terraform.tfstate`). No Secrets
  Manager permissions are required.

## Deploying stacks

No management API is exposed publicly: deployments go through SSH using a
Docker context (the ready-to-use command is in the `docker_context` Terraform
output):

````bash
docker context create dropicture --docker "host=ssh://root@<manager_public_ip>"
docker context use dropicture

docker stack deploy -c app.stack.yml dropicture
docker stack services dropicture
docker service logs -f dropicture_app
````

The Origin CA material is available in the Swarm as the
`dropicture_origin_cert` config and the `dropicture_origin_key` secret —
reference them with `external: true` in your stack files. Persistent data
lives under `/opt/dropicture/data/<service>` on the server's local disk.

> No overlay MTU tuning is needed anymore: with a single node the overlay
> traffic never leaves the host. You can drop any
> `com.docker.network.driver.mtu: "1400"` driver_opts inherited from the old
> multi-node stack files.

## License

Released under the MIT License. See [LICENSE](../LICENSE).