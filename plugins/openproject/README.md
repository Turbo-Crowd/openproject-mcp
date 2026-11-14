# OpenProject MCP server

This package provides the local, general-purpose OpenProject API v3 MCP server used by the Turbo Crowd fork. It retains the inherited tool surface for projects, work packages, attachments, relations, boards, users, watchers, notifications, and reference data.

It is part of [OpenProject MCP](https://github.com/Turbo-Crowd/openproject-mcp), a fork of [alex13slem/openproject-codex-plugin](https://github.com/alex13slem/openproject-codex-plugin). The upstream project remains credited under the MIT license.

## Run with an MCP client

Configure `OPENPROJECT_URL` and `OPENPROJECT_API_TOKEN` through your client's private environment. Use an HTTPS origin such as `https://openproject.example.com`, and keep tokens out of commits and logs.

```bash
bun scripts/server.ts
```

For development, install with `bun install --frozen-lockfile` first. The package name is `@turbo-crowd/openproject-mcp`; publication is not part of this repository state.

## Authorization modes

`native` is the default mode. It requires only URL and token credentials, registers all 72 tools, and lets OpenProject authorize every confirmed operation. The shared preview gate returns before invoking its handler until `confirm: true`; destructive tools retain their destructive MCP annotations. Technical preflight remains active in native mode: route validation, target namespace and ownership checks, lock versions, payload validation, sanitized errors, and upload-root controls. Only local ACL checks are skipped; OpenProject authorizes the confirmed request.

Set `OPENPROJECT_AUTHORIZATION_MODE=restricted` only when a deployment needs a local second authorization layer, such as a multi-tenant gateway or client-isolated agent. In restricted mode, the v0.6.3 write, project, type, tool, module, membership, destructive, and audit controls remain fail-closed. Existing installations that set a legacy restriction variable without selecting a mode are inferred as restricted and receive a sanitized startup warning.

`OPENPROJECT_ALLOWED_UPLOAD_DIRS` is independent of authorization mode. It is required only for the local upload tool because an OpenProject token cannot authorize reading local files. See the repository [README](../../README.md) for the complete configuration reference, compatibility guidance, and deterministic-validation limits.

## License

MIT
