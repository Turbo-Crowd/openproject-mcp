# OpenProject MCP v0.6.0

Released artifact notes for the first Turbo Crowd release boundary of this MIT-friendly fork of [alex13slem/openproject-codex-plugin](https://github.com/alex13slem/openproject-codex-plugin). We retain upstream attribution, history, and the MIT license while maintaining a client-independent stdio MCP server.

## Highlights

- 72 deterministic-test-validated tools: 41 inherited OpenProject API v3 tools and 31 typed CE tools.
- CE coverage for Meetings, agenda items, sections and outcomes; News; Time Tracking; project-filtered memberships; and project-bound capability evidence.
- Attachment metadata handling and relation creation fixes, including source action resolution, duplicate detection, target validation, and target-only payloads.
- Preview-first, fail-closed mutations. Writes need explicit policy configuration and `confirm: true`; destructive operations require a separate opt-in. Sanitized audit records exclude secrets and private-loopback URLs.
- Client-independent local stdio positioning for compatible MCP clients, rather than a client-specific runtime dependency.

## Validation

The deterministic suite covers policy behavior, the 72-tool stdio inventory, write matrix behavior, and fake-HAL E2E paths. CI runs the frozen install, typecheck, tests, build, portable installer checks, manifest validation, and public-source sanitization on Linux, macOS, and Windows.

## Known boundaries

Disposable-instance live write validation for version-specific CE contracts and write/recovery behavior remains pending. OpenCode runtime cutover is also pending. This release does not claim npm or MCP Registry publication.

## Install from the release asset

1. Download `openproject-mcp-v0.6.0.tar.gz` and `SHA256SUMS` from the GitHub release.
2. Verify the archive before extracting:

```bash
sha256sum --check SHA256SUMS
```

3. Extract the archive and configure a compatible MCP client to run the included `openproject-mcp.js` as a local stdio process. Provide `OPENPROJECT_URL` and `OPENPROJECT_API_TOKEN` through the client environment; keep credentials private.

The release archive is a standalone distribution asset. The release workflow builds it with normalized entry order, timestamp, ownership, and gzip metadata, so the same tagged source produces the same archive bytes. Package and registry publication require a separate decision and are not implied by this release.

## Docker image build

Build the image from this repository checkout:

```bash
docker build -t openproject-mcp:v0.6.0 .
```

The Dockerfile builds the server from the checked-out source with the frozen Bun lockfile. It does not install an npm package, so it remains usable while package publication is intentionally unavailable.

## Contribute

Issues and focused pull requests are welcome, especially reproducible API-contract validation against disposable instances, safety tests, and client integration examples. Please do not include tokens, private URLs, or customer data in reports.
