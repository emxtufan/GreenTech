import React, { useEffect, useRef } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import useSection from "./hooks/useSection.js";
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
  const text = useSection("projects");
  const pageRef = useRef(null);
  const backButtonRef = useRef(null);
  const scopeDescription = text("scopeDescription", "");
  const galleryNote = text("galleryNote", "");

  useEffect(() => {
    const previousTitle = document.title;
    const focusFrame = window.requestAnimationFrame(() => {
      pageRef.current?.scrollTo({ top: 0 });
      backButtonRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.title = `${project.title} | Greentech Professionals`;
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.title = previousTitle;
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
      data-lenis-prevent
    >
      <header className="project-detail-nav">
        <button
          className="project-detail-brand"
          type="button"
          aria-label={text("returnProjectsLabel", "Inapoi la proiecte")}
          onClick={onClose}
        >
          <img src="/original/logo-alb.png.webp" alt="Greentech Professionals" />
        </button>
        <button
          className="project-detail-back"
          ref={backButtonRef}
          type="button"
          onClick={onClose}
        >
          <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>{text("returnProjectsLabel", "Inapoi la proiecte")}</span>
        </button>
      </header>

      <main>
        <section className="project-detail-hero">
          <img src={project.image} alt={project.alt} fetchPriority="high" />
          <div className="project-detail-hero-shade" aria-hidden="true" />
          <div className="project-detail-hero-content">
            <span>{text("projectLabel", "Proiect")} {String(project.order).padStart(2, "0")}</span>
            <h1 id="project-detail-title">{project.title}</h1>
            <p>{project.projectCategory}</p>
          </div>
        </section>

        <section className="project-detail-about" aria-labelledby="project-about-title">
          <div className="project-detail-about-copy">
            <span>{text("overviewEyebrow", "Prezentarea proiectului")}</span>
            <h2 id="project-about-title">{text("aboutTitle", "Despre proiect")}</h2>
            <p>{project.about}</p>
            <p>{project.description}</p>
          </div>

          <dl className="project-detail-facts">
            <div>
              <dt>{text("projectDateLabel", "Data proiectului")}</dt>
              <dd>{project.projectDate}</dd>
            </div>
            {project.projectStatus && (
              <div>
                <dt>{text("statusLabel", "Status")}</dt>
                <dd>{project.projectStatus}</dd>
              </div>
            )}
            <div>
              <dt>{text("categoryLabel", "Categorie")}</dt>
              <dd>{project.projectCategory}</dd>
            </div>
            <div>
              <dt>{text("projectLocationLabel", "Locatia proiectului")}</dt>
              <dd>{project.location}</dd>
            </div>
            {project.client && (
              <div>
                <dt>{text("clientLabel", "Client")}</dt>
                <dd>{project.client}</dd>
              </div>
            )}
            {project.projectManager && (
              <div>
                <dt>{text("projectManagerLabel", "Coordonator proiect")}</dt>
                <dd>{project.projectManager}</dd>
              </div>
            )}
            <div className="project-detail-capacity">
              <dt>{text("projectCapacityLabel", "Capacitatea proiectului")}</dt>
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
              <span>{text("scopeEyebrow", "Lucrari executate")}</span>
              <h2 id="project-scope-title">{text("scopeTitle", "Ce am instalat")}</h2>
              {scopeDescription && (
                <p className="project-detail-section-intro">{scopeDescription}</p>
              )}
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
              <span>{text("galleryEyebrow", "Din santier")}</span>
              <h2 id="project-gallery-title">{text("projectGalleryTitle", "Galeria proiectului")}</h2>
              {galleryNote && (
                <p className="project-detail-section-intro">{galleryNote}</p>
              )}
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
            <span>{text("sourceEyebrow", "Informatii despre proiect")}</span>
            <p>{text("sourceDescription")}</p>
          </div>
        </section>

        <footer className="project-detail-next">
          <span>{text("nextProjectLabel", "Proiectul urmator")}</span>
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
