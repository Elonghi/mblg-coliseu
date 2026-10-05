FROM node:24.4.1-alpine AS build

WORKDIR /workspace

COPY packages/game-engine/package.json packages/game-engine/package-lock.json ./packages/game-engine/
RUN npm ci --prefix packages/game-engine

COPY packages/game-engine ./packages/game-engine
RUN npm run build --prefix packages/game-engine

COPY apps/server/package.json apps/server/package-lock.json ./apps/server/
RUN npm ci --prefix apps/server

COPY apps/server ./apps/server
RUN npm run build --prefix apps/server \
  && npm prune --omit=dev --prefix apps/server

FROM node:24.4.1-alpine AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /workspace/packages/game-engine/package.json ./packages/game-engine/package.json
COPY --from=build --chown=node:node /workspace/packages/game-engine/dist ./packages/game-engine/dist
COPY --from=build --chown=node:node /workspace/apps/server/package.json ./apps/server/package.json
COPY --from=build --chown=node:node /workspace/apps/server/node_modules ./apps/server/node_modules
COPY --from=build --chown=node:node /workspace/apps/server/dist ./apps/server/dist

USER node
WORKDIR /app/apps/server

EXPOSE 3000

CMD ["node", "dist/main.js"]
