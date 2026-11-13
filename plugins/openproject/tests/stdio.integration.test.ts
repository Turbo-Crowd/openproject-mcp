import { afterEach, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EXPECTED_TOOL_COUNT } from "../scripts/tool-inventory.js";

const transports: StdioClientTransport[] = [];

afterEach(async () => {
  await Promise.all(transports.splice(0).map((transport) => transport.close()));
});

test("stdio initialize and tools/list expose exactly 72 fully annotated tools without network I/O", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["scripts/server.ts"],
    cwd: process.cwd(),
    env: {
      OPENPROJECT_URL: "https://openproject.invalid",
      OPENPROJECT_API_TOKEN: "synthetic-token",
      OPENPROJECT_WRITE_ENABLED: "false",
    },
    stderr: "pipe",
  });
  transports.push(transport);

  const client = new Client({ name: "offline-stdio-test", version: "1.0.0" });
  await client.connect(transport);
  const listed = await client.listTools();
  const tools = listed.tools;

  expect(tools).toHaveLength(EXPECTED_TOOL_COUNT);
  expect(new Set(tools.map((tool) => tool.name)).size).toBe(EXPECTED_TOOL_COUNT);
  for (const tool of tools) {
    expect(tool.annotations?.readOnlyHint).toBeBoolean();
  }
  for (const tool of tools.filter((tool) => tool.annotations?.readOnlyHint === false)) {
    expect(tool.annotations?.destructiveHint).toBeBoolean();
    expect(tool.annotations?.idempotentHint).toBeBoolean();
  }
});
