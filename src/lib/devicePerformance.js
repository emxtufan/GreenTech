export function isIOSDevice() {
  if (typeof window === "undefined") return false;

  const navigatorRef = window.navigator;
  const userAgent = navigatorRef?.userAgent ?? "";
  const platform = navigatorRef?.platform ?? "";

  return (
    /iPad|iPhone|iPod/i.test(userAgent)
    || (platform === "MacIntel" && (navigatorRef?.maxTouchPoints ?? 0) > 1)
  );
}

// Phones and small tablets: a touch-only pointer on a compact screen. Screen
// dimensions (not the viewport) keep the answer stable across rotation.
export function isMobileDevice() {
  if (typeof window === "undefined") return false;

  const coarsePointer = window.matchMedia?.("(hover: none) and (pointer: coarse)").matches;
  const screenWidth = window.screen?.width || window.innerWidth || 0;
  const screenHeight = window.screen?.height || window.innerHeight || 0;
  const compactScreen = Math.min(screenWidth, screenHeight) <= 900;

  return Boolean(coarsePointer && compactScreen);
}

export function shouldConserveWebGLMemory() {
  if (typeof window === "undefined") return false;

  const deviceMemory = Number(window.navigator?.deviceMemory);
  const lowMemory = Number.isFinite(deviceMemory) && deviceMemory <= 4;

  return isIOSDevice() || lowMemory || isMobileDevice();
}

