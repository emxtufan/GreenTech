import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { selectBlogPosts } from "./lib/siteContent.js";
import useSection from "./hooks/useSection.js";
import "./BlogSection.css";

// Baseline list for first paint; the live document arrives via useSiteContent.
export const blogPosts = selectBlogPosts();

function PostMeta({ post }) {
  return (
    <div className="blog-post-meta">
      <span>{post.category}</span>
      <span>
        <CalendarDays size={14} strokeWidth={1.7} aria-hidden="true" />
        {post.date ? (
          <time dateTime={post.date}>{post.dateLabel}</time>
        ) : (
          post.dateLabel
        )}
      </span>
      <span>
        <Clock3 size={14} strokeWidth={1.7} aria-hidden="true" />
        {post.readTime}
      </span>
    </div>
  );
}

function BlogSection({ active, onPostOpen }) {
  const text = useSection("blog");
  const sectionRef = useRef(null);
  const [inView, setInView] = useState(false);
  const featuredPost = useMemo(
    () => blogPosts.find((post) => post.featured) ?? blogPosts[0],
    [],
  );
  const secondaryPosts = useMemo(
    () => blogPosts.filter((post) => post.id !== featuredPost.id),
    [featuredPost.id],
  );

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
            <h2 id="blog-section-title">
              {text("title", "Field notes, team news and opportunities.")}
            </h2>
            <p>
              {text(
                "description",
                "Project updates, technical stories, company news and careers in one dedicated editorial space.",
              )}
            </p>
          </div>
        </header>

        <div className="blog-editorial-layout">
          <article className="blog-feature blog-reveal">
            <figure>
              <img
                src={featuredPost.image}
                alt={featuredPost.alt}
                loading="lazy"
                decoding="async"
              />
            </figure>
            <div className="blog-feature-copy">
              <PostMeta post={featuredPost} />
              <h3>{featuredPost.title}</h3>
              <p>{featuredPost.excerpt}</p>
              <button type="button" onClick={() => onPostOpen(featuredPost.id)}>
                <span>Read story</span>
                <ArrowRight size={19} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          </article>

          <div className="blog-story-list" aria-label="More journal stories">
            {secondaryPosts.map((post, index) => (
              <article
                className="blog-story blog-reveal"
                key={post.id}
                style={{ "--blog-story-index": index }}
              >
                <figure>
                  <img src={post.image} alt={post.alt} loading="lazy" decoding="async" />
                </figure>
                <div>
                  <PostMeta post={post} />
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                  <button type="button" onClick={() => onPostOpen(post.id)}>
                    <span>Read story</span>
                    <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default BlogSection;
