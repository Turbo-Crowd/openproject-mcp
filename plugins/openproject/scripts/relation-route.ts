import type { HalLink, HalResource } from "./openproject-api.js";

export type RelationType =
  | "relates"
  | "duplicates"
  | "duplicated"
  | "blocks"
  | "blocked"
  | "precedes"
  | "follows"
  | "includes"
  | "partof"
  | "requires"
  | "required";

export const REVERSE_RELATION_TYPE: Record<RelationType, RelationType> = {
  relates: "relates",
  duplicates: "duplicated",
  duplicated: "duplicates",
  blocks: "blocked",
  blocked: "blocks",
  precedes: "follows",
  follows: "precedes",
  includes: "partof",
  partof: "includes",
  requires: "required",
  required: "requires",
};

export const RELATION_TYPES = Object.keys(REVERSE_RELATION_TYPE) as RelationType[];
const LAG_CAPABLE_TYPES = new Set<RelationType>(["precedes", "follows"]);

export type RelationCollection = {
  path: string;
  source: "hal-addRelation" | "canonical-fallback";
};

export type RelationCreatePayload = {
  type: RelationType;
  description?: string | null;
  lag?: number | null;
  _links: { to: HalLink };
};

export type ExistingRelation = HalResource & {
  id?: number;
  type?: string;
  reverseType?: string;
};

function relationLink(relation: ExistingRelation, key: "from" | "to"): HalLink | null {
  const value = relation._links?.[key];
  return value && !Array.isArray(value) ? value : null;
}

export function workPackageIdFromHref(href: string | null | undefined): number | null {
  const match = href ? /\/work_packages\/(\d+)(?:[/?#]|$)/.exec(href) : null;
  return match ? Number(match[1]) : null;
}

function linkOf(resource: HalResource, key: string): HalLink | null {
  const value = resource._links?.[key];
  return value && !Array.isArray(value) ? value : null;
}

export function resolveRelationCreateRoute(
  fromId: number,
  fromWorkPackage: HalResource,
): RelationCollection {
  const canonical = `/api/v3/work_packages/${fromId}/relations`;
  const addRelation = linkOf(fromWorkPackage, "addRelation");
  if (addRelation?.href) {
    const resolved = toApiV3Path(addRelation.href);
    if (resolved !== canonical) {
      throw new Error(`addRelation link does not match the canonical relation route: ${resolved}`);
    }
    return { path: resolved, source: "hal-addRelation" };
  }
  return { path: canonical, source: "canonical-fallback" };
}

export function toApiV3Path(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//") || /:\/\//.test(href)) {
    throw new Error(`relation route must be host-relative: ${href}`);
  }
  const path = href.replace(/\/$/, "");
  if (!path.startsWith("/api/v3/")) {
    throw new Error(`relation route must live under /api/v3: ${href}`);
  }
  return path;
}

export function buildRelationCreatePayload(input: {
  type: RelationType;
  toId: number;
  description?: string | null;
  lag?: number | null;
}): RelationCreatePayload {
  assertRelationLag(input.type, input.lag ?? null);
  return {
    type: input.type,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.lag !== undefined ? { lag: input.lag } : {}),
    _links: { to: { href: `/api/v3/work_packages/${input.toId}` } },
  };
}

export function assertRelationLag(type: RelationType, lag: number | null): void {
  if (lag === null || lag === undefined) return;
  if (!Number.isInteger(lag) || lag < 0) {
    throw new Error(`relation lag must be a non-negative integer number of working days, received ${lag}`);
  }
  if (lag > 0 && !LAG_CAPABLE_TYPES.has(type)) {
    throw new Error(`relation type "${type}" does not accept a non-zero lag; only precedes/follows are scheduling relations`);
  }
}

export function findExistingPairRelation(
  relations: ExistingRelation[],
  fromId: number,
  toId: number,
): ExistingRelation | null {
  for (const relation of relations) {
    const pairFrom = workPackageIdFromHref(relationLink(relation, "from")?.href);
    const pairTo = workPackageIdFromHref(relationLink(relation, "to")?.href);
    if (pairFrom === null || pairTo === null) continue;
    if ((pairFrom === fromId && pairTo === toId) || (pairFrom === toId && pairTo === fromId)) {
      return relation;
    }
  }
  return null;
}

export function describeExistingRelation(
  relation: ExistingRelation,
  fromId: number,
  toId: number,
): string {
  const pairFrom = workPackageIdFromHref(relationLink(relation, "from")?.href);
  const direction = pairFrom === fromId ? `#${fromId} -> #${toId}` : `#${toId} -> #${fromId}`;
  return `relation ${relation.id ?? "?"} (${relation.type ?? "unknown"}) already links ${direction}`;
}
