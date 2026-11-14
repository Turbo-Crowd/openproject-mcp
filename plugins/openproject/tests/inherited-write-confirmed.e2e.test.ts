import { afterEach, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transports: StdioClientTransport[] = [];
const uploadDir = "/tmp/openproject-mcp-synthetic-upload";
let projectCreatePayloads: Array<Record<string, unknown>> = [];

function response(value: unknown) {
  return new Response(JSON.stringify(value), { headers: { "Content-Type": "application/hal+json" } });
}

function project(id = 7) {
  return { id, _type: "Project" };
}

function workPackage(id: number) {
  return { id, _type: "WorkPackage", lockVersion: 1, _links: { project: { href: "/api/v3/projects/7" }, type: { href: "/api/v3/types/1" } } };
}

function result(responseValue: unknown) {
  const typed = responseValue as { content?: Array<{ text?: string }>; isError?: boolean };
  const text = typed.content?.[0]?.text;
  if (!text) throw new Error("Expected a text tool response.");
  if (typed.isError) throw new Error(text);
  return JSON.parse(text) as Record<string, unknown>;
}

afterEach(async () => {
  await Promise.all(transports.splice(0).map((transport) => transport.close()));
  rmSync(uploadDir, { recursive: true, force: true });
  projectCreatePayloads = [];
});

test("all 15 inherited writes use native fake-HAL preflight and issue exactly one intended mutation", async () => {
  mkdirSync(uploadDir, { recursive: true });
  const uploadPath = join(uploadDir, "synthetic.txt");
  writeFileSync(uploadPath, "synthetic");
  const mutations: Array<{ path: string; method: string }> = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      const path = `${url.pathname}${url.search}`;
      const method = request.method;
      if (["POST", "PATCH", "DELETE"].includes(method)) mutations.push({ path, method });
      if (path === "/api/v3/projects/7" || path === "/api/v3/projects/synthetic") return response(project());
      if (/^\/api\/v3\/work_packages\/\d+$/.test(url.pathname)) return response(workPackage(Number(url.pathname.split("/").pop())));
      if (path === "/api/v3/projects/7/types") return response({ _embedded: { elements: [{ id: 1, name: "Task" }] } });
      if (path === "/api/v3/relations/7") return response({ id: 7, _type: "Relation", _links: { from: { href: "/api/v3/work_packages/7" }, to: { href: "/api/v3/work_packages/8" } } });
      if (path === "/api/v3/work_packages/7/relations") return response({ _embedded: { elements: [] } });
      if (path === "/api/v3/attachments/7") return response({ id: 7, _type: "Attachment", _links: { container: { href: "/api/v3/work_packages/7" } } });
      if (path === "/api/v3/notifications/7") return response({ id: 7, _type: "Notification", _links: { project: { href: "/api/v3/projects/7" } } });
      if (path === "/api/v3/notifications?pageSize=100") return response({ total: 1, _embedded: { elements: [{ id: 7, _type: "Notification", _links: { project: { href: "/api/v3/projects/7" } } }] } });
      if (method === "POST" && path === "/api/v3/projects") {
        return request.json().then((payload) => {
          projectCreatePayloads.push(payload as Record<string, unknown>);
          return response(project());
        });
      }
      if (method === "POST" && path === "/api/v3/projects/7/work_packages") return response(workPackage(41));
      if (method === "POST" && path === "/api/v3/work_packages/7/activities") return response({ id: 41 });
      if (method === "POST" && path === "/api/v3/work_packages/7/relations") return response({ id: 41, _type: "Relation" });
      if (method === "POST" && path === "/api/v3/work_packages/7/attachments") return response({ id: 41, _type: "Attachment" });
      if (method === "POST" && path === "/api/v3/work_packages/7/watchers") return response({ id: 8, _type: "User" });
      if (method === "POST" && ["/api/v3/notifications/7/read_ian", "/api/v3/notifications/read_ian"].includes(path)) return response({});
      if (method === "PATCH") return response(project());
      if (method === "DELETE") return response({});
      return response({});
    },
  });
  try {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["scripts/server.ts"],
      cwd: process.cwd(),
      env: {
        OPENPROJECT_URL: `http://127.0.0.1:${server.port}`,
        OPENPROJECT_API_TOKEN: "synthetic-token",
        OPENPROJECT_AUTHORIZATION_MODE: "native",
        OPENPROJECT_ALLOWED_UPLOAD_DIRS: uploadDir,
        OPENPROJECT_AUDIT_ENABLED: "false",
      },
      stderr: "pipe",
    });
    transports.push(transport);
    const client = new Client({ name: "inherited-write-confirmed", version: "1" });
    await client.connect(transport);
    const writes: Array<[string, Record<string, unknown>, string, string]> = [
      ["create_work_package", { projectId: 7, subject: "Synthetic" }, "POST", "/api/v3/projects/7/work_packages"],
      ["update_work_package", { id: 7, subject: "Synthetic" }, "PATCH", "/api/v3/work_packages/7"],
      ["add_work_package_comment", { id: 7, comment: "Synthetic" }, "POST", "/api/v3/work_packages/7/activities"],
      ["create_project", { name: "Synthetic", parentId: 7 }, "POST", "/api/v3/projects"],
      ["update_project", { idOrIdentifier: "synthetic", name: "Synthetic" }, "PATCH", "/api/v3/projects/synthetic"],
      ["delete_project", { id: 7 }, "DELETE", "/api/v3/projects/7"],
      ["delete_work_package", { id: 7 }, "DELETE", "/api/v3/work_packages/7"],
      ["create_work_package_relation", { fromId: 7, toId: 8, type: "relates" }, "POST", "/api/v3/work_packages/7/relations"],
      ["delete_work_package_relation", { id: 7 }, "DELETE", "/api/v3/relations/7"],
      ["upload_work_package_attachment", { workPackageId: 7, filePath: uploadPath }, "POST", "/api/v3/work_packages/7/attachments"],
      ["delete_work_package_attachment", { attachmentId: 7 }, "DELETE", "/api/v3/attachments/7"],
      ["add_work_package_watcher", { workPackageId: 7, userId: 8 }, "POST", "/api/v3/work_packages/7/watchers"],
      ["remove_work_package_watcher", { workPackageId: 7, userId: 8 }, "DELETE", "/api/v3/work_packages/7/watchers/8"],
      ["mark_notification_read", { id: 7 }, "POST", "/api/v3/notifications/7/read_ian"],
      ["mark_all_notifications_read", { projectId: 7 }, "POST", "/api/v3/notifications/read_ian"],
    ];
    expect(writes).toHaveLength(15);
    for (const [name, args, method, path] of writes) {
      const before = mutations.length;
      const output = result(await client.callTool({ name, arguments: { ...args, confirm: true } }));
      expect(output.status).not.toBe("PROJECT_SCOPE_UNRESOLVED");
      expect(mutations.slice(before)).toEqual([{ method, path }]);
    }
  } finally {
    server.stop(true);
  }
});

