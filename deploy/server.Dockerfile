FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app/server
COPY server/package*.json ./
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca npm ci; else npm ci; fi
COPY server/ ./
RUN --mount=type=secret,id=npm_ca \
    npm run build && \
    if [ -f /run/secrets/npm_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca npm prune --omit=dev; else npm prune --omit=dev; fi

FROM node:24.19.0-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app/server
COPY --from=build --chown=node:node /app/server/package*.json ./
COPY --from=build --chown=node:node /app/server/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server/dist ./dist
COPY --from=build --chown=node:node /app/server/migrations ./migrations
COPY --chown=node:node docs/openapi.yaml /app/docs/openapi.yaml
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
