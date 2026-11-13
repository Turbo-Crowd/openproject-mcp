import { z } from "zod";
import type { HalResource } from "../openproject-api.js";

export const positiveId = z.number().int().positive();
export const projectId = positiveId.describe("Explicit project ID; there is no default project.");
export const confirm = z.boolean().optional().describe("Set true only after reviewing the local preview.");
export const pagination = {
  offset: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
};

export function linkId(value: HalResource, name: string): number | undefined {
  const link = value._links?.[name];
  if (!link || Array.isArray(link) || typeof link.href !== "string") return undefined;
  const match = link.href.match(/\/(\d+)(?:\?.*)?$/);
  return match ? Number(match[1]) : undefined;
}

export function summary(value: HalResource) {
  return {
    id: value.id,
    name: value.name,
    title: value.title,
    subject: value.subject,
    lockVersion: value.lockVersion,
    links: value._links,
  };
}

export function requireProjectOwner(resource: HalResource, requestedProjectId: number): void {
  const owner = linkId(resource, "project");
  if (owner === undefined) {
    throw new Error("Cannot establish the target resource project ownership.");
  }
  if (owner !== requestedProjectId) {
    throw new Error("Target resource does not belong to the supplied project.");
  }
}

export function requireType(resource: HalResource, expected: string): void {
  if (resource._type && resource._type !== expected) {
    throw new Error(`WRONG_ENTITY_TYPE: target did not resolve to ${expected}.`);
  }
}

export function requireLockVersion(resource: HalResource): number {
  if (!Number.isInteger(resource.lockVersion) || (resource.lockVersion as number) < 0) {
    throw new Error("STALE_LOCK_VERSION: target did not provide a valid lockVersion; re-read before retrying.");
  }
  return resource.lockVersion as number;
}
