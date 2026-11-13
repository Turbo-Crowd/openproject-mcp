# OpenProject MCP server

This package provides the local, general-purpose OpenProject API v3 MCP server used by the Turbo Crowd fork. It retains the inherited tool surface for projects, work packages, attachments, relations, boards, users, watchers, notifications, and reference data.

It is part of [OpenProject MCP](https://github.com/Turbo-Crowd/openproject-mcp), a fork of [alex13slem/openproject-codex-plugin](https://github.com/alex13slem/openproject-codex-plugin). The upstream project remains credited under the MIT license.

## Run with an MCP client

Configure `OPENPROJECT_URL` and `OPENPROJECT_API_TOKEN` through your client's private environment. Use an HTTPS origin such as `https://openproject.example.com`, and keep tokens out of commits and logs.

```bash
bun scripts/server.ts
```

For development, install with `bun install --frozen-lockfile` first. The package name is `@turbo-crowd/openproject-mcp`; publication is not part of this repository state.

## Policy configuration

The safety layer defaults to no mutation and emits previews for policy-gated writes until `confirm: true` is supplied. Configure only the minimum scope required:

- `OPENPROJECT_WRITE_ENABLED` defaults to `false`.
- `OPENPROJECT_ALLOWED_PROJECT_IDS` defaults to an empty list.
- `OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS` defaults to an empty list.
- `OPENPROJECT_ALLOW_DESTRUCTIVE` defaults to `false`.
- `OPENPROJECT_AUDIT_ENABLED` defaults to `true` and emits sanitized audit records to stderr.

All registered mutations use preview-first policy handling. Confirmed inherited mutations are usable when verified or explicit project scope matches configured policy, and fail closed when scope cannot be established. `create_work_package`, `mark_all_notifications_read`, and top-level `create_project` require `projectId` on confirmation; `create_project` derives scope from `parentId` when creating a subproject. CE mutations require an explicit allowed project and verify ownership for target resources. See the repository [README](../../README.md) for deterministic-validation limits and disposable-instance guidance.

## License

MIT
