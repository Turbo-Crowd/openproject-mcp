import { describe, expect, test } from "bun:test";
import {
  createAuditRecord,
  evaluateMutation,
  loadMembershipProtection,
  loadModuleEvidence,
  loadOpenProjectPolicy,
  moduleEvidenceState,
  sanitizeAuditValue,
} from "../scripts/policy.js";

describe("OpenProject policy", () => {
  test("fails closed for missing, empty, and malformed policy configuration", () => {
    const empty = loadOpenProjectPolicy({});
    expect(evaluateMutation(empty, { tool: "create_work_package", operation: "write", projectId: 1, confirm: true }).allowed).toBe(false);
    expect(() => loadOpenProjectPolicy({ OPENPROJECT_WRITE_ENABLED: "yes" })).toThrow(/must be true or false/);
    expect(() => loadOpenProjectPolicy({ OPENPROJECT_ALLOWED_PROJECT_IDS: "a" })).toThrow(/positive integers/);
  });

  test("previews by default and permits only explicitly scoped confirmed writes", () => {
    const policy = loadOpenProjectPolicy({
      OPENPROJECT_WRITE_ENABLED: "true",
      OPENPROJECT_ALLOWED_PROJECT_IDS: "7",
      OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS: "3",
    });
    expect(evaluateMutation(policy, { tool: "create_work_package", operation: "write", projectId: 7, workPackageTypeId: 3 }).preview).toBe(true);
    expect(evaluateMutation(policy, { tool: "create_work_package", operation: "write", projectId: 8, workPackageTypeId: 3, confirm: true })).toMatchObject({ allowed: false });
    expect(evaluateMutation(policy, { tool: "create_work_package", operation: "write", projectId: 7, workPackageTypeId: 3, confirm: true })).toEqual({ allowed: true, preview: false });
  });

  test("requires a separate destructive opt-in", () => {
    const policy = loadOpenProjectPolicy({ OPENPROJECT_WRITE_ENABLED: "true" });
    expect(evaluateMutation(policy, { tool: "delete_work_package", operation: "destructive", confirm: true })).toMatchObject({ allowed: false });
  });

  test("loads explicit module evidence without inferring absent evidence", () => {
    const policy = loadOpenProjectPolicy({ OPENPROJECT_MODULE_EVIDENCE: '[{"projectId":7,"module":"meetings","state":"confirmed_enabled","source":"admin-ui"}]' });
    expect(moduleEvidenceState(policy, 7, "meetings")).toBe("confirmed_enabled");
    expect(moduleEvidenceState(policy, 8, "meetings")).toBe("unproven");
    expect(() => loadModuleEvidence('[{"projectId":7,"module":"meetings","state":"enabled"}]')).toThrow(/invalid/);
  });

  test("loads membership protection and rejects malformed values", () => {
    expect(loadMembershipProtection('{"protectedProjectIds":[7],"protectedMembershipIds":[8],"lastAdminMembershipIds":[9]}')).toEqual({ protectedProjectIds: [7], protectedMembershipIds: [8], lastAdminMembershipIds: [9] });
    expect(() => loadMembershipProtection('{"protectedProjectIds":["bad"]}')).toThrow(/invalid/);
  });

  test("redacts secrets and private URLs from audit records", () => {
    expect(sanitizeAuditValue({ apiToken: "secret", endpoint: "http://127.0.0.1:3000/api" })).toEqual({ apiToken: "<redacted>", endpoint: "<private-url>" });
    expect(JSON.stringify(createAuditRecord({ tool: "x", operation: "write", confirm: true }, { allowed: false, preview: false, reason: "token=secret" }))).not.toContain("secret");
  });
});
