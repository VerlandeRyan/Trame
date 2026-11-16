FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build
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

FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
ENV NODE_ENV=production
WORKDIR /app
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
