# ---- build frontend ----
FROM node:22-alpine AS frontend
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- build backend ----
FROM node:22-alpine AS backend
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY backend/ ./
RUN npm run build

# ---- runtime ----
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=backend /app/dist ./dist
COPY --from=frontend /app/frontend/dist ./public

EXPOSE 3333
USER node
CMD ["node", "dist/server.js"]
