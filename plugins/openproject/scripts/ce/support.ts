import { z } from "zod";
import { OpenProjectTransportError } from "../openproject-api.js";
import { createAuditRecord, evaluateMutation, type OpenProjectPolicy } from "../policy.js";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const isoDateTime = z.string().datetime({ offset: true });
export const isoDuration = z.string().regex(/^P(?=.+)(?:(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+S)?)?)$/);
export const formattable = z.object({ format: z.enum(["plain", "markdown", "custom"]), raw: z.string() });

export function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

export function statusResult(status: string, message: string, data: Record<string, unknown> = {}) {
  return result({ status, message, ...data });
}

export async function safely<T>(operation: () => Promise<T>): Promise<T | ReturnType<typeof statusResult>> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof OpenProjectTransportError) return statusResult(error.category, error.message);
    throw error;
  }
}

export function mutationGate(policy: OpenProjectPolicy, tool: string, targetProjectId: number, destructive: boolean, confirmed?: boolean) {
  const operation = destructive ? "destructive" : "write";
  const decision = evaluateMutation(policy, { tool, operation, projectId: targetProjectId, confirm: confirmed });
  const audit = createAuditRecord({ tool, operation, projectId: targetProjectId, confirm: confirmed }, decision);
  if (policy.auditEnabled) console.error(JSON.stringify(audit));
  if (!decision.allowed) return { status: decision.preview ? "PREVIEW" : "POLICY_DENIED", preview: decision.preview, audit, message: decision.reason };
  return null;
}

export function ensureDuration(value: string, field: string): void {
  if (!/^P(?=.+)(?:(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+S)?)?)$/.test(value) || value === "P" || value === "PT") throw new Error(`${field} must be an ISO-8601 duration.`);
  if (!/[1-9]/.test(value)) throw new Error(`${field} must be greater than zero.`);
}
