import { create } from 'zustand';

/**
 * Holds which photo (by index within the currently loaded list) the
 * lightbox is showing, if any. `null` means the lightbox is closed.
 *
 * The store only tracks the index, not the photo object itself, so it
 * stays trivially in sync with whatever list the gallery currently has
 * loaded (including as more pages arrive via infinite scroll).
 */
export const useLightboxStore = create((set) => ({
  openIndex: null,
  open: (index) => set({ openIndex: index }),
  close: () => set({ openIndex: null }),
  next: (maxIndex) =>
    set((state) => {
      if (state.openIndex === null) return state;
      return { openIndex: Math.min(state.openIndex + 1, maxIndex) };
    }),
  prev: () =>
    set((state) => {
      if (state.openIndex === null) return state;
      return { openIndex: Math.max(state.openIndex - 1, 0) };
    }),
}));
