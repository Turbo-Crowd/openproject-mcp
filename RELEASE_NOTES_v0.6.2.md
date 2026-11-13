# OpenProject MCP v0.6.2

## Enforcement hardening

v0.6.2 makes server-side write policy stricter by default without changing the public MCP tool inventory, tool names, schemas, or annotations.

- Every one of the 32 write tools now requires an exact entry in `OPENPROJECT_ALLOWED_WRITE_TOOLS` after preview confirmation. The default empty list denies every confirmed write.
- Meeting and agenda mutations require `OPENPROJECT_MODULE_EVIDENCE` to record `confirmed_enabled` for the target project. Missing, disabled, and unproven evidence deny confirmed mutation.
- Membership create, update, and delete require explicit per-operation project entries in `OPENPROJECT_MEMBERSHIP_WRITE_POLICY`. Existing protected-project, protected-membership, last-admin, project, destructive, and assertion safeguards remain in force.
- Uploads require an explicit `OPENPROJECT_ALLOWED_UPLOAD_DIRS` configuration. Preview and policy denials complete before any local file bytes are read.

## Upgrade notes

Set an explicit minimal write-tool allowlist before enabling confirmed writes. Configure upload roots only when upload capability is intended. Configure meeting module evidence and membership operation allowlists only for the projects and operations approved for use.

No database migration is required. This candidate has not contacted a live OpenProject instance.
