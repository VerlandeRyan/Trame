FROM node:24.22.2-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS build
WORKDIR /app
RUN npm install --global --ignore-scripts npm@12.2.0
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY nuxt.config.ts tsconfig.json ./
COPY app ./app
COPY i18n ./i18n
COPY server ./server
COPY shared ./shared
RUN npm run build

FROM node:24.22.2-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8
ENV NODE_ENV=production
WORKDIR /app
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
