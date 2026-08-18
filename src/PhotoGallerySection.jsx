import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Images, X } from "lucide-react";
import BlurText from "./BlurText.jsx";
import SectionActionModal, { useSectionAction } from "./SectionAction.jsx";
import { useIsMobile } from "./hooks/use-mobile.js";
import useSection from "./hooks/useSection.js";
import { collectProjectImages } from "./lib/projectImages.js";
import "./PhotoGallerySection.css";

const DEFAULT_PATH = {
  perspective: 30,
  cardWidth: 18,
  cardHeight: 25,
  cardRadius: 0.45,
  birthHeight: 2.6,
  exitHeight: 45,
  railBirth: -11,
  railExit: 44,
  fan: 3.3,
  turnBirth: 6,
  turnExit: 28,
  stops: 24,
};

function createKeyframes(direction, name, path) {
  const steps = [];

  for (let step = 0; step <= path.stops; step += 1) {
    const progress = step / path.stops;
    const scale =
      (path.birthHeight / path.cardHeight)
      * ((path.exitHeight / path.birthHeight) ** progress);
    const depth = path.perspective * (1 - (1 / scale));
    const rail =
      path.railExit
      - ((path.railExit - path.railBirth) * ((1 - progress) ** path.fan));
    const turn = path.turnBirth + ((path.turnExit - path.turnBirth) * progress);

    steps.push(
      `${(progress * 100).toFixed(2)}%{transform:translate3d(${(
        direction * rail
      ).toFixed(2)}cqw,0,${depth.toFixed(2)}cqw) rotateY(${(
        -direction * turn
      ).toFixed(2)}deg)}`,
    );
  }

  return `@keyframes ${name}{${steps.join("")}}`;
}

