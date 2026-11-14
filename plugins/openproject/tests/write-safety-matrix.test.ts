import { afterEach, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EXPECTED_TOOL_COUNT, EXPECTED_WRITE_TOOL_COUNT } from "../scripts/tool-inventory.js";

const transports: StdioClientTransport[] = [];

const writes: Record<string, Record<string, unknown>> = {
  create_work_package: { projectId: 7, subject: "Synthetic" },
  update_work_package: { id: 7, subject: "Synthetic" },
  add_work_package_comment: { id: 7, comment: "Synthetic" },
  create_project: { name: "Synthetic", parentId: 7 },
  update_project: { idOrIdentifier: "synthetic", name: "Synthetic" },
  delete_project: { id: 7 },
  delete_work_package: { id: 7 },
  create_work_package_relation: { fromId: 7, toId: 8, type: "relates" },
  delete_work_package_relation: { id: 7 },
  upload_work_package_attachment: { workPackageId: 7, filePath: "/synthetic" },
  delete_work_package_attachment: { attachmentId: 7 },
  add_work_package_watcher: { workPackageId: 7, userId: 8 },
  remove_work_package_watcher: { workPackageId: 7, userId: 8 },
  mark_notification_read: { id: 7 },
  mark_all_notifications_read: { projectId: 7 },
  ce_create_meeting: { projectId: 7, title: "Synthetic", startTime: "2026-01-02T10:00:00Z", duration: "PT1H" },
  ce_update_meeting: { projectId: 7, meetingId: 8, title: "Synthetic" },
  ce_delete_meeting: { projectId: 7, meetingId: 8 },
  ce_create_agenda_item: { projectId: 7, meetingId: 8, title: "Synthetic" },
  ce_update_agenda_item: { projectId: 7, agendaItemId: 8, title: "Synthetic" },
  ce_create_meeting_section: { projectId: 7, meetingId: 8, title: "Synthetic" },
  ce_create_meeting_outcome: { projectId: 7, agendaItemId: 8 },
  ce_delete_meeting_agenda_child: { projectId: 7, childType: "agenda_item", childId: 8 },
  ce_create_news: { projectId: 7, title: "Synthetic", description: { format: "markdown", raw: "Synthetic" } },
  ce_update_news: { projectId: 7, newsId: 8, title: "Synthetic" },
  ce_delete_news: { projectId: 7, newsId: 8 },
  ce_create_time_entry: { projectId: 7, entityType: "WorkPackage", entityId: 8, spentOn: "2026-01-02", hours: "PT1H", activityId: 9 },
  ce_update_time_entry: { projectId: 7, timeEntryId: 8, hours: "PT1H" },
  ce_delete_time_entry: { projectId: 7, timeEntryId: 8 },
  ce_create_membership: { projectId: 7, principalId: 8, roles: [9] },
  ce_update_membership: { projectId: 7, membershipId: 8, principalId: 9, roles: [10] },
  ce_delete_membership: { projectId: 7, membershipId: 8, principalId: 9, roles: [10] },
};

function responseText(response: unknown) {
  const content = (response as { content?: Array<{ type: string; text?: string }> }).content;
  const text = content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("Expected a text response");
  return JSON.parse(text) as { status?: string; preview?: boolean; message?: string };
}

afterEach(async () => {
  await Promise.all(transports.splice(0).map((transport) => transport.close()));
});

test("all 32 writes have individual runtime preview, annotation, and fail-closed confirmed-path evidence", async () => {
  let transportCalls = 0;
  const api = Bun.serve({
    port: 0,
    fetch() {
      transportCalls += 1;
      return new Response("{}");
    },
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["scripts/server.ts"],
    cwd: process.cwd(),
    env: {
      OPENPROJECT_URL: `http://127.0.0.1:${api.port}`,
      OPENPROJECT_API_TOKEN: "synthetic-token",
      OPENPROJECT_WRITE_ENABLED: "true",
    },
    stderr: "pipe",
  });
  transports.push(transport);
  const client = new Client({ name: "write-safety-matrix", version: "1.0.0" });
  await client.connect(transport);
  const listed = await client.listTools();
  expect(listed.tools).toHaveLength(EXPECTED_TOOL_COUNT);
  expect(Object.keys(writes)).toHaveLength(EXPECTED_WRITE_TOOL_COUNT);

  for (const [name, args] of Object.entries(writes)) {
    const tool = listed.tools.find((candidate) => candidate.name === name);
    expect(tool).toBeDefined();
    expect(tool?.annotations?.readOnlyHint).toBe(false);
    expect(tool?.annotations?.destructiveHint).toBeBoolean();
    expect(tool?.annotations?.idempotentHint).toBeBoolean();

    const beforePreview = transportCalls;
    const preview = responseText(await client.callTool({ name, arguments: args }));
    expect(preview.preview).toBe(true);
    expect(transportCalls).toBe(beforePreview);

    const confirmed = responseText(await client.callTool({ name, arguments: { ...args, confirm: true } }));
    expect(confirmed.status).toBe("POLICY_DENIED");
    expect(confirmed.message).toBe("WRITE_TOOL_NOT_ALLOWED: target tool is not in OPENPROJECT_ALLOWED_WRITE_TOOLS.");
    expect(confirmed.preview).not.toBe(true);
  }
  api.stop(true);
});
