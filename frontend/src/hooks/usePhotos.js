import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchPhotos } from '../api/photos.js';

/**
 * Infinite-scroll photo list. Flattens all loaded pages into a single
 * array for convenience, since the gallery always renders one continuous
 * grid regardless of how many pages have been fetched so far.
 */
export function usePhotos() {
  const query = useInfiniteQuery({
    queryKey: ['photos'],
    queryFn: fetchPhotos,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined),
  });

  const photos = query.data?.pages.flatMap((page) => page.photos) ?? [];

  return { ...query, photos };
}
