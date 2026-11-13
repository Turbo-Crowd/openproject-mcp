export const INHERITED_DIRECT_TOOL_NAMES = [
  "list_projects", "search_work_packages", "get_work_package",
  "list_work_package_attachments", "get_work_package_attachment",
  "create_work_package", "update_work_package", "add_work_package_comment",
] as const;

export const EXPANDED_WRITE_TOOL_NAMES = [
  "create_project", "update_project", "delete_project", "delete_work_package",
  "create_work_package_relation", "delete_work_package_relation", "upload_work_package_attachment",
  "delete_work_package_attachment", "add_work_package_watcher", "remove_work_package_watcher",
  "mark_notification_read", "mark_all_notifications_read",
] as const;

export const INHERITED_WRITE_TOOL_NAMES = [
  "create_work_package", "update_work_package", "add_work_package_comment", ...EXPANDED_WRITE_TOOL_NAMES,
] as const;

export const CE_WRITE_TOOL_NAMES = [
  "ce_create_meeting", "ce_update_meeting", "ce_delete_meeting", "ce_create_agenda_item",
  "ce_update_agenda_item", "ce_create_meeting_section", "ce_create_meeting_outcome",
  "ce_delete_meeting_agenda_child", "ce_create_news", "ce_update_news", "ce_delete_news",
  "ce_create_time_entry", "ce_update_time_entry", "ce_delete_time_entry", "ce_create_membership",
  "ce_update_membership", "ce_delete_membership",
] as const;

export const WRITE_TOOL_NAMES = [...INHERITED_WRITE_TOOL_NAMES, ...CE_WRITE_TOOL_NAMES] as const;
export const EXPECTED_WRITE_TOOL_COUNT = 32;
export const EXPECTED_TOOL_COUNT = 72;
