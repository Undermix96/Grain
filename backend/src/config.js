// Centralized configuration, read from environment variables.
// Keeping all env access in one place makes it easy to see what the
// backend depends on and to add validation later if needed.

function parseIntEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  // Folder containing the original photos, mounted read-only in the
  // container. Never written to and never served directly.
  photosPath: process.env.PHOTOS_PATH || '/data/photos',

  // Folder used to store generated thumbnail/medium/full versions.
  // Safe to wipe entirely: it will be regenerated from photosPath.
  cachePath: process.env.CACHE_PATH || '/data/cache',

  // Internal port the Fastify server listens on.
  backendPort: parseIntEnv(process.env.BACKEND_PORT, 3001),

  // How long the in-memory photo list stays valid before the folder is
  // re-scanned on the next request. Keeps repeated requests cheap while
  // still picking up new/modified files without a restart.
  scanCacheTtlMs: parseIntEnv(process.env.SCAN_CACHE_TTL_MS, 60_000),

  // General API rate limit (applies to read endpoints like listing photos).
  rateLimit: {
    max: parseIntEnv(process.env.RATE_LIMIT_MAX, 200),
    window: process.env.RATE_LIMIT_WINDOW || '1 minute',
  },

  // Stricter rate limit for expensive endpoints (first-time image
  // generation, manual refresh).
  rateLimitHeavy: {
    max: parseIntEnv(process.env.RATE_LIMIT_HEAVY_MAX, 10),
    window: process.env.RATE_LIMIT_HEAVY_WINDOW || '1 minute',
  },
};
