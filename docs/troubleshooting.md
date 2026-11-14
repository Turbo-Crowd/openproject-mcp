# Troubleshooting

## The server reports missing credentials

Set `OPENPROJECT_URL` and `OPENPROJECT_API_TOKEN` in the MCP client environment or a private environment file. Use an HTTPS URL such as `https://openproject.example.com`. Do not paste the token into an issue or terminal transcript.

## A write returns a preview

This is expected when `confirm` is omitted. Review the request, then repeat it with `confirm: true` only if the mutation is intended. The shared preview gate returns before invoking its write handler in both authorization modes.

## A confirmed native-mode write is rejected

OpenProject is authoritative in native mode. The configured token may lack permission, the resource or module may be unavailable, the target may not exist, or a lock version may be stale. Inspect the sanitized 401, 403, 404, 409, or validation category, correct the request or permissions in OpenProject, and retry only when appropriate.

## A confirmed restricted-mode write is denied

Check the optional restricted policy without exposing values:

- `OPENPROJECT_AUTHORIZATION_MODE` must be `restricted` when local policy is intended.
- `OPENPROJECT_WRITE_ENABLED` must be `true`.
- Project, type, tool, destructive, module, and membership controls must permit the operation.

Existing v0.6.3 variables without an explicit mode infer restricted mode and produce a startup warning. Set `OPENPROJECT_AUTHORIZATION_MODE=native` to use OpenProject permissions without the local allowlists, or set it to `restricted` to retain the policy intentionally.

## An upload path is rejected

Uploads require `OPENPROJECT_ALLOWED_UPLOAD_DIRS` in both modes. The server resolves symlinks before checking the boundary, so a link to a file outside an allowed root is denied. Missing roots disable only local uploads, not other writes.

## OpenProject rejects an update

The token may lack permission, the target may no longer exist, or another client may have changed a work package. Work-package updates use the current `lockVersion` to avoid silently overwriting a concurrent change. Read the resource again, review the change, and retry only if appropriate.

## Connection or authentication failures

Verify that the configured URL is the OpenProject origin, that API v3 is available, and that `OPENPROJECT_AUTH_MODE` matches the instance. The default is `basic`; `bearer` is available for compatible installations. Use an appropriately scoped token and a disposable instance when diagnosing.

## Reporting a defect

Include the server version, client, redacted command/configuration names, safe reproduction steps, and expected versus actual behavior. For security-sensitive problems, follow [SECURITY.md](../SECURITY.md) instead of opening a public issue.
