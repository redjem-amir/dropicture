# Infrastructure diagrams (PlantUML sources)

PlantUML sources for the dropicture infrastructure documentation. Each `.puml`
file is the single source of truth for a diagram; the committed `.png` files are
generated artifacts and should not be edited by hand.

| Source              | Output             | Describes                                                                                 |
| ------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `architecture.puml` | `architecture.png` | Terraform-managed infra: Hetzner Cloud, Cloudflare, private network, S3 remote state.     |
| `ansible.puml`      | `ansible.png`      | Ansible provisioning flow: Nomad cluster install, ACL bootstrap, reconciliation, cleanup. |

## Prerequisites

- A Java runtime (JRE 11 or newer) — check with `java -version`. The current
  `plantuml.jar` no longer runs on Java 8.
- `plantuml.jar` at `~/bin/plantuml.jar`.

No Graphviz is required: `architecture.puml` uses the built-in Smetana layout
(`!pragma layout smetana`) and `ansible.puml` is a sequence diagram — neither
needs the `dot` binary.

Install PlantUML once:

```bash
mkdir -p ~/bin
curl -L -o ~/bin/plantuml.jar \
  https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar
```

## Updating a diagram

Edit the `.puml` source, then regenerate its PNG:

```bash
java -jar ~/bin/plantuml.jar -tpng ansible.puml
```

The image is written next to the source (here, `ansible.png`). Commit the
`.puml` and the regenerated `.png` together so the rendered output never drifts
from the source.

### Regenerate every diagram at once

```bash
java -jar ~/bin/plantuml.jar -tpng *.puml
```

### Other useful options

```bash
# Vector output (crisper, scales without blurring)
java -jar ~/bin/plantuml.jar -tsvg architecture.puml

# Validate syntax without writing any  (useful in CI / pre-commit)
java -jar ~/bin/plantuml.jar -checkonly *.puml

# Write the images into a specific directory instead of next to the source
java -jar ~/bin/plantuml.jar -tpng -o out/ *.puml
```

### Optional: a shorter alias

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias puml='java -jar ~/bin/plantuml.jar -tpng'
# then simply: puml ansible.puml
```

## License

Released under the [MIT License](../LICENSE).