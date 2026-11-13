import { expect, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCeTools } from "../scripts/ce-tools.js";
import { OpenProjectTransportError, type OpenProjectApi } from "../scripts/openproject-api.js";
import type { OpenProjectPolicy } from "../scripts/policy.js";

const policy: OpenProjectPolicy = {
  writeEnabled: true,
  allowedProjectIds: [7],
  allowedWorkPackageTypeIds: [],
  allowedWriteTools: ["ce_create_news", "ce_delete_news"],
  allowDestructive: true,
  auditEnabled: false,
  membershipWritePolicy: { allowedCreateProjectIds: [], allowedUpdateProjectIds: [], allowedDeleteProjectIds: [] },
};

function tools(server: McpServer) {
  return (server as unknown as {
    _registeredTools: Record<string, { handler: (args: Record<string, unknown>, extra: unknown) => Promise<unknown> }>;
  })._registeredTools;
}

function text(response: unknown) {
  return JSON.parse((response as { content: Array<{ text: string }> }).content[0]!.text) as Record<string, unknown>;
}

test("offline fake-HAL sequence discovers, reads, previews, mutates, recovers, and sanitizes errors", async () => {
  const calls: Array<{ path: string; method?: string }> = [];
  let newsExists = false;
  const api = (async (path: string, init?: RequestInit) => {
    calls.push({ path, method: init?.method });
    if (path.startsWith("/api/v3/news?")) {
      return { _embedded: { elements: [] } };
    }
    if (path === "/api/v3/news") {
      if (init?.method === "POST") {
        newsExists = true;
        return { id: 41, _type: "News", lockVersion: 0, _links: { project: { href: "/api/v3/projects/7" } } };
      }
      return { _embedded: { elements: [] } };
    }
    if (path === "/api/v3/news/41") {
      if (init?.method === "DELETE") {
        newsExists = false;
        return {};
      }
      if (!newsExists) throw new OpenProjectTransportError(404, "NOT_FOUND");
      return { id: 41, _type: "News", lockVersion: 0, _links: { project: { href: "/api/v3/projects/7" } } };
    }
    throw new OpenProjectTransportError(403, "PERMISSION_DENIED");
  }) as unknown as OpenProjectApi;
  const server = new McpServer({ name: "fake-hal-e2e", version: "0" });
  registerCeTools(server, api, policy);

  expect(Object.keys(tools(server))).toContain("ce_create_news");
  expect(text(await tools(server).ce_list_news!.handler({ offset: 1, pageSize: 25 }, {})).status).toBe("OK");

  const preview = text(await tools(server).ce_create_news!.handler({
    projectId: 7,
    title: "Synthetic",
    description: { format: "markdown", raw: "Synthetic" },
  }, {}));
  expect(preview.status).toBe("PREVIEW");
  expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);

  const created = text(await tools(server).ce_create_news!.handler({
    projectId: 7,
    title: "Synthetic",
    description: { format: "markdown", raw: "Synthetic" },
    confirm: true,
  }, {}));
  expect(created.verified).toBe(true);
  expect(newsExists).toBe(true);

  const deleted = text(await tools(server).ce_delete_news!.handler({ projectId: 7, newsId: 41, confirm: true }, {}));
  expect(deleted.deleted).toBe(41);
  expect(newsExists).toBe(false);
  expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(1);

  const sanitized = text(await tools(server).ce_get_news!.handler({ newsId: 404 }, {}));
  expect(sanitized.status).toBe("PERMISSION_DENIED");
  expect(JSON.stringify(sanitized)).not.toContain("private");
});
