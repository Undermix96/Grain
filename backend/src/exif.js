// Extracts the subset of EXIF data Grain shows in the UI: camera, lens,
// focal length, aperture, shutter speed, ISO.
//
// This module never reads or returns GPS/location tags. It's not enough
// that the frontend chooses not to display them — we don't even ask
// exifr to parse the GPS IFD in the first place, so there is no code path
// in the whole application where location data exists in memory as
// parsed, readable coordinates.

import exifr from 'exifr';

const REQUESTED_TAGS = ['Make', 'Model', 'LensModel', 'FNumber', 'ExposureTime', 'FocalLength', 'ISO'];

const EXIFR_OPTIONS = {
  // Only the tags listed above are parsed.
  pick: REQUESTED_TAGS,
  // Explicitly disable GPS parsing, even though `pick` above already
  // excludes it. Defense in depth: if REQUESTED_TAGS is ever edited
  // carelessly, this flag still guarantees GPS is never parsed.
  gps: false,
  // No need for the embedded thumbnail some cameras store in EXIF.
  thumbnail: false,
};

function formatShutterSpeed(exposureTimeSeconds) {
  if (!exposureTimeSeconds || exposureTimeSeconds <= 0) return null;
  if (exposureTimeSeconds >= 1) {
    // Round to at most 1 decimal for slow, multi-second exposures.
    return `${Math.round(exposureTimeSeconds * 10) / 10}s`;
  }
  const denominator = Math.round(1 / exposureTimeSeconds);
  return `1/${denominator}s`;
}

function formatAperture(fNumber) {
  if (!fNumber || fNumber <= 0) return null;
  // Avoid trailing ".0" for whole f-stops (f/2 instead of f/2.0), while
  // keeping one decimal for fractional stops (f/1.8).
  const rounded = Math.round(fNumber * 10) / 10;
  return `f/${rounded}`;
}

function formatFocalLength(focalLengthMm) {
  if (!focalLengthMm || focalLengthMm <= 0) return null;
  return `${Math.round(focalLengthMm)}mm`;
}

/**
 * Reads the display-relevant EXIF fields from a photo file and returns
 * them pre-formatted for the UI. Any field missing from the source file
 * (e.g. a screenshot or a scanned photo with no EXIF at all) is simply
 * omitted from the result rather than included as a placeholder.
 *
 * Never throws on missing/malformed EXIF: returns an empty object instead,
 * since a photo without readable EXIF should still be served normally.
 */
export async function extractDisplayExif(filePath) {
  let raw;
  try {
    raw = await exifr.parse(filePath, EXIFR_OPTIONS);
  } catch {
    return {};
  }

  if (!raw) return {};

  const result = {};

  const camera = [raw.Make, raw.Model].filter(Boolean).join(' ').trim();
  if (camera) result.camera = camera;

  if (raw.LensModel) result.lens = raw.LensModel;

  const focalLength = formatFocalLength(raw.FocalLength);
  if (focalLength) result.focalLength = focalLength;

  const aperture = formatAperture(raw.FNumber);
  if (aperture) result.aperture = aperture;

  const shutterSpeed = formatShutterSpeed(raw.ExposureTime);
  if (shutterSpeed) result.shutterSpeed = shutterSpeed;

  if (raw.ISO) result.iso = `ISO ${raw.ISO}`;

  return result;
}
