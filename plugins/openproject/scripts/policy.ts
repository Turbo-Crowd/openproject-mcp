export type ModuleEvidenceState = "confirmed_enabled" | "confirmed_disabled" | "unproven";

export type ModuleEvidence = {
  projectId: number;
  module: string;
  state: ModuleEvidenceState;
  source?: string;
};

export type MembershipProtection = {
  protectedProjectIds: number[];
  protectedMembershipIds: number[];
  lastAdminMembershipIds: number[];
};

export type MembershipWritePolicy = {
  allowedCreateProjectIds: number[];
  allowedUpdateProjectIds: number[];
  allowedDeleteProjectIds: number[];
};

export type OpenProjectPolicy = {
  authorizationMode?: "native" | "restricted";
  legacyModeInferred?: boolean;
  writeEnabled: boolean;
  allowedProjectIds: number[];
  allowedWorkPackageTypeIds: number[];
  allowedWriteTools: string[];
  allowDestructive: boolean;
  auditEnabled: boolean;
  moduleEvidence?: ModuleEvidence[];
  membershipProtection?: MembershipProtection;
  membershipWritePolicy?: MembershipWritePolicy;
};

export type MutationIntent = {
  tool: string;
  operation: "write" | "destructive";
  projectId?: number;
  workPackageTypeId?: number;
  confirm?: boolean;
  module?: string;
};

export type PolicyDecision =
  | { allowed: true; preview: false }
  | { allowed: false; preview: true; reason: string }
  | { allowed: false; preview: false; reason: string };

const DEFAULT_POLICY: OpenProjectPolicy = {
  authorizationMode: "restricted",
  legacyModeInferred: false,
  writeEnabled: false,
  allowedProjectIds: [],
  allowedWorkPackageTypeIds: [],
  allowedWriteTools: [],
  allowDestructive: false,
  auditEnabled: true,
  moduleEvidence: [],
  membershipProtection: {
    protectedProjectIds: [],
    protectedMembershipIds: [],
    lastAdminMembershipIds: [],
  },
  membershipWritePolicy: {
    allowedCreateProjectIds: [],
    allowedUpdateProjectIds: [],
    allowedDeleteProjectIds: [],
  },
};

function parseBoolean(value: string | undefined, name: string, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

function parsePositiveIdList(value: string | undefined, name: string): number[] {
  if (value === undefined || value.trim() === "") return [];
  const ids = value.split(",").map((part) => Number(part.trim()));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error(`${name} must be a comma-separated list of positive integers`);
  }
  return [...new Set(ids)];
}

function parseToolList(value: string | undefined, name: string): string[] {
  if (value === undefined || value.trim() === "") return [];
  const tools = value.split(",").map((part) => part.trim());
  if (tools.some((tool) => !/^(?:ce_)?[a-z][a-z0-9_]*$/.test(tool) || tool.includes("*") || tool.includes("-"))) {
    throw new Error(`${name} must be a comma-separated list of exact tool names`);
  }
  return [...new Set(tools)];
}

function parseJson<T>(value: string | undefined, name: string, fallback: T): T {
  if (value === undefined || value.trim() === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
}

function validIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.some((id) => !Number.isInteger(id) || id <= 0)) return null;
  return [...new Set(value as number[])];
}

