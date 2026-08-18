import { useEffect, useState } from "react";
import { shouldConserveWebGLMemory } from "../lib/devicePerformance.js";

export default function useNearViewport(targetRef, enabled, rootMargin) {
  const [nearViewport, setNearViewport] = useState(false);
  const conserveMemory = shouldConserveWebGLMemory();
  const observerMargin = rootMargin
    ?? (conserveMemory ? "35% 0px 120% 0px" : "2000px 0px");

  useEffect(() => {
    if (!enabled) {
      setNearViewport(false);
      return undefined;
    }

    const target = targetRef.current;
    if (!target) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      const isNear = entries.some((entry) => entry.isIntersecting);

      if (conserveMemory) {
        setNearViewport(isNear);
        return;
      }

      if (!isNear) return;
      setNearViewport(true);
      observer.disconnect();
    }, { rootMargin: observerMargin });

    observer.observe(target);
    return () => observer.disconnect();
  }, [conserveMemory, enabled, observerMargin, targetRef]);

  return enabled && nearViewport;
}
