# Troubleshooting

## The server reports missing credentials

Set `OPENPROJECT_URL` and `OPENPROJECT_API_TOKEN` in the MCP client environment or a private environment file. Use an HTTPS URL such as `https://openproject.example.com`. Do not paste the token into an issue or terminal transcript.

## A policy-gated write returns a preview

This is expected when `confirm` is omitted. Review the request, then repeat it with `confirm: true` only if the mutation is intended.

## A confirmed write is denied

Check the policy variables without exposing their values:

- `OPENPROJECT_WRITE_ENABLED` must be `true`.
- `OPENPROJECT_ALLOWED_PROJECT_IDS` must include the target project when the tool supplies one.
- `OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS` must include the target type when the tool supplies one.
- Destructive actions additionally require `OPENPROJECT_ALLOW_DESTRUCTIVE=true`.

For confirmed inherited writes, scope is verified from the target resource where possible. Supply `projectId` for `create_work_package`, `mark_all_notifications_read`, and a top-level `create_project`; a subproject `create_project` instead derives scope from `parentId`. A top-level project uses `projectId` only as an explicit configured authorization scope. Empty, missing, malformed, unresolved, or mismatched scope values fail closed. This is intentional; consult the [README](../README.md) for deterministic-validation limits and current tool coverage.

## An upload path is rejected

Uploads must be under `OPENPROJECT_ALLOWED_UPLOAD_DIRS`, or under the process working directory when the variable is unset. The server resolves symlinks before checking the boundary, so a link to a file outside an allowed root is denied.

## OpenProject rejects an update

The token may lack permission, the target may no longer exist, or another client may have changed a work package. Work-package updates use the current `lockVersion` to avoid silently overwriting a concurrent change. Read the resource again, review the change, and retry only if appropriate.

## Connection or authentication failures

Verify that the configured URL is the OpenProject origin, that API v3 is available, and that `OPENPROJECT_AUTH_MODE` matches the instance. The default is `basic`; `bearer` is available for compatible installations. Use a least-privilege token and a disposable instance when diagnosing.

## Reporting a defect

Include the server version, client, redacted command/configuration names, safe reproduction steps, and expected versus actual behavior. For security-sensitive problems, follow [SECURITY.md](../SECURITY.md) instead of opening a public issue.
