export const NATIVE_TOUCH_QUERY = "(hover: none) and (pointer: coarse)";
export const TOUCH_VISUAL_EASE = 0.14;

export function usesNativeTouchScroll() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia(NATIVE_TOUCH_QUERY).matches
    || (window.navigator?.maxTouchPoints ?? 0) > 0
  );
}

// Sticky sections drive their visuals from how far the page has travelled
// inside them, so landing on their first pixel shows the visual at 0%. Such a
// section declares `data-anchor-progress="0.85"` and anchor navigation lands
// that far into it instead. Returns `null` for ordinary sections.
export function resolveAnchorScrollTop(target) {
  const progress = Number.parseFloat(target?.dataset?.anchorProgress ?? "");
  if (!Number.isFinite(progress)) return null;

  const bounds = target.getBoundingClientRect();
  const viewportHeight = window.innerHeight || 1;
  const travel = Math.max(0, bounds.height - viewportHeight);
  return Math.round(window.scrollY + bounds.top + travel * Math.min(1, Math.max(0, progress)));
}
