# Changelog

All notable changes to this project are documented here. The project follows [Semantic Versioning](https://semver.org/).

## Unreleased

## 0.6.2 - 2026-11-13

### Added

- Exact server-side write-tool allowlisting through `OPENPROJECT_ALLOWED_WRITE_TOOLS`; the default empty list denies every confirmed write while preserving zero-I/O previews.
- Confirmed meeting, agenda, section, and outcome mutations now require project-bound `confirmed_enabled` meeting-module evidence.
- Membership create, update, and delete now require explicit per-operation project authorization through `OPENPROJECT_MEMBERSHIP_WRITE_POLICY`, in addition to the generic write, project, tool, destructive, and protection gates.

### Changed

- Uploads require explicit `OPENPROJECT_ALLOWED_UPLOAD_DIRS`; no configured roots now fail closed before local file bytes are read.
- The policy loader rejects unknown/non-write allowlist entries and duplicate module-evidence project/module records.

## 0.6.1 - 2026-11-13

### Fixed

- Time-entry listing now uses the API v3 collection with `entity_type` and `entity_id` filters, so an empty filtered collection is returned as an empty result rather than a missing nested route.
- The time-entry activity discovery tool now uses OpenProject's `time_entries/available_projects` contract.
- Project membership listing and duplicate detection now use the memberships collection filtered by project instead of an unsupported nested route.
- Confirmed `update_work_package` mutations now resolve and policy-check the target's live project and type links before PATCH. Missing or malformed ownership/type evidence fails closed.

## 0.6.0 - 2026-11-13

### Changed

- Fork identity is now Turbo Crowd: package `@turbo-crowd/openproject-mcp` and planned MCP Registry identity `io.github.Turbo-Crowd/openproject-mcp`.
- Added explicit upstream attribution, an adoption-focused README, contribution and security guidance, a Code of Conduct, and upstream sync policy.

### Added

- Fail-closed policy configuration with empty defaults, preview-first decisions, optional project/type allowlists, a separate destructive opt-in, and sanitized audit primitives.
- Deterministic policy tests, including malformed configuration, preview behavior, scope denial, destructive denial, and sanitization checks.
- Thirty-one CE tools for Meetings and agenda structures, News, Time Tracking, memberships, and project capability evidence, with offline fake-HAL E2E validation and exact 72-tool stdio discovery coverage.
- A data-driven deterministic matrix for all 32 writes, proving preview behavior, runtime annotations, and fail-closed confirmed paths under synthetic policy, plus fake-HAL confirmed-success E2E coverage for inherited writes under verified scope.

### Fixed

- Attachment metadata is encoded as a scalar multipart JSON field.
- Relation creation resolves the source HAL action route, validates targets and lag, detects duplicates, and sends a target-only payload.

### Known boundaries

- Disposable-instance live E2E validation of version-specific CE contracts is pending.
- Disposable-instance validation of version-specific write and recovery contracts is pending.
- OpenCode runtime cutover is pending.

## 0.5.0 - 2026-07-14

### Added

- Project CRUD, native filtering, sorting, pagination, and count tools.
- Work-package activities, deletion, scheduling, estimates, progress, hierarchy, responsibility, and versions.
- Attachment uploads and deletion, relations, watchers, notifications, boards, users, available assignees, and reference data.
- Request timeout and authentication-mode controls.
- Restricted GET-only API v3 passthrough for uncommon read workflows.
