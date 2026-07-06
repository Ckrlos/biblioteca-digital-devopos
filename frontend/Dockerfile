# ---- Stage 1: builder ------------------------------------------------------
# Bundlea y minifica app.js + styles.css con esbuild antes de servirlos;
# esto es lo que justifica el multietapa (no es solo copiar archivos estaticos).
#
# pnpm (via corepack) en vez de npm: bloquea scripts postinstall de
# dependencias por defecto (mitigacion de supply chain), con lockfile de
# hashes de integridad igual que npm.
FROM node:20-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY build.js ./
COPY src ./src
RUN pnpm run build

# ---- Stage 2: runtime -------------------------------------------------------
FROM nginx:alpine

# BACKEND_HOST/PORT son el unico destino al que nginx hace reverse proxy de
# /api/*; se sobreescriben por entorno (docker-compose usa el nombre de
# servicio "backend", K8s usa "backend-service"), nunca hardcodeados en el
# frontend. NGINX_ENVSUBST_FILTER limita el envsubst automatico del
# entrypoint a estas dos variables, para no tocar por error variables propias
# de nginx como $host o $request_uri en la plantilla.
ENV BACKEND_HOST=backend \
    BACKEND_PORT=3001 \
    NGINX_ENVSUBST_FILTER=^BACKEND_

# nginx:alpine ya trae un usuario "nginx" no root; ajustamos permisos para
# poder correr el proceso maestro sin privilegios de root.
RUN sed -i 's/^user\s\+nginx;//' /etc/nginx/nginx.conf && \
    sed -i 's#pid\s*/run/nginx.pid;#pid /tmp/nginx.pid;#' /etc/nginx/nginx.conf && \
    sed -i '/^http {/a \    client_body_temp_path /tmp/client_temp;\n    proxy_temp_path /tmp/proxy_temp;\n    fastcgi_temp_path /tmp/fastcgi_temp;\n    uwsgi_temp_path /tmp/uwsgi_temp;\n    scgi_temp_path /tmp/scgi_temp;' /etc/nginx/nginx.conf && \
    chown -R nginx:nginx /var/cache/nginx /etc/nginx/conf.d

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
RUN rm -f /etc/nginx/conf.d/default.conf

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:80/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
