import React, { useEffect, useRef } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import useSection from "./hooks/useSection.js";
import "./AllProjectsPage.css";

function shouldHandleNavigation(event) {
  return (
    event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
  );
}

function AllProjectsPage({ projects, onClose, onProjectOpen }) {
  const text = useSection("projects");
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

    document.title = `${text("allProjectsTitle", "Proiectele nostre")} | Greentech Professionals`;
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.title = previousTitle;
      window.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [onClose, text]);

  const handleProjectLink = (event, projectId) => {
    if (!shouldHandleNavigation(event)) return;
    event.preventDefault();
    onProjectOpen(projectId);
  };

  return (
    <article
      className="projects-index-page"
      ref={pageRef}
      aria-labelledby="projects-index-title"
      data-lenis-prevent
    >
      <header className="projects-index-nav">
        <button
          className="projects-index-brand"
          type="button"
          aria-label={text("backPortfolioLabel", "Inapoi la portofoliu")}
          onClick={onClose}
        >
          <img src="/original/logo-alb.png.webp" alt="Greentech Professionals" />
        </button>
        <button
          className="projects-index-back"
          ref={backButtonRef}
          type="button"
          onClick={onClose}
        >
          <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>{text("backPortfolioLabel", "Inapoi la portofoliu")}</span>
        </button>
      </header>

      <main>
        <header className="projects-index-intro">
          <div>
            <span>{text("portfolioLabel", "Portofoliu")} / {String(projects.length).padStart(2, "0")}</span>
            <h1 id="projects-index-title">{text("allProjectsTitle", "Proiectele nostre")}</h1>
          </div>
          <p>{text("allProjectsDescription")}</p>
        </header>

        <section
          className="projects-index-grid"
          aria-label={text("projectPortfolioLabel", "Portofoliu proiecte")}
        >
          {projects.map((project, index) => (
            <a
              className="projects-index-card"
              href={`?project=${encodeURIComponent(project.id)}`}
              key={project.id}
              onClick={(event) => handleProjectLink(event, project.id)}
              aria-label={`${text("viewProjectLabel", "Vezi proiectul")}: ${project.title}`}
            >
              <figure>
                <img
                  src={project.image}
                  alt={project.alt}
                  loading={index < 3 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                />
                <span aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </figure>

              <div className="projects-index-card-copy">
                <span>{project.category}</span>
                <h2>{project.title}</h2>
                <dl>
                  <div>
                    <dt>{text("locationLabel", "Locatie")}</dt>
                    <dd>{project.location}</dd>
                  </div>
                  <div>
                    <dt>{text("dateLabel", "Data")}</dt>
                    <dd>{project.projectDate}</dd>
                  </div>
                  <div>
                    <dt>{text("capacityLabel", "Capacitate")}</dt>
                    <dd>{project.capacity ?? project.capacityNote}</dd>
                  </div>
                </dl>
                <i aria-hidden="true">
                  <ArrowUpRight size={20} strokeWidth={1.7} />
                </i>
              </div>
            </a>
          ))}
        </section>
      </main>
    </article>
  );
}

export default AllProjectsPage;
