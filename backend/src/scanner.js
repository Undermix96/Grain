// Scans the photos folder and builds the in-memory photo list the API
// serves from. Re-scanning is cheap (filesystem stat + a few header bytes
// per file for EXIF), so we simply re-read the folder from scratch on
// every scan rather than tracking incremental changes — this is what
// lets new/modified photos show up without restarting the backend (see
// AGENTS.md §3, "Detecting new/modified photos").
//
// The result is cached in memory for `scanCacheTtlMs`: repeated API
// requests within that window reuse the same list instead of hitting the
// filesystem again. `scanPhotos({ force: true })` bypasses the cache
// immediately, used by the manual refresh endpoint.

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from './config.js';
import { extractDisplayExif } from './exif.js';
import { computeCacheKey } from './imagePipeline.js';
import { isSupportedPhotoFile, parseFilename } from './filename.js';

let cachedPhotos = [];
let photosById = new Map();
let lastScanAt = 0;
let scanInFlight = null;

async function readImageDimensions(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    return { width: metadata.width ?? null, height: metadata.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

async function buildPhotoEntry(filename) {
  const filePath = path.join(config.photosPath, filename);
  const stats = await stat(filePath);
  const parsed = parseFilename(filename);

  // Fall back to the file's modification time whenever the filename
  // doesn't carry a valid date, so the photo still appears in the
  // gallery (and sorts sensibly) instead of being skipped.
  const date = parsed.date ?? stats.mtime.toISOString().slice(0, 10);

  const id = computeCacheKey(filename, stats.mtimeMs);

  const [dimensions, exif] = await Promise.all([
    readImageDimensions(filePath),
    extractDisplayExif(filePath),
  ]);

  return {
    id,
    filename,
    date,
    album: parsed.album,
    title: parsed.title,
    width: dimensions.width,
    height: dimensions.height,
    exif,
    // Kept internally to resolve the source file for image generation and
    // to sort deterministically; never sent to API consumers as-is.
    mtimeMs: stats.mtimeMs,
  };
}

function sortNewestFirst(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return b.mtimeMs - a.mtimeMs;
}

async function performScan() {
  let filenames;
  try {
    filenames = await readdir(config.photosPath);
  } catch (error) {
    // Folder missing/unreadable: log and behave as an empty gallery
    // rather than crashing the whole server.
    // eslint-disable-next-line no-console
    console.error(`[scanner] failed to read photos folder "${config.photosPath}":`, error.message);
    return [];
  }

  const photoFilenames = filenames.filter(isSupportedPhotoFile);

  const entries = await Promise.all(
    photoFilenames.map(async (filename) => {
      try {
        return await buildPhotoEntry(filename);
      } catch (error) {
        // A single unreadable/corrupt file must not break the whole
        // gallery — skip it and keep going, consistent with the
        // "skip and continue" error-handling philosophy used across
        // the maintainer's other self-hosted projects.
        // eslint-disable-next-line no-console
        console.error(`[scanner] skipping "${filename}":`, error.message);
        return null;
      }
    }),
  );

  return entries.filter(Boolean).sort(sortNewestFirst);
}

/**
 * Returns the current photo list, re-scanning the folder if the cache has
 * expired (or if `force` is true). Concurrent calls while a scan is
 * already in progress share the same in-flight scan instead of triggering
 * duplicate filesystem work.
 */
export async function scanPhotos({ force = false } = {}) {
  const isFresh = Date.now() - lastScanAt < config.scanCacheTtlMs;

  if (!force && isFresh) {
    return cachedPhotos;
  }

  if (scanInFlight) {
    return scanInFlight;
  }

  scanInFlight = performScan()
    .then((photos) => {
      cachedPhotos = photos;
      photosById = new Map(photos.map((photo) => [photo.id, photo]));
      lastScanAt = Date.now();
      return cachedPhotos;
    })
    .finally(() => {
      scanInFlight = null;
    });

  return scanInFlight;
}

/**
 * Looks up a single photo by id from the current cache without forcing a
 * re-scan. Callers that need an up-to-date view should call `scanPhotos`
 * first (the API layer does this on every request that needs it).
 */
export function getPhotoById(id) {
  return photosById.get(id) ?? null;
}
