import React, { useEffect, useRef } from "react";
import { TOUCH_VISUAL_EASE } from "./scrollMotion.js";
import serviceIllustrations from "./serviceIllustrations.jsx";
import "./ServiceSvgIllustration.css";

// Mobile stand-in for the scroll-driven 3D service models. The illustration
// draws itself in as the sticky section scrolls: every element carrying
// `data-build="start duration"` (both on a 0..1 timeline) is traced through its
// stroke-dashoffset, or faded in when it is a `data-mode="fill"` element.
// The drawing starts while the section is still sliding into view (once its
// top crosses this fraction of the viewport height) and is complete this far
// into the pinned scroll travel.
const BUILD_START_VIEWPORT = 0.55;
const BUILD_COMPLETE_AT = 0.45;
const PATH_LENGTH = 100;
const BUILT_THRESHOLD = 0.985;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (progress) => {
  const value = clamp(progress, 0, 1);
  return value * value * (3 - 2 * value);
};

function ServiceSvgIllustration({
  variant,
  sectionRef,
  active,
  modelKey,
  onPrepared,
}) {
  const frameRef = useRef(null);
  const Illustration = serviceIllustrations[variant];

  // Nothing to download or compile, so the section counts as prepared at once.
  useEffect(() => {
    onPrepared?.(modelKey, true);
  }, [modelKey, onPrepared]);

  useEffect(() => {
    const section = sectionRef.current;
    const frame = frameRef.current;
    const svg = frame?.querySelector("svg");
    if (!active || !section || !frame || !svg) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const parts = Array.from(svg.querySelectorAll("[data-build]")).map((element) => {
      const [start = 0, duration = 0.2] = element.dataset.build
        .split(/[\s,]+/)
        .map(Number);
      return {
        element,
        start,
        duration: Math.max(0.001, duration),
        fill: element.dataset.mode === "fill",
        value: -1,
      };
    });

    const state = { opacity: 0, build: 0 };
    const layout = { top: 0, height: 1, viewportHeight: Math.max(1, window.innerHeight) };
    let raf = 0;
    let measureFrame = 0;
    let inRange = false;
    let built = false;
    let disposed = false;

    const applyBuild = (build) => {
      parts.forEach((part) => {
        const local = clamp((build - part.start) / part.duration, 0, 1);
        if (local === part.value) return;
        part.value = local;
        if (part.fill) {
          part.element.style.opacity = local.toFixed(3);
          return;
        }
        // Round caps would leave a dot at the path start while fully offset,
        // so an untraced stroke is hidden outright.
        part.element.style.opacity = local > 0 ? "1" : "0";
        part.element.style.strokeDashoffset = ((1 - local) * PATH_LENGTH).toFixed(3);
      });

      const nextBuilt = build >= BUILT_THRESHOLD;
      if (nextBuilt !== built) {
        built = nextBuilt;
        svg.classList.toggle("built", built);
      }
    };

    const measure = () => {
      measureFrame = 0;
      if (disposed) return;
      const bounds = section.getBoundingClientRect();
      layout.top = window.scrollY + bounds.top;
      layout.height = Math.max(1, bounds.height);
      layout.viewportHeight = Math.max(1, window.innerHeight);
    };

    const scheduleMeasure = () => {
      if (measureFrame) return;
      measureFrame = window.requestAnimationFrame(measure);
    };

    const render = () => {
      raf = 0;
      if (!inRange || disposed) return;

      const { viewportHeight } = layout;
      const boundsTop = layout.top - window.scrollY;
      const boundsBottom = boundsTop + layout.height;
      const scrollTravel = Math.max(1, layout.height - viewportHeight);
      const buildStart = viewportHeight * BUILD_START_VIEWPORT;
      const buildSpan = buildStart + scrollTravel * BUILD_COMPLETE_AT;
      const targetBuild = reducedMotion.matches
        ? 1
        : smoothstep((buildStart - boundsTop) / buildSpan);
      const entryVisibility = smoothstep(
        (viewportHeight - boundsTop) / Math.max(1, viewportHeight * 0.65),
      );
      const exitVisibility = smoothstep(
        boundsBottom / Math.max(1, viewportHeight * 0.5),
      );
      const targetOpacity = entryVisibility * exitVisibility;
      const ease = reducedMotion.matches ? 1 : TOUCH_VISUAL_EASE;

      state.opacity += (targetOpacity - state.opacity) * ease;
      state.build += (targetBuild - state.build) * ease;
      if (Math.abs(targetOpacity - state.opacity) < 0.001) state.opacity = targetOpacity;
      if (Math.abs(targetBuild - state.build) < 0.0005) state.build = targetBuild;

      frame.style.opacity = state.opacity.toFixed(3);
      applyBuild(state.build);

      const settled =
        state.opacity === targetOpacity && state.build === targetBuild;
      if (!settled) requestRender();
    };

    const requestRender = () => {
      if (!inRange || disposed || raf) return;
      raf = window.requestAnimationFrame(render);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        inRange = entries.some((entry) => entry.isIntersecting);
        if (inRange) {
          measure();
          requestRender();
          return;
        }
        window.cancelAnimationFrame(raf);
        raf = 0;
        state.opacity = 0;
        frame.style.opacity = "0";
      },
      { rootMargin: "20% 0px" },
    );
    observer.observe(section);

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(section);
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", scheduleMeasure);
    measure();
    applyBuild(0);

    return () => {
      disposed = true;
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", scheduleMeasure);
      window.cancelAnimationFrame(raf);
      window.cancelAnimationFrame(measureFrame);
      frame.style.opacity = "";
      svg.classList.remove("built");
    };
  }, [active, sectionRef, variant]);

  if (!Illustration) return null;

  return (
    <div
      ref={frameRef}
      className={`service-svg-illustration service-svg-${variant}`}
      aria-hidden="true"
    >
      <Illustration />
    </div>
  );
}

export default ServiceSvgIllustration;
