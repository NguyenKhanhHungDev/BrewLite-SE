FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Generate does not connect to this placeholder database.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/brewlite?schema=public" \
    npx prisma generate --config ./prisma7.config.ts && npm run build

# The one-shot database job retains Prisma/tsx; the API runtime does not.
FROM build AS migration
ENV PATH="/app/node_modules/.bin:${PATH}"
USER node
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --config ./prisma7.config.ts && ./node_modules/.bin/prisma db seed --config ./prisma7.config.ts"]

FROM build AS production-dependencies
# Prisma Client's optional peers can retain the CLI/compiler even with omit=dev.
# The generated dist client only needs @prisma/client/runtime, not these tools.
RUN npm prune --omit=dev --omit=peer --ignore-scripts --offline --no-audit --no-fund \
    && rm -rf node_modules/prisma node_modules/typescript \
        node_modules/.bin/prisma node_modules/.bin/tsc node_modules/.bin/tsserver

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
