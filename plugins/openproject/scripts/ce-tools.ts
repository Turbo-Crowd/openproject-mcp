import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OpenProjectApi } from "./openproject-api.js";
import type { OpenProjectPolicy } from "./policy.js";
import { registerMeetingTools } from "./ce/meetings.js";
import { registerNewsTools } from "./ce/news.js";
import { registerTimeEntryTools } from "./ce/time-entries.js";
import { registerMembershipCapabilityTools } from "./ce/memberships-capabilities.js";
import type { CeRegistrationContext } from "./ce/context.js";

export const CE_READ_TOOL_NAMES = [
  "ce_list_meetings", "ce_get_meeting", "ce_list_meeting_agenda", "ce_list_news",
  "ce_get_news", "ce_list_time_entries", "ce_get_time_entry", "ce_list_time_entry_activities",
  "ce_list_memberships", "ce_get_membership", "ce_membership_schema",
  "ce_available_membership_projects", "ce_project_capabilities", "ce_list_project_roles",
] as const;
export const CE_WRITE_TOOL_NAMES = [
  "ce_create_meeting", "ce_update_meeting", "ce_delete_meeting", "ce_create_agenda_item",
  "ce_update_agenda_item", "ce_create_meeting_section", "ce_create_meeting_outcome",
  "ce_delete_meeting_agenda_child", "ce_create_news", "ce_update_news", "ce_delete_news",
  "ce_create_time_entry", "ce_update_time_entry", "ce_delete_time_entry", "ce_create_membership",
  "ce_update_membership", "ce_delete_membership",
] as const;
export const CE_TOOL_NAMES = [...CE_READ_TOOL_NAMES, ...CE_WRITE_TOOL_NAMES] as const;

export function registerCeTools(server: McpServer, api: OpenProjectApi, policy: OpenProjectPolicy): void {
  const context: CeRegistrationContext = {
    server,
    api,
    policy,
    read: { annotations: { readOnlyHint: true } },
    write: (destructive = false) => ({ annotations: { readOnlyHint: false, destructiveHint: destructive, idempotentHint: destructive } }),
  };
  registerMeetingTools(context);
  registerNewsTools(context);
  registerTimeEntryTools(context);
  registerMembershipCapabilityTools(context);
}
