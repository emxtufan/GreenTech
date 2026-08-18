import React, { useLayoutEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import BlurText from "./BlurText.jsx";
import SectionActionModal, { useSectionAction } from "./SectionAction.jsx";
import useSection from "./hooks/useSection.js";
import "./HorizontalParallaxGallery.css";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function HorizontalParallaxGallery({
  entered,
  items,
  onProjectOpen,
  onShowAllProjects,
}) {
  const text = useSection("projects");
  const projectAction = useSectionAction("projects", {
    label: "Vezi proiectul",
    mode: "builtin",
  });
  const sectionRef = useRef(null);
  const wrapperRef = useRef(null);
  const trackRef = useRef(null);
  const featuredItems = items.slice(0, 5);
  const archiveImage =
    items[featuredItems.length]?.image
    ?? featuredItems[featuredItems.length - 1]?.image;

  useLayoutEffect(() => {
    if (!entered) return undefined;

    const section = sectionRef.current;
    const wrapper = wrapperRef.current;
    const track = trackRef.current;
    if (!section || !wrapper || !track) return undefined;

    const scroll = {
      current: 0,
      target: 0,
      ease: 0.07,
      limit: 0,
      sectionTop: 0,
      travel: 1,
    };

    let cardMetrics = [];
    let frame = 0;
    let measureFrame = 0;
    let disposed = false;
    let inRenderRange = false;

    const setTargetFromPageScroll = () => {
      const progress = clamp(
        (window.scrollY - scroll.sectionTop) / scroll.travel,
        0,
        1,
      );
      scroll.target = progress * scroll.limit;
    };

    const measure = () => {
      measureFrame = 0;
      if (disposed) return;

      const viewportHeight = Math.max(1, wrapper.clientHeight || window.innerHeight);
      scroll.limit = Math.max(0, track.scrollWidth - wrapper.clientWidth);
      section.style.height = `${viewportHeight + scroll.limit}px`;
      scroll.sectionTop = section.getBoundingClientRect().top + window.scrollY;
      scroll.travel = Math.max(1, section.offsetHeight - viewportHeight);

      cardMetrics = Array.from(track.querySelectorAll(".horizontal-gallery-card")).map(
        (card) => ({
          card,
          center: card.offsetLeft + card.offsetWidth * 0.5,
          width: card.offsetWidth,
          image: card.querySelector(".horizontal-gallery-image"),
          category: card.querySelector(".horizontal-gallery-caption > span"),
          title: card.querySelector(".horizontal-gallery-caption h3"),
          link: card.querySelector(".horizontal-gallery-link"),
          index: card.querySelector(".horizontal-gallery-caption b"),
        }),
      );

      setTargetFromPageScroll();
      scroll.current = clamp(scroll.current, 0, scroll.limit);
    };

    const scheduleMeasure = () => {
      if (measureFrame) return;
      measureFrame = window.requestAnimationFrame(measure);
    };

    const render = () => {
      frame = 0;
      if (!inRenderRange || disposed) return;

      setTargetFromPageScroll();
      scroll.current += (scroll.target - scroll.current) * scroll.ease;

      if (Math.abs(scroll.target - scroll.current) < 0.01) {
        scroll.current = scroll.target;
      }

      track.style.transform = `translate3d(${-scroll.current}px, 0, 0)`;

      const wrapperLeft = wrapper.getBoundingClientRect().left;
      const viewportCenter = window.innerWidth * 0.5;

      cardMetrics.forEach(({
        card,
        center,
        width,
        image,
        category,
        title,
        link,
        index,
      }) => {
        if (!image) return;

        const elementCenter = wrapperLeft + center - scroll.current;
        const elementLeft = elementCenter - width * 0.5;
        const position = clamp(
          (elementCenter - viewportCenter) / viewportCenter,
          -1,
          1,
        );
        const shift = -position * 10;
        const captionOffset = clamp(wrapperLeft - elementLeft, 0, width - 120);
        image.style.transform = `translate3d(${shift}%, 0, 0)`;
        card.style.setProperty("--caption-offset", `${captionOffset}px`);

        if (!category || !title || !link || !index) return;

        const copyRight = Math.max(
          category.offsetLeft + category.offsetWidth,
          title.offsetLeft + title.offsetWidth,
        );
        const linkRight = link.offsetLeft + link.offsetWidth;
        const indexLeft = index.offsetLeft;
        const copyGap = indexLeft - copyRight;
        const linkGap = indexLeft - linkRight;
        const copyIsHidden = card.classList.contains("caption-copy-hidden");
        const indexIsCompact = card.classList.contains("caption-index-compact");

        card.classList.toggle(
          "caption-copy-hidden",
          copyIsHidden ? copyGap < 44 : copyGap < 28,
        );
        card.classList.toggle(
          "caption-index-compact",
          indexIsCompact ? linkGap < 34 : linkGap < 18,
        );
      });

      frame = window.requestAnimationFrame(render);
    };

    measure();

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(wrapper);
    resizeObserver.observe(track);
    const renderObserver = new IntersectionObserver(
      (entries) => {
        inRenderRange = entries.some((entry) => entry.isIntersecting);
        if (inRenderRange && !frame) {
          frame = window.requestAnimationFrame(render);
        } else if (!inRenderRange) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "50% 0px" },
    );
    renderObserver.observe(section);
    window.addEventListener("resize", scheduleMeasure);
    document.fonts?.ready.then(scheduleMeasure);

    return () => {
      disposed = true;
      renderObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(measureFrame);
      section.style.height = "";
      track.style.transform = "";
      cardMetrics.forEach(({ card, image }) => {
        if (image) image.style.transform = "";
        card.style.removeProperty("--caption-offset");
        card.classList.remove("caption-copy-hidden", "caption-index-compact");
      });
    };
  }, [entered, items, projectAction.label]);

  const handleProjectLink = (event, projectId) => {
    if (
      !onProjectOpen ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    onProjectOpen(projectId);
  };

  const handleArchiveLink = (event) => {
    if (
      !onShowAllProjects ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    onShowAllProjects();
  };

  return (
    <section
      ref={sectionRef}
      id="projects"
      className={`horizontal-gallery-section ${entered ? "visible" : ""}`}
      aria-labelledby="horizontal-gallery-title"
      data-wind-stage="projects"
    >
      <div className="horizontal-gallery-sticky">
        <header className="horizontal-gallery-heading">
          <span>{text("eyebrow", "Portofoliu")}</span>
          <BlurText
            as="h2"
            id="horizontal-gallery-title"
            text={text("title", "Proiecte selectate")}
            play={entered}
            animateBy="letters"
            direction="top"
            delay={55}
            stepDuration={0.45}
          />
          <p>
            {text(
              "description",
              "Lucrari din Romania si Italia, prezentate cu amplasament, capacitate si domeniul de executie.",
            )}
          </p>
        </header>

        <div className="horizontal-gallery-wrapper" ref={wrapperRef}>
          <div className="horizontal-gallery-track" ref={trackRef}>
            {featuredItems.map((item, index) => (
              <figure className="horizontal-gallery-card" key={item.id}>
                <img
                  className="horizontal-gallery-image"
                  src={item.image}
                  alt={item.alt}
                  loading={index < 2 ? "eager" : "lazy"}
                  draggable="false"
                />
                <figcaption className="horizontal-gallery-caption">
                  <span>{item.category}</span>
                  <h3>{item.title}</h3>
                  {projectAction.visible && (
                    <a
                      className="horizontal-gallery-link"
                      href={projectAction.hrefFor(`?project=${encodeURIComponent(item.id)}`)}
                      aria-label={`${projectAction.label}: ${item.title}`}
                      onClick={(event) => projectAction.activate(
                        event,
                        (builtinEvent) => handleProjectLink(builtinEvent, item.id),
                      )}
                    >
                      <span>{projectAction.label}</span>
                      <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
                    </a>
                  )}
                  <b aria-hidden="true">{String(index + 1).padStart(2, "0")}</b>
                </figcaption>
              </figure>
            ))}

            <figure className="horizontal-gallery-card horizontal-gallery-all-card">
              {archiveImage && (
                <img
                  className="horizontal-gallery-image"
                  src={archiveImage}
                  alt=""
                  loading="lazy"
                  draggable="false"
                  aria-hidden="true"
                />
              )}
              <figcaption className="horizontal-gallery-all-content">
                <span>{text("archiveEyebrow", "Portofoliu complet")}</span>
                <h3>{text("archiveTitle", "Toate proiectele")}</h3>
                <p>{text("archiveDescription")}</p>
                <a
                  href="?projects=all"
                  onClick={handleArchiveLink}
                  aria-label={text("archiveAriaLabel", "Vezi toate proiectele Greentech Professionals")}
                >
                  <span>{text("archiveAction", "Vezi portofoliul")}</span>
                  <ArrowUpRight size={17} strokeWidth={1.8} aria-hidden="true" />
                </a>
                <b aria-hidden="true">{String(items.length).padStart(2, "0")}</b>
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
      <SectionActionModal {...projectAction.modalProps} />
    </section>
  );
}

export default HorizontalParallaxGallery;
