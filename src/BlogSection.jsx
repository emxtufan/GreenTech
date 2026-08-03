import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BookOpenText,
  CalendarDays,
  Clock3,
  X,
} from "lucide-react";
import { selectBlogPosts } from "./lib/siteContent.js";
import BlurText from "./BlurText.jsx";
import SectionActionModal, { useSectionAction } from "./SectionAction.jsx";
import useSiteContent from "./hooks/useSiteContent.js";
import useSection from "./hooks/useSection.js";
import "./BlogSection.css";

const HOMEPAGE_POST_LIMIT = 4;

function PostMeta({ post }) {
  return (
    <div className="blog-post-meta">
      {post.category && <span className="blog-post-category">{post.category}</span>}
      {(post.date || post.dateLabel) && (
        <span>
          <CalendarDays size={14} strokeWidth={1.7} aria-hidden="true" />
          {post.date ? (
            <time dateTime={post.date}>{post.dateLabel || post.date}</time>
          ) : (
            post.dateLabel
          )}
        </span>
      )}
      {post.readTime && (
        <span>
          <Clock3 size={14} strokeWidth={1.7} aria-hidden="true" />
          {post.readTime}
        </span>
      )}
    </div>
  );
}

function PostImage({ post }) {
  if (!post.image) {
    return (
      <span className="blog-image-placeholder" aria-hidden="true">
        <BookOpenText size={28} strokeWidth={1.4} />
      </span>
    );
  }

  return (
    <img
      src={post.image}
      alt={post.alt || ""}
      loading="lazy"
      decoding="async"
    />
  );
}

function BlogArchiveModal({ open, posts, onClose, onPostOpen, triggerRef }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousActive = document.activeElement;
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.paddingRight = previousBodyPaddingRight;
      (triggerRef.current || previousActive)?.focus?.({ preventScroll: true });
    };
  }, [onClose, open, triggerRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="blog-archive-overlay"
      data-lenis-prevent
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className="blog-archive-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="blog-archive-title"
        tabIndex={-1}
      >
        <header className="blog-archive-header">
          <div>
            <span>Field Journal</span>
            <h2 id="blog-archive-title">All stories</h2>
            <p>{posts.length} published {posts.length === 1 ? "article" : "articles"}.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close all articles"
            title="Close"
            onClick={onClose}
          >
            <X size={20} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </header>

        <div className="blog-archive-list" role="list">
          {posts.map((post, index) => (
            <article className="blog-archive-item" role="listitem" key={post.id}>
              <button type="button" onClick={() => onPostOpen(post.id)}>
                <span className="blog-archive-image">
                  <PostImage post={post} />
                </span>
                <span className="blog-archive-copy">
                  <span className="blog-archive-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="blog-archive-category">{post.category || "Journal"}</span>
                  <strong>{post.title}</strong>
                  <span className="blog-archive-details">
                    {(post.date || post.dateLabel) && (
                      <span>
                        <CalendarDays size={14} strokeWidth={1.7} aria-hidden="true" />
                        {post.dateLabel || post.date}
                      </span>
                    )}
                    {post.readTime && (
                      <span>
                        <Clock3 size={14} strokeWidth={1.7} aria-hidden="true" />
                        {post.readTime}
                      </span>
                    )}
                  </span>
                </span>
                <span className="blog-archive-open" aria-hidden="true">
                  <span>Read</span>
                  <ArrowRight className="blog-archive-arrow" size={20} strokeWidth={1.8} />
                </span>
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function BlogSection({ active, onPostOpen }) {
  const content = useSiteContent();
  const text = useSection("blog");
  const storyAction = useSectionAction("blog", {
    label: "Read story",
    mode: "builtin",
  });
  const sectionRef = useRef(null);
  const archiveTriggerRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const posts = useMemo(() => selectBlogPosts(content), [content]);
  const homepagePosts = posts.slice(0, HOMEPAGE_POST_LIMIT);
  const featuredPost = homepagePosts[0] ?? null;
  const secondaryPosts = homepagePosts.slice(1);

  const closeArchive = useCallback(() => setArchiveOpen(false), []);
  const openArchivePost = useCallback((postId) => {
    setArchiveOpen(false);
    onPostOpen(postId);
  }, [onPostOpen]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!active || !section) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10%", threshold: 0.08 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [active]);

  return (
    <>
      <section
        ref={sectionRef}
        id="journal"
        className={`blog-section ${active ? "is-active" : ""} ${inView ? "is-in-view" : ""}`}
        aria-labelledby="blog-section-title"
      >
        <div className="blog-section-inner">
          <header className="blog-section-header blog-reveal">
            <span>{text("eyebrow", "The GreenTech Journal")}</span>
            <div>
              <BlurText
                as="h2"
                id="blog-section-title"
                text={text("title", "Field notes, team news and opportunities.")}
                play={active}
                animateBy="letters"
                direction="top"
                delay={55}
                stepDuration={0.45}
              />
              <p>
                {text(
                  "description",
                  "Project updates, technical stories, company news and careers in one dedicated editorial space.",
                )}
              </p>
            </div>
          </header>

          {featuredPost ? (
            <div className="blog-editorial-layout">
              <article className="blog-feature blog-reveal">
                <figure>
                  <PostImage post={featuredPost} />
                </figure>
                <div className="blog-feature-copy">
                  <PostMeta post={featuredPost} />
                  <h3>{featuredPost.title}</h3>
                  {featuredPost.excerpt && <p>{featuredPost.excerpt}</p>}
                  {storyAction.visible && (
                    <button
                      type="button"
                      onClick={(event) => storyAction.activate(
                        event,
                        () => onPostOpen(featuredPost.id),
                      )}
                    >
                      <span>{storyAction.label}</span>
                      <ArrowRight size={19} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>

              {secondaryPosts.length > 0 && (
                <div className="blog-story-list" aria-label="More journal stories">
                  {secondaryPosts.map((post, index) => (
                    <article
                      className="blog-story blog-reveal"
                      key={post.id}
                      style={{ "--blog-story-index": index }}
                    >
                      <figure>
                        <PostImage post={post} />
                      </figure>
                      <div>
                        <PostMeta post={post} />
                        <h3>{post.title}</h3>
                        {post.excerpt && <p>{post.excerpt}</p>}
                        {storyAction.visible && (
                          <button
                            type="button"
                            onClick={(event) => storyAction.activate(
                              event,
                              () => onPostOpen(post.id),
                            )}
                          >
                            <span>{storyAction.label}</span>
                            <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="blog-empty blog-reveal">
              <BookOpenText size={24} strokeWidth={1.5} aria-hidden="true" />
              <strong>No published stories yet.</strong>
            </div>
          )}

          {posts.length > 0 && (
            <div className="blog-archive-cta blog-reveal">
              <div>
                <span>Journal archive</span>
                <strong>
                  Showing {homepagePosts.length} of {posts.length} published {posts.length === 1 ? "story" : "stories"}
                </strong>
              </div>
              <button
                ref={archiveTriggerRef}
                type="button"
                onClick={() => setArchiveOpen(true)}
              >
                <span>Show all articles</span>
                <span className="blog-archive-count">{String(posts.length).padStart(2, "0")}</span>
                <ArrowRight size={19} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        <SectionActionModal {...storyAction.modalProps} />
      </section>

      <BlogArchiveModal
        open={archiveOpen}
        posts={posts}
        triggerRef={archiveTriggerRef}
        onClose={closeArchive}
        onPostOpen={openArchivePost}
      />
    </>
  );
}

export default BlogSection;
