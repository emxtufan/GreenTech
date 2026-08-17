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
    const nativeScroll = usesNativeTouchScroll() || reducedMotion;
    const previousScrollRestoration = window.history.scrollRestoration;
    let routeIsOpen = routeOpenRef.current;
    let bodyIsLocked = bodyHasScrollLock();
    let returningToIntro = false;
    let renderingPaused = false;
    let savedScrollY = window.scrollY;
    let restoreFrameOne = 0;
    let restoreFrameTwo = 0;
    let lenis = null;

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
      if (!target || isSuspended()) return;

      if (lenis) {
        lenis.scrollTo(target, { immediate: false, lock: false });
        return;
      }

      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
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
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pageshow", handlePageShow);
      delete window.__scrollToSection;
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