export function loadModuleEvidence(value: string | undefined): ModuleEvidence[] {
  const parsed = parseJson<unknown>(value, "OPENPROJECT_MODULE_EVIDENCE", []);
  if (!Array.isArray(parsed)) throw new Error("OPENPROJECT_MODULE_EVIDENCE must be a JSON array");
  const entries = parsed.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("OPENPROJECT_MODULE_EVIDENCE entry is invalid");
    const candidate = entry as Record<string, unknown>;
    if (!Number.isInteger(candidate.projectId) || (candidate.projectId as number) <= 0 || typeof candidate.module !== "string" || !["confirmed_enabled", "confirmed_disabled", "unproven"].includes(candidate.state as string)) {
      throw new Error("OPENPROJECT_MODULE_EVIDENCE entry is invalid");
    }
    return { projectId: candidate.projectId as number, module: candidate.module, state: candidate.state as ModuleEvidenceState, ...(typeof candidate.source === "string" ? { source: candidate.source } : {}) };
  });
  const keys = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.projectId}:${entry.module}`;
    if (keys.has(key)) throw new Error("OPENPROJECT_MODULE_EVIDENCE contains duplicate project/module entries");
    keys.add(key);
  }
  return entries;
}

export function loadMembershipProtection(value: string | undefined): MembershipProtection {
  const parsed = parseJson<unknown>(value, "OPENPROJECT_MEMBERSHIP_PROTECTION", DEFAULT_POLICY.membershipProtection);
  if (!parsed || typeof parsed !== "object") throw new Error("OPENPROJECT_MEMBERSHIP_PROTECTION must be a JSON object");
  const candidate = parsed as Record<string, unknown>;
  const protectedProjectIds = validIds(candidate.protectedProjectIds);
  const protectedMembershipIds = validIds(candidate.protectedMembershipIds);
  const lastAdminMembershipIds = validIds(candidate.lastAdminMembershipIds);
  if (!protectedProjectIds || !protectedMembershipIds || !lastAdminMembershipIds) throw new Error("OPENPROJECT_MEMBERSHIP_PROTECTION contains invalid IDs");
  return { protectedProjectIds, protectedMembershipIds, lastAdminMembershipIds };
}

export function loadMembershipWritePolicy(value: string | undefined): MembershipWritePolicy {
  const parsed = parseJson<unknown>(value, "OPENPROJECT_MEMBERSHIP_WRITE_POLICY", DEFAULT_POLICY.membershipWritePolicy);
  if (!parsed || typeof parsed !== "object") throw new Error("OPENPROJECT_MEMBERSHIP_WRITE_POLICY must be a JSON object");
  const candidate = parsed as Record<string, unknown>;
  const allowedCreateProjectIds = validIds(candidate.allowedCreateProjectIds);
  const allowedUpdateProjectIds = validIds(candidate.allowedUpdateProjectIds);
  const allowedDeleteProjectIds = validIds(candidate.allowedDeleteProjectIds);
  if (!allowedCreateProjectIds || !allowedUpdateProjectIds || !allowedDeleteProjectIds) throw new Error("OPENPROJECT_MEMBERSHIP_WRITE_POLICY contains invalid IDs");
  return { allowedCreateProjectIds, allowedUpdateProjectIds, allowedDeleteProjectIds };
}

export function moduleEvidenceState(policy: OpenProjectPolicy, projectId: number, module: string): ModuleEvidenceState {
  return policy.moduleEvidence?.find((entry) => entry.projectId === projectId && entry.module === module)?.state ?? "unproven";
}

export function loadOpenProjectPolicy(env: NodeJS.ProcessEnv = process.env, registeredWriteTools: readonly string[] = []): OpenProjectPolicy {
  const explicitMode = env.OPENPROJECT_AUTHORIZATION_MODE;
  if (explicitMode !== undefined && explicitMode !== "native" && explicitMode !== "restricted") {
    throw new Error("OPENPROJECT_AUTHORIZATION_MODE must be native or restricted");
  }
  const legacyRestrictionVariables = [
    "OPENPROJECT_WRITE_ENABLED",
    "OPENPROJECT_ALLOWED_PROJECT_IDS",
    "OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS",
    "OPENPROJECT_ALLOWED_WRITE_TOOLS",
    "OPENPROJECT_ALLOW_DESTRUCTIVE",
    "OPENPROJECT_MODULE_EVIDENCE",
    "OPENPROJECT_MEMBERSHIP_PROTECTION",
    "OPENPROJECT_MEMBERSHIP_WRITE_POLICY",
  ];
  const legacyModeInferred = explicitMode === undefined && legacyRestrictionVariables.some((name) => env[name] !== undefined);
  const authorizationMode = explicitMode ?? (legacyModeInferred ? "restricted" : "native");
  const allowedWriteTools = parseToolList(env.OPENPROJECT_ALLOWED_WRITE_TOOLS, "OPENPROJECT_ALLOWED_WRITE_TOOLS");
  if (registeredWriteTools.length && allowedWriteTools.some((tool) => !registeredWriteTools.includes(tool))) {
    throw new Error("OPENPROJECT_ALLOWED_WRITE_TOOLS contains an unknown or non-write tool");
  }
  return {
    authorizationMode,
    legacyModeInferred,
    writeEnabled: parseBoolean(env.OPENPROJECT_WRITE_ENABLED, "OPENPROJECT_WRITE_ENABLED", DEFAULT_POLICY.writeEnabled),
    allowedProjectIds: parsePositiveIdList(env.OPENPROJECT_ALLOWED_PROJECT_IDS, "OPENPROJECT_ALLOWED_PROJECT_IDS"),
    allowedWorkPackageTypeIds: parsePositiveIdList(env.OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS, "OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS"),
    allowedWriteTools,
    allowDestructive: parseBoolean(env.OPENPROJECT_ALLOW_DESTRUCTIVE, "OPENPROJECT_ALLOW_DESTRUCTIVE", DEFAULT_POLICY.allowDestructive),
    auditEnabled: parseBoolean(env.OPENPROJECT_AUDIT_ENABLED, "OPENPROJECT_AUDIT_ENABLED", DEFAULT_POLICY.auditEnabled),
    moduleEvidence: loadModuleEvidence(env.OPENPROJECT_MODULE_EVIDENCE),
    membershipProtection: loadMembershipProtection(env.OPENPROJECT_MEMBERSHIP_PROTECTION),
    membershipWritePolicy: loadMembershipWritePolicy(env.OPENPROJECT_MEMBERSHIP_WRITE_POLICY),
  };
}

export function evaluateMutation(policy: OpenProjectPolicy, intent: MutationIntent): PolicyDecision {
  if (!intent.confirm) return { allowed: false, preview: true, reason: "Set confirm: true after reviewing the preview to execute this mutation." };
  if (policy.authorizationMode !== "restricted") return { allowed: true, preview: false };
  if (!policy.writeEnabled) return { allowed: false, preview: false, reason: "Writes are disabled by policy. Set OPENPROJECT_WRITE_ENABLED=true to enable configured writes." };
  if (!policy.allowedWriteTools.includes(intent.tool)) return { allowed: false, preview: false, reason: "WRITE_TOOL_NOT_ALLOWED: target tool is not in OPENPROJECT_ALLOWED_WRITE_TOOLS." };
  if (intent.operation === "destructive" && !policy.allowDestructive) return { allowed: false, preview: false, reason: "Destructive operations are disabled by policy. Set OPENPROJECT_ALLOW_DESTRUCTIVE=true only when required." };
  if (intent.projectId !== undefined && !policy.allowedProjectIds.includes(intent.projectId)) return { allowed: false, preview: false, reason: "Target project is not in OPENPROJECT_ALLOWED_PROJECT_IDS." };
  if (intent.workPackageTypeId !== undefined && !policy.allowedWorkPackageTypeIds.includes(intent.workPackageTypeId)) return { allowed: false, preview: false, reason: "Target work package type is not in OPENPROJECT_ALLOWED_WORK_PACKAGE_TYPE_IDS." };
  if (intent.module && intent.projectId !== undefined && moduleEvidenceState(policy, intent.projectId, intent.module) !== "confirmed_enabled") return { allowed: false, preview: false, reason: "MODULE_EVIDENCE_REQUIRED: target project module is not confirmed enabled." };
  return { allowed: true, preview: false };
}

const SECRET_KEY = /token|authorization|password|secret|api[_-]?key/i;
const PRIVATE_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.)(?:[^\s"']*)/gi;

export function sanitizeAuditValue(value: unknown, key = ""): unknown {
  if (SECRET_KEY.test(key)) return "<redacted>";
  if (typeof value === "string") return value.replace(PRIVATE_URL, "<private-url>");
  if (Array.isArray(value)) return value.map((entry) => sanitizeAuditValue(entry));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitizeAuditValue(entryValue, entryKey)]));
  return value;
}

export function createAuditRecord(policy: OpenProjectPolicy, intent: MutationIntent, decision: PolicyDecision): Record<string, unknown> {
  const reason = decision.allowed ? "policy_match" : decision.reason;
  return sanitizeAuditValue({ event: "openproject_policy", tool: intent.tool, operation: intent.operation, projectId: intent.projectId, workPackageTypeId: intent.workPackageTypeId, decision: decision.allowed ? "allow" : decision.preview ? "preview" : "deny", reason: SECRET_KEY.test(reason) ? "<redacted>" : reason, authMode: policy.authorizationMode ?? "restricted" }) as Record<string, unknown>;
}
