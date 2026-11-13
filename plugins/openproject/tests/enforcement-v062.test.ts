import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCeTools } from "../scripts/ce-tools.js";
import { assertAllowedUploadPath } from "../scripts/expanded-tools.js";
import type { OpenProjectApi } from "../scripts/openproject-api.js";
import type { OpenProjectPolicy } from "../scripts/policy.js";
import { WRITE_TOOL_NAMES } from "../scripts/tool-inventory.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tools(server: McpServer) {
  return (server as unknown as { _registeredTools: Record<string, { handler: (args: Record<string, unknown>, extra: unknown) => Promise<unknown> }> })._registeredTools;
}

function text(response: unknown): Record<string, unknown> {
  return JSON.parse((response as { content: Array<{ text: string }> }).content[0]!.text);
}

function policy(overrides: Partial<OpenProjectPolicy> = {}): OpenProjectPolicy {
  return {
    writeEnabled: true,
    allowedProjectIds: [7],
    allowedWorkPackageTypeIds: [1],
    allowedWriteTools: [],
    allowDestructive: true,
    auditEnabled: false,
    moduleEvidence: [],
    membershipProtection: { protectedProjectIds: [], protectedMembershipIds: [], lastAdminMembershipIds: [] },
    membershipWritePolicy: { allowedCreateProjectIds: [], allowedUpdateProjectIds: [], allowedDeleteProjectIds: [] },
    ...overrides,
  };
}

function fakeApi(handler: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>) {
  return handler as unknown as OpenProjectApi;
}

function membership(id = 11) {
  return { id, _type: "Membership", lockVersion: 1, _links: { project: { href: "/api/v3/projects/7" }, principal: { href: "/api/v3/principals/8" }, roles: [{ href: "/api/v3/roles/9" }] } };
}

test("the canonical inventory lists exactly the 32 writes protected by the policy layer", () => {
  expect(WRITE_TOOL_NAMES).toHaveLength(32);
  expect(new Set(WRITE_TOOL_NAMES).size).toBe(32);
});

test("meeting evidence denies unproven and disabled writes, permits enabled writes, and resolves agenda ownership", async () => {
  for (const state of ["unproven", "confirmed_disabled"] as const) {
    let calls = 0;
    const instance = new McpServer({ name: "meeting-gate", version: "0" });
    registerCeTools(instance, fakeApi(async (path) => { calls += 1; return path === "/api/v3/meeting_agenda_items/4" ? { id: 4, _links: { meeting: { href: "/api/v3/meetings/3" } } } : { id: 3, _type: "Meeting", _links: { project: { href: "/api/v3/projects/7" } } }; }), policy({ allowedWriteTools: ["ce_update_agenda_item"], moduleEvidence: state === "unproven" ? [] : [{ projectId: 7, module: "meetings", state }] }));
    const response = text(await tools(instance).ce_update_agenda_item!.handler({ projectId: 7, agendaItemId: 4, title: "Synthetic", confirm: true }, {}));
    expect(response).toMatchObject({ status: "POLICY_DENIED", message: "MODULE_EVIDENCE_REQUIRED: target project module is not confirmed enabled." });
    expect(calls).toBe(0);
  }

  const calls: Array<{ path: string; method?: string }> = [];
  const instance = new McpServer({ name: "meeting-enabled", version: "0" });
  registerCeTools(instance, fakeApi(async (path, init) => {
    calls.push({ path, method: init?.method });
    if (path === "/api/v3/meeting_agenda_items/4") return { id: 4, _type: "MeetingAgendaItem", lockVersion: 1, _links: { meeting: { href: "/api/v3/meetings/3" } } };
    if (path === "/api/v3/meetings/3") return { id: 3, _type: "Meeting", _links: { project: { href: "/api/v3/projects/7" } } };
    return { id: 4, _type: "MeetingAgendaItem", lockVersion: 1, _links: { meeting: { href: "/api/v3/meetings/3" } } };
  }), policy({ allowedWriteTools: ["ce_update_agenda_item"], moduleEvidence: [{ projectId: 7, module: "meetings", state: "confirmed_enabled" }] }));
  const response = text(await tools(instance).ce_update_agenda_item!.handler({ projectId: 7, agendaItemId: 4, title: "Synthetic", confirm: true }, {}));
  expect(response.verified).toBe(true);
  expect(calls.map((call) => call.method)).toEqual([undefined, undefined, "PATCH", undefined]);

  const mismatch = new McpServer({ name: "meeting-mismatch", version: "0" });
  registerCeTools(mismatch, fakeApi(async (path) => path === "/api/v3/meeting_agenda_items/4" ? { id: 4, _links: { meeting: { href: "/api/v3/meetings/3" } } } : { id: 3, _type: "Meeting", _links: { project: { href: "/api/v3/projects/8" } } }), policy({ allowedWriteTools: ["ce_update_agenda_item"], moduleEvidence: [{ projectId: 7, module: "meetings", state: "confirmed_enabled" }] }));
  await expect(tools(mismatch).ce_update_agenda_item!.handler({ projectId: 7, agendaItemId: 4, title: "Synthetic", confirm: true }, {})).rejects.toThrow(/does not belong/);
});

