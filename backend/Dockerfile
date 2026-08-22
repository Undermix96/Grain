# syntax=docker/dockerfile:1

FROM node:22-alpine

# sharp needs vips at runtime; the prebuilt binary npm installs on alpine
# pulls in the required shared libraries automatically, so no extra apk
# packages are needed here as of sharp 0.33.
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

# Source photos (read-only) and the generated-versions cache are mounted
# as volumes at deploy time — see docker-compose.yml. These defaults match
# config.js's fallbacks so the image also runs standalone for local testing.
ENV PHOTOS_PATH=/data/photos
ENV CACHE_PATH=/data/cache
ENV BACKEND_PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3001/api/health >/dev/null || exit 1

CMD ["node", "src/index.js"]
