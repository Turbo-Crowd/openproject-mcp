import { describe, expect, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CE_TOOL_NAMES, registerCeTools } from "../scripts/ce-tools.js";
import { OpenProjectTransportError, type OpenProjectApi } from "../scripts/openproject-api.js";
import type { OpenProjectPolicy } from "../scripts/policy.js";

const permissive: OpenProjectPolicy = {
  writeEnabled: true,
  allowedProjectIds: [21],
  allowedWorkPackageTypeIds: [],
  allowedWriteTools: ["ce_create_meeting", "ce_update_meeting", "ce_delete_meeting", "ce_create_agenda_item", "ce_update_agenda_item", "ce_create_meeting_section", "ce_create_meeting_outcome", "ce_delete_meeting_agenda_child", "ce_create_news", "ce_update_news", "ce_delete_news", "ce_create_time_entry", "ce_update_time_entry", "ce_delete_time_entry", "ce_create_membership", "ce_update_membership", "ce_delete_membership"],
  allowDestructive: true,
  auditEnabled: false,
  moduleEvidence: [{ projectId: 21, module: "meetings", state: "confirmed_enabled" }],
  membershipWritePolicy: { allowedCreateProjectIds: [21], allowedUpdateProjectIds: [21], allowedDeleteProjectIds: [21] },
};
const denied = { ...permissive, allowedProjectIds: [] };
function registered(server: McpServer) {
  return (server as unknown as { _registeredTools: Record<string, { annotations?: Record<string, boolean>; handler: (args: Record<string, unknown>, extra: unknown) => Promise<unknown> }> })._registeredTools;
}
function text(response: unknown) {
  return JSON.parse((response as { content: Array<{ text: string }> }).content[0]!.text);
}
function fakeApi(handler: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>) {
  return handler as unknown as OpenProjectApi;
}
function server(api: OpenProjectApi, policy = permissive) {
  const instance = new McpServer({ name: "test", version: "0" });
  registerCeTools(instance, api, policy);
  return instance;
}
async function call(instance: McpServer, name: string, args: Record<string, unknown>) {
  return registered(instance)[name]!.handler(args, {});
}

describe("CE tool inventory", () => {
  test("registers all 31 exact CE names with consistent annotations", () => {
    const instance = server(fakeApi(async () => ({})));
    const tools = registered(instance);
    expect(CE_TOOL_NAMES).toHaveLength(31);
    expect(CE_TOOL_NAMES.every((name) => Boolean(tools[name]))).toBe(true);
    for (const name of CE_TOOL_NAMES.slice(0, 14)) expect(tools[name]!.annotations?.readOnlyHint).toBe(true);
    for (const name of CE_TOOL_NAMES.slice(14)) expect(tools[name]!.annotations?.readOnlyHint).toBe(false);
    for (const name of ["ce_delete_meeting", "ce_delete_meeting_agenda_child", "ce_delete_news", "ce_delete_time_entry", "ce_delete_membership"]) expect(tools[name]!.annotations?.destructiveHint).toBe(true);
  });
});

