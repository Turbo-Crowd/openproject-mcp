# OpenProject MCP v0.7.1

## Membership role resolution fix

v0.7.1 is a focused patch to project membership creation and update. Previously, a
role passed as a numeric id or as a numeric string could fail to resolve and a
write could be rejected before it reached OpenProject. This release resolves
membership roles against the live role collection before any write:

- a positive integer role id resolves to that id;
- a numeric string (for example `"4"`) is coerced to its id and resolves;
- an exact role name (for example `"Member"`) resolves to its id.

An unknown role, or a role collection that reports more entries than were
returned, now fails closed with a structured `ROLE_UNRESOLVED` result and no
request is sent.

## Structured membership write errors

Membership create, update, and delete failures now return a structured result
that preserves the OpenProject `errorIdentifier`, a bounded `message`, and the
`httpStatus` when the transport reports it. The server does not auto-retry a
failed membership write. `MEMBERSHIP_WRITE_NOT_AUTHORIZED` remains a thrown
default-deny: the generic MCP stays assignment-agnostic and never enforces a
mandatory assignee.

## Compatibility

- Tool names, input schemas, and MCP annotations remain compatible.
- The 72-tool and 32-write inventory is unchanged.
- Preview remains zero-I/O; no live OpenProject calls are made by the
  deterministic test suite.
- This release is prepared locally only; publishing remains a separate approval
  and release action.
