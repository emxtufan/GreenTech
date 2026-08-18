import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { usesNativeTouchScroll } from "./scrollMotion.js";

const LENIS_DURATION = 1.05;
const LENIS_WHEEL_MULTIPLIER = 0.9;

function bodyHasScrollLock() {
  const body = document.body;
  return body.style.overflow === "hidden" || body.style.overflowY === "hidden";
}

function clampScrollY(value) {
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
  return Math.min(maxScroll, Math.max(0, value));
}

export default function useExperienceScrollController({
  entered,
  routeOpen,
  sceneRef,
  experienceRef,
}) {
  const controllerRef = useRef(null);
  const routeOpenRef = useRef(routeOpen);

  routeOpenRef.current = routeOpen;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!entered || !scene) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touchScroll = usesNativeTouchScroll();
    const nativeScroll = touchScroll || reducedMotion;
    const previousScrollRestoration = window.history.scrollRestoration;
    const root = document.documentElement;
    let routeIsOpen = routeOpenRef.current;
    let bodyIsLocked = bodyHasScrollLock();
    let returningToIntro = false;
    let renderingPaused = false;
    let savedScrollY = window.scrollY;
    let restoreFrameOne = 0;
    let restoreFrameTwo = 0;
    let pendingScrollTarget = null;
    let restoringScroll = false;
    let lenis = null;
    let heroExitSnapActive = false;
    let heroExitTouchEnded = false;
    let heroExitReleaseTimer = 0;

    window.history.scrollRestoration = "manual";

    const isSuspended = () => routeIsOpen || bodyIsLocked || returningToIntro;

    const createLenis = () => {
      if (nativeScroll || lenis) return;

      lenis = new Lenis({
        autoRaf: true,
        duration: LENIS_DURATION,
        smoothWheel: true,
        syncTouch: false,
        touchMultiplier: 1,
        wheelMultiplier: LENIS_WHEEL_MULTIPLIER,
        overscroll: false,
        stopInertiaOnNavigate: true,
      });

      if (isSuspended()) lenis.stop();
    };

    const destroyLenis = () => {
      lenis?.destroy();
      lenis = null;
    };

    const cancelRestore = () => {
      window.cancelAnimationFrame(restoreFrameOne);
      window.cancelAnimationFrame(restoreFrameTwo);
      restoreFrameOne = 0;
      restoreFrameTwo = 0;
      restoringScroll = false;
    };

    const clearHeroExitRelease = () => {
      window.clearTimeout(heroExitReleaseTimer);
      heroExitReleaseTimer = 0;
    };

    const releaseHeroExitSnap = () => {
      clearHeroExitRelease();
      heroExitSnapActive = false;
      heroExitTouchEnded = false;
      root.classList.remove("hero-exit-snap-active");
    };

    const scheduleHeroExitRelease = () => {
      clearHeroExitRelease();
      heroExitReleaseTimer = window.setTimeout(releaseHeroExitSnap, 280);
    };

    const scrollToSection = (target) => {
      if (!target?.isConnected) return;

      // Anchor navigation is intentional and must not be intercepted by the
      // one-way touch stop at the end of the 3D hero.
      releaseHeroExitSnap();

      if (lenis) {
        lenis.scrollTo(target, { immediate: false, lock: false });
        return;
      }

      target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    };

    const flushPendingSectionScroll = () => {
      if (!pendingScrollTarget || isSuspended() || restoringScroll) return;

      const target = pendingScrollTarget;
      pendingScrollTarget = null;
      scrollToSection(target);
    };

    const rememberScrollPosition = () => {
      savedScrollY = window.scrollY;
    };

    const syncScrollPosition = () => {
      const target = clampScrollY(savedScrollY);
      savedScrollY = target;
      lenis?.resize();
      window.scrollTo({ top: target, left: 0, behavior: "auto" });
      lenis?.scrollTo(target, {
        immediate: true,
        force: true,
        lock: false,
      });
    };

    const suspendScroll = (rememberPosition) => {
      cancelRestore();
      if (rememberPosition) rememberScrollPosition();
      lenis?.stop();
    };

    const resumeAfterLayout = () => {
      if (isSuspended()) return;

      cancelRestore();
      restoringScroll = true;
      createLenis();
      lenis?.stop();
      syncScrollPosition();

      // React removes the fixed route/modal in the current commit. Two frames
      // let Safari/Chromium settle the document height before Lenis resumes.
      restoreFrameOne = window.requestAnimationFrame(() => {
        restoreFrameOne = 0;
        if (isSuspended()) return;

        syncScrollPosition();
        restoreFrameTwo = window.requestAnimationFrame(() => {
          restoreFrameTwo = 0;
          if (isSuspended()) return;

          syncScrollPosition();
          createLenis();
          lenis?.start();
          restoringScroll = false;
          flushPendingSectionScroll();
        });
      });
    };

    const setRenderingPaused = (paused) => {
      if (paused === renderingPaused) return;
      renderingPaused = paused;
      scene.classList.toggle("experience-rendering-paused", paused);
      experienceRef.current?.setRenderingPaused(paused);
    };

    const sceneObserver = new IntersectionObserver(([entry]) => {
      setRenderingPaused(!entry.isIntersecting);
    });
    sceneObserver.observe(scene);

    const companySection = document.getElementById("company");
    const handleHeroExitTouchStart = () => {
      clearHeroExitRelease();
      heroExitTouchEnded = false;

      if (!companySection?.isConnected) {
        releaseHeroExitSnap();
        return;
      }

      const companyTop = window.scrollY + companySection.getBoundingClientRect().top;
      heroExitSnapActive = window.scrollY < companyTop - 2;
      root.classList.toggle("hero-exit-snap-active", heroExitSnapActive);
    };
    const handleHeroExitTouchEnd = () => {
      if (!heroExitSnapActive) return;
      heroExitTouchEnded = true;
      scheduleHeroExitRelease();
    };
    const handleHeroExitScroll = () => {
      if (heroExitSnapActive && heroExitTouchEnded) scheduleHeroExitRelease();
    };
    const handleHeroExitScrollEnd = () => {
      if (heroExitSnapActive && heroExitTouchEnded) releaseHeroExitSnap();
    };

    if (touchScroll && companySection) {
      window.addEventListener("touchstart", handleHeroExitTouchStart, { passive: true });
      window.addEventListener("touchend", handleHeroExitTouchEnd, { passive: true });
      window.addEventListener("touchcancel", handleHeroExitTouchEnd, { passive: true });
      window.addEventListener("scroll", handleHeroExitScroll, { passive: true });
      window.addEventListener("scrollend", handleHeroExitScrollEnd, { passive: true });
    }

    const handleResize = () => lenis?.resize();
    window.addEventListener("resize", handleResize);

    const bodyLockObserver = new MutationObserver(() => {
      const nextBodyIsLocked = bodyHasScrollLock();
      if (nextBodyIsLocked === bodyIsLocked) return;

      const wasSuspended = isSuspended();
      bodyIsLocked = nextBodyIsLocked;

      if (bodyIsLocked) {
        suspendScroll(!wasSuspended);
        return;
      }

      resumeAfterLayout();
    });
    bodyLockObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
    });

    controllerRef.current = {
      prepareForHeroNavigation() {
        releaseHeroExitSnap();
        returningToIntro = true;
        suspendScroll(false);
        destroyLenis();
      },
      setRouteOpen(nextRouteIsOpen) {
        if (nextRouteIsOpen === routeIsOpen) return;

        const wasSuspended = isSuspended();
        routeIsOpen = nextRouteIsOpen;

        if (routeIsOpen) {
          suspendScroll(!wasSuspended);
          return;
        }

        resumeAfterLayout();
      },
    };

    // Anchor links elsewhere in the app need to move the same scroller Lenis
    // drives. Native touch scrolling stays fully native.
    window.__scrollToSection = (target) => {
      if (!target) return;

      if (isSuspended() || restoringScroll) {
        pendingScrollTarget = target;
        return;
      }

      scrollToSection(target);
    };

    const handlePageShow = () => {
      if (isSuspended()) return;
      savedScrollY = window.scrollY;
      resumeAfterLayout();
    };
    window.addEventListener("pageshow", handlePageShow);

    createLenis();
    if (isSuspended()) {
      lenis?.stop();
    }

    return () => {
      cancelRestore();
      sceneObserver.disconnect();
      bodyLockObserver.disconnect();
      window.removeEventListener("touchstart", handleHeroExitTouchStart);
      window.removeEventListener("touchend", handleHeroExitTouchEnd);
      window.removeEventListener("touchcancel", handleHeroExitTouchEnd);
      window.removeEventListener("scroll", handleHeroExitScroll);
      window.removeEventListener("scrollend", handleHeroExitScrollEnd);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pageshow", handlePageShow);
      delete window.__scrollToSection;
      pendingScrollTarget = null;
      releaseHeroExitSnap();
      destroyLenis();
      window.history.scrollRestoration = previousScrollRestoration;
      scene.classList.remove("experience-rendering-paused");
      experienceRef.current?.setRenderingPaused(false);
      controllerRef.current = null;
    };
  }, [entered, experienceRef, sceneRef]);

  useLayoutEffect(() => {
    controllerRef.current?.setRouteOpen(routeOpen);
  }, [routeOpen]);

  return useCallback(() => {
    controllerRef.current?.prepareForHeroNavigation();
  }, []);
}