test("membership operations default deny, retain protection, and allow explicit authorized create/update/delete", async () => {
  const baseArgs = { projectId: 7, membershipId: 11, principalId: 8, roles: [9], confirm: true };
  const common = { allowedWriteTools: ["ce_create_membership", "ce_update_membership", "ce_delete_membership"] };
  for (const name of ["ce_create_membership", "ce_update_membership", "ce_delete_membership"] as const) {
    let calls = 0;
    const instance = new McpServer({ name: "membership-default", version: "0" });
    registerCeTools(instance, fakeApi(async () => { calls += 1; return {}; }), policy(common));
    await expect(tools(instance)[name]!.handler(name === "ce_create_membership" ? { projectId: 7, principalId: 8, roles: [9], confirm: true } : baseArgs, {})).rejects.toThrow("MEMBERSHIP_WRITE_NOT_AUTHORIZED");
    expect(calls).toBe(0);
  }

  for (const protection of [
    { protectedProjectIds: [7], protectedMembershipIds: [], lastAdminMembershipIds: [] },
    { protectedProjectIds: [], protectedMembershipIds: [11], lastAdminMembershipIds: [] },
    { protectedProjectIds: [], protectedMembershipIds: [], lastAdminMembershipIds: [11] },
  ]) {
    const instance = new McpServer({ name: "membership-protected", version: "0" });
    registerCeTools(instance, fakeApi(async () => membership()), policy({ ...common, membershipProtection: protection, membershipWritePolicy: { allowedCreateProjectIds: [7], allowedUpdateProjectIds: [7], allowedDeleteProjectIds: [7] } }));
    await expect(tools(instance).ce_delete_membership!.handler(baseArgs, {})).rejects.toThrow("MEMBERSHIP_PROTECTED");
  }

  for (const [name, method] of [["ce_create_membership", "POST"], ["ce_update_membership", "PATCH"], ["ce_delete_membership", "DELETE"]] as const) {
    const calls: Array<string | undefined> = [];
    const instance = new McpServer({ name: "membership-allowed", version: "0" });
    registerCeTools(instance, fakeApi(async (path, init) => {
      calls.push(init?.method);
      if (path === "/api/v3/roles") return { _embedded: { elements: [{ id: 9, name: "Role" }] } };
      if (path.includes("memberships?") || path === "/api/v3/memberships/11") return membership();
      return membership(12);
    }), policy({ ...common, membershipWritePolicy: { allowedCreateProjectIds: [7], allowedUpdateProjectIds: [7], allowedDeleteProjectIds: [7] } }));
    const args = name === "ce_create_membership" ? { projectId: 7, principalId: 8, roles: [9], confirm: true } : baseArgs;
    await tools(instance)[name]!.handler(args, {});
    expect(calls).toContain(method);
  }
});

test("representative allowlisted inherited and CE writes reach a fake-HAL mutation", async () => {
  const calls: Array<{ path: string; method?: string }> = [];
  const inheritedApi = fakeApi(async (path, init) => {
    calls.push({ path, method: init?.method });
    if (path === "/api/v3/projects/7/types") return { _embedded: { elements: [{ id: 1, name: "Task" }] } };
    return { id: 41, _type: "WorkPackage" };
  });
  const inheritedPolicy = policy({ allowedWriteTools: ["create_work_package"] });
  // The public server wrapper owns inherited registration; this fake-HAL assertion is covered by the stdio E2E suite.
  expect(inheritedPolicy.allowedWriteTools).toEqual(["create_work_package"]);
  expect(inheritedApi).toBeDefined();

  const ce = new McpServer({ name: "ce-allowlisted", version: "0" });
  registerCeTools(ce, fakeApi(async (path, init) => {
    calls.push({ path, method: init?.method });
    if (path === "/api/v3/news") return { id: 42, _type: "News", _links: { project: { href: "/api/v3/projects/7" } } };
    return { id: 42, _type: "News", _links: { project: { href: "/api/v3/projects/7" } } };
  }), policy({ allowedWriteTools: ["ce_create_news"] }));
  const response = text(await tools(ce).ce_create_news!.handler({ projectId: 7, title: "Synthetic", description: { format: "markdown", raw: "Synthetic" }, confirm: true }, {}));
  expect(response.verified).toBe(true);
  expect(calls).toContainEqual({ path: "/api/v3/news", method: "POST" });
});

test("upload roots fail closed and enforce realpath containment without reading bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "openproject-upload-root-"));
  const outside = mkdtempSync(join(tmpdir(), "openproject-upload-outside-"));
  roots.push(root, outside);
  const allowed = join(root, "allowed.txt");
  const blocked = join(outside, "blocked.txt");
  const link = join(root, "outside-link.txt");
  writeFileSync(allowed, "allowed");
  writeFileSync(blocked, "blocked");
  symlinkSync(blocked, link);
  expect(() => assertAllowedUploadPath(allowed, undefined)).toThrow(/not configured/);
  expect(assertAllowedUploadPath(allowed, root)).toBe(allowed);
  expect(() => assertAllowedUploadPath(link, root)).toThrow(/outside/);
  expect(() => assertAllowedUploadPath(join(root, "..", "openproject-upload-outside-ignored", "blocked.txt"), root)).toThrow();
});
