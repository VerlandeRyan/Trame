FROM node:24-alpine AS build
WORKDIR /app
# npm à jour : celui embarqué dans l'image de base a des dépendances internes vulnérables.
RUN npm install --global --ignore-scripts npm@12.2.0
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
# Correctifs système, puis retrait de npm : l'exécution n'a besoin que de node.
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
