FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app/client
COPY client/package*.json ./
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca npm ci; else npm ci; fi
COPY client/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28.0-alpine
COPY --chown=nginx:nginx --chmod=644 deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /app/client/dist /usr/share/nginx/html
EXPOSE 8080
