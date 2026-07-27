import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

const POST_TOP_TOLERANCE = 1.5;
const POST_RESET_DISTANCE = 8;
const MOBILE_LANDING_QUIET_MS = 100;
const LENIS_DURATION = 0.92;
const LENIS_TOUCH_INERTIA_EXPONENT = 1.7;
const MOBILE_PROJECT_SCROLL_FACTOR = 0.58;
const MOBILE_PROJECT_SCROLL_DURATION = 1.16;
const MOBILE_PROJECT_TOUCH_INERTIA_EXPONENT = 1.32;

const smoothEaseOut = (progress) => 1 - (1 - progress) ** 3;

function isLenisPreventedEvent(event) {
  return event.composedPath().some(
    (node) => node instanceof HTMLElement && node.hasAttribute("data-lenis-prevent"),
  );
}

function isFinalSectionEvent(event) {
  return event.composedPath().some(
    (node) => node instanceof HTMLElement && node.classList.contains("final-section"),
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
    const projectGallery = postExperience.querySelector(".horizontal-gallery-section");
    const iosDevice = isIOSDevice();
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const previousScrollRestoration = window.history.scrollRestoration;
    let animationFrame = 0;
    let landingTimer = 0;
    let routeResumeFrame = 0;
    let routeSettleFrame = 0;
    let landingTouchActive = false;
    let renderingPaused = false;
    let routeAnchor = null;
    let routeScrollY = null;
    let phase = postExperience.getBoundingClientRect().top <= POST_TOP_TOLERANCE
      ? "post"
      : "hero";
    let lenis;

    root.classList.toggle("ios-native-scroll", iosDevice);
    window.history.scrollRestoration = "manual";

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

    const clearLandingTimer = () => {
      window.clearTimeout(landingTimer);
      landingTimer = 0;
    };

    const releaseLanding = (nextPhase = "post") => {
      clearLandingTimer();
      landingTouchActive = false;
      lenis.reset();
      setPhase(nextPhase);
    };

    const scheduleLandingRelease = () => {
      clearLandingTimer();
      if (landingTouchActive) return;

      landingTimer = window.setTimeout(() => {
        if (phase === "landing") releaseLanding();
      }, MOBILE_LANDING_QUIET_MS);
    };

    const landAtPostBoundary = (sourceEvent) => {
      const bounds = postExperience.getBoundingClientRect();
      const boundaryScrollY = window.scrollY + bounds.top;
      clearLandingTimer();
      landingTouchActive = Boolean(
        sourceEvent?.type.startsWith("touch") && sourceEvent.type !== "touchend",
      );
      setPhase("landing");
      lenis.reset();
      window.scrollTo({ top: boundaryScrollY, left: 0, behavior: "auto" });
      if (!landingTouchActive) scheduleLandingRelease();
    };

    const shouldGuardMobileLanding = () => (
      window.innerWidth <= 700 || coarsePointer.matches
    );

    const isMobileProjectGalleryInRange = (deltaY = 0) => {
      if (window.innerWidth > 700 || !projectGallery) return false;

      const bounds = projectGallery.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const projectedTop = bounds.top - deltaY;
      const projectedBottom = bounds.bottom - deltaY;

      return (
        (bounds.top < viewportHeight && bounds.bottom > 0)
        || (projectedTop < viewportHeight && projectedBottom > 0)
      );
    };

    const applyMobileProjectScrollProfile = (scrollEvent) => {
      const active = isMobileProjectGalleryInRange(scrollEvent.deltaY);

      lenis.options.duration = active
        ? MOBILE_PROJECT_SCROLL_DURATION
        : LENIS_DURATION;
      lenis.options.touchInertiaExponent = active
        ? MOBILE_PROJECT_TOUCH_INERTIA_EXPONENT
        : LENIS_TOUCH_INERTIA_EXPONENT;

      if (!active) return;

      scrollEvent.deltaX *= MOBILE_PROJECT_SCROLL_FACTOR;
      scrollEvent.deltaY *= MOBILE_PROJECT_SCROLL_FACTOR;
    };

    const handleVirtualScroll = (scrollEvent) => {
      const { event } = scrollEvent;

      if (phase === "returning") {
        if (event.cancelable) event.preventDefault();
        return false;
      }

      if (phase === "landing") {
        if (event.type === "touchend") {
          releaseLanding();
          return false;
        }

        if (scrollEvent.deltaY < 0) {
          releaseLanding("hero");
          return false;
        }

        if (event.type.startsWith("touch")) landingTouchActive = true;
        if (event.cancelable) event.preventDefault();
        if (!landingTouchActive) scheduleLandingRelease();
        return false;
      }

      const bounds = postExperience.getBoundingClientRect();
      const scrollingDown = scrollEvent.deltaY > 0;

      // The GLB hero follows the browser's native position. Lenis starts only
      // after the next content has crossed the viewport naturally.
      if (phase === "hero") {
        const projectedTop = bounds.top - Math.max(0, scrollEvent.deltaY);
        if (
          shouldGuardMobileLanding()
          && scrollingDown
          && projectedTop <= POST_TOP_TOLERANCE
        ) {
          if (event.cancelable) event.preventDefault();
          landAtPostBoundary(event);
        }
        return false;
      }

      applyMobileProjectScrollProfile(scrollEvent);

      if (isFinalSectionEvent(event)) return false;
      if (isLenisPreventedEvent(event)) return true;

      return bounds.top < -POST_TOP_TOLERANCE || scrollingDown;
    };

    lenis = new Lenis({
      autoRaf: true,
      duration: LENIS_DURATION,
      easing: smoothEaseOut,
      smoothWheel: !reducedMotion.matches,
      syncTouch: !reducedMotion.matches,
      syncTouchLerp: 0.075,
      touchInertiaExponent: LENIS_TOUCH_INERTIA_EXPONENT,
      wheelMultiplier: 0.85,
      touchMultiplier: 0.92,
      overscroll: true,
      virtualScroll: handleVirtualScroll,
    });

    const updateScrollState = () => {
      animationFrame = 0;
      const bounds = postExperience.getBoundingClientRect();
      setRenderingPaused(bounds.top <= POST_TOP_TOLERANCE);

      if (phase === "returning") return;

      if (phase === "landing") {
        if (Math.abs(bounds.top) > POST_TOP_TOLERANCE) {
          const boundaryScrollY = window.scrollY + bounds.top;
          window.scrollTo({ top: boundaryScrollY, left: 0, behavior: "auto" });
        }
        if (!landingTouchActive) scheduleLandingRelease();
        return;
      }

      if (phase === "hero" && bounds.top <= POST_TOP_TOLERANCE) {
        if (shouldGuardMobileLanding()) {
          landAtPostBoundary();
        } else {
          setPhase("post");
          lenis.resize();
        }
        return;
      }

      if (phase === "post" && bounds.top > POST_RESET_DISTANCE) {
        setPhase("hero");
        lenis.reset();
      }
    };

    const scheduleUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateScrollState);
    };

    const cancelRouteResume = () => {
      window.cancelAnimationFrame(routeResumeFrame);
      window.cancelAnimationFrame(routeSettleFrame);
      routeResumeFrame = 0;
      routeSettleFrame = 0;
    };

    const getRouteViewportHeight = () => (
      window.visualViewport?.height ?? window.innerHeight
    );

    const captureRouteAnchor = () => {
      const viewportHeight = getRouteViewportHeight();
      const referenceRatio = 0.5;
      const referenceY = viewportHeight * referenceRatio;
      const candidates = Array.from(postExperience.children)
        .map((element) => ({
          element,
          bounds: element.getBoundingClientRect(),
          position: window.getComputedStyle(element).position,
        }))
        .filter(({ bounds, position }) => (
          bounds.height > 1
          && position !== "fixed"
          && position !== "absolute"
        ));

      const current = candidates.find(({ bounds }) => (
        bounds.top <= referenceY && bounds.bottom > referenceY
      ));
      if (!current) return null;

      return {
        element: current.element,
        progress: Math.min(
          1,
          Math.max(0, (referenceY - current.bounds.top) / current.bounds.height),
        ),
        referenceRatio,
      };
    };

    const getRouteRestoreY = () => {
      if (!routeAnchor?.element.isConnected) return routeScrollY;

      const bounds = routeAnchor.element.getBoundingClientRect();
      if (bounds.height <= 1) return routeScrollY;

      const referenceY = getRouteViewportHeight() * routeAnchor.referenceRatio;
      return (
        window.scrollY
        + bounds.top
        + bounds.height * routeAnchor.progress
        - referenceY
      );
    };

    const restoreRouteScroll = () => {
      if (routeScrollY === null) return;

      const restoreY = getRouteRestoreY() ?? routeScrollY;
      const scrollLimit = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      window.scrollTo({
        top: Math.min(Math.max(0, restoreY), scrollLimit),
        left: 0,
        behavior: "auto",
      });
      lenis.resize();
      lenis.reset();
      scheduleUpdate();
    };

    controllerRef.current = {
      prepareForHeroNavigation() {
        clearLandingTimer();
        landingTouchActive = false;
        setPhase("returning");
        lenis.stop();
      },
      setSuspended(suspended) {
        if (suspended) {
          cancelRouteResume();
          if (routeScrollY === null) {
            routeScrollY = window.scrollY;
            routeAnchor = captureRouteAnchor();
          }
          lenis.reset();
          return;
        }

        if (phase === "returning") return;

        lenis.start();
        restoreRouteScroll();

        // Fixed route overlays can change the visual viewport and scrollbar.
        // Measure once after they unmount, then restore again before input resumes.
        routeResumeFrame = window.requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
          restoreRouteScroll();
          routeSettleFrame = window.requestAnimationFrame(() => {
            restoreRouteScroll();
            routeAnchor = null;
            routeScrollY = null;
            routeSettleFrame = 0;
          });
          routeResumeFrame = 0;
        });
      },
    };

    setPhase(phase);
    updateScrollState();
    if (suspendedRef.current) controllerRef.current.setSuspended(true);

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.cancelAnimationFrame(animationFrame);
      cancelRouteResume();
      clearLandingTimer();
      lenis.destroy();
      window.history.scrollRestoration = previousScrollRestoration;
      root.classList.remove("ios-native-scroll");
      delete postExperience.dataset.scrollPhase;
      scene.classList.remove("experience-rendering-paused");
      experienceRef.current?.setRenderingPaused(false);
      controllerRef.current = null;
    };
  }, [entered, experienceRef, postExperienceRef, sceneRef]);

  useLayoutEffect(() => {
    controllerRef.current?.setSuspended(projectOpen);
  }, [projectOpen]);

  return useCallback(() => {
    controllerRef.current?.prepareForHeroNavigation();
  }, []);
}
