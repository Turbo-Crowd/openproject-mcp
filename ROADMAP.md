# Roadmap

The roadmap favors safe, testable adoption over broad claims. Items are proposals, not commitments.

## Current fork baseline

- Retained API v3 project, work-package, attachment, relation, watcher, notification, board, user, and reference-data tools.
- Corrected attachment metadata and relation creation routing in the current migration branch.
- Added a public policy foundation: fail-closed configuration parsing, preview-first decisions, project/type allowlists, a destructive opt-in, and sanitized audit records.
- Added 31 deterministic-test-validated CE tools for Meetings and agenda structures, News, Time Tracking, project-filtered memberships, and capability evidence. Their 17 mutations are preview-first, project-gated, ownership-checked, audited, and destructively guarded where applicable.
- Added offline MCP stdio discovery and a data-driven matrix for all 32 writes: each proves preview behavior, no-I/O fail-closed denial under synthetic policy, and writable annotation metadata.
- Added a fake-HAL confirmed-success E2E for all 15 inherited writes: under verified, policy-allowed scope, each issues exactly one intended mutation. The matrix remains denial evidence, not usability evidence.
- Added an exact 72-tool runtime inventory: 41 inherited API v3 tools plus 31 CE tools.

## Next stages

1. Run disposable-instance live E2E coverage for version-specific API v3 and CE contracts. Live E2E is not part of the deterministic validation claim.
2. Extend recovery reporting from the current proportional pre-image data where a live endpoint contract supports it.
3. Add client-specific setup examples while retaining a client-independent MCP contract.
4. Decide publication, release automation, and registry registration in a separate reviewed workflow.

## Deliberately not claimed

The fork does not claim live-instance validation for all 72 tools, OAuth, a hosted service, automatic rollback, or a production migration guarantee.
