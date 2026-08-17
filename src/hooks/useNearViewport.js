import { useEffect, useState } from "react";

export default function useNearViewport(targetRef, enabled, rootMargin = "2000px 0px") {
  const [nearViewport, setNearViewport] = useState(false);

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
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setNearViewport(true);
      observer.disconnect();
    }, { rootMargin });

    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, rootMargin, targetRef]);

  return enabled && nearViewport;
}
