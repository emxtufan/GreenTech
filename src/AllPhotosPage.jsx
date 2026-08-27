import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import useSection from "./hooks/useSection.js";
import { collectProjectImageGroups } from "./lib/projectImages.js";
import "./AllPhotosPage.css";

const gallerySpring = {
  type: "spring",
  stiffness: 350,
  damping: 35,
  mass: 1,
};

const GALLERY_CLUSTER_SIZE = 6;

function AllPhotosPage({ projects = [], photos = [], onClose }) {
  const pageRef = useRef(null);
  const resultsRef = useRef(null);
  const backButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const imageButtonsRef = useRef([]);
  const [activeProjectId, setActiveProjectId] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const imageGroups = useMemo(
    () => collectProjectImageGroups(projects, photos),
    [photos, projects],
  );
  const allImages = useMemo(
    () => imageGroups.flatMap((group) => group.images),
    [imageGroups],
  );
  const activeGroup = useMemo(
    () => imageGroups.find((group) => group.id === activeProjectId) || null,
    [activeProjectId, imageGroups],
  );
  const images = activeProjectId === "all" || !activeGroup
    ? allImages
    : activeGroup.images;
  const imageClusters = useMemo(() => {
    const clusters = [];

    for (let index = 0; index < images.length; index += GALLERY_CLUSTER_SIZE) {
      clusters.push(
        images.slice(index, index + GALLERY_CLUSTER_SIZE).map((image, offset) => ({
          image,
          index: index + offset,
        })),
      );
    }

    return clusters;
  }, [images]);
  const text = useSection("photo-gallery");
  const copy = {
    back: text("galleryBackLabel"),
    archive: text("galleryArchiveLabel"),
    imageCount: text("galleryImageCountLabel"),
    close: text("galleryCloseLabel"),
    previous: text("galleryPreviousLabel"),
    next: text("galleryNextLabel"),
    empty: text("galleryEmptyMessage"),
    filter: text("galleryFilterLabel", "Filtreaza dupa proiect"),
    allProjects: text("galleryAllProjectsLabel", "Toate proiectele"),
  };
  const selectedImage = selectedIndex === null ? null : images[selectedIndex];
  const title = text("title");

  const changeProjectFilter = useCallback((projectId) => {
    setSelectedIndex(null);
    setActiveProjectId(projectId);
    imageButtonsRef.current = [];

    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ block: "start" });
    });
  }, []);

  const closeImage = useCallback(() => {
    const previousIndex = selectedIndex;
    setSelectedIndex(null);
    window.requestAnimationFrame(() => {
      imageButtonsRef.current[previousIndex]?.focus({ preventScroll: true });
    });
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
    const previousTitle = document.title;
    const focusFrame = window.requestAnimationFrame(() => {
      pageRef.current?.scrollTo({ top: 0 });
      backButtonRef.current?.focus({ preventScroll: true });
    });

    document.title = `${title} | Greentech Professionals`;

    return () => {
      document.title = previousTitle;
      window.cancelAnimationFrame(focusFrame);
    };
  }, [title]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (selectedIndex !== null) closeImage();
        else onClose();
        return;
      }

      if (selectedIndex === null) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeImage, onClose, selectedIndex, showNext, showPrevious]);

  useEffect(() => {
    const page = pageRef.current;
    if (!selectedImage || !page) return undefined;

    const previousOverflow = page.style.overflowY;
    page.style.overflowY = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });

    return () => {
      page.style.overflowY = previousOverflow;
      window.cancelAnimationFrame(focusFrame);
    };
  }, [selectedImage]);

  return (
    <article
      className="photos-index-page"
      ref={pageRef}
      aria-labelledby="photos-index-title"
      data-lenis-prevent
    >
      <header className="photos-index-nav">
        <button
          className="photos-index-brand"
          type="button"
          aria-label={copy.back}
          onClick={onClose}
        >
          <img src="/original/logo-alb.png.webp" alt="Greentech Professionals" />
        </button>
        <button
          className="photos-index-back"
          ref={backButtonRef}
          type="button"
          onClick={onClose}
        >
          <ArrowLeft aria-hidden="true" />
          <span>{copy.back}</span>
        </button>
      </header>

      <main className="photos-index-content">
        <header className="photos-index-intro">
          <span>{copy.archive} / {String(images.length).padStart(2, "0")}</span>
          <h1 id="photos-index-title">{title}</h1>
          <p>{text("description")}</p>
        </header>

        {images.length > 0 ? (
          <section
            className="photos-index-browser"
            aria-label={copy.filter}
          >
            <aside className="photos-index-filter">
              <div className="photos-index-filter-select">
                <label htmlFor="photos-project-filter">{copy.filter}</label>
                <select
                  id="photos-project-filter"
                  value={activeProjectId}
                  onChange={(event) => changeProjectFilter(event.target.value)}
                >
                  <option value="all">{copy.allProjects} ({allImages.length})</option>
                  {imageGroups.map((group) => (
                    <option value={group.id} key={group.id}>
                      {group.title} ({group.images.length})
                    </option>
                  ))}
                </select>
              </div>

              <div className="photos-index-filter-menu">
                <span>{copy.filter}</span>
                <nav aria-label={copy.filter}>
                  <button
                    className={activeProjectId === "all" ? "is-active" : ""}
                    type="button"
                    aria-pressed={activeProjectId === "all"}
                    onClick={() => changeProjectFilter("all")}
                  >
                    <span>{copy.allProjects}</span>
                    <b>{String(allImages.length).padStart(2, "0")}</b>
                  </button>
                  {imageGroups.map((group) => (
                    <button
                      className={activeProjectId === group.id ? "is-active" : ""}
                      type="button"
                      aria-pressed={activeProjectId === group.id}
                      key={group.id}
                      onClick={() => changeProjectFilter(group.id)}
                    >
                      <span>{group.title}</span>
                      <b>{String(group.images.length).padStart(2, "0")}</b>
                    </button>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="photos-index-results" ref={resultsRef}>
              <header className="photos-index-results-header">
                <h2>{activeGroup?.title || copy.allProjects}</h2>
                <span>{String(images.length).padStart(2, "0")} {copy.imageCount}</span>
              </header>

              <div className="photos-index-grid">
                {imageClusters.map((cluster, clusterIndex) => (
                  <div
                    className={`photos-index-cluster ${clusterIndex % 2 === 1 ? "is-reversed" : ""}`}
                    data-count={cluster.length}
                    key={cluster.map(({ image }) => image.id).join("-")}
                  >
                    {cluster.map(({ image, index }, slotIndex) => (
                      <motion.button
                        className={`photos-index-tile is-slot-${slotIndex + 1}`}
                        ref={(node) => { imageButtonsRef.current[index] = node; }}
                        type="button"
                        key={image.id}
                        onClick={() => setSelectedIndex(index)}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.985 }}
                        transition={gallerySpring}
                        aria-label={`${image.projectTitle}${image.location ? `, ${image.location}` : ""}`}
                      >
                        <motion.img
                          layoutId={`photo-${image.id}`}
                          src={image.src}
                          alt={image.alt}
                          loading={index < 6 ? "eager" : "lazy"}
                          fetchPriority={index === 0 ? "high" : "auto"}
                          decoding="async"
                          draggable={false}
                          transition={gallerySpring}
                        />
                        <span className="photos-index-tile-shade" aria-hidden="true" />
                        <span className="photos-index-tile-copy">
                          <strong>{image.projectTitle}</strong>
                          {(image.caption || image.location) && (
                            <small>{image.caption || image.location}</small>
                          )}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <p className="photos-index-empty">{copy.empty}</p>
        )}
      </main>

      <AnimatePresence>
        {selectedImage && (
          <div className="photos-viewer" role="presentation">
            <motion.button
              className="photos-viewer-backdrop"
              type="button"
              aria-label={copy.close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              onClick={closeImage}
            />

            <motion.figure
              className="photos-viewer-figure"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.72}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.y) > 110 || Math.abs(info.velocity.y) > 450) {
                  closeImage();
                }
              }}
            >
              <motion.img
                layoutId={`photo-${selectedImage.id}`}
                src={selectedImage.src}
                alt={selectedImage.alt}
                draggable={false}
                transition={gallerySpring}
              />
              <figcaption>
                <strong>{selectedImage.projectTitle}</strong>
                {(selectedImage.caption || selectedImage.location) && (
                  <span>{selectedImage.caption || selectedImage.location}</span>
                )}
              </figcaption>
            </motion.figure>

            <button
              className="photos-viewer-close"
              ref={closeButtonRef}
              type="button"
              title={copy.close}
              aria-label={copy.close}
              onClick={closeImage}
            >
              <X aria-hidden="true" />
            </button>
            {images.length > 1 && (
              <>
                <button
                  className="photos-viewer-nav is-previous"
                  type="button"
                  title={copy.previous}
                  aria-label={copy.previous}
                  onClick={showPrevious}
                >
                  <ArrowLeft aria-hidden="true" />
                </button>
                <button
                  className="photos-viewer-nav is-next"
                  type="button"
                  title={copy.next}
                  aria-label={copy.next}
                  onClick={showNext}
                >
                  <ArrowRight aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        )}
      </AnimatePresence>
    </article>
  );
}

export default AllPhotosPage;
