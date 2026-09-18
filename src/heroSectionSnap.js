import { SCENE_COUNT, SCROLL_SEGMENT } from "./experienceConfig.js";

// One gesture inside the 3D hero moves exactly one scene: a touch swipe, a
// mouse-wheel notch or a trackpad flick. Free scrolling covers roughly a
// quarter of a 4000px segment per gesture, which reads as lag.
const SWIPE_COMMIT_DISTANCE = 24;
const WHEEL_COMMIT_DISTANCE = 30;
const SNAP_DURATION = 620;
const WHEEL_SNAP_DURATION = 0.9;
const SETTLE_DELAY = 140;
// A trackpad keeps emitting decaying inertia events after a flick; a new
// gesture is one whose deltas grow again, or that starts after a pause.
const WHEEL_GESTURE_GAP = 120;
const WHEEL_COOLDOWN = 260;

function easeInOut(progress) {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - ((-2 * progress + 2) ** 2) / 2;
}

// Scene N starts exactly at N * SCROLL_SEGMENT. The +1 keeps the experience's
// eased scroll value on the right side of the boundary (see `?scene=` in main).
export function sceneScrollTarget(index) {
  return index === 0 ? 0 : index * SCROLL_SEGMENT + 1;
}

export default function installHeroSectionSnap({
  companySection,
  isSuspended,
  getLenis = () => null,
}) {
  let touchActive = false;
  let touchIntercepting = false;
  let touchHandled = false;
  let touchId = null;
  let touchStartY = 0;
  let snapFrame = 0;
  let snapping = false;
  let snapTarget = 0;
  let settleTimer = 0;
  let wheelSum = 0;
  let wheelLastTime = 0;
  let wheelLastMagnitude = 0;
  let wheelBlockedUntil = 0;

  const heroExitTop = () => (
    companySection.isConnected
      ? Math.round(window.scrollY + companySection.getBoundingClientRect().top)
      : sceneScrollTarget(SCENE_COUNT)
  );

  const inHero = () => window.scrollY < heroExitTop() - 2;

  // Every stop a swipe can land on: the six scenes, then the first content
  // section so the last swipe leaves the hero cleanly.
  const stops = () => {
    const exit = heroExitTop();
    const list = [];
    for (let index = 0; index < SCENE_COUNT; index += 1) {
      const target = sceneScrollTarget(index);
      if (target < exit) list.push(target);
    }
    list.push(exit);
    return list;
  };

  const clearSettle = () => {
    window.clearTimeout(settleTimer);
    settleTimer = 0;
  };

  const cancelSnap = () => {
    window.cancelAnimationFrame(snapFrame);
    snapFrame = 0;
    snapping = false;
  };

  const finishSnap = () => {
    snapFrame = 0;
    snapping = false;
    wheelSum = 0;
    wheelBlockedUntil = performance.now() + WHEEL_COOLDOWN;
  };

  const snapTo = (target) => {
    cancelSnap();
    const from = window.scrollY;
    const distance = target - from;
    if (Math.abs(distance) < 1) return;

    snapping = true;
    snapTarget = target;

    // With Lenis mounted, let it own the animation so its internal scroll
    // state stays in sync. A newer scrollTo replaces the running one, so the
    // stale onComplete is ignored by the target check.
    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(target, {
        duration: WHEEL_SNAP_DURATION,
        easing: easeInOut,
        lock: true,
        onComplete: () => {
          if (snapping && snapTarget === target) finishSnap();
        },
      });
      return;
    }

    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / SNAP_DURATION);
      window.scrollTo(0, from + distance * easeInOut(progress));
      if (progress < 1) {
        snapFrame = window.requestAnimationFrame(step);
        return;
      }
      finishSnap();
    };
    snapFrame = window.requestAnimationFrame(step);
  };

  const stepScene = (direction) => {
    const list = stops();
    // Chaining swipes while a snap is in flight advances from where that snap
    // is heading, so quick successive swipes keep moving forward.
    const base = snapping ? snapTarget : window.scrollY;
    const next = direction > 0
      ? list.find((stop) => stop > base + 1)
      : [...list].reverse().find((stop) => stop < base - 1);
    if (next === undefined) return;
    snapTo(next);
  };

  const snapToNearest = () => {
    const y = window.scrollY;
    const nearest = stops().reduce((best, stop) => (
      Math.abs(stop - y) < Math.abs(best - y) ? stop : best
    ));
    snapTo(nearest);
  };

  // Native momentum can still carry the page into the hero from the content
  // below it; once it settles, land on the closest scene.
  const scheduleSettle = () => {
    clearSettle();
    settleTimer = window.setTimeout(() => {
      settleTimer = 0;
      if (touchActive || snapping || isSuspended() || !inHero()) return;
      snapToNearest();
    }, SETTLE_DELAY);
  };

  // Only a gesture arms the settle; momentum after it keeps pushing the timer
  // out. Programmatic scrolls (anchor links, route restores) never trigger it.
  const handleScroll = () => {
    if (settleTimer) scheduleSettle();
  };

  const handleTouchStart = (event) => {
    clearSettle();
    touchActive = true;
    touchHandled = false;

    if (event.touches.length !== 1) {
      touchIntercepting = false;
      return;
    }

    const [touch] = event.touches;
    touchId = touch.identifier;
    touchStartY = touch.clientY;
    // The expanded hero card scrolls its own copy; leave that gesture native.
    touchIntercepting =
      !isSuspended()
      && inHero()
      && !event.target?.closest?.(".cards.expanded");
  };

  const handleTouchMove = (event) => {
    if (!touchIntercepting) return;

    event.preventDefault();
    if (touchHandled) return;

    const touch = [...event.touches].find((item) => item.identifier === touchId)
      ?? event.touches[0];
    if (!touch) return;

    const delta = touch.clientY - touchStartY;
    if (Math.abs(delta) < SWIPE_COMMIT_DISTANCE) return;

    touchHandled = true;
    stepScene(delta < 0 ? 1 : -1);
  };

  const handleTouchEnd = (event) => {
    if (event.touches.length > 0) return;

    touchActive = false;
    const wasIntercepting = touchIntercepting;
    touchIntercepting = false;
    touchId = null;

    if (!wasIntercepting) scheduleSettle();
  };

  const handleWheel = (event) => {
    if (event.ctrlKey || isSuspended()) return;
    const deltaScale = event.deltaMode === 1
      ? 16
      : event.deltaMode === 2 ? window.innerHeight : 1;
    const delta = event.deltaY * deltaScale;
    if (Math.abs(delta) <= Math.abs(event.deltaX * deltaScale)) return;

    const y = window.scrollY;
    const exit = heroExitTop();
    // Scrolling up from the first content section re-enters the hero as a
    // step to the last scene rather than a free scroll into it.
    const inRange = y < exit - 2 || (delta < 0 && y <= exit + 2);
    if (!inRange) {
      if (delta < 0) scheduleSettle();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const now = performance.now();
    const magnitude = Math.abs(delta);
    const gap = now - wheelLastTime;
    const newGesture = gap > WHEEL_GESTURE_GAP;
    const accelerating = newGesture || magnitude > wheelLastMagnitude * 1.05;
    wheelLastTime = now;
    wheelLastMagnitude = magnitude;

    if (snapping || now < wheelBlockedUntil || !accelerating) return;
    if (newGesture) wheelSum = 0;
    wheelSum += delta;
    if (Math.abs(wheelSum) < WHEEL_COMMIT_DISTANCE) return;

    wheelSum = 0;
    stepScene(delta > 0 ? 1 : -1);
  };

  // Capture phase so the step wins over Lenis' own wheel handling on window.
  window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
  window.addEventListener("touchstart", handleTouchStart, { passive: true });
  window.addEventListener("touchmove", handleTouchMove, { passive: false });
  window.addEventListener("touchend", handleTouchEnd, { passive: true });
  window.addEventListener("touchcancel", handleTouchEnd, { passive: true });
  window.addEventListener("scroll", handleScroll, { passive: true });

  return () => {
    clearSettle();
    cancelSnap();
    window.removeEventListener("wheel", handleWheel, { capture: true });
    window.removeEventListener("touchstart", handleTouchStart);
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleTouchEnd);
    window.removeEventListener("touchcancel", handleTouchEnd);
    window.removeEventListener("scroll", handleScroll);
  };
}
