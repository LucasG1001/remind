# O lockfile é escrito pelo npm da máquina de desenvolvimento (11.x), e o node:22-alpine
# traz o npm 10, que resolve a árvore de dependências opcionais de outro jeito e recusa o
# `npm ci` com "Missing: @emnapi/... from lock file". Fixar a versão aqui é o que faz o
# build ser reprodutível de verdade; ao trocar o npm local, troque este número junto.
ARG NPM_VERSION=11.6.2

# ---- build frontend ----
FROM node:22-alpine AS frontend
ARG NPM_VERSION
RUN npm i -g npm@${NPM_VERSION}
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- build backend ----
FROM node:22-alpine AS backend
ARG NPM_VERSION
RUN npm i -g npm@${NPM_VERSION}
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY backend/ ./
RUN npm run build

# ---- runtime ----
FROM node:22-alpine
ARG NPM_VERSION
RUN npm i -g npm@${NPM_VERSION}
WORKDIR /app

ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=backend /app/dist ./dist
COPY --from=frontend /app/frontend/dist ./public

EXPOSE 3333
USER node
CMD ["node", "dist/server.js"]