describe("CE policy and fake HAL behavior", () => {
  test("returns preview before any transport call", async () => {
    let calls = 0;
    const instance = server(fakeApi(async () => { calls += 1; return {}; }));
    const response = text(await call(instance, "ce_create_news", { projectId: 21, title: "Synthetic", description: { format: "markdown", raw: "Body" } }));
    expect(response.preview).toBe(true);
    expect(calls).toBe(0);
  });

  test("denies disallowed projects before any transport call", async () => {
    let calls = 0;
    const instance = server(fakeApi(async () => { calls += 1; return {}; }), denied);
    await expect(call(instance, "ce_create_time_entry", { projectId: 22, entityType: "WorkPackage", entityId: 3, spentOn: "2026-01-02", hours: "PT1H", activityId: 1, confirm: true })).resolves.toBeDefined();
    expect(calls).toBe(0);
  });

  test("uses collection filters for entity time entries and preserves empty results", async () => {
    const paths: string[] = [];
    const instance = server(fakeApi(async (path) => { paths.push(path); return { offset: 1, pageSize: 25, count: 0, total: 0, _embedded: { elements: [] } }; }));
    const response = text(await call(instance, "ce_list_time_entries", { entityType: "WorkPackage", entityId: 7, offset: 1, pageSize: 25 }));
    expect(paths).toHaveLength(1);
    const request = new URL(paths[0]!, "https://openproject.invalid");
    expect(request.pathname).toBe("/api/v3/time_entries");
    expect(JSON.parse(request.searchParams.get("filters")!)).toEqual([{ entity_type: { operator: "=", values: ["WorkPackage"] } }, { entity_id: { operator: "=", values: ["7"] } }]);
    expect(response).toMatchObject({ status: "OK", total: 0, count: 0, elements: [] });
  });

  test("uses the available-projects activity contract", async () => {
    const paths: string[] = [];
    const instance = server(fakeApi(async (path) => { paths.push(path); return { _embedded: { elements: [{ id: 4, name: "Synthetic" }] } }; }));
    const response = text(await call(instance, "ce_list_time_entry_activities", {}));
    expect(paths).toEqual(["/api/v3/time_entries/available_projects"]);
    expect(response).toMatchObject({ status: "OK", elements: [{ id: 4, name: "Synthetic" }] });
  });

  test("uses the global membership collection with a project filter", async () => {
    const paths: string[] = [];
    const instance = server(fakeApi(async (path) => { paths.push(path); return { offset: 1, pageSize: 25, count: 1, total: 1, _embedded: { elements: [{ id: 5 }] } }; }));
    const response = text(await call(instance, "ce_list_memberships", { projectId: 7, offset: 1, pageSize: 25 }));
    const request = new URL(paths[0]!, "https://openproject.invalid");
    expect(request.pathname).toBe("/api/v3/memberships");
    expect(JSON.parse(request.searchParams.get("filters")!)).toEqual([{ project: { operator: "=", values: ["7"] } }]);
    expect(response).toMatchObject({ status: "OK", projectId: 7, elements: [{ id: 5 }] });
  });

  test("reports empty project meetings without claiming a disabled module", async () => {
    const instance = server(fakeApi(async () => ({ _embedded: { elements: [] } })));
    const response = text(await call(instance, "ce_list_meetings", { projectId: 21 }));
    expect(response.capability).toBe("NO_VISIBLE_MEETINGS");
    expect(response.status).toBe("OK");
  });

  test("returns sanitized permission, not-found, and stale-lock statuses", async () => {
    for (const [category, status] of [["PERMISSION_DENIED", 403], ["NOT_FOUND", 404], ["STALE_LOCK_VERSION", 409]] as const) {
      const instance = server(fakeApi(async () => { throw new OpenProjectTransportError(status, category); }));
      const response = text(await call(instance, "ce_get_meeting", { meetingId: 3 }));
      expect(response).toEqual({ status: category, message: expect.any(String) });
    }
  });

  test("uses a live lockVersion and rejects stale client lock versions", async () => {
    let calls = 0;
    const api = fakeApi(async () => { calls += 1; return { _type: "Meeting", id: 3, lockVersion: 4, _links: { project: { href: "/api/v3/projects/21" } } }; });
    const instance = server(api);
    await expect(call(instance, "ce_update_meeting", { projectId: 21, meetingId: 3, title: "Revised", lockVersion: 1, confirm: true })).rejects.toThrow("STALE_LOCK_VERSION");
    expect(calls).toBe(1);
  });

  test("rejects an owner mismatch before a destructive mutation", async () => {
    const methods: Array<string | undefined> = [];
    const api = fakeApi(async (_path: string, init?: RequestInit) => { methods.push(init?.method); return { id: 3, _type: "Meeting", _links: { project: { href: "/api/v3/projects/22" } } }; });
    const instance = server(api);
    await expect(call(instance, "ce_delete_meeting", { projectId: 21, meetingId: 3, confirm: true })).rejects.toThrow("does not belong");
    expect(methods).toEqual([undefined]);
  });

  test("requires destructive opt-in after preview confirmation", async () => {
    const instance = server(fakeApi(async () => ({})), { ...permissive, allowDestructive: false });
    const response = text(await call(instance, "ce_delete_news", { projectId: 21, newsId: 5, confirm: true }));
    expect(response.message).toMatch(/Destructive operations are disabled/);
  });

  test("fails closed when the owner project link is absent", async () => {
    const methods: Array<string | undefined> = [];
    const instance = server(fakeApi(async (_path, init) => { methods.push(init?.method); return { id: 3, _type: "Meeting", _links: {} }; }));
    await expect(call(instance, "ce_delete_meeting", { projectId: 21, meetingId: 3, confirm: true })).rejects.toThrow(/Cannot establish/);
    expect(methods).toEqual([undefined]);
  });

  test("does not infer meeting module state from an empty collection", async () => {
    const instance = server(fakeApi(async () => ({ _embedded: { elements: [] } })), { ...permissive, moduleEvidence: [{ projectId: 21, module: "meetings", state: "confirmed_disabled" }] });
    const response = text(await call(instance, "ce_list_meetings", { projectId: 21 }));
    expect(response.capability).toBe("NO_VISIBLE_MEETINGS");
    expect(response.moduleEvidence).toBe("confirmed_disabled");
  });

  test("denies protected membership deletion before transport", async () => {
    let calls = 0;
    const instance = server(fakeApi(async () => { calls += 1; return {}; }), { ...permissive, membershipProtection: { protectedProjectIds: [21], protectedMembershipIds: [], lastAdminMembershipIds: [] } });
    await expect(call(instance, "ce_delete_membership", { projectId: 21, membershipId: 3, principalId: 4, roles: [5], confirm: true })).rejects.toThrow("MEMBERSHIP_PROTECTED");
    expect(calls).toBe(0);
  });

  test("rejects malformed ISO durations before preview", async () => {
    const instance = server(fakeApi(async () => ({})));
    await expect(call(instance, "ce_create_meeting", { projectId: 21, title: "Synthetic", startTime: "2026-01-02T10:00:00Z", duration: "1", confirm: false })).rejects.toThrow();
  });
});
