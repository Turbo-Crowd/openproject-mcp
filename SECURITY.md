# Security Policy

## Supported reporting path

Please do not disclose suspected vulnerabilities in a public issue. Use GitHub's private vulnerability reporting feature for this repository. Include the affected version or commit, safe reproduction steps, likely impact, and suggested mitigation.

Remove API tokens, private OpenProject URLs, customer data, and unredacted request logs before submitting a report. Do not test a suspected vulnerability against an instance you do not own or have permission to assess.

## Security model

- The server sends the API token only to the configured OpenProject origin.
- In default native mode, OpenProject remains the authorization authority for the token after technical target, namespace, ownership, route, payload, and concurrency preflight. Local ACL checks apply only in restricted mode.
- Preview-first confirmation, destructive MCP annotations, route/payload validation, ownership assertions, lock-version handling, and sanitized audit records remain active in both authorization modes.
- Optional `restricted` mode adds a fail-closed local policy layer for explicit project, type, tool, module, membership, and destructive controls.
- Uploads are constrained to configured local roots and resolve symlinks before access; this local filesystem control is independent of OpenProject authorization.
- Sanitized audit records must not include credentials or private-loopback URLs.

If a token is exposed, revoke it in OpenProject immediately and replace it through your normal secret-management process.

## Scope

Report vulnerabilities in repository source, packaged configuration, documentation that could cause unsafe operation, or release automation. Operational support questions belong in an issue or discussion without sensitive details.
