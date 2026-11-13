import { describe, expect, test } from "bun:test";
import {
  assertRelationLag,
  buildRelationCreatePayload,
  findExistingPairRelation,
  resolveRelationCreateRoute,
  toApiV3Path,
} from "../scripts/relation-route.js";
import type { HalResource } from "../scripts/openproject-api.js";

const workPackage = (id: number, extra: Partial<HalResource> = {}): HalResource => ({
  _type: "WorkPackage",
  id,
  _links: {},
  ...extra,
});

describe("relation create route", () => {
  test("uses the source work package HAL route", () => {
    expect(resolveRelationCreateRoute(17, workPackage(17, {
      _links: { addRelation: { href: "/api/v3/work_packages/17/relations" } },
    }))).toEqual({
      path: "/api/v3/work_packages/17/relations",
      source: "hal-addRelation",
    });
  });

  test("rejects non-local HAL routes", () => {
    expect(() => toApiV3Path("https://invalid.example/api/v3/work_packages/1/relations")).toThrow(/host-relative/);
  });

  test("builds a target-only payload and validates lag", () => {
    expect(buildRelationCreatePayload({ type: "precedes", toId: 9, lag: 2 })).toEqual({
      type: "precedes",
      lag: 2,
      _links: { to: { href: "/api/v3/work_packages/9" } },
    });
    expect(() => assertRelationLag("relates", 1)).toThrow(/does not accept/);
  });

  test("detects either direction of an existing pair", () => {
    const relation = {
      _type: "Relation",
      id: 3,
      _links: {
        from: { href: "/api/v3/work_packages/7" },
        to: { href: "/api/v3/work_packages/5" },
      },
    } as HalResource;
    expect(findExistingPairRelation([relation], 5, 7)?.id).toBe(3);
  });
});
