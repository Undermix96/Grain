// Grain backend entrypoint: a small Fastify server exposing the photo
// gallery API. See AGENTS.md for the full architecture and the rationale
// behind every decision referenced in the comments below.

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { scanPhotos, getPhotoById } from './scanner.js';
import { ensurePhotoVersions, getVersionPath, SUPPORTED_VERSIONS } from './imagePipeline.js';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

await fastify.register(cors, {
  // The gallery is fully public and read-only from the browser's point of
  // view, so an open CORS policy carries no meaningful risk here.
  origin: true,
});

await fastify.register(rateLimit, {
  max: config.rateLimit.max,
  timeWindow: config.rateLimit.window,
});

/**
 * Strips internal-only fields before a photo entry is sent to API
 * consumers. Keeping this in one place avoids accidentally leaking
 * implementation details (like the raw mtime) through a future new route.
 */
function toPublicPhoto(photo) {
  const { mtimeMs, filename, ...publicFields } = photo;
  return publicFields;
}

fastify.get('/api/health', async () => ({ status: 'ok' }));

fastify.get('/api/photos', async (request, reply) => {
  const limit = Math.min(Number.parseInt(request.query.limit, 10) || 30, 100);
  const offset = Math.max(Number.parseInt(request.query.offset, 10) || 0, 0);

  const photos = await scanPhotos();
  const page = photos.slice(offset, offset + limit);

  return {
    photos: page.map(toPublicPhoto),
    total: photos.length,
    offset,
    limit,
    hasMore: offset + page.length < photos.length,
  };
});

/**
 * Serves a specific version of a photo, generating it on first request if
 * it isn't cached yet. Registered with a stricter rate limit than the
 * general API because first-time generation runs `sharp` and is the most
 * CPU-expensive operation the backend performs.
 */
fastify.get(
  '/api/photos/:id/:version',
  {
    config: {
      rateLimit: {
        max: config.rateLimitHeavy.max,
        timeWindow: config.rateLimitHeavy.window,
      },
    },
  },
  async (request, reply) => {
    const { id, version } = request.params;

    if (!SUPPORTED_VERSIONS.includes(version)) {
      return reply.code(400).send({ error: `Unknown photo version "${version}"` });
    }

    // Force-refreshing the scan here would make every single image
    // request pay for a folder scan; the photo list itself is already
    // kept fresh by scanCacheTtlMs, so a cache lookup is enough.
    await scanPhotos();
    const photo = getPhotoById(id);

    if (!photo) {
      return reply.code(404).send({ error: 'Photo not found' });
    }

    const sourcePath = path.join(config.photosPath, photo.filename);

    try {
      const versions = await ensurePhotoVersions(sourcePath, config.cachePath, photo.id);
      const filePath = versions[version] ?? getVersionPath(config.cachePath, photo.id, version);

      // All generated versions are immutable WebP files keyed by content
      // (the cache key changes whenever the source file changes), so they
      // can be cached aggressively by browsers/CDNs.
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      reply.type('image/webp');
      return reply.send(createReadStream(filePath));
    } catch (error) {
      request.log.error({ err: error, photoId: id, version }, 'failed to generate photo version');
      return reply.code(500).send({ error: 'Failed to generate image' });
    }
  },
);

/**
 * Forces an immediate re-scan of the photos folder, bypassing the normal
 * cache TTL. Useful right after copying new files in, without waiting for
 * the cache to expire on its own.
 */
fastify.post(
  '/api/refresh',
  {
    config: {
      rateLimit: {
        max: config.rateLimitHeavy.max,
        timeWindow: config.rateLimitHeavy.window,
      },
    },
  },
  async () => {
    const photos = await scanPhotos({ force: true });
    return { status: 'ok', photoCount: photos.length };
  },
);

try {
  await fastify.listen({ port: config.backendPort, host: '0.0.0.0' });
} catch (error) {
  fastify.log.error(error);
  process.exit(1);
}
