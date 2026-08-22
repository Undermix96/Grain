import { useCallback } from 'react';
import { usePhotos } from '../hooks/usePhotos.js';
import { useInfiniteScrollTrigger } from '../hooks/useInfiniteScrollTrigger.js';
import { useLightboxStore } from '../stores/lightboxStore.js';
import { PhotoCard } from './PhotoCard.jsx';

export function Gallery() {
  const { photos, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = usePhotos();
  const openLightbox = useLightboxStore((state) => state.open);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const sentinelRef = useInfiniteScrollTrigger(handleLoadMore, { enabled: hasNextPage });

  if (isLoading) {
    return <p className="gallery__status">Loading photos…</p>;
  }

  if (isError) {
    return <p className="gallery__status">Couldn't load the gallery. Please try again later.</p>;
  }

  if (photos.length === 0) {
    return <p className="gallery__status">No photos yet.</p>;
  }

  return (
    <>
      <div className="gallery">
        {photos.map((photo, index) => (
          <PhotoCard key={photo.id} photo={photo} onOpen={() => openLightbox(index)} />
        ))}
      </div>
      <div ref={sentinelRef} className="gallery__sentinel" aria-hidden="true" />
      {isFetchingNextPage && <p className="gallery__status">Loading more…</p>}
    </>
  );
}
