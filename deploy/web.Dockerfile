FROM node:24.4.1-alpine AS build

WORKDIR /workspace

COPY packages/game-engine/package.json packages/game-engine/package-lock.json ./packages/game-engine/
RUN npm ci --prefix packages/game-engine

COPY packages/game-engine ./packages/game-engine
RUN npm run build --prefix packages/game-engine

COPY packages/bot/package.json packages/bot/package-lock.json ./packages/bot/
RUN npm ci --prefix packages/bot

COPY packages/bot ./packages/bot
RUN npm run build --prefix packages/bot

COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
RUN npm ci --prefix apps/web

COPY apps/web ./apps/web

ARG VITE_WS_URL=wss://basiclandgame.com/ws
ENV VITE_WS_URL=${VITE_WS_URL}

RUN npm run build --prefix apps/web

FROM nginx:1.29-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
