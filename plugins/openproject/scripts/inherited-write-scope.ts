import type { HalResource, OpenProjectApi } from "./openproject-api.js";

type ScopeArgs = Record<string, unknown>;

function projectIdFromHref(href: unknown): number | null {
  if (typeof href !== "string") return null;
  const match = /^\/api\/v3\/projects\/(\d+)$/.exec(href);
  return match ? Number(match[1]) : null;
}

function workPackageIdFromHref(href: unknown): number | null {
  if (typeof href !== "string") return null;
  const match = /^\/api\/v3\/work_packages\/(\d+)$/.exec(href);
  return match ? Number(match[1]) : null;
}

function linkHref(resource: HalResource, names: string[]): unknown {
  for (const name of names) {
    const link = resource._links?.[name];
    if (link && !Array.isArray(link)) return link.href;
  }
  return undefined;
}

function assertResource(resource: HalResource, id: number, type?: string): void {
  if (resource.id !== id || (type && resource._type && resource._type !== type)) {
    throw new Error("Scope preflight returned an unexpected resource.");
  }
}

function explicitProjectId(args: ScopeArgs): number | undefined {
  return Number.isInteger(args.projectId) && (args.projectId as number) > 0
    ? args.projectId as number
    : undefined;
}

function requireMatchingProject(derived: number, supplied: number | undefined): number {
  if (supplied !== undefined && supplied !== derived) {
    throw new Error("The supplied projectId does not match verified resource ownership.");
  }
  return derived;
}

async function project(api: OpenProjectApi, id: number): Promise<number> {
  const resource = await api(`/api/v3/projects/${id}`);
  assertResource(resource, id, "Project");
  return id;
}

async function workPackage(api: OpenProjectApi, id: number): Promise<number> {
  const resource = await api(`/api/v3/work_packages/${id}`);
  assertResource(resource, id, "WorkPackage");
  const projectId = projectIdFromHref(linkHref(resource, ["project"]));
  if (!projectId) throw new Error("Work package preflight did not provide a verified project link.");
  return projectId;
}

async function relation(api: OpenProjectApi, id: number): Promise<number> {
  const resource = await api(`/api/v3/relations/${id}`);
  assertResource(resource, id, "Relation");
  const fromId = workPackageIdFromHref(linkHref(resource, ["from"]));
  const toId = workPackageIdFromHref(linkHref(resource, ["to"]));
  if (!fromId || !toId) throw new Error("Relation preflight did not provide verified work package links.");
  const [fromProject, toProject] = await Promise.all([workPackage(api, fromId), workPackage(api, toId)]);
  if (fromProject !== toProject) throw new Error("Relation spans projects and cannot be authorized by a single project scope.");
  return fromProject;
}

async function attachment(api: OpenProjectApi, id: number): Promise<number> {
  const resource = await api(`/api/v3/attachments/${id}`);
  assertResource(resource, id, "Attachment");
  const workPackageId = workPackageIdFromHref(linkHref(resource, ["container", "workPackage", "work_package"]));
  if (!workPackageId) throw new Error("Attachment preflight did not provide a verified work package link.");
  return workPackage(api, workPackageId);
}

async function notification(api: OpenProjectApi, id: number): Promise<number> {
  const resource = await api(`/api/v3/notifications/${id}`);
  assertResource(resource, id, "Notification");
  const projectId = projectIdFromHref(linkHref(resource, ["project"]));
  if (!projectId) throw new Error("Notification preflight did not provide a verified project link.");
  return projectId;
}

/** Resolves write scope from verified API resources before policy evaluation. */
export type ResolvedInheritedWriteScope = {
  projectId: number;
  workPackageTypeId?: number;
};

