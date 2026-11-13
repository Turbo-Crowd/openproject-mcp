# Contributing

Thank you for considering a contribution to OpenProject MCP. This public MIT fork is maintained by Turbo Crowd and credits its upstream project; see [UPSTREAM.md](UPSTREAM.md).

## Before you start

Open an issue before substantial work so maintainers can discuss API compatibility, safety impact, and test scope. Do not submit credentials, environment files, private instance URLs, customer data, or unredacted logs.

## Development setup

```bash
cd plugins/openproject
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build
```

Use a disposable OpenProject instance and a least-privilege token for manual checks. The automated suite must not require a live OpenProject call.

## Pull requests

- Keep each change focused and preserve existing tool names, required inputs, and annotations unless the issue explicitly proposes a compatible migration.
- Add deterministic tests for behavior, particularly policy, write, delete, and sanitization changes.
- Document user-visible configuration or safety changes.
- State validation commands and any limitations in the pull request.
- Use Conventional Commits, for example `feat: add status lookup` or `fix: preserve work package lock version`.

## Safety changes

Writes must remain least-privilege and fail closed. Preview behavior, explicit confirmation, allowlists, destructive guards, and audit redaction need tests. Do not broaden a configured scope as a convenience or use a live production instance as a test target.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