test("native technical preflight rejects malformed target evidence without mutation transport", async () => {
  const cases: Array<[string, Record<string, unknown>, (path: string) => Record<string, unknown>]> = [
    ["delete_work_package", { id: 7 }, () => ({ id: 7, _type: "Project" })],
    ["delete_work_package_attachment", { attachmentId: 7 }, () => ({ id: 8, _type: "Attachment", _links: { container: { href: "/api/v3/work_packages/7" } } })],
    ["update_work_package", { id: 7, subject: "Synthetic" }, () => ({ id: 7, _type: "WorkPackage", _links: { project: { href: "/api/v3/projects/7" } } })],
    ["delete_work_package_relation", { id: 7 }, (path) => path === "/api/v3/relations/7"
      ? { id: 7, _type: "Relation", _links: { from: { href: "/api/v3/work_packages/7" }, to: { href: "/api/v3/work_packages/8" } } }
      : { id: Number(path.split("/").pop()), _type: "WorkPackage", _links: { project: { href: path.endsWith("/7") ? "/api/v3/projects/7" : "/api/v3/projects/8" } } }],
  ];
  for (const [name, args, responseFor] of cases) {
    const mutations: Array<{ path: string; method: string }> = [];
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        const path = `${url.pathname}${url.search}`;
        if (["POST", "PATCH", "DELETE"].includes(request.method)) mutations.push({ method: request.method, path });
        return response(responseFor(path));
      },
    });
    try {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: ["scripts/server.ts"],
        cwd: process.cwd(),
        env: {
          OPENPROJECT_URL: `http://127.0.0.1:${server.port}`,
          OPENPROJECT_API_TOKEN: "synthetic-token",
          OPENPROJECT_AUTHORIZATION_MODE: "native",
          OPENPROJECT_AUDIT_ENABLED: "false",
        },
        stderr: "pipe",
      });
      transports.push(transport);
      const client = new Client({ name: "native-technical-negative", version: "1" });
      await client.connect(transport);
      const output = result(await client.callTool({ name, arguments: { ...args, confirm: true } }));
      expect(["INTERNAL_ERROR", "PROJECT_SCOPE_UNRESOLVED"]).toContain(String(output.status));
      expect(mutations).toEqual([]);
    } finally {
      server.stop(true);
    }
  }
});

test("top-level create_project uses an explicit policy scope without a parent payload", async () => {
  const mutations: Array<{ path: string; method: string }> = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      const path = `${url.pathname}${url.search}`;
      if (["POST", "PATCH", "DELETE"].includes(request.method)) mutations.push({ method: request.method, path });
      if (path === "/api/v3/projects/7") return response(project());
      if (request.method === "POST" && path === "/api/v3/projects") {
        return request.json().then((payload) => {
          projectCreatePayloads.push(payload as Record<string, unknown>);
          return response(project());
        });
      }
      return response({});
    },
  });
  try {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["scripts/server.ts"],
      cwd: process.cwd(),
      env: {
        OPENPROJECT_URL: `http://127.0.0.1:${server.port}`,
        OPENPROJECT_API_TOKEN: "synthetic-token",
        OPENPROJECT_AUTHORIZATION_MODE: "native",
        OPENPROJECT_AUDIT_ENABLED: "false",
      },
      stderr: "pipe",
    });
    transports.push(transport);
    const client = new Client({ name: "top-level-create-project", version: "1" });
    await client.connect(transport);
    const output = result(await client.callTool({ name: "create_project", arguments: { name: "Synthetic", projectId: 7, confirm: true } }));
    expect(output.status).not.toBe("PROJECT_SCOPE_UNRESOLVED");
    expect(mutations).toEqual([{ method: "POST", path: "/api/v3/projects" }]);
    expect(projectCreatePayloads).toHaveLength(1);
    expect(projectCreatePayloads[0]!._links).not.toHaveProperty("parent");
  } finally {
    server.stop(true);
  }
});
