FROM node:20-alpine

RUN npm install --global @turbo-crowd/openproject-mcp@0.5.0

ENTRYPOINT ["openproject-mcp"]
