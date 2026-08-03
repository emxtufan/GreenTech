import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { usesNativeTouchScroll } from "./scrollMotion.js";

const LENIS_LERP = 0.075;
const LENIS_WHEEL_MULTIPLIER = 0.65;

export default function useExperienceScrollController({
  entered,
  projectOpen,
  sceneRef,
  experienceRef,
}) {
  const controllerRef = useRef(null);
  const suspendedRef = useRef(projectOpen);

  suspendedRef.current = projectOpen;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!entered || !scene) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nativeTouchScroll = usesNativeTouchScroll();
    let returningToIntro = false;
    let renderingPaused = false;

    const lenis = nativeTouchScroll
      ? null
      : new Lenis({
        autoRaf: true,
        lerp: LENIS_LERP,
        smoothWheel: !reducedMotion,
        syncTouch: false,
        wheelMultiplier: LENIS_WHEEL_MULTIPLIER,
        overscroll: false,
        stopInertiaOnNavigate: true,
      });

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

    controllerRef.current = {
      prepareForHeroNavigation() {
        returningToIntro = true;
        lenis?.stop();
      },
      setSuspended(suspended) {
        if (returningToIntro) return;

        if (suspended) {
          lenis?.stop();
          return;
        }

        lenis?.start();
        lenis?.resize();
      },
    };

    // Anchor links elsewhere in the app need to move the same scroller Lenis
    // drives. Native smooth scrolling fights its animation loop, so expose a
    // helper that defers to Lenis when it is running.
    window.__scrollToSection = (target) => {
      if (!target) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (lenis) {
        lenis.scrollTo(target, { immediate: reduced, lock: false });
        return;
      }

      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    };

    if (suspendedRef.current) lenis?.stop();

    return () => {
      sceneObserver.disconnect();
      delete window.__scrollToSection;
      lenis?.destroy();
      scene.classList.remove("experience-rendering-paused");
      experienceRef.current?.setRenderingPaused(false);
      controllerRef.current = null;
    };
  }, [entered, experienceRef, sceneRef]);

  useLayoutEffect(() => {
    controllerRef.current?.setSuspended(projectOpen);
  }, [projectOpen]);

  return useCallback(() => {
    controllerRef.current?.prepareForHeroNavigation();
  }, []);
}
