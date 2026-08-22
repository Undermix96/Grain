import { useEffect, useRef } from 'react';

/**
 * Triggers `onIntersect` whenever the returned ref's element becomes
 * visible in the viewport. Used to load the next page of photos as the
 * user scrolls near the bottom of the gallery, without a scroll event
 * listener.
 */
export function useInfiniteScrollTrigger(onIntersect, { enabled = true } = {}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !enabled) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onIntersect();
        }
      },
      { rootMargin: '600px' }, // start loading well before the sentinel is on-screen
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [onIntersect, enabled]);

  return sentinelRef;
}
