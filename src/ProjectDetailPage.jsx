import React, { useEffect, useRef } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import "./ProjectDetailPage.css";

function shouldHandleNavigation(event) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function ProjectDetailPage({ project, nextProject, onClose, onProjectOpen }) {
  const pageRef = useRef(null);
  const backButtonRef = useRef(null);

  useEffect(() => {
    const previousTitle = document.title;
    const focusFrame = window.requestAnimationFrame(() => {
      pageRef.current?.scrollTo({ top: 0 });
      backButtonRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.title = `${project.title} | GreenTech Professionals`;
    document.body.classList.add("project-route-open");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.title = previousTitle;
      document.body.classList.remove("project-route-open");
      window.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [onClose, project.id, project.title]);

  const handleNextProject = (event) => {
    if (!shouldHandleNavigation(event)) return;
    event.preventDefault();
    onProjectOpen(nextProject.id);
  };

  return (
    <article
      className="project-detail-page"
      ref={pageRef}
      aria-labelledby="project-detail-title"
    >
      <header className="project-detail-nav">
        <button
          className="project-detail-brand"
          type="button"
          aria-label="Return to projects"
          onClick={onClose}
        >
          <img src="/original/logo-alb.png.webp" alt="GreenTech Professionals" />
        </button>
        <button
          className="project-detail-back"
          ref={backButtonRef}
          type="button"
          onClick={onClose}
        >
          <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>Back to projects</span>
        </button>
      </header>

      <main>
        <section className="project-detail-hero">
          <img src={project.image} alt={project.alt} fetchPriority="high" />
          <div className="project-detail-hero-shade" aria-hidden="true" />
          <div className="project-detail-hero-content">
            <span>Project {String(project.order).padStart(2, "0")}</span>
            <h1 id="project-detail-title">{project.title}</h1>
            <p>{project.projectCategory}</p>
          </div>
        </section>

        <section className="project-detail-about" aria-labelledby="project-about-title">
          <div className="project-detail-about-copy">
            <span>Project overview</span>
            <h2 id="project-about-title">About the project</h2>
            <p>{project.about}</p>
            <p>{project.description}</p>
          </div>

          <dl className="project-detail-facts">
            <div>
              <dt>Project Date</dt>
              <dd>{project.projectDate}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{project.projectCategory}</dd>
            </div>
            <div>
              <dt>Project Location</dt>
              <dd>{project.location}</dd>
            </div>
            <div className="project-detail-capacity">
              <dt>Project Capacity</dt>
              <dd>
                <strong>{project.capacity ?? project.capacityNote}</strong>
                {project.capacityKw && <span>{project.capacityKw}</span>}
                {project.capacity && <small>{project.capacityNote}</small>}
              </dd>
            </div>
          </dl>
        </section>

        <section className="project-detail-scope" aria-labelledby="project-scope-title">
          <div className="project-detail-section-inner">
            <header className="project-detail-section-heading">
              <span>Technical scope</span>
              <h2 id="project-scope-title">What we installed</h2>
            </header>
            <div className="project-detail-scope-grid">
              {project.scope.map((item, index) => (
                <article key={item.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="project-detail-gallery" aria-labelledby="project-gallery-title">
          <div className="project-detail-section-inner">
            <header className="project-detail-section-heading">
              <span>On site</span>
              <h2 id="project-gallery-title">Project gallery</h2>
            </header>
            <div className={`project-detail-gallery-grid images-${project.gallery.length}`}>
              {project.gallery.map((image, index) => (
                <figure key={image.src}>
                  <img src={image.src} alt={image.alt} loading={index === 0 ? "eager" : "lazy"} />
                  <figcaption>{String(index + 1).padStart(2, "0")}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="project-detail-source">
          <div>
            <span>Verified project information</span>
            <p>
              Project metadata and photographs are based on GreenTech Professionals'
              official portfolio. Unpublished technical values are not estimated.
            </p>
          </div>
          <a href={project.sourceUrl} target="_blank" rel="noreferrer">
            <span>Official project page</span>
            <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </section>

        <footer className="project-detail-next">
          <span>Next project</span>
          <a
            href={`?project=${encodeURIComponent(nextProject.id)}`}
            onClick={handleNextProject}
          >
            <strong>{nextProject.title}</strong>
            <ArrowUpRight size={34} strokeWidth={1.5} aria-hidden="true" />
          </a>
        </footer>
      </main>
    </article>
  );
}

export default ProjectDetailPage;
