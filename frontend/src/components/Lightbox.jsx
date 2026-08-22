import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePhotos } from '../hooks/usePhotos.js';
import { useLightboxStore } from '../stores/lightboxStore.js';
import { getPhotoUrl } from '../api/photos.js';

const EXIF_KEYS = ['camera', 'lens', 'focalLength', 'aperture', 'shutterSpeed', 'iso'];

const SWIPE_THRESHOLD_PX = 50;

function ExifRow({ exif }) {
  const entries = EXIF_KEYS.map((key) => [key, exif?.[key]]).filter(([, value]) => Boolean(value));
  if (entries.length === 0) return null;

  return (
    <div className="lightbox__exif">
      {entries.map(([key, value]) => (
        <span key={key}>{value}</span>
      ))}
    </div>
  );
}

export function Lightbox() {
  const { photos, hasNextPage, isFetchingNextPage, fetchNextPage } = usePhotos();
  const openIndex = useLightboxStore((state) => state.openIndex);
  const close = useLightboxStore((state) => state.close);
  const next = useLightboxStore((state) => state.next);
  const prev = useLightboxStore((state) => state.prev);

  const isOpen = openIndex !== null;
  const photo = isOpen ? photos[openIndex] : null;
  const isLastLoaded = isOpen && openIndex === photos.length - 1;

  // Pre-fetch the next page proactively when the viewer nears the end of
  // what's currently loaded, so "next" feels seamless during browsing
  // instead of dead-ending until the background gallery scroll catches up.
  useEffect(() => {
    if (isOpen && isLastLoaded && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isOpen, isLastLoaded, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const goNext = useCallback(() => {
    next(photos.length - 1);
  }, [next, photos.length]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') goNext();
      if (event.key === 'ArrowLeft') prev();
    }

    document.addEventListener('keydown', handleKeyDown);
    // Prevent the page behind the lightbox from scrolling while open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, close, goNext, prev]);

  const touchStartX = useRef(null);

  function handleTouchStart(event) {
    touchStartX.current = event.touches[0].clientX;
  }

  function handleTouchEnd(event) {
    if (touchStartX.current === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    if (deltaX < 0) goNext();
    else prev();
  }

  return (
    <AnimatePresence>
      {isOpen && photo && (
        <motion.div
          className="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="lightbox__topbar">
            <a
              className="lightbox__icon-button"
              href={getPhotoUrl(photo.id, 'full')}
              download
              aria-label="Download photo"
              title="Download"
            >
              ↓
            </a>
            <button
              type="button"
              className="lightbox__icon-button"
              onClick={close}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="lightbox__stage">
            {openIndex > 0 && (
              <button
                type="button"
                className="lightbox__nav-button lightbox__nav-button--prev"
                onClick={prev}
                aria-label="Previous photo"
              >
                ‹
              </button>
            )}

            <AnimatePresence mode="wait">
              <motion.img
                key={photo.id}
                className="lightbox__image"
                src={getPhotoUrl(photo.id, 'medium')}
                alt=""
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </AnimatePresence>

            {(openIndex < photos.length - 1 || hasNextPage) && (
              <button
                type="button"
                className="lightbox__nav-button lightbox__nav-button--next"
                onClick={goNext}
                aria-label="Next photo"
              >
                ›
              </button>
            )}
          </div>

          <div className="lightbox__footer">
            <ExifRow exif={photo.exif} />
            <span className="lightbox__date">{photo.date}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
