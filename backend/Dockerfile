# ─────────────────────────────────────────────
# Stage 1: build — compila TypeScript a JavaScript
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias primero (aprovecha caché de capas Docker)
COPY package*.json ./
RUN npm ci

# Copiar código fuente y compilar
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: runner — imagen mínima para producción
# ─────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Solo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar artefactos compilados y assets estáticos
COPY --from=builder /app/dist ./dist
COPY public ./public

# Usuario sin privilegios para mayor seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3005

CMD ["node", "dist/server.js"]
