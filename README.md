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
| Safety | Client annotations and upload roots | Fail-closed policy loader, preview-first writes, scoped confirmed paths, destructive opt-in, sanitized audit records | Disposable-instance contract validation |
| Documentation | Installation-oriented | Adoption, policy, compatibility, and contribution guidance | Disposable-instance E2E examples |

## Status and roadmap

This repository exposes 72 deterministic-test-validated tools: 41 inherited API v3 tools and 31 typed CE tools. The CE surface covers Meetings and agenda items, sections and outcomes; News; Time Tracking; project-filtered memberships; and project-bound capability evidence. Every CE mutation is preview-first, requires an allowed explicit project and `confirm: true`, and applies ownership checks before a network mutation.

This count is proven by offline stdio discovery, not live-instance compatibility evidence. The deterministic suite exercises every write's zero-I/O preview and fail-closed denials, and proves confirmed success under synthetic configured scope: each inherited write completes one intended mutation against a fake HAL API. See [ROADMAP.md](ROADMAP.md) for remaining disposable-instance validation. Please open an issue or submit a focused pull request if you can help validate an API contract or improve the safety layer.

## Quick start

Requirements:

- [Bun](https://bun.sh/) 1.3 or newer
- Any MCP client that supports a local stdio server
- An OpenProject API token restricted to the minimum projects and permissions needed

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

## Safety model

Reads use the configured API token's OpenProject permissions. Mutations are deliberately opt-in:

1. All writes default to a preview. Pass `confirm: true` only after reviewing the proposed operation.
2. `OPENPROJECT_WRITE_ENABLED` defaults to `false`. Enable it only for a deliberately configured instance.
3. `OPENPROJECT_ALLOWED_PROJECT_IDS` and `OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS` default to empty lists. A write targeting an ID outside its configured list is denied.
4. `OPENPROJECT_ALLOW_DESTRUCTIVE` defaults to `false` and is required in addition to the write gate for destructive operations.
5. Audit records omit secrets and replace private-loopback URLs. `OPENPROJECT_AUDIT_ENABLED` defaults to `true`.

Example policy for a disposable test instance only:

```text
OPENPROJECT_WRITE_ENABLED=true
OPENPROJECT_ALLOWED_PROJECT_IDS=101
OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS=1
OPENPROJECT_ALLOW_DESTRUCTIVE=false
```

All registered mutations pass through preview-first policy handling. Confirmed inherited mutations use verified resource ownership where available and are usable when the resolved scope is allowed by policy. `create_work_package`, `mark_all_notifications_read`, and a top-level `create_project` require `projectId` on confirmation because their target cannot establish scope itself; for top-level project creation, `projectId` is an explicit configured authorization scope, not inferred ownership. A subproject `create_project` derives scope from `parentId`. CE mutations require an explicit allowed project ID and perform endpoint-specific ownership checks where a target resource is involved. Omitting `confirm` always yields a harmless, zero-I/O preview.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENPROJECT_URL` | none | OpenProject origin, for example `https://openproject.example.com` |
| `OPENPROJECT_API_TOKEN` | none | API token; keep it private |
| `OPENPROJECT_PAGE_SIZE` | `25` | Default list size, from 1 to 100 |
| `OPENPROJECT_TIMEOUT_MS` | `30000` | Request timeout, from 1000 to 300000 ms |
| `OPENPROJECT_AUTH_MODE` | `basic` | `basic` or `bearer` |
| `OPENPROJECT_ALLOWED_UPLOAD_DIRS` | current directory | Platform-separated upload roots |
| `OPENPROJECT_WRITE_ENABLED` | `false` | Enables policy-gated writes |
| `OPENPROJECT_ALLOWED_PROJECT_IDS` | empty | Comma-separated permitted project IDs |
| `OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS` | empty | Comma-separated permitted work-package type IDs |
| `OPENPROJECT_ALLOW_DESTRUCTIVE` | `false` | Enables policy-gated destructive writes |
| `OPENPROJECT_AUDIT_ENABLED` | `true` | Emits sanitized policy audit records to stderr |

`OPENPROJECT_BASE_URL` and `OPENPROJECT_API_KEY` remain compatibility aliases.

## Compatibility and limitations

The server uses OpenProject API v3 over HTTPS and runs as a local stdio process. It is intended for Community and Enterprise installations that expose the endpoints used by the registered tools. OpenProject remains the authorization authority.

The inherited tool set includes read and write capabilities for projects, work packages, attachments, relations, watchers, notifications, boards, users, and reference data. Tool names and MCP annotations are preserved. The restricted API escape hatch accepts relative GET paths under `/api/v3` only.

No live OpenProject instance is contacted during the test suite. Before use, validate with a disposable instance and a least-privilege token. Do not rely on this project for an unreviewed production migration or as a substitute for OpenProject backups.

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
