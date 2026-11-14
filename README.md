# OpenProject MCP

A general-purpose, local MCP server for OpenProject API v3. It gives compatible MCP clients a focused, typed surface for projects, work packages, attachments, relations, boards, users, watchers, notifications, and reference data.

> **A friendly fork.** This project is maintained by Turbo Crowd and is forked from [alex13slem/openproject-codex-plugin](https://github.com/alex13slem/openproject-codex-plugin). We are grateful to the upstream maintainers and preserve the MIT license, attribution, and upstream history.

## Why this fork

The upstream project established a useful OpenProject API v3 MCP integration. This fork keeps that foundation while making the server client-independent, documenting its safety boundary explicitly, and preparing a broader public OpenProject surface. The goal is practical adoption, not a claim that one tool fits every deployment.

| Area | Upstream baseline | This fork now | Being ported |
| --- | --- | --- | --- |
| MCP client | Codex plugin workflow | General-purpose stdio MCP server | Additional client examples |
| Identity | Upstream package and registry identity | Turbo Crowd package and MCP identities | Published registry entries, after a separate release decision |
| Existing tools | Project and work-package API v3 coverage | Existing tool names and annotations retained, plus 31 typed CE tools | Disposable-instance live E2E |
| Expanded domains | Not included | Meetings and agenda, News, Time Tracking, memberships, and capability evidence | Version-specific live contract checks |
| Safety | Client annotations and upload roots | Native OpenProject authorization, preview-first writes, technical target guards, optional restricted policy, sanitized audit records | Disposable-instance contract validation |
| Documentation | Installation-oriented | Adoption, authorization, compatibility, and contribution guidance | Disposable-instance E2E examples |

## Status and roadmap

This repository exposes 72 deterministic-test-validated tools: 41 inherited API v3 tools and 31 typed CE tools. The CE surface covers Meetings and agenda items, sections and outcomes; News; Time Tracking; project-filtered memberships; and project-bound capability evidence. Every mutation is preview-first and checks route, payload, ownership, and concurrency requirements before a network mutation.

This count is proven by offline stdio discovery, not live-instance compatibility evidence. The deterministic suite proves preview responses without transport at the wrapper/common gate, all 15 inherited writes through native fake-HAL wrapper preflight, and all 17 CE writes through native handler preflight. See [ROADMAP.md](ROADMAP.md) for remaining disposable-instance validation. Please open an issue or submit a focused pull request if you can help validate an API contract or improve the safety layer.

## Quick start

Requirements:

- [Bun](https://bun.sh/) 1.3 or newer
- Any MCP client that supports a local stdio server
- An OpenProject API token with the permissions appropriate for the account

Clone and install dependencies:

```bash
git clone https://github.com/Turbo-Crowd/openproject-mcp.git
cd openproject-mcp/plugins/openproject
bun install --frozen-lockfile
```

Configure your MCP client to run `bun scripts/server.ts` in `plugins/openproject`. Supply credentials through the client environment or a private environment file; never commit either value:

```text
OPENPROJECT_URL=https://openproject.example.com
OPENPROJECT_API_TOKEN=<set-in-your-client-environment>
```

The package identity is `@turbo-crowd/openproject-mcp`. The planned MCP Registry identity is `io.github.Turbo-Crowd/openproject-mcp`; neither is a publication promise. Build the included Dockerfile from a repository checkout when a container is needed; it compiles the checked-out source and does not require a published npm package.

## Authorization and safety

The default `native` authorization mode treats the configured OpenProject user/token as authoritative. The server registers all 72 tools, and all 32 write tools are eligible after their normal preview and `confirm: true` confirmation. OpenProject decides whether a resource or action is permitted and returns its native 401, 403, 404, 409, and validation outcomes.

The three authorization layers are separate:

1. MCP client tool permissions decide which tools a client exposes to an agent.
2. Optional MCP `restricted` mode is a local policy layer for advanced deployments.
3. OpenProject user/token permissions authorize normal native-mode operations.

Native mode does not require local project, work-package type, write-tool, module-evidence, or membership policy allowlists. It retains technical safeguards: zero-I/O previews, destructive MCP annotations, entity and ownership checks needed for route correctness, lock versions and 409 handling, payload validation, sanitized errors/audit, and local upload filesystem protection. `OPENPROJECT_ALLOWED_UPLOAD_DIRS` remains required only for the upload tool because OpenProject permissions do not authorize local file reads.

### Advanced restricted mode

Set `OPENPROJECT_AUTHORIZATION_MODE=restricted` to opt into the v0.6.3 policy controls for a multi-tenant gateway, agent profile, or client-isolated deployment:

```text
OPENPROJECT_AUTHORIZATION_MODE=restricted
OPENPROJECT_WRITE_ENABLED=true
OPENPROJECT_ALLOWED_PROJECT_IDS=101
OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS=1
OPENPROJECT_ALLOWED_WRITE_TOOLS=create_work_package,update_work_package
OPENPROJECT_ALLOW_DESTRUCTIVE=false
```

Restricted mode fails closed when its relevant values are missing or malformed. `OPENPROJECT_MODULE_EVIDENCE`, `OPENPROJECT_MEMBERSHIP_WRITE_POLICY`, and `OPENPROJECT_MEMBERSHIP_PROTECTION` remain restricted-mode controls. Existing v0.6.3 configurations that have legacy restriction variables but omit `OPENPROJECT_AUTHORIZATION_MODE` continue in restricted mode and emit a startup deprecation warning. Clean installations default to native mode.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENPROJECT_URL` | none | OpenProject origin, for example `https://openproject.example.com` |
| `OPENPROJECT_API_TOKEN` | none | API token; keep it private |
| `OPENPROJECT_AUTHORIZATION_MODE` | `native` | `native` uses OpenProject permissions; `restricted` enables local policy controls |
| `OPENPROJECT_PAGE_SIZE` | `25` | Default list size, from 1 to 100 |
| `OPENPROJECT_TIMEOUT_MS` | `30000` | Request timeout, from 1000 to 300000 ms |
| `OPENPROJECT_AUTH_MODE` | `basic` | `basic` or `bearer` |
| `OPENPROJECT_ALLOWED_UPLOAD_DIRS` | empty | Platform-separated upload roots; missing configuration disables only uploads |
| `OPENPROJECT_WRITE_ENABLED` | restricted: `false` | Enables restricted-mode writes |
| `OPENPROJECT_ALLOWED_WRITE_TOOLS` | restricted: empty | Exact registered write-tool list; empty denies restricted writes |
| `OPENPROJECT_ALLOWED_PROJECT_IDS` | restricted: empty | Comma-separated restricted project IDs |
| `OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS` | restricted: empty | Comma-separated restricted work-package type IDs |
| `OPENPROJECT_MODULE_EVIDENCE` | restricted: empty | JSON module evidence for restricted meeting writes |
| `OPENPROJECT_MEMBERSHIP_WRITE_POLICY` | restricted: empty | JSON membership project allowlists for restricted mode |
| `OPENPROJECT_MEMBERSHIP_PROTECTION` | restricted: empty | JSON protected project, membership, and last-admin records |
| `OPENPROJECT_ALLOW_DESTRUCTIVE` | restricted: `false` | Enables restricted-mode destructive writes |
| `OPENPROJECT_AUDIT_ENABLED` | `true` | Emits sanitized audit records to stderr |

`OPENPROJECT_BASE_URL` and `OPENPROJECT_API_KEY` remain compatibility aliases.

## Compatibility and limitations

The server uses OpenProject API v3 over HTTPS and runs as a local stdio process. It is intended for Community and Enterprise installations that expose the endpoints used by the registered tools. OpenProject remains the authorization authority in native mode.

The inherited tool set includes read and write capabilities for projects, work packages, attachments, relations, watchers, notifications, boards, users, and reference data. Tool names and MCP annotations are preserved. The restricted API escape hatch accepts relative GET paths under `/api/v3` only.

No live OpenProject instance is contacted during the test suite. Before use, validate with a disposable instance and an appropriately scoped token. Do not rely on this project for an unreviewed production migration or as a substitute for OpenProject backups.

## Documentation

- [Architecture and security boundaries](docs/architecture.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Upstream attribution and sync](UPSTREAM.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Changelog](CHANGELOG.md)

## Development

```bash
cd plugins/openproject
bun install --frozen-lockfile
bun run check
bun run build
```

Please report reproducible defects without including API tokens, private URLs, customer data, or logs that contain them. Contributions that include focused tests and documentation updates are especially welcome.

## License

[MIT](LICENSE). OpenProject is a trademark of OpenProject GmbH. This project is not affiliated with or endorsed by OpenProject GmbH.
