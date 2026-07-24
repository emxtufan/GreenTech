import { useCallback, useEffect, useRef } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

const SNAP_CAPTURE_MIN = 72;
const SNAP_CAPTURE_MAX = 144;
const SNAP_CAPTURE_RATIO = 0.12;
const SNAP_TOP_TOLERANCE = 1.5;
const SNAP_RESET_DISTANCE = 8;
const SNAP_INPUT_QUIET_MS = 110;

const smoothEaseOut = (progress) => 1 - (1 - progress) ** 3;

function getSnapCaptureDistance() {
  return Math.min(
    SNAP_CAPTURE_MAX,
    Math.max(SNAP_CAPTURE_MIN, window.innerHeight * SNAP_CAPTURE_RATIO),
  );
}

function isLenisPreventedEvent(event) {
  return event.composedPath().some(
    (node) => node instanceof HTMLElement && node.hasAttribute("data-lenis-prevent"),
  );
}

function isIOSDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function useExperienceScrollController({
  entered,
  projectOpen,
  sceneRef,
  postExperienceRef,
  experienceRef,
}) {
  const controllerRef = useRef(null);
  const suspendedRef = useRef(projectOpen);

  suspendedRef.current = projectOpen;

  useEffect(() => {
    const scene = sceneRef.current;
    const postExperience = postExperienceRef.current;
    if (!entered || !scene || !postExperience) return undefined;

    const root = document.documentElement;
    const nativeIOSScroll = isIOSDevice();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let snapFrame = 0;
    let releaseTimer = 0;
    let renderingPaused = false;
    let disposed = false;
    let previousScrollY = window.scrollY;
    let phase = postExperience.getBoundingClientRect().top <= SNAP_TOP_TOLERANCE
      ? "post"
      : "hero";
    let lenis;

    root.classList.toggle("ios-native-scroll", nativeIOSScroll);

    const setPhase = (nextPhase) => {
      phase = nextPhase;
      postExperience.dataset.scrollPhase = nextPhase;
    };

    const setRenderingPaused = (paused) => {
      if (paused === renderingPaused) return;
      renderingPaused = paused;
      scene.classList.toggle("experience-rendering-paused", paused);
      experienceRef.current?.setRenderingPaused(paused);
    };

    const clearReleaseTimer = () => {
      window.clearTimeout(releaseTimer);
      releaseTimer = 0;
    };

    const releaseAfterCurrentGesture = () => {
      clearReleaseTimer();
      releaseTimer = window.setTimeout(() => {
        if (disposed || phase !== "settling") return;
        setPhase("post");
      }, SNAP_INPUT_QUIET_MS);
    };

    const finishSnap = () => {
      if (disposed) return;
      setRenderingPaused(true);
      setPhase("settling");
      releaseAfterCurrentGesture();
    };

    const alignPostImmediately = (source, onComplete) => {
      lenis.scrollTo(postExperience, {
        immediate: true,
        force: true,
        userData: { source },
        onComplete,
      });
    };

    const performSnap = (forceImmediate = false) => {
      snapFrame = 0;
      if (disposed || phase !== "hero") return;

      const bounds = postExperience.getBoundingClientRect();
      setPhase("snapping");
      const distance = Math.abs(bounds.top);
      const duration = Math.min(0.72, Math.max(0.42, distance / 900));
      const immediate = forceImmediate || bounds.top < -SNAP_TOP_TOLERANCE;

      lenis.scrollTo(postExperience, {
        duration,
        easing: smoothEaseOut,
        immediate: reducedMotion.matches || immediate,
        force: true,
        lock: !reducedMotion.matches && !immediate,
        userData: { source: "post-experience-snap" },
        onComplete: finishSnap,
      });
    };

    const requestSnap = () => {
      if (snapFrame || phase !== "hero") return;
      snapFrame = window.requestAnimationFrame(() => performSnap());
    };

    const handleVirtualScroll = (scrollEvent) => {
      const { event } = scrollEvent;

      if (isLenisPreventedEvent(event)) return true;

      if (phase === "returning") {
        if (event.cancelable) event.preventDefault();
        return false;
      }

      // Safari owns touch inertia and viewport snapping on iOS.
      if (nativeIOSScroll) return false;

      if (phase === "snapping" || phase === "settling") {
        if (event.cancelable) event.preventDefault();
        if (phase === "settling") releaseAfterCurrentGesture();
        return false;
      }

      const bounds = postExperience.getBoundingClientRect();
      const scrollingDown = scrollEvent.deltaY > 0;

      if (phase === "hero") {
        const projectedTop = bounds.top - Math.max(0, scrollEvent.deltaY);
        if (scrollingDown && projectedTop <= getSnapCaptureDistance()) {
          if (event.cancelable) event.preventDefault();
          requestSnap();
        }

        // Hero transitions intentionally follow the browser's native scroll position.
        return false;
      }

      if (scrollEvent.deltaY < 0) {
        const postTop = window.scrollY + bounds.top;
        const distanceToBoundary = postTop - lenis.targetScroll;

        if (distanceToBoundary >= -SNAP_TOP_TOLERANCE) {
          setPhase("hero");
          return false;
        }

        // Keep Lenis from carrying wheel inertia into the GLB-controlled hero.
        scrollEvent.deltaY = Math.max(scrollEvent.deltaY, distanceToBoundary);
      }

      return bounds.top < -SNAP_TOP_TOLERANCE || scrollingDown;
    };

    lenis = new Lenis({
      autoRaf: true,
      duration: 0.92,
      easing: smoothEaseOut,
      smoothWheel: !reducedMotion.matches && !nativeIOSScroll,
      syncTouch: false,
      wheelMultiplier: 0.85,
      touchMultiplier: 1,
      overscroll: true,
      virtualScroll: handleVirtualScroll,
    });

    const updateScrollState = () => {
      animationFrame = 0;
      const bounds = postExperience.getBoundingClientRect();
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > previousScrollY + 0.5;
      previousScrollY = currentScrollY;

      setRenderingPaused(bounds.top <= SNAP_TOP_TOLERANCE);

      if (nativeIOSScroll) {
        if (phase === "hero" && bounds.top <= SNAP_TOP_TOLERANCE) {
          setPhase("post");
        } else if (phase === "post" && bounds.top > SNAP_RESET_DISTANCE) {
          setPhase("hero");
        }
        return;
      }

      if (phase === "settling" && Math.abs(bounds.top) > SNAP_TOP_TOLERANCE) {
        alignPostImmediately("post-experience-settle");
      }

      if (phase === "post" && bounds.top > SNAP_RESET_DISTANCE) {
        setPhase("hero");
      }

      if (
        phase === "hero"
        && scrollingDown
        && bounds.top <= getSnapCaptureDistance()
      ) {
        performSnap(bounds.top < -SNAP_TOP_TOLERANCE);
      }
    };

    const scheduleUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateScrollState);
    };

    const handleScroll = () => {
      const bounds = postExperience.getBoundingClientRect();

      if (nativeIOSScroll) {
        scheduleUpdate();
        return;
      }

      if (phase === "snapping" && bounds.top < -SNAP_TOP_TOLERANCE) {
        alignPostImmediately("post-experience-overshoot", finishSnap);
        return;
      }

      if (phase === "settling" && Math.abs(bounds.top) > SNAP_TOP_TOLERANCE) {
        alignPostImmediately("post-experience-settle");
        releaseAfterCurrentGesture();
        return;
      }

      const scrollingDown = window.scrollY > previousScrollY + 0.5;
      if (phase === "hero" && scrollingDown && bounds.top < -SNAP_TOP_TOLERANCE) {
        performSnap(true);
        return;
      }

      scheduleUpdate();
    };

    controllerRef.current = {
      prepareForHeroNavigation() {
        clearReleaseTimer();
        window.cancelAnimationFrame(snapFrame);
        snapFrame = 0;
        setPhase("returning");
        if (!nativeIOSScroll) lenis.stop();
      },
      setSuspended(suspended) {
        if (nativeIOSScroll) return;

        if (suspended) {
          lenis.stop();
          return;
        }

        if (phase === "returning") return;
        lenis.start();
        lenis.resize();
        previousScrollY = window.scrollY;
        scheduleUpdate();
      },
    };

    setPhase(phase);
    updateScrollState();
    if (suspendedRef.current) lenis.stop();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      disposed = true;
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", scheduleUpdate);
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(snapFrame);
      clearReleaseTimer();
      lenis.destroy();
      root.classList.remove("ios-native-scroll");
      delete postExperience.dataset.scrollPhase;
      scene.classList.remove("experience-rendering-paused");
      experienceRef.current?.setRenderingPaused(false);
      controllerRef.current = null;
    };
  }, [entered, experienceRef, postExperienceRef, sceneRef]);

  useEffect(() => {
    controllerRef.current?.setSuspended(projectOpen);
  }, [projectOpen]);

  return useCallback(() => {
    controllerRef.current?.prepareForHeroNavigation();
  }, []);
}
