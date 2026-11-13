# Security Policy

## Supported reporting path

Please do not disclose suspected vulnerabilities in a public issue. Use GitHub's private vulnerability reporting feature for this repository. Include the affected version or commit, safe reproduction steps, likely impact, and suggested mitigation.

Remove API tokens, private OpenProject URLs, customer data, and unredacted request logs before submitting a report. Do not test a suspected vulnerability against an instance you do not own or have permission to assess.

## Security model

- The server sends the API token only to the configured OpenProject origin.
- OpenProject remains the authorization authority for the token.
- Uploads are constrained to configured local roots and resolve symlinks before access.
- The policy layer defaults to no writes, empty scope lists, previews before confirmed policy-gated writes, and destructive actions disabled. Confirmed inherited writes establish authorization scope from the target HAL resource or an explicitly configured project scope when no target exists; mismatches fail closed.
- Sanitized audit records must not include credentials or private-loopback URLs.

If a token is exposed, revoke it in OpenProject immediately and replace it through your normal secret-management process.

## Scope

Report vulnerabilities in repository source, packaged configuration, documentation that could cause unsafe operation, or release automation. Operational support questions belong in an issue or discussion without sensitive details.
