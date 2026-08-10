FROM node:22.13.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY workers/phase9-runtime ./workers/phase9-runtime
COPY workers/phase9-metadata-worker ./workers/phase9-metadata-worker
COPY supabase/functions/_shared/imageInventory ./supabase/functions/_shared/imageInventory
RUN npm run build:phase9:metadata-worker

FROM node:22.13.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.phase9-dist ./.phase9-dist
EXPOSE 8093
CMD ["node", ".phase9-dist/workers/phase9-metadata-worker/server.js"]
