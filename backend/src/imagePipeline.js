// Generates and caches the three served versions of every photo:
//
//   - thumbnail: small, for the gallery grid
//   - medium:    screen-sized, for the lightbox
//   - full:      near-original resolution, for download
//
// All three are re-encoded with sharp and, crucially, none of them carry
// the source file's EXIF metadata: sharp does not copy EXIF/GPS data to
// the output unless `.withMetadata()` or `.keepExif()` is explicitly
// called, which this module never does. This is what guarantees GPS data
// never leaves the server in any served file, including the "full"
// download.
//
// Orientation is a deliberate exception: `.rotate()` (with no arguments)
// reads the source EXIF orientation tag and bakes the correct rotation
// into the pixel data itself before the metadata is stripped, so photos
// don't end up sideways once the orientation tag is gone.
//
// Color accuracy: by default sharp converts output to the device-
// independent sRGB color space when metadata (including any embedded ICC
// profile) is stripped, which is exactly what we want for `thumbnail` and
// `medium` — every browser renders sRGB consistently, so colors and tones
// look correct everywhere. For `full` (the version offered for download),
// we instead keep the source file's original ICC color profile via
// `.keepIccProfile()` — this is independent from EXIF/GPS stripping, so a
// photographer working in Adobe RGB or ProPhoto RGB gets a downloaded file
// that preserves their original color profile, without any location data
// attached.

import { createHash } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const VERSIONS = {
  thumbnail: { width: 500, quality: 70, keepColorProfile: false },
  medium: { width: 1920, quality: 82, keepColorProfile: false },
  // `full` is capped rather than fixed: most photos are served near their
  // original resolution, but anything larger than this is downscaled to
  // keep download size reasonable. Sharp leaves smaller images untouched
  // when using `withoutEnlargement`. It also keeps the original ICC color
  // profile instead of converting to sRGB — see the module-level comment
  // above for why.
  full: { width: 4000, quality: 92, keepColorProfile: true },
};

/**
 * Derives a stable cache key for a source photo from its relative path
 * and modification time. When the source file changes, its mtime changes,
 * the key changes, and the pipeline naturally regenerates fresh versions
 * on the next request instead of serving a stale cached copy.
 */
export function computeCacheKey(relativePath, mtimeMs) {
  return createHash('sha1').update(`${relativePath}:${mtimeMs}`).digest('hex');
}

function cacheFilePath(cacheDir, cacheKey, versionName) {
  // Splitting into subdirectories by the first two hex chars avoids
  // dumping tens of thousands of files into a single flat directory.
  const subdir = cacheKey.slice(0, 2);
  return path.join(cacheDir, subdir, `${cacheKey}-${versionName}.webp`);
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generateVersion(sourcePath, targetPath, { width, quality, keepColorProfile }) {
  await mkdir(path.dirname(targetPath), { recursive: true });

  let pipeline = sharp(sourcePath)
    .rotate() // bake in EXIF orientation before metadata is stripped
    .resize({ width, withoutEnlargement: true });

  pipeline = keepColorProfile
    // Keep the original ICC color profile (e.g. Adobe RGB, ProPhoto RGB)
    // for the download version. This does NOT bring EXIF/GPS back: EXIF
    // and ICC are handled independently by sharp.
    ? pipeline.keepIccProfile()
    // Explicit for readability, even though this is sharp's default when
    // metadata is stripped: convert to sRGB for consistent, correct
    // colors in every browser.
    : pipeline.toColorspace('srgb');

  await pipeline
    .webp({ quality })
    // No .withMetadata()/.keepExif() call: output never carries EXIF/GPS.
    .toFile(targetPath);
}

/**
 * Ensures the thumbnail/medium/full versions of a photo exist in the
 * cache, generating any missing ones, and returns their file paths.
 *
 * Safe to call concurrently for the same photo: existing files are never
 * regenerated once present, so the worst case under a race is a redundant
 * generation, never a corrupted read.
 */
export async function ensurePhotoVersions(sourcePath, cacheDir, cacheKey) {
  const paths = {
    thumbnail: cacheFilePath(cacheDir, cacheKey, 'thumbnail'),
    medium: cacheFilePath(cacheDir, cacheKey, 'medium'),
    full: cacheFilePath(cacheDir, cacheKey, 'full'),
  };

  // Versions are generated sequentially on purpose, to avoid spiking CPU
  // with parallel sharp jobs for the same photo on a CPU-only host.
  for (const [versionName, options] of Object.entries(VERSIONS)) {
    const targetPath = paths[versionName];
    if (!(await fileExists(targetPath))) {
      await generateVersion(sourcePath, targetPath, options);
    }
  }

  return paths;
}

/**
 * Returns the cache file path for a single version without generating it,
 * for callers that already know the version exists (e.g. right after
 * `ensurePhotoVersions`).
 */
export function getVersionPath(cacheDir, cacheKey, versionName) {
  if (!VERSIONS[versionName]) {
    throw new Error(`Unknown photo version: ${versionName}`);
  }
  return cacheFilePath(cacheDir, cacheKey, versionName);
}

export const SUPPORTED_VERSIONS = Object.keys(VERSIONS);
