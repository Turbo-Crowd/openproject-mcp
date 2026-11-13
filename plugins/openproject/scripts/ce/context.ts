import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OpenProjectApi } from "../openproject-api.js";
import type { OpenProjectPolicy } from "../policy.js";

export type WriteRegistration = (destructive?: boolean) => {
  annotations: Record<string, boolean>;
};

export type CeRegistrationContext = {
  server: McpServer;
  api: OpenProjectApi;
  policy: OpenProjectPolicy;
  read: { annotations: { readOnlyHint: true } };
  write: WriteRegistration;
};

export type CeDomainRegistrar = (context: CeRegistrationContext) => void;
