import { expect, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CE_TOOL_NAMES, registerCeTools } from "../scripts/ce-tools.js";
import { EXPANDED_TOOL_NAMES, registerExpandedTools } from "../scripts/expanded-tools.js";
import { EXPECTED_TOOL_COUNT, INHERITED_DIRECT_TOOL_NAMES } from "../scripts/tool-inventory.js";
import type { OpenProjectApi } from "../scripts/openproject-api.js";
import type { OpenProjectPolicy } from "../scripts/policy.js";

const policy: OpenProjectPolicy = {
  writeEnabled: false,
  allowedProjectIds: [],
  allowedWorkPackageTypeIds: [],
  allowDestructive: false,
  auditEnabled: false,
};

function registered(server: McpServer) {
  return (server as unknown as {
    _registeredTools: Record<string, { annotations?: Record<string, boolean> }>;
  })._registeredTools;
}

test("one-shot registration snapshot has exactly 72 unique compatible tools", () => {
  const server = new McpServer({ name: "snapshot", version: "0" });
  const api = (async () => ({})) as unknown as OpenProjectApi;
  const register = server.registerTool.bind(server);
  for (const name of INHERITED_DIRECT_TOOL_NAMES) {
    register(name, { description: name, inputSchema: {}, annotations: { readOnlyHint: !["create_work_package", "update_work_package", "add_work_package_comment"].includes(name) } }, async () => ({ content: [] }));
  }
  registerExpandedTools(server, api, "https://tasks.example.com");
  registerCeTools(server, api, policy);

  const tools = registered(server);
  const actual = Object.keys(tools).sort();
  const expected = [...INHERITED_DIRECT_TOOL_NAMES, ...EXPANDED_TOOL_NAMES, ...CE_TOOL_NAMES].sort();
  expect(expected).toHaveLength(EXPECTED_TOOL_COUNT);
  expect(new Set(expected).size).toBe(EXPECTED_TOOL_COUNT);
  expect(actual).toEqual(expected);
  for (const name of CE_TOOL_NAMES.slice(0, 14)) expect(tools[name]?.annotations?.readOnlyHint).toBe(true);
  for (const name of CE_TOOL_NAMES.slice(14)) expect(tools[name]?.annotations?.readOnlyHint).toBe(false);
});
