FROM oven/bun:1.3.14-alpine AS build

WORKDIR /app/plugins/openproject

COPY plugins/openproject/package.json plugins/openproject/bun.lock ./
RUN bun install --frozen-lockfile

COPY plugins/openproject/ ./
RUN bun run build

FROM node:20-alpine

WORKDIR /app
COPY --from=build /app/plugins/openproject/dist/openproject-mcp.js ./openproject-mcp.js

ENTRYPOINT ["node", "/app/openproject-mcp.js"]
