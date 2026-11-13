export type HalLink = { href?: string | null; title?: string };

export type HalResource = Record<string, unknown> & {
  count?: number;
  total?: number;
  offset?: number;
  pageSize?: number;
  id?: number;
  subject?: string;
  name?: string;
  identifier?: string;
  lockVersion?: number;
  startDate?: string | null;
  dueDate?: string | null;
  percentageDone?: number | null;
  fileName?: string;
  fileSize?: number;
  filesize?: number;
  contentType?: string;
  status?: string;
  _links?: Record<string, HalLink | HalLink[]>;
  _embedded?: { elements?: HalResource[] };
};

export type DownloadedFile = {
  bytes: Uint8Array;
  contentType: string;
};

export type OpenProjectFilter = {
  field: string;
  operator: string;
  values: string[] | null;
};

export type CollectionOptions = {
  filters?: OpenProjectFilter[];
  sortBy?: [string, "asc" | "desc"][];
  offset?: number;
  pageSize?: number;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class OpenProjectTransportError extends Error {
  constructor(
    public readonly status: number,
    public readonly category: "NOT_FOUND" | "PERMISSION_DENIED" | "STALE_LOCK_VERSION" | "TRANSPORT_ERROR",
  ) {
    super(
      category === "NOT_FOUND" ? "OpenProject resource was not found."
        : category === "PERMISSION_DENIED" ? "OpenProject permission was denied."
        : category === "STALE_LOCK_VERSION" ? "OpenProject rejected a stale lockVersion; re-read before retrying."
        : "OpenProject transport request failed.",
    );
    this.name = "OpenProjectTransportError";
  }
}

function transportError(status: number): OpenProjectTransportError {
  if (status === 404) return new OpenProjectTransportError(status, "NOT_FOUND");
  if (status === 403) return new OpenProjectTransportError(status, "PERMISSION_DENIED");
  if (status === 409) return new OpenProjectTransportError(status, "STALE_LOCK_VERSION");
  return new OpenProjectTransportError(status, "TRANSPORT_ERROR");
}

export function createOpenProjectApi(
  baseUrl: string,
  apiToken: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 30_000,
  authMode: "basic" | "bearer" = "basic",
) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  async function request(path: string, init: RequestInit, accept: string) {
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) headers.set("Accept", accept);
    if (!headers.has("Authorization")) {
      headers.set(
        "Authorization",
        authMode === "basic"
          ? `Basic ${Buffer.from(`apikey:${apiToken}`).toString("base64")}`
          : `Bearer ${apiToken}`,
      );
    }
    if (
      init.body &&
      !(init.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      // Transport payloads may contain server internals or user data. Surface only
      // a stable category that callers can safely return through MCP.
      await response.body?.cancel();
      throw transportError(response.status);
    }
    return response;
  }

  async function api<T extends HalResource>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await request(path, init, "application/hal+json");
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  api.download = async (
    path: string,
    maxBytes: number,
  ): Promise<DownloadedFile> => {
    const response = await request(path, {}, "*/*");
    const declaredSize = Number(response.headers.get("Content-Length"));
    if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
      await response.body?.cancel();
      throw new Error(
        `Attachment is ${declaredSize} bytes; the configured limit is ${maxBytes} bytes`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) return { bytes: new Uint8Array(), contentType: "application/octet-stream" };

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Attachment exceeds the configured limit of ${maxBytes} bytes`);
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      bytes,
      contentType:
        response.headers.get("Content-Type")?.split(";", 1)[0] ??
        "application/octet-stream",
    };
  };

  api.upload = async (
    path: string,
    fileName: string,
    contentType: string,
    bytes: Uint8Array,
    description?: string,
  ): Promise<HalResource> => {
    const form = new FormData();
    const fileBytes = Uint8Array.from(bytes);
    // OpenProject expects metadata as a scalar JSON string, not a file part.
    form.append(
      "metadata",
      JSON.stringify({
        fileName,
        ...(description
          ? { description: { format: "plain", raw: description } }
          : {}),
      }),
    );
    form.append(
      "file",
      new Blob([fileBytes.buffer], { type: contentType }),
      fileName,
    );
    return api(path, { method: "POST", body: form });
  };

  return api;
}

export type OpenProjectApi = ReturnType<typeof createOpenProjectApi>;

export function buildCollectionPath(
  path: string,
  options: CollectionOptions = {},
): string {
  const params = new URLSearchParams();
  if (options.filters?.length) {
    params.set(
      "filters",
      JSON.stringify(
        options.filters.map(({ field, operator, values }) => ({
          [field]: { operator, values },
        })),
      ),
    );
  }
  if (options.sortBy?.length) {
    params.set("sortBy", JSON.stringify(options.sortBy));
  }
  if (options.offset !== undefined) params.set("offset", String(options.offset));
  if (options.pageSize !== undefined) {
    params.set("pageSize", String(options.pageSize));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function collectionResult(resource: HalResource) {
  const offset = resource.offset ?? 1;
  const pageSize = resource.pageSize ?? resource.count ?? 0;
  const count = resource.count ?? elements(resource).length;
  const total = resource.total ?? count;
  return {
    total,
    count,
    offset,
    pageSize,
    hasMore: offset * pageSize < total,
  };
}

export function assertApiV3Path(path: string): string {
  if (!path.startsWith("/")) throw new Error("API path must start with /");
  const parsed = new URL(path, "https://openproject.invalid");
  if (parsed.origin !== "https://openproject.invalid") {
    throw new Error("API path must be relative to the configured OpenProject instance");
  }
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    throw new Error("API path contains invalid percent encoding");
  }
  const normalized = decodedPath.replace(/\/{2,}/g, "/");
  if (
    normalized.includes("\\") ||
    normalized.split("/").includes("..") ||
    (normalized !== "/api/v3" && !normalized.startsWith("/api/v3/"))
  ) {
    throw new Error("Only GET paths under /api/v3 are allowed");
  }
  return `${normalized}${parsed.search}`;
}

export function compactAttachment(resource: HalResource): Record<string, unknown> {
  return {
    id: resource.id,
    fileName: resource.fileName,
    fileSize: resource.fileSize ?? resource.filesize,
    contentType: resource.contentType,
    status: resource.status,
    author: linkedResource(resource, "author"),
    downloadLocation: linkedResource(resource, "downloadLocation"),
  };
}

export function isTextAttachment(fileName: string, contentType: string): boolean {
  if (contentType.startsWith("text/")) return true;
  if (/^(application\/(json|xml|yaml|x-yaml|javascript))$/.test(contentType)) {
    return true;
  }
  return /\.(md|txt|csv|json|xml|ya?ml|log|html?|css|m?js|cjs|tsx?|py|sql)$/i.test(
    fileName,
  );
}

export function elements(resource: HalResource): HalResource[] {
  return resource._embedded?.elements ?? [];
}

export function compact(resource: HalResource): Record<string, unknown> {
  return {
    id: resource.id,
    name: resource.name,
    identifier: resource.identifier,
    subject: resource.subject,
    lockVersion: resource.lockVersion,
    links: resource._links,
  };
}

function linkedResource(resource: HalResource, key: string): HalLink | null {
  const link = resource._links?.[key];
  return link && !Array.isArray(link) ? link : null;
}

export function compactWorkPackage(
  resource: HalResource,
  baseUrl: string,
): Record<string, unknown> {
  return {
    id: resource.id,
    subject: resource.subject,
    url: workPackageWebUrl(baseUrl, resource.id),
    startDate: resource.startDate,
    dueDate: resource.dueDate,
    percentageDone: resource.percentageDone,
    project: linkedResource(resource, "project"),
    type: linkedResource(resource, "type"),
    status: linkedResource(resource, "status"),
    priority: linkedResource(resource, "priority"),
    assignee: linkedResource(resource, "assignee"),
    self: linkedResource(resource, "self"),
  };
}

export function workPackageWebUrl(
  baseUrl: string,
  id: number | undefined,
): string | undefined {
  if (!id) return undefined;
  return `${baseUrl.replace(/\/$/, "")}/work_packages/${id}`;
}

export function buildWorkPackageSearchPath({
  query,
  projectId,
  assigneeId,
  dueDate,
  statusId,
  statusCategory,
  filters: extraFilters,
  sortBy,
  offset,
  pageSize,
}: {
  query?: string;
  projectId?: number;
  assigneeId?: number;
  dueDate?: string;
  statusId?: number;
  statusCategory?: "open" | "closed";
  filters?: OpenProjectFilter[];
  sortBy?: [string, "asc" | "desc"][];
  offset?: number;
  pageSize: number;
}): string {
  const filters: Record<string, unknown>[] = [];
  if (query) filters.push({ subject: { operator: "~", values: [query] } });
  if (projectId) {
    filters.push({ project: { operator: "=", values: [String(projectId)] } });
  }
  if (assigneeId) {
    filters.push({ assignee: { operator: "=", values: [String(assigneeId)] } });
  }
  if (dueDate) {
    filters.push({ dueDate: { operator: "=d", values: [dueDate] } });
  }
  if (statusId) {
    filters.push({ status: { operator: "=", values: [String(statusId)] } });
  } else if (statusCategory) {
    filters.push({
      status: {
        operator: statusCategory === "open" ? "o" : "c",
        values: [],
      },
    });
  }
  for (const { field, operator, values } of extraFilters ?? []) {
    filters.push({ [field]: { operator, values } });
  }
  const params = new URLSearchParams({ pageSize: String(pageSize) });
  if (offset !== undefined) params.set("offset", String(offset));
  if (sortBy?.length) params.set("sortBy", JSON.stringify(sortBy));
  if (filters.length) params.set("filters", JSON.stringify(filters));
  return `/api/v3/work_packages?${params}`;
}

export function buildWorkPackageUpdatePayload(
  lockVersion: number | undefined,
  input: {
    subject?: string;
    description?: string;
    assigneeId?: number | null;
    priorityId?: number;
    statusId?: number;
    responsibleId?: number | null;
    parentId?: number | null;
    versionId?: number | null;
    startDate?: string | null;
    dueDate?: string | null;
    percentageDone?: number;
    estimatedTime?: string | null;
  },
): Record<string, unknown> {
  const links: Record<string, HalLink> = {};
  if (input.assigneeId !== undefined) {
    links.assignee = {
      href: input.assigneeId ? `/api/v3/users/${input.assigneeId}` : null,
    };
  }
  if (input.priorityId) {
    links.priority = { href: `/api/v3/priorities/${input.priorityId}` };
  }
  if (input.statusId) {
    links.status = { href: `/api/v3/statuses/${input.statusId}` };
  }
  for (const [key, id, collection] of [
    ["responsible", input.responsibleId, "users"],
    ["parent", input.parentId, "work_packages"],
    ["version", input.versionId, "versions"],
  ] as const) {
    if (id !== undefined) {
      links[key] = { href: id ? `/api/v3/${collection}/${id}` : null };
    }
  }

  return {
    lockVersion,
    ...(input.subject !== undefined ? { subject: input.subject } : {}),
    ...(input.description !== undefined
      ? { description: { format: "markdown", raw: input.description } }
      : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.percentageDone !== undefined
      ? { percentageDone: input.percentageDone }
      : {}),
    ...(input.estimatedTime !== undefined
      ? { estimatedTime: input.estimatedTime }
      : {}),
    ...(Object.keys(links).length ? { _links: links } : {}),
  };
}
