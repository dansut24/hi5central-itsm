FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
COPY deployment/runtime-config-entrypoint.sh /usr/bin/hi5-runtime-entrypoint
RUN chmod 0755 /usr/bin/hi5-runtime-entrypoint
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O- http://127.0.0.1/healthz | grep -qx ok || exit 1
ENTRYPOINT ["/usr/bin/hi5-runtime-entrypoint"]
CMD ["caddy","run","--config","/etc/caddy/Caddyfile","--adapter","caddyfile"]
