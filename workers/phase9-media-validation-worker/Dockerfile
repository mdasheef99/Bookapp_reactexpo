FROM node:22.13.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY workers/phase9-runtime ./workers/phase9-runtime
COPY workers/phase9-media-validation-worker ./workers/phase9-media-validation-worker
COPY supabase/functions/_shared/imageInventory ./supabase/functions/_shared/imageInventory
RUN npm run build:phase9:media-worker

FROM node:22.13.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.phase9-dist ./.phase9-dist
COPY --from=build /app/node_modules/@imagemagick/magick-wasm/dist/magick.wasm /app/runtime/magick.wasm
ENV PHASE9_MEDIA_WORKER_MAGICK_WASM_PATH=/app/runtime/magick.wasm
EXPOSE 8091
CMD ["node", ".phase9-dist/workers/phase9-media-validation-worker/server.js"]
