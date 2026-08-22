import { getPhotoUrl } from '../api/photos.js';

/**
 * A single gallery grid item. Sets `width`/`height` attributes from the
 * photo's known dimensions (returned by the API) so the browser can
 * reserve the correct aspect ratio before the image loads, preventing
 * layout shift in the masonry columns.
 */
export function PhotoCard({ photo, onOpen }) {
  return (
    <button
      type="button"
      className="photo-card"
      onClick={onOpen}
      aria-label={`Open photo from ${photo.date}`}
    >
      <img
        className="photo-card__image"
        src={getPhotoUrl(photo.id, 'thumbnail')}
        width={photo.width ?? undefined}
        height={photo.height ?? undefined}
        loading="lazy"
        decoding="async"
        alt=""
      />
      <span className="photo-card__date">{photo.date}</span>
    </button>
  );
}
