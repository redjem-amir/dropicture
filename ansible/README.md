## Development setup

The playbook reads the node IPs from the Terraform remote state (S3),
configures Nomad over SSH (Docker driver + CNI bridge networking), enables
ACLs, and stores the bootstrap token in AWS Secrets Manager. It needs only
three environment variables — the SSH key is decoded by the playbook itself,
so no ssh-agent setup is required.

1. Create a `.env` file at the repository root (next to `playbook.yml`):

```bash
cat <<'EOF' > .env
export AWS_ACCESS_KEY_ID=""
export AWS_SECRET_ACCESS_KEY=""
export SSH_PRIVATE_KEY_B64=""
EOF
```

2. Install the Ansible prerequisites:

```bash
pip install ansible boto3 botocore
ansible-galaxy collection install amazon.aws community.aws community.general ansible.posix
```

3. Fill in the values, then load them into your shell:

```bash
source .env
```

4. Run the playbook:

```bash
ansible-playbook playbook.yml
```

> `.env` is listed in `.gitignore` — never commit it.

### Corporate proxy (optional)

If you run the playbook behind a corporate proxy that sets `http_proxy` /
`https_proxy` (Zscaler, Netskope, etc.), the tasks that call the Nomad API on
port 4646 are routed through the proxy — which cannot reach the server on that
port. The ACL bootstrap then fails with:

```
Status code was -1 and not [200]: Connection failure: timed out
```

The TCP wait on 4646 still passes (it opens a raw socket and ignores proxy
settings); only the HTTP tasks are affected, which is the tell-tale sign.

Exclude the server's public IP from proxying before running the playbook:

```bash
export no_proxy="<node_public_ip>,${no_proxy}"
export NO_PROXY="<node_public_ip>,${NO_PROXY}"
```

Because the server IP changes whenever it is recreated, the durable fix is to
set `use_proxy: false` on every `ansible.builtin.uri` task that talks to Nomad
(the ACL bootstrap and the reconciliation tasks). The `wait_for` task needs no
change.

## Requirements

- The IP of the machine running the playbook must be in `admin_ips` (Terraform),
  otherwise SSH (22) and the Nomad API (4646) are blocked by the firewall.
- `SSH_PRIVATE_KEY_B64` must match the public key in `hcloud_ssh_key.deploy`.
- The AWS credentials need read access to the state bucket **and** Secrets
  Manager permissions (`CreateSecret`, `GetSecretValue`, `DescribeSecret`,
  `TagResource`).

## Deploying jobs

The token is stored in Secrets Manager as `nomad/<project>/management-token`.
Deployments go through the Nomad API (no SSH, no UI):

```bash
export NOMAD_ADDR="http://<node_public_ip>:4646"
export NO_PROXY="<node_public_ip>,$NO_PROXY"
export NOMAD_TOKEN="$(aws secretsmanager get-secret-value \
    --secret-id nomad/dropicture/management-token \
    --query SecretString --output text --region eu-west-3)"
nomad job run app.nomad.hcl
```

## License

Released under the MIT License. See [LICENSE](../LICENSE).