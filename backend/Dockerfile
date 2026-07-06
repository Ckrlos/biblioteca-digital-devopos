# ---- Stage 1: deps -------------------------------------------------------
# Instala solo dependencias de produccion en una capa cacheable y separada
# del codigo fuente, para builds mas rapidos y reproducibles.
#
# Usamos pnpm (via corepack, firmado y distribuido con Node) en vez de npm:
# pnpm bloquea por defecto los scripts postinstall de las dependencias, que
# es el vector que explotaron varios ataques reales a la cadena de
# suministro de npm (ua-parser-js, event-stream). pnpm-lock.yaml fija
# versiones exactas con hash de integridad, igual que package-lock.json.
FROM node:20-alpine AS deps

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# ---- Stage 2: runtime -----------------------------------------------------
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Usuario no root para ejecutar el proceso de la aplicacion.
RUN addgroup -S biblioteca && adduser -S biblioteca -G biblioteca

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

USER biblioteca

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
