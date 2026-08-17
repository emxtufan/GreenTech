export const NATIVE_TOUCH_QUERY = "(hover: none) and (pointer: coarse)";
export const TOUCH_VISUAL_EASE = 0.14;

export function usesNativeTouchScroll() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia(NATIVE_TOUCH_QUERY).matches
    || (window.navigator?.maxTouchPoints ?? 0) > 0
  );
}
