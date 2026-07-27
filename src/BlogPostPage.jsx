import React, { useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
} from "lucide-react";
import "./BlogPostPage.css";

function BlogPostPage({ post, onClose, onProjectOpen }) {
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

    document.title = `${post.title} | GreenTech Journal`;
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.title = previousTitle;
      window.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [onClose, post.id, post.title]);

  const action = post.primaryAction;

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
          aria-label="Return to the journal"
          onClick={onClose}
        >
          <img src="/original/logo-alb.png.webp" alt="GreenTech Professionals" />
        </button>
        <button
          className="blog-post-back"
          ref={backButtonRef}
          type="button"
          onClick={onClose}
        >
          <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>Back to journal</span>
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
          <p>{post.excerpt}</p>
        </header>

        <figure className="blog-post-hero">
          <img src={post.image} alt={post.alt} fetchPriority="high" />
        </figure>

        <section className="blog-post-article" aria-label="Article content">
          <aside>
            <span>Published in</span>
            <strong>{post.category}</strong>
            <span>Reading time</span>
            <strong>{post.readTime}</strong>
          </aside>

          <div className="blog-post-body">
            <p className="blog-post-lead">{post.intro}</p>
            {post.sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
        </section>

        <section className="blog-post-highlights" aria-label="Article highlights">
          {post.highlights.map((highlight) => (
            <div key={highlight.label}>
              <strong>{highlight.value}</strong>
              <span>{highlight.label}</span>
            </div>
          ))}
        </section>

        <section className="blog-post-action" aria-labelledby="blog-post-action-title">
          <div>
            <span>Continue exploring</span>
            <h2 id="blog-post-action-title">
              {action.type === "project"
                ? "See the work behind the story."
                : "Take the next step with GreenTech PRO."}
            </h2>
          </div>

          {action.type === "project" ? (
            <button type="button" onClick={() => onProjectOpen(post.relatedProjectId)}>
              <span>{action.label}</span>
              <ArrowRight size={19} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : (
            <a href={action.href} target="_blank" rel="noreferrer">
              <span>{action.label}</span>
              <ArrowUpRight size={19} strokeWidth={1.8} aria-hidden="true" />
            </a>
          )}
        </section>

        <footer className="blog-post-source">
          <span>Source</span>
          <a href={post.sourceUrl} target="_blank" rel="noreferrer">
            GreenTech Professionals official website
            <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </footer>
      </main>
    </article>
  );
}

export default BlogPostPage;
