import { z } from "zod";
import { buildCollectionPath, collectionResult, elements, OpenProjectTransportError } from "../openproject-api.js";
import { confirm, linkId, pagination, positiveId, projectId, requireLockVersion, requireProjectOwner, summary } from "./common.js";
import type { CeRegistrationContext } from "./context.js";
import { mutationGate, result, safely } from "./support.js";

function membershipOperationAllowed(policy: CeRegistrationContext["policy"], tool: "ce_create_membership" | "ce_update_membership" | "ce_delete_membership", projectId: number): boolean {
  if (policy.authorizationMode === "native") return true;
  const allowed = tool === "ce_create_membership"
    ? policy.membershipWritePolicy?.allowedCreateProjectIds
    : tool === "ce_update_membership"
      ? policy.membershipWritePolicy?.allowedUpdateProjectIds
      : policy.membershipWritePolicy?.allowedDeleteProjectIds;
  return Boolean(allowed?.includes(projectId));
}
export function registerMembershipCapabilityTools({ server, api, policy, read, write }: CeRegistrationContext): void {
 server.registerTool("ce_list_memberships", { description: "List memberships on one project; global membership listing is deliberately unavailable.", inputSchema: { projectId, ...pagination }, ...read }, async ({ projectId: id, offset, pageSize }) => safely(async () => { const data = await api(buildCollectionPath("/api/v3/memberships", { filters: [{ field: "project", operator: "=", values: [String(id)] }], offset, pageSize })); return result({ status: "OK", ...collectionResult(data), projectId: id, elements: elements(data).map(summary) }); }));
 server.registerTool("ce_get_membership", { description: "Get one membership by ID.", inputSchema: { membershipId: positiveId }, ...read }, async ({ membershipId }) => safely(async () => result({ status: "OK", membership: summary(await api(`/api/v3/memberships/${membershipId}`)) })));
 server.registerTool("ce_membership_schema", { description: "Read the membership schema for shape and diagnostics only.", inputSchema: {}, ...read }, async () => safely(async () => result({ status: "OK", schema: await api("/api/v3/memberships/schema") })));
 server.registerTool("ce_available_membership_projects", { description: "List projects available for a new membership.", inputSchema: {}, ...read }, async () => safely(async () => { const data = await api("/api/v3/memberships/available_projects"); return result({ status: "OK", elements: elements(data).map(summary) }); }));
 server.registerTool("ce_project_capabilities", { description: "Read a principal's effective capabilities on one project. Role names never prove capabilities.", inputSchema: { principalId: positiveId, projectId }, ...read }, async ({ principalId, projectId: id }) => safely(async () => result({ status: "OK", projectId: id, principalId, evidence: await api(`/api/v3/projects/${id}/members/${principalId}/capabilities`) })));
  server.registerTool("ce_list_project_roles", { description: "List globally visible OpenProject roles. This does not prove a role is assignable to a specific project.", inputSchema: {}, ...read }, async () => safely(async () => { const data = await api("/api/v3/roles"); return result({ status: "OK", elements: elements(data).map(summary) }); }));
  const roles = z.array(z.union([positiveId, z.string().min(1)])).min(1);
  const membershipCollection = (id: number, filters?: { field: string; operator: string; values: string[] }[]) => buildCollectionPath("/api/v3/memberships", { filters: [{ field: "project", operator: "=", values: [String(id)] }, ...(filters ?? [])] });
  const resolveRoles = async (values: (number | string)[]): Promise<{ status: "OK"; roleIds: number[] } | { status: "ROLE_UNRESOLVED"; message: string }> => {
    const data = await api("/api/v3/roles");
    const known = elements(data);
    if (data.total !== undefined && known.length < data.total) return { status: "ROLE_UNRESOLVED", message: "Role collection is incomplete; cannot resolve roles safely." };
    const roleIds: number[] = [];
    for (const value of values) {
      const id = typeof value === "number" ? value : /^\d+$/.test(value) ? Number(value) : undefined;
      const role = id === undefined ? known.find((entry) => entry.name === value) : known.find((entry) => entry.id === id);
      if (!role?.id) return { status: "ROLE_UNRESOLVED", message: "One or more requested roles could not be resolved." };
      roleIds.push(role.id);
    }
    return { status: "OK", roleIds };
  };
  const membershipWriteResult = async <T>(operation: () => Promise<T>) => {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof OpenProjectTransportError) return result({
        status: error.category,
        message: error.message,
        httpStatus: error.status,
        ...(error.errorIdentifier ? { errorIdentifier: error.errorIdentifier } : {}),
      });
      throw error;
    }
  };
  server.registerTool("ce_create_membership", { description: "Create a project membership with roles resolved from live role data. Preview-first.", inputSchema: { projectId, principalId: positiveId, roles, sendNotification: z.boolean().default(false), confirm }, ...write() }, async (args) => { const gate = mutationGate(policy, "ce_create_membership", args.projectId, false, args.confirm); if (gate) return result(gate); if (!membershipOperationAllowed(policy, "ce_create_membership", args.projectId)) throw new Error("MEMBERSHIP_WRITE_NOT_AUTHORIZED"); return membershipWriteResult(async () => { const existing = await api(membershipCollection(args.projectId, [{ field: "principal", operator: "=", values: [String(args.principalId)] }])); if (elements(existing).length) return result({ status: "DUPLICATE_PREVENTED" }); const resolved = await resolveRoles(args.roles); if (resolved.status !== "OK") return result(resolved); const created = await api("/api/v3/memberships", { method: "POST", body: JSON.stringify({ _meta: { sendNotification: args.sendNotification }, _links: { project: { href: `/api/v3/projects/${args.projectId}` }, principal: { href: `/api/v3/users/${args.principalId}` }, roles: resolved.roleIds.map((id) => ({ href: `/api/v3/roles/${id}` })) } }) }); return result({ membership: summary(await api(`/api/v3/memberships/${created.id}`)), verified: true }); }); });
  server.registerTool("ce_update_membership", { description: "Replace membership roles after principal and project checks. Preview-first.", inputSchema: { projectId, membershipId: positiveId, principalId: positiveId, roles, confirm }, ...write() }, async (args) => { const gate = mutationGate(policy, "ce_update_membership", args.projectId, false, args.confirm); if (gate) return result(gate); if (!membershipOperationAllowed(policy, "ce_update_membership", args.projectId)) throw new Error("MEMBERSHIP_WRITE_NOT_AUTHORIZED"); return membershipWriteResult(async () => { const live = await api(`/api/v3/memberships/${args.membershipId}`); requireProjectOwner(live, args.projectId); if (linkId(live, "principal") !== args.principalId) return result({ status: "PRINCIPAL_MISMATCH" }); const resolved = await resolveRoles(args.roles); if (resolved.status !== "OK") return result(resolved); const rollback = live._links?.roles; await api(`/api/v3/memberships/${args.membershipId}`, { method: "PATCH", body: JSON.stringify({ lockVersion: requireLockVersion(live), _links: { roles: resolved.roleIds.map((id) => ({ href: `/api/v3/roles/${id}` })) } }) }); return result({ membership: summary(await api(`/api/v3/memberships/${args.membershipId}`)), rollback: { roles: rollback }, verified: true }); }); });
  server.registerTool("ce_delete_membership", { description: "Delete a membership only after expected principal and roles assertions. Preview-first, destructive, protected-project, and last-admin guarded.", inputSchema: { projectId, membershipId: positiveId, principalId: positiveId, roles, confirm }, ...write(true) }, async (args) => { const gate = mutationGate(policy, "ce_delete_membership", args.projectId, true, args.confirm); if (gate) return result(gate); const protection = policy.membershipProtection; if (!membershipOperationAllowed(policy, "ce_delete_membership", args.projectId)) throw new Error("MEMBERSHIP_WRITE_NOT_AUTHORIZED"); if (policy.authorizationMode !== "native" && (protection?.protectedProjectIds.includes(args.projectId) || protection?.protectedMembershipIds.includes(args.membershipId) || protection?.lastAdminMembershipIds.includes(args.membershipId))) throw new Error("MEMBERSHIP_PROTECTED: reliable policy evidence prohibits this membership deletion."); const live = await api(`/api/v3/memberships/${args.membershipId}`); requireProjectOwner(live, args.projectId); if (linkId(live, "principal") !== args.principalId) throw new Error("PRINCIPAL_MISMATCH"); const resolved = await resolveRoles(args.roles); if (resolved.status !== "OK") return result(resolved); const expected = resolved.roleIds; const actual = (Array.isArray(live._links?.roles) ? live._links.roles : []).map((role) => typeof role.href === "string" ? Number(role.href.match(/\/(\d+)$/)?.[1]) : NaN).sort(); if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) throw new Error("Membership roles do not match the expected delete assertion."); await api(`/api/v3/memberships/${args.membershipId}`, { method: "DELETE" }); return result({ deleted: args.membershipId, rollback: { principalId: args.principalId, roleIds: expected } }); });
}
