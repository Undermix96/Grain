// Thin wrapper around the backend REST API. Kept framework-agnostic so it
// can be reused outside of TanStack Query hooks if needed.

const PAGE_SIZE = 30;

/**
 * Fetches one page of the photo list.
 * `pageParam` is the offset to start from, following TanStack Query's
 * infinite query convention.
 */
export async function fetchPhotos({ pageParam = 0 }) {
  const response = await fetch(`/api/photos?limit=${PAGE_SIZE}&offset=${pageParam}`);

  if (!response.ok) {
    throw new Error(`Failed to load photos (HTTP ${response.status})`);
  }

  return response.json();
}

/**
 * Builds the URL for a given photo version. Centralized here so the
 * versions supported by the backend (thumbnail/medium/full) are only
 * spelled out once across the whole frontend.
 */
export function getPhotoUrl(photoId, version) {
  return `/api/photos/${photoId}/${version}`;
}
