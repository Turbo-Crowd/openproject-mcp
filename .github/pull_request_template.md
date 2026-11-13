## Summary

- Describe the user-visible change and compatibility impact.

## Validation

- [ ] `bun run typecheck`
- [ ] `bun test`
- [ ] `bun run build`
- [ ] `bash -n scripts/install.sh scripts/uninstall.sh`

## Safety and documentation

- [ ] This change does not expose tokens, private URLs, or customer data.
- [ ] Write/delete behavior remains fail-closed and has deterministic tests.
- [ ] Documentation and changelog are updated when behavior changes.
- [ ] Tool names, required inputs, and annotations remain compatible, or the migration is explained.
