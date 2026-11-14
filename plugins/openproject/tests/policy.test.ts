import { describe, expect, test } from "bun:test";
import {
  createAuditRecord,
  evaluateMutation,
  loadMembershipProtection,
  loadMembershipWritePolicy,
  loadModuleEvidence,
  loadOpenProjectPolicy,
  moduleEvidenceState,
  sanitizeAuditValue,
} from "../scripts/policy.js";

describe("OpenProject authorization modes", () => {
  test("defaults clean installations to native authorization", () => {
    const policy = loadOpenProjectPolicy({});
    expect(policy).toMatchObject({ authorizationMode: "native", legacyModeInferred: false });
    expect(evaluateMutation(policy, { tool: "create_work_package", operation: "write", projectId: 999, workPackageTypeId: 888, confirm: true })).toEqual({ allowed: true, preview: false });
    expect(evaluateMutation(policy, { tool: "delete_work_package", operation: "destructive", projectId: 999, confirm: true })).toEqual({ allowed: true, preview: false });
  });

  test("always previews without confirmation in both modes", () => {
    for (const policy of [loadOpenProjectPolicy({}), loadOpenProjectPolicy({ OPENPROJECT_AUTHORIZATION_MODE: "restricted" })]) {
      expect(evaluateMutation(policy, { tool: "create_work_package", operation: "write", confirm: false })).toMatchObject({ allowed: false, preview: true });
    }
  });

  test("infers restricted mode from legacy restriction variables", () => {
    const policy = loadOpenProjectPolicy({ OPENPROJECT_WRITE_ENABLED: "true", OPENPROJECT_ALLOWED_WRITE_TOOLS: "create_work_package" });
    expect(policy).toMatchObject({ authorizationMode: "restricted", legacyModeInferred: true });
    expect(evaluateMutation(policy, { tool: "create_work_package", operation: "write", projectId: 7, confirm: true })).toMatchObject({ allowed: false, reason: "Target project is not in OPENPROJECT_ALLOWED_PROJECT_IDS." });
  });

  test("fails closed in explicit restricted mode and validates malformed configuration", () => {
    const policy = loadOpenProjectPolicy({ OPENPROJECT_AUTHORIZATION_MODE: "restricted", OPENPROJECT_WRITE_ENABLED: "true", OPENPROJECT_ALLOWED_PROJECT_IDS: "7", OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS: "3", OPENPROJECT_ALLOWED_WRITE_TOOLS: "create_work_package" });
    expect(evaluateMutation(policy, { tool: "create_work_package", operation: "write", projectId: 7, workPackageTypeId: 3, confirm: true })).toEqual({ allowed: true, preview: false });
    expect(evaluateMutation(policy, { tool: "create_work_package", operation: "write", projectId: 8, workPackageTypeId: 3, confirm: true })).toMatchObject({ allowed: false });
    expect(() => loadOpenProjectPolicy({ OPENPROJECT_AUTHORIZATION_MODE: "invalid" })).toThrow(/native or restricted/);
    expect(() => loadOpenProjectPolicy({ OPENPROJECT_AUTHORIZATION_MODE: "restricted", OPENPROJECT_WRITE_ENABLED: "yes" })).toThrow(/must be true or false/);
    expect(() => loadOpenProjectPolicy({ OPENPROJECT_ALLOWED_PROJECT_IDS: "a" })).toThrow(/positive integers/);
  });

  test("retains strict restricted tool and destructive policy", () => {
    const policy = loadOpenProjectPolicy({ OPENPROJECT_AUTHORIZATION_MODE: "restricted", OPENPROJECT_WRITE_ENABLED: "true", OPENPROJECT_ALLOWED_WRITE_TOOLS: "delete_work_package" });
    expect(evaluateMutation(policy, { tool: "delete_work_package", operation: "destructive", confirm: true })).toMatchObject({ allowed: false });
    expect(() => loadOpenProjectPolicy({ OPENPROJECT_ALLOWED_WRITE_TOOLS: "create_*" })).toThrow(/exact tool names/);
    expect(() => loadOpenProjectPolicy({ OPENPROJECT_ALLOWED_WRITE_TOOLS: "list_projects" }, ["create_work_package"])).toThrow(/unknown or non-write/);
  });

  test("loads restricted module and membership policy safely", () => {
    const policy = loadOpenProjectPolicy({ OPENPROJECT_MODULE_EVIDENCE: '[{"projectId":7,"module":"meetings","state":"confirmed_enabled","source":"admin-ui"}]' });
    expect(moduleEvidenceState(policy, 7, "meetings")).toBe("confirmed_enabled");
    expect(moduleEvidenceState(policy, 8, "meetings")).toBe("unproven");
    expect(() => loadModuleEvidence('[{"projectId":7,"module":"meetings","state":"enabled"}]')).toThrow(/invalid/);
    expect(loadMembershipProtection('{"protectedProjectIds":[7],"protectedMembershipIds":[8],"lastAdminMembershipIds":[9]}')).toEqual({ protectedProjectIds: [7], protectedMembershipIds: [8], lastAdminMembershipIds: [9] });
    expect(loadMembershipWritePolicy(undefined)).toEqual({ allowedCreateProjectIds: [], allowedUpdateProjectIds: [], allowedDeleteProjectIds: [] });
  });

  test("redacts secrets and records the active authorization mode", () => {
    const policy = loadOpenProjectPolicy({});
    expect(sanitizeAuditValue({ apiToken: "secret", endpoint: "http://127.0.0.1:3000/api" })).toEqual({ apiToken: "<redacted>", endpoint: "<private-url>" });
    const record = createAuditRecord(policy, { tool: "x", operation: "write", confirm: true }, { allowed: false, preview: false, reason: "token=secret" });
    expect(record.authMode).toBe("native");
    expect(JSON.stringify(record)).not.toContain("secret");
  });
});
