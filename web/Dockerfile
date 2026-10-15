FROM node:24-alpine AS build
WORKDIR /app
RUN npm install --global --ignore-scripts npm@12.2.0
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY nuxt.config.ts tsconfig.json ./
COPY app ./app
COPY i18n ./i18n
COPY server ./server
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
