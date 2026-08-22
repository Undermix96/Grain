// Parses photo filenames following Grain's naming convention:
//
//   YYYY-MM-DD-album-title.ext
//
// - date  (required by convention, but falls back to file mtime if absent
//          or invalid, so a "wrongly named" file still shows up instead of
//          being skipped)
// - album (required by convention, defaults to "uncategorized" if absent;
//          not yet used by the frontend, but always extracted so it's
//          ready for future album/category features)
// - title (optional, parsed but not yet displayed in the UI; underscores
//          are treated as spaces to keep filenames filesystem-friendly)
//
// Examples:
//   2026-08-21-travel-sunset_over_the_lake.jpg
//     -> { date: '2026-08-21', album: 'travel', title: 'sunset over the lake' }
//   2026-08-21-travel.jpg
//     -> { date: '2026-08-21', album: 'travel', title: null }
//   random-name.jpg
//     -> { date: null, album: 'uncategorized', title: null }  (mtime fallback applied by caller)

const DEFAULT_ALBUM = 'uncategorized';

const DATE_PREFIX_PATTERN = /^(\d{4})-(\d{2})-(\d{2})-(.+)$/;

/**
 * Checks whether a date extracted from a filename is a real, valid
 * calendar date (rejects things like 2026-13-40).
 */
function isValidDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Splits the "album-title" remainder (i.e. the filename stem with the
 * date prefix already stripped) into album and title.
 *
 * The album is the first hyphen-separated segment; everything after it
 * is the title. If there is no further segment, the title is null.
 */
function splitAlbumAndTitle(remainder) {
  const separatorIndex = remainder.indexOf('-');

  if (separatorIndex === -1) {
    return {
      album: remainder || DEFAULT_ALBUM,
      title: null,
    };
  }

  const album = remainder.slice(0, separatorIndex) || DEFAULT_ALBUM;
  const titleRaw = remainder.slice(separatorIndex + 1);
  const title = titleRaw ? titleRaw.replace(/_/g, ' ').trim() : null;

  return { album, title: title || null };
}

/**
 * Parses a photo filename (without directory path) into its components.
 *
 * @param {string} filename - e.g. "2026-08-21-travel-sunset_over_the_lake.jpg"
 * @returns {{ date: string|null, album: string, title: string|null, extension: string }}
 *   `date` is an ISO date string (YYYY-MM-DD) or null if not present/valid
 *   in the filename; callers should fall back to the file's mtime in that
 *   case.
 */
export function parseFilename(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0;
  const stem = hasExtension ? filename.slice(0, lastDotIndex) : filename;
  const extension = hasExtension ? filename.slice(lastDotIndex + 1).toLowerCase() : '';

  const match = stem.match(DATE_PREFIX_PATTERN);

  if (!match) {
    return {
      date: null,
      ...splitAlbumAndTitle(stem),
      extension,
    };
  }

  const [, yearStr, monthStr, dayStr, remainder] = match;
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);

  if (!isValidDate(year, month, day)) {
    // Looks like a date but isn't one (e.g. 2026-13-40-foo.jpg): treat the
    // whole stem as album/title instead of guessing.
    return {
      date: null,
      ...splitAlbumAndTitle(stem),
      extension,
    };
  }

  return {
    date: `${yearStr}-${monthStr}-${dayStr}`,
    ...splitAlbumAndTitle(remainder),
    extension,
  };
}

const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'tif']);

/**
 * Whether a filename looks like a photo Grain should serve, based on its
 * extension. Used by the folder scanner to skip unrelated files (e.g.
 * .DS_Store, README files accidentally left in the photos folder).
 */
export function isSupportedPhotoFile(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex <= 0) return false;
  const extension = filename.slice(lastDotIndex + 1).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(extension);
}
