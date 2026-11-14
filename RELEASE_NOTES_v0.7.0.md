# OpenProject MCP v0.7.0

## Native OpenProject authorization by default

v0.7.0 changes the default authorization model. New installations need only:

```text
OPENPROJECT_URL=https://openproject.example.com
OPENPROJECT_API_TOKEN=<user-token>
```

The default `native` mode registers all 72 tools and leaves OpenProject to authorize every confirmed write using the configured user/token. Before a mutation, the server preserves technical preflight for exact route, namespace, target, ownership, payload, and concurrency validation; local ACL checks apply only in optional restricted mode. It also preserves preview-before-confirmation, destructive MCP annotations, sanitized errors/audit, and upload filesystem protection.

## Optional restricted mode and migration

`OPENPROJECT_AUTHORIZATION_MODE=restricted` retains the v0.6.3 local policy controls for advanced deployments that need an additional authorization layer. Existing configurations with legacy restriction variables and no explicit mode stay restricted automatically and receive a sanitized startup warning. Set an explicit mode when upgrading to make the intended posture clear.

`OPENPROJECT_ALLOWED_UPLOAD_DIRS` remains required only for the local upload tool. It does not disable other native-mode writes.

## Compatibility

- Tool names, input schemas, and MCP annotations remain compatible.
- The 72-tool and 32-write inventory is unchanged.
- No live OpenProject calls are made by the deterministic test suite.
- This release is prepared locally only; publishing remains a separate approval and release action.