function ImageCorridor({ images, cards = 10, speed = 21, axis = 54 }) {
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const rightAnimation = `photo-stream-right-${instanceId}`;
  const leftAnimation = `photo-stream-left-${instanceId}`;
  const path = DEFAULT_PATH;

  const animationCss = useMemo(
    () => (
      `${createKeyframes(1, rightAnimation, path)}`
      + `${createKeyframes(-1, leftAnimation, path)}`
    ),
    [leftAnimation, path, rightAnimation],
  );

  if (images.length === 0) return null;

  return (
    <div
      className="photo-stream"
      aria-hidden="true"
      style={{ containerType: "inline-size" }}
    >
      <style>{animationCss}</style>
      <div
        className="photo-stream-perspective"
        style={{
          perspective: `${path.perspective}cqw`,
          perspectiveOrigin: `50% ${axis}%`,
        }}
      >
        <div className="photo-stream-world">
          {[
            { name: rightAnimation, offset: 0 },
            { name: leftAnimation, offset: Math.ceil(images.length / 2) },
          ].map((rail) => (
            Array.from({ length: cards }, (_, index) => {
              const image = images[(index + rail.offset) % images.length];

              return (
                <figure
                  className="photo-stream-card"
                  key={`${rail.name}-${index}`}
                  style={{
                    left: "50%",
                    top: `${axis}%`,
                    "--photo-card-width-base": `${path.cardWidth}cqw`,
                    "--photo-card-height-base": `${path.cardHeight}cqw`,
                    "--photo-card-radius-base": `${path.cardRadius}cqw`,
                    "--photo-card-offset-x-base": `${-path.cardWidth / 2}cqw`,
                    "--photo-card-offset-y-base": `${-path.cardHeight / 2}cqw`,
                    animationName: rail.name,
                    animationDuration: `${speed}s`,
                    animationDelay: `${-(index * speed) / cards}s`,
                  }}
                >
                  <img
                    src={image.src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </figure>
              );
            })
          ))}
        </div>
      </div>
    </div>
  );
}

function GalleryDialog({ images, open, onClose, title, triggerRef, ui }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const viewerCloseRef = useRef(null);
  const imageButtonsRef = useRef([]);
  const [selectedIndex, setSelectedIndex] = useState(null);

  const closeViewer = useCallback(() => {
    const previousIndex = selectedIndex;
    setSelectedIndex(null);
    window.requestAnimationFrame(() => imageButtonsRef.current[previousIndex]?.focus());
  }, [selectedIndex]);

  const showPrevious = useCallback(() => {
    setSelectedIndex((current) => (
      current === null ? 0 : (current - 1 + images.length) % images.length
    ));
  }, [images.length]);

  const showNext = useCallback(() => {
    setSelectedIndex((current) => (
      current === null ? 0 : (current + 1) % images.length
    ));
  }, [images.length]);

  useEffect(() => {
    if (!open) return undefined;

    const previousActive = document.activeElement;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      setSelectedIndex(null);
      (triggerRef.current || previousActive)?.focus?.({ preventScroll: true });
    };
  }, [onClose, open, triggerRef]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (selectedIndex !== null) closeViewer();
        else onClose();
        return;
      }

      if (selectedIndex !== null && event.key === "ArrowLeft") {
        event.preventDefault();
        showPrevious();
        return;
      }

      if (selectedIndex !== null && event.key === "ArrowRight") {
        event.preventDefault();
        showNext();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      const available = [...(focusable || [])].filter((element) => !element.closest("[inert]"));
      if (available.length === 0) return;

      const first = available[0];
      const last = available[available.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeViewer, onClose, open, selectedIndex, showNext, showPrevious]);

  useEffect(() => {
    if (selectedIndex === null) return;
    const frame = window.requestAnimationFrame(() => viewerCloseRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [selectedIndex]);

  if (!open || typeof document === "undefined") return null;

  const selectedImage = selectedIndex === null ? null : images[selectedIndex];

  return createPortal(
    <div
      className="photo-gallery-dialog-backdrop"
      data-lenis-prevent
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="photo-gallery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="photo-gallery-dialog-content" inert={selectedImage ? true : undefined}>
          <header className="photo-gallery-dialog-header">
            <div>
              <span>{ui.brandLabel}</span>
              <h2 id={titleId}>{title}</h2>
            </div>
            <div className="photo-gallery-dialog-meta">
              <p>{String(images.length).padStart(2, "0")} {ui.images}</p>
              <button
                ref={closeRef}
                type="button"
                aria-label={ui.closeGallery}
                title={ui.closeGallery}
                onClick={onClose}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="photo-gallery-grid">
            {images.map((image, index) => (
              <button
                ref={(element) => { imageButtonsRef.current[index] = element; }}
                className="photo-gallery-grid-item"
                type="button"
                key={image.id}
                aria-label={`${ui.openImage} ${index + 1}: ${image.alt}`}
                onClick={() => setSelectedIndex(index)}
              >
                <figure>
                  <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
                  <figcaption>
                    <span>{image.projectTitle}</span>
                    <b>{String(index + 1).padStart(2, "0")}</b>
                  </figcaption>
                </figure>
              </button>
            ))}
          </div>
        </div>

        {selectedImage && (
          <div className="photo-gallery-viewer" aria-live="polite">
            <header>
              <div>
                <span>{String(selectedIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span>
                <p>{selectedImage.projectTitle}</p>
              </div>
              <button
                ref={viewerCloseRef}
                type="button"
                aria-label={ui.backToGallery}
                title={ui.backToGallery}
                onClick={closeViewer}
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="photo-gallery-viewer-stage">
              <button
                className="photo-gallery-viewer-nav is-previous"
                type="button"
                aria-label={ui.previousImage}
                title={ui.previousImage}
                onClick={showPrevious}
              >
                <ArrowLeft aria-hidden="true" />
              </button>

              <figure>
                <img src={selectedImage.src} alt={selectedImage.alt} />
                <figcaption>{selectedImage.alt}</figcaption>
              </figure>

              <button
                className="photo-gallery-viewer-nav is-next"
                type="button"
                aria-label={ui.nextImage}
                title={ui.nextImage}
                onClick={showNext}
              >
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}

function PhotoGallerySection({ active, projects = [], photos = [], onShowAllPhotos }) {
  const sectionRef = useRef(null);
  const [inView, setInView] = useState(false);
  const isMobile = useIsMobile();
  const text = useSection("photo-gallery");
  const action = useSectionAction("photo-gallery", {
    label: "",
    mode: "builtin",
  });
  const images = useMemo(
    () => collectProjectImages(projects, photos),
    [photos, projects],
  );
  const title = text("title");
  const previewCards = isMobile
    ? Math.min(6, Math.max(4, images.length))
    : Math.min(12, Math.max(9, images.length));

  useEffect(() => {
    const section = sectionRef.current;
    if (!active || !section) {
      setInView(false);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "18% 0px", threshold: 0.04 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [active]);

  if (images.length === 0) return null;

  return (
    <section
      id="photo-gallery"
      ref={sectionRef}
      className={`photo-gallery-section ${active ? "is-active" : ""} ${inView ? "is-in-view" : ""}`}
      aria-labelledby="photo-gallery-title"
    >
      <div className="photo-gallery-stage">
        <ImageCorridor
          images={images}
          cards={previewCards}
          speed={22}
          axis={55}
        />

        <header className="photo-gallery-heading">
          <span>{text("eyebrow")}</span>
          <BlurText
            as="h2"
            id="photo-gallery-title"
            text={title}
            play={active}
            animateBy="letters"
            direction="top"
            delay={55}
            stepDuration={0.45}
          />
          <p>
            {text("description")}
          </p>
        </header>

        <footer className="photo-gallery-footer">
          {action.visible && (
            <a
              className="photo-gallery-open"
              href={action.hrefFor("?gallery=all")}
              onClick={(event) => action.activate(event, (navigationEvent) => {
                if (
                  navigationEvent.button !== 0
                  || navigationEvent.metaKey
                  || navigationEvent.ctrlKey
                  || navigationEvent.shiftKey
                  || navigationEvent.altKey
                  || typeof onShowAllPhotos !== "function"
                ) return;

                navigationEvent.preventDefault();
                onShowAllPhotos();
              })}
            >
              <span>{action.label}</span>
              <Images aria-hidden="true" />
            </a>
          )}
        </footer>
      </div>
      <SectionActionModal {...action.modalProps} />
    </section>
  );
}

export default PhotoGallerySection;
