import React, { useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
} from "lucide-react";
import useSection from "./hooks/useSection.js";
import "./BlogPostPage.css";

function BlogPostPage({ post, onClose, onProjectOpen }) {
  const text = useSection("blog");
  const pageRef = useRef(null);
  const backButtonRef = useRef(null);
  const sections = (Array.isArray(post.sections) ? post.sections : [])
    .filter((section) => section && typeof section === "object")
    .map((section) => ({
      ...section,
      paragraphs: Array.isArray(section.paragraphs)
        ? section.paragraphs.filter((paragraph) => typeof paragraph === "string" && paragraph.trim())
        : [],
    }))
    .filter((section) => section.title || section.paragraphs.length > 0);
  const highlights = (Array.isArray(post.highlights) ? post.highlights : [])
    .filter((highlight) => (
      highlight
      && typeof highlight === "object"
      && (highlight.value || highlight.label)
    ));
  const action = post.primaryAction && typeof post.primaryAction === "object"
    ? post.primaryAction
    : null;
  const hasProjectAction = Boolean(
    post.relatedProjectId
    && onProjectOpen,
  );
  const hasLinkAction = Boolean(
    !hasProjectAction
    && action?.type !== "project"
    && action?.label
    && action.href,
  );
  const hasAction = hasProjectAction || hasLinkAction;
  const actionLabel = hasProjectAction
    ? (action?.type === "project" && action.label
      ? action.label
      : text("relatedProjectFallback", "Vezi proiectul asociat"))
    : action?.label;
  const actionIsExternal = /^https?:\/\//i.test(String(action?.href || ""));
  const lead = post.intro || post.excerpt;

  useEffect(() => {
    const previousTitle = document.title;
    const focusFrame = window.requestAnimationFrame(() => {
      pageRef.current?.scrollTo({ top: 0 });
      backButtonRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.title = `${post.title} | Jurnal Greentech`;
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.title = previousTitle;
      window.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [onClose, post.id, post.title]);

  return (
    <article
      className="blog-post-page"
      ref={pageRef}
      aria-labelledby="blog-post-title"
      data-lenis-prevent
    >
      <header className="blog-post-nav">
        <button
          className="blog-post-brand"
          type="button"
          aria-label={text("returnJournalLabel", "Inapoi la jurnal")}
          onClick={onClose}
        >
          <img src="/original/logo-alb.png.webp" alt="Greentech Professionals" />
        </button>
        <button
          className="blog-post-back"
          ref={backButtonRef}
          type="button"
          onClick={onClose}
        >
          <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>{text("returnJournalLabel", "Inapoi la jurnal")}</span>
        </button>
      </header>

      <main>
        <header className="blog-post-heading">
          <div className="blog-post-heading-meta">
            <span>{post.category}</span>
            <span>
              <CalendarDays size={15} strokeWidth={1.7} aria-hidden="true" />
              {post.date ? (
                <time dateTime={post.date}>{post.dateLabel}</time>
              ) : (
                post.dateLabel
              )}
            </span>
            <span>
              <Clock3 size={15} strokeWidth={1.7} aria-hidden="true" />
              {post.readTime}
            </span>
          </div>
          <h1 id="blog-post-title">{post.title}</h1>
          {post.excerpt && <p>{post.excerpt}</p>}
        </header>

        {post.image && (
          <figure className="blog-post-hero">
            <img src={post.image} alt={post.alt || ""} fetchPriority="high" />
          </figure>
        )}

        <section
          className="blog-post-article"
          aria-label={text("articleContentLabel", "Continutul articolului")}
        >
          <aside>
            <span>{text("publishedInLabel", "Publicat in")}</span>
            <strong>{post.category}</strong>
            <span>{text("readingTimeLabel", "Timp de citire")}</span>
            <strong>{post.readTime}</strong>
          </aside>

          <div className="blog-post-body">
            {lead && <p className="blog-post-lead">{lead}</p>}
            {sections.map((section, sectionIndex) => (
              <section key={section.id || `${section.title || "section"}-${sectionIndex}`}>
                {section.title && <h2>{section.title}</h2>}
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={`${paragraph}-${paragraphIndex}`}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
        </section>

        {highlights.length > 0 && (
          <section
            className="blog-post-highlights"
            aria-label={text("highlightsLabel", "Idei principale")}
          >
            {highlights.map((highlight, index) => (
              <div key={highlight.id || `${highlight.label || "highlight"}-${index}`}>
                {highlight.value && <strong>{highlight.value}</strong>}
                {highlight.label && <span>{highlight.label}</span>}
              </div>
            ))}
          </section>
        )}

        {hasAction && (
          <section className="blog-post-action" aria-labelledby="blog-post-action-title">
            <div>
              <span>{text("continueLabel", "Continuati explorarea")}</span>
              <h2 id="blog-post-action-title">
                {hasProjectAction
                  ? text("relatedProjectHeading", "Vedeti proiectul din spatele articolului.")
                  : text("externalActionHeading", "Aflati mai multe despre Greentech Professionals.")}
              </h2>
            </div>

            {hasProjectAction ? (
              <button type="button" onClick={() => onProjectOpen(post.relatedProjectId)}>
                <span>{actionLabel}</span>
                <ArrowRight size={19} strokeWidth={1.8} aria-hidden="true" />
              </button>
            ) : (
              <a
                href={action.href}
                {...(actionIsExternal ? { target: "_blank", rel: "noreferrer" } : null)}
              >
                <span>{action.label}</span>
                <ArrowUpRight size={19} strokeWidth={1.8} aria-hidden="true" />
              </a>
            )}
          </section>
        )}

        {post.sourceUrl && (
          <footer className="blog-post-source">
            <span>{text("sourceLabel", "Sursa")}</span>
            <a href={post.sourceUrl} target="_blank" rel="noreferrer">
              {text("officialSiteLabel", "Site-ul oficial Greentech Professionals")}
              <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </footer>
        )}
      </main>
    </article>
  );
}

export default BlogPostPage;
