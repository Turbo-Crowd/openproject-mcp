import { expect, test } from "bun:test";
import { resolveInheritedWriteProjectScope } from "../scripts/inherited-write-scope.js";
import type { OpenProjectApi } from "../scripts/openproject-api.js";

const project = { id: 7, _type: "Project" };
const workPackage = (id: number) => ({
  id,
  _type: "WorkPackage",
  _links: { project: { href: "/api/v3/projects/7" } },
});

function apiForScope() {
  const calls: string[] = [];
  const api = (async (path: string) => {
    calls.push(path);
    if (path === "/api/v3/projects/7" || path === "/api/v3/projects/synthetic") return project;
    if (/^\/api\/v3\/work_packages\/\d+$/.test(path)) return workPackage(Number(path.split("/").pop()));
    if (path === "/api/v3/relations/7") {
      return { id: 7, _type: "Relation", _links: { from: { href: "/api/v3/work_packages/7" }, to: { href: "/api/v3/work_packages/8" } } };
    }
    if (path === "/api/v3/attachments/7") {
      return { id: 7, _type: "Attachment", _links: { container: { href: "/api/v3/work_packages/7" } } };
    }
    if (path === "/api/v3/notifications/7") {
      return { id: 7, _type: "Notification", _links: { project: { href: "/api/v3/projects/7" } } };
    }
    if (path === "/api/v3/notifications?pageSize=100") {
      return { total: 1, _embedded: { elements: [{ id: 7, _type: "Notification", _links: { project: { href: "/api/v3/projects/7" } } }] } };
    }
    throw new Error(`Unexpected preflight path: ${path}`);
  }) as unknown as OpenProjectApi;
  return { api, calls };
}

const confirmedWrites: Array<[string, Record<string, unknown>]> = [
  ["create_work_package", { projectId: 7 }],
  ["update_work_package", { id: 7 }],
  ["add_work_package_comment", { id: 7 }],
  ["create_project", { parentId: 7 }],
  ["update_project", { idOrIdentifier: "synthetic" }],
  ["delete_project", { id: 7 }],
  ["delete_work_package", { id: 7 }],
  ["create_work_package_relation", { fromId: 7, toId: 8 }],
  ["delete_work_package_relation", { id: 7 }],
  ["upload_work_package_attachment", { workPackageId: 7 }],
  ["delete_work_package_attachment", { attachmentId: 7 }],
  ["add_work_package_watcher", { workPackageId: 7 }],
  ["remove_work_package_watcher", { workPackageId: 7 }],
  ["mark_notification_read", { id: 7 }],
  ["mark_all_notifications_read", { projectId: 7 }],
];

test("all 15 inherited writes resolve confirmed project scope from fake HAL", async () => {
  expect(confirmedWrites).toHaveLength(15);
  for (const [tool, args] of confirmedWrites) {
    const { api, calls } = apiForScope();
    await expect(resolveInheritedWriteProjectScope(api, tool, args)).resolves.toBe(7);
    expect(calls.length).toBeGreaterThan(0);
  }
});

test("top-level project creation accepts an explicit configured authorization scope", async () => {
  const { api, calls } = apiForScope();
  await expect(resolveInheritedWriteProjectScope(api, "create_project", { projectId: 7 })).resolves.toBe(7);
  expect(calls).toEqual(["/api/v3/projects/7"]);
});

test("top-level project creation fails closed without an explicit authorization scope", async () => {
  const { api } = apiForScope();
  await expect(resolveInheritedWriteProjectScope(api, "create_project", {})).rejects.toThrow("requires projectId");
});

test("inherited write scope rejects mismatched caller scope", async () => {
  const { api } = apiForScope();
  await expect(resolveInheritedWriteProjectScope(api, "update_work_package", { id: 7, projectId: 8 })).rejects.toThrow("does not match");
});
