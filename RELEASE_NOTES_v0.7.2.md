# OpenProject MCP v0.7.2

## Membership user-link fix

v0.7.2 is a focused patch to project membership creation. Previously, the
membership create request serialized the principal HAL link as
`/api/v3/principals/{id}`. OpenProject treats that generic principal route as a
type mismatch on a membership write and rejected the request with a structured
`ResourceTypeMismatch` error. This release serializes the user-specific route:

- a user principal now links to `/api/v3/users/{id}`, which is the correct
  principal type for a user membership.

## Compatibility

- The membership input schema stays user-only (`principalId`). Groups remain
  unsupported and are never serialized as a user; no polymorphic group inference
  is performed.
- `ce_update_membership` remains roles-only and does not serialize a principal
  link; the numeric `PRINCIPAL_MISMATCH` guard and the protected-project and
  last-admin delete guards are unchanged.
- Preview remains zero-I/O; default-deny `MEMBERSHIP_WRITE_NOT_AUTHORIZED` and
  structured write errors (`errorIdentifier`, bounded `message`, `httpStatus`,
  no auto-retry) are preserved.
- Tool names, input schemas, and MCP annotations remain compatible. The 72-tool
  and 32-write inventory is unchanged.
- The generic MCP stays assignment-agnostic and never enforces a mandatory
  assignee.
