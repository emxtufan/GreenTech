export const NATIVE_TOUCH_QUERY = "(hover: none) and (pointer: coarse)";
export const TOUCH_VISUAL_EASE = 0.14;

export function usesNativeTouchScroll() {
  return typeof window !== "undefined" && window.matchMedia(NATIVE_TOUCH_QUERY).matches;
}