export async function resolveInheritedWriteScope(
  api: OpenProjectApi,
  tool: string,
  args: ScopeArgs,
): Promise<ResolvedInheritedWriteScope> {
  const supplied = explicitProjectId(args);
  let derived: number;
  let workPackageTypeId: number | undefined;

  switch (tool) {
    case "create_work_package":
      if (!supplied) throw new Error("A projectId is required to create a work package.");
      derived = await project(api, supplied);
      break;
    case "create_project":
      if (Number.isInteger(args.parentId) && (args.parentId as number) > 0) {
        derived = await project(api, args.parentId as number);
        break;
      }
      if (!supplied) {
        throw new Error("Confirmed top-level project creation requires projectId as its configured authorization scope.");
      }
      // A top-level project has no parent resource to derive ownership from.
      derived = await project(api, supplied);
      break;
    case "update_project": {
      const resource = await api(`/api/v3/projects/${encodeURIComponent(String(args.idOrIdentifier))}`);
      if (!Number.isInteger(resource.id) || resource._type && resource._type !== "Project") {
        throw new Error("Project preflight returned an unexpected resource.");
      }
      derived = resource.id as number;
      break;
    }
    case "delete_project":
      derived = await project(api, args.id as number);
      break;
    case "update_work_package": {
      const resource = await api(`/api/v3/work_packages/${args.id as number}`);
      assertResource(resource, args.id as number, "WorkPackage");
      const projectId = projectIdFromHref(linkHref(resource, ["project"]));
      const typeHref = linkHref(resource, ["type"]);
      const typeId = Number(typeof typeHref === "string" ? typeHref.match(/\/api\/v3\/types\/(\d+)$/)?.[1] : NaN);
      if (!projectId || !Number.isInteger(typeId) || typeId <= 0) {
        throw new Error("Work package preflight did not provide verified project and type links.");
      }
      derived = projectId;
      workPackageTypeId = typeId;
      break;
    }
    case "add_work_package_comment":
    case "delete_work_package":
      derived = await workPackage(api, args.id as number);
      break;
    case "create_work_package_relation": {
      const [fromProject, toProject] = await Promise.all([
        workPackage(api, args.fromId as number),
        workPackage(api, args.toId as number),
      ]);
      if (fromProject !== toProject) throw new Error("Relation spans projects and cannot be authorized by a single project scope.");
      derived = fromProject;
      break;
    }
    case "delete_work_package_relation":
      derived = await relation(api, args.id as number);
      break;
    case "upload_work_package_attachment":
    case "add_work_package_watcher":
    case "remove_work_package_watcher":
      derived = await workPackage(api, args.workPackageId as number);
      break;
    case "delete_work_package_attachment":
      derived = await attachment(api, args.attachmentId as number);
      break;
    case "mark_notification_read":
      derived = await notification(api, args.id as number);
      break;
    case "mark_all_notifications_read": {
      if (!supplied) throw new Error("A projectId is required to scope bulk notification changes.");
      const notifications = await api("/api/v3/notifications?pageSize=100");
      const items = (notifications._embedded?.elements ?? []) as HalResource[];
      if (typeof notifications.total === "number" && notifications.total !== items.length) {
        throw new Error("Notification scope cannot be verified from a partial collection.");
      }
      if (items.length === 0) throw new Error("Notification scope cannot be verified from an empty collection.");
      for (const item of items) {
        const projectId = projectIdFromHref(linkHref(item, ["project"]));
        if (projectId !== supplied) throw new Error("Bulk notification scope includes a different or unverified project.");
      }
      derived = supplied;
      break;
    }
    default:
      throw new Error(`No inherited write scope resolver is configured for ${tool}.`);
  }

  return { projectId: requireMatchingProject(derived, supplied), ...(workPackageTypeId ? { workPackageTypeId } : {}) };
}

/** Compatibility helper for callers that only need verified project ownership. */
export async function resolveInheritedWriteProjectScope(
  api: OpenProjectApi,
  tool: string,
  args: ScopeArgs,
): Promise<number> {
  return (await resolveInheritedWriteScope(api, tool, args)).projectId;
}
