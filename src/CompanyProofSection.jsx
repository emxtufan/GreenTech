import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe2,
  MessageSquarePlus,
  Quote,
  ShieldCheck,
  Star,
  Users,
  X,
} from "lucide-react";
import {
  selectCredentials,
  selectQualityPoints,
  selectTestimonials,
} from "./lib/siteContent.js";
import useSiteContent from "./hooks/useSiteContent.js";
import useSection from "./hooks/useSection.js";
import "./CompanyProofSection.css";

const CompanyFootprintMap = lazy(() => import("./CompanyFootprintMap.jsx"));

// Icons cannot live in JSON, so content stores a name and this map resolves it.
const credentialIcons = { Award, ShieldCheck, Users, Globe2 };

const TESTIMONIAL_ROTATION_MS = 7000;
const REVIEW_STORAGE_KEY = "greentech-customer-reviews";
const MAX_SAVED_REVIEWS = 20;
const EMPTY_REVIEW = {
  name: "",
  quote: "",
  rating: 0,
  consent: false,
};

function getReviewInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function loadSavedReviews() {
  if (typeof window === "undefined") return [];

  try {
    const savedReviews = JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY) || "[]");
    if (!Array.isArray(savedReviews)) return [];

    return savedReviews
      .filter((review) => (
        typeof review?.author === "string"
        && typeof review?.quote === "string"
        && Number.isFinite(Number(review?.rating))
      ))
      .slice(-MAX_SAVED_REVIEWS)
      .map((review, index) => ({
        id: String(review.id || `saved-review-${index}`),
        author: review.author.trim().slice(0, 60),
        role: "Community review",
        quote: review.quote.trim().slice(0, 420),
        rating: Math.min(5, Math.max(1, Math.round(Number(review.rating)))),
        avatarText: getReviewInitials(review.author),
        verified: false,
      }));
  } catch {
    return [];
  }
}

function CompanyProofSection({ active }) {
  const content = useSiteContent();
  const credentials = selectCredentials(content);
  const qualityPoints = selectQualityPoints(content);
  const testimonials = selectTestimonials(content);
  const credentialsText = useSection("credentials");
  const footprintText = useSection("footprint-map");
  const qualityText = useSection("quality");
  const reviewsText = useSection("reviews");
  const sectionRef = useRef(null);
  const testimonialRef = useRef(null);
  const swipeStartRef = useRef(null);
  const reviewTriggerRef = useRef(null);
  const reviewDialogRef = useRef(null);
  const reviewNameRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [testimonialInView, setTestimonialInView] = useState(false);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [testimonialPaused, setTestimonialPaused] = useState(false);
  const [savedReviews, setSavedReviews] = useState(loadSavedReviews);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewForm, setReviewForm] = useState(EMPTY_REVIEW);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewError, setReviewError] = useState("");
  const carouselTestimonials = [...testimonials, ...savedReviews];
  const carouselPaused = testimonialPaused || reviewOpen;

  useEffect(() => {
    const section = sectionRef.current;
    if (!active || !section) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12%", threshold: 0.08 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    const carousel = testimonialRef.current;
    if (!active || !carousel) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setTestimonialInView(entry.isIntersecting),
      { rootMargin: "-12% 0px", threshold: 0.22 },
    );

    observer.observe(carousel);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    if (!active || !inView || !testimonialInView || carouselPaused) {
      return undefined;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return undefined;

    const timer = window.setInterval(() => {
      setTestimonialIndex((current) => (current + 1) % carouselTestimonials.length);
    }, TESTIMONIAL_ROTATION_MS);

    return () => window.clearInterval(timer);
  }, [active, carouselPaused, carouselTestimonials.length, inView, testimonialInView, testimonialIndex]);

  useEffect(() => {
    if (!reviewOpen) return undefined;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    const focusFrame = window.requestAnimationFrame(() => {
      reviewNameRef.current?.focus();
    });

    const handleDialogKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setReviewOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = reviewDialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleDialogKeyDown);
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.paddingRight = previousBodyPaddingRight;
      reviewTriggerRef.current?.focus({ preventScroll: true });
    };
  }, [reviewOpen]);

  const showPreviousTestimonial = () => {
    setTestimonialIndex((current) => (
      (current - 1 + carouselTestimonials.length) % carouselTestimonials.length
    ));
  };

  const showNextTestimonial = () => {
    setTestimonialIndex((current) => (current + 1) % carouselTestimonials.length);
  };

  const openReviewDialog = () => {
    setReviewForm({ ...EMPTY_REVIEW });
    setHoveredRating(0);
    setReviewError("");
    setReviewSubmitted(false);
    setReviewOpen(true);
  };

  const closeReviewDialog = () => {
    setReviewOpen(false);
  };

  const updateReviewField = (field, value) => {
    setReviewForm((current) => ({ ...current, [field]: value }));
    if (reviewError) setReviewError("");
  };

  const submitReview = (event) => {
    event.preventDefault();

    const author = reviewForm.name.trim();
    const quote = reviewForm.quote.trim();

    if (author.length < 2) {
      setReviewError("Please enter your name.");
      reviewNameRef.current?.focus();
      return;
    }

    if (reviewForm.rating < 1) {
      setReviewError("Please select a star rating.");
      return;
    }

    if (quote.length < 10) {
      setReviewError("Please write at least 10 characters about your experience.");
      return;
    }

    if (!reviewForm.consent) {
      setReviewError("Please confirm that your review may be displayed publicly.");
      return;
    }

    const newReview = {
      id: globalThis.crypto?.randomUUID?.() || `review-${Date.now()}`,
      author,
      role: "Community review",
      quote,
      rating: reviewForm.rating,
      avatarText: getReviewInitials(author),
      verified: false,
    };
    const nextSavedReviews = [...savedReviews, newReview].slice(-MAX_SAVED_REVIEWS);

    setSavedReviews(nextSavedReviews);
    setTestimonialIndex(testimonials.length + nextSavedReviews.length - 1);
    setReviewSubmitted(true);

    try {
      window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(nextSavedReviews));
    } catch {
      // The submitted review still remains available for the current session.
    }
  };

  const handleTouchStart = (event) => {
    swipeStartRef.current = event.changedTouches[0]?.clientX ?? null;
    setTestimonialPaused(true);
  };

  const handleTouchEnd = (event) => {
    const startX = swipeStartRef.current;
    const endX = event.changedTouches[0]?.clientX;
    swipeStartRef.current = null;
    setTestimonialPaused(false);

    if (startX === null || endX === undefined || Math.abs(endX - startX) < 44) {
      return;
    }

    if (endX < startX) showNextTestimonial();
    else showPreviousTestimonial();
  };

  return (
    <>
      <section
      ref={sectionRef}
      className={`company-proof-section ${active ? "is-active" : ""} ${inView ? "is-in-view" : ""}`}
      aria-labelledby="company-proof-title"
    >
      <div className="company-proof-inner">
        <header className="company-proof-header proof-reveal">
          <span>{credentialsText("eyebrow", "Trust & certifications")}</span>
          <div>
            <h2 id="company-proof-title">
              {credentialsText("title", "Built for accountable field delivery.")}
            </h2>
            <p>
              {credentialsText(
                "description",
                "Technical capability, qualified teams and a growing European footprint behind every stage of execution.",
              )}
            </p>
          </div>
          <a
            href="https://greentechpro.ro/faqs/"
            target="_blank"
            rel="noreferrer"
          >
            <span>Review credentials</span>
            <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </header>

        <div className="company-proof-credentials proof-reveal">
          {credentials.map(({ id, value, label, detail, icon }) => {
            const Icon = credentialIcons[icon] ?? Award;

            return (
              <article className="company-proof-credential" key={id ?? label}>
                <Icon size={23} strokeWidth={1.6} aria-hidden="true" />
                <strong>{value}</strong>
                <h3>{label}</h3>
                <p>{detail}</p>
              </article>
            );
          })}
        </div>

        <section className="company-footprint proof-reveal" aria-labelledby="footprint-title">
          <header>
            <span>{footprintText("eyebrow", "European footprint")}</span>
            <h2 id="footprint-title">{footprintText("title", "Teams close to the work.")}</h2>
            <p>
              {footprintText(
                "description",
                "Published projects and field updates connect GreenTech Professionals across Romania, Italy and Spain.",
              )}
            </p>
          </header>

          <Suspense
            fallback={
              <div
                className="company-footprint-map company-footprint-map-loading"
                role="status"
              >
                <span>Loading European project map</span>
              </div>
            }
          >
            <CompanyFootprintMap />
          </Suspense>
        </section>

        <section className="company-quality proof-reveal" aria-labelledby="quality-title">
          <figure className="company-quality-media">
            <img
              src="/gallery/solar-safety.webp"
              alt="Protective equipment positioned on photovoltaic panels"
              loading="lazy"
              decoding="async"
            />
            <figcaption>Safety is designed into the work.</figcaption>
          </figure>

          <div className="company-quality-copy">
            <span>{qualityText("eyebrow", "Safety & quality")}</span>
            <h2 id="quality-title">
              {qualityText("title", "Control from planning to handover.")}
            </h2>
            <p>
              Reliable delivery depends on disciplined field execution, qualified
              personnel and checks that continue beyond installation.
            </p>
            <ul>
              {qualityPoints.map((point) => (
                <li key={point.id}>
                  <CheckCircle2 size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span>{point.text}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://greentechpro.ro/services/"
              target="_blank"
              rel="noreferrer"
            >
              <span>Explore our capabilities</span>
              <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section
          ref={testimonialRef}
          className={`company-testimonial-carousel proof-reveal ${testimonialInView ? "is-running" : ""} ${carouselPaused ? "is-paused" : ""}`}
          aria-label="Customer testimonials"
          aria-roledescription="carousel"
          onPointerEnter={() => setTestimonialPaused(true)}
          onPointerLeave={() => setTestimonialPaused(false)}
          onFocusCapture={() => setTestimonialPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setTestimonialPaused(false);
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            swipeStartRef.current = null;
            setTestimonialPaused(false);
          }}
        >
          <div className="company-testimonial-toolbar">
            <span>{reviewsText("eyebrow", "Customer reviews")}</span>
            <button
              ref={reviewTriggerRef}
              className="company-review-trigger"
              type="button"
              onClick={openReviewDialog}
            >
              <MessageSquarePlus size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>Create a review</span>
            </button>
          </div>

          <div
            className="company-testimonial-stage"
            aria-live={carouselPaused ? "polite" : "off"}
          >
            {carouselTestimonials.map((testimonial, index) => {
              const selected = index === testimonialIndex;

              return (
                <figure
                  className={`company-testimonial ${selected ? "is-active" : ""}`}
                  key={testimonial.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${testimonials.length}`}
                  aria-hidden={!selected}
                >
                  <Quote size={34} strokeWidth={1.35} aria-hidden="true" />
                  <blockquote>&ldquo;{testimonial.quote}&rdquo;</blockquote>
                  <figcaption>
                    <span
                      className="company-testimonial-avatar"
                      style={{ "--testimonial-avatar-position": testimonial.imagePosition }}
                      aria-hidden="true"
                    >
                      {testimonial.image ? (
                        <img src={testimonial.image} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span>{testimonial.avatarText}</span>
                      )}
                    </span>
                    <span
                      className="company-testimonial-rating"
                      aria-label={`${testimonial.rating} out of 5 stars`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          className={star <= testimonial.rating ? "is-filled" : ""}
                          key={star}
                          size={16}
                          strokeWidth={1.7}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                    <strong>
                      {testimonial.author}
                      {testimonial.verified && (
                        <CheckCircle2 size={15} strokeWidth={1.8} aria-hidden="true" />
                      )}
                    </strong>
                    <span>{testimonial.role}</span>
                    {testimonial.source && (
                      <a
                        href={testimonial.source}
                        target="_blank"
                        rel="noreferrer"
                        tabIndex={selected ? 0 : -1}
                        aria-label={`Read ${testimonial.author} testimonial source`}
                      >
                        Original source
                        <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
                      </a>
                    )}
                  </figcaption>
                </figure>
              );
            })}
          </div>

          <div className="company-testimonial-controls">
            <span className="company-testimonial-count" aria-hidden="true">
              {String(testimonialIndex + 1).padStart(2, "0")} / {String(carouselTestimonials.length).padStart(2, "0")}
            </span>

            <div className="company-testimonial-dots" role="group" aria-label="Choose testimonial">
              {carouselTestimonials.map((testimonial, index) => (
                <button
                  className={index === testimonialIndex ? "is-active" : ""}
                  type="button"
                  key={testimonial.id}
                  aria-label={`Show testimonial ${index + 1}`}
                  aria-current={index === testimonialIndex ? "true" : undefined}
                  onClick={() => setTestimonialIndex(index)}
                >
                  <span />
                </button>
              ))}
            </div>

            <div className="company-testimonial-arrows">
              <button
                type="button"
                aria-label="Previous testimonial"
                title="Previous testimonial"
                onClick={showPreviousTestimonial}
              >
                <ChevronLeft size={20} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Next testimonial"
                title="Next testimonial"
                onClick={showNextTestimonial}
              >
                <ChevronRight size={20} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </div>
      </section>

      {reviewOpen && createPortal(
        <div
          className="company-review-overlay"
          data-lenis-prevent
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeReviewDialog();
          }}
        >
          <section
            ref={reviewDialogRef}
            className="company-review-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="company-review-title"
          >
            <button
              className="company-review-close"
              type="button"
              aria-label="Close review form"
              title="Close"
              onClick={closeReviewDialog}
            >
              <X size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>

            {reviewSubmitted ? (
              <div className="company-review-success" role="status">
                <span>
                  <CheckCircle2 size={27} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <p>Review received</p>
                <h2 id="company-review-title">Thank you for sharing your experience.</h2>
                <button type="button" onClick={closeReviewDialog}>Done</button>
              </div>
            ) : (
              <>
                <header className="company-review-header">
                  <span>Customer feedback</span>
                  <h2 id="company-review-title">Create a review</h2>
                </header>

                <form className="company-review-form" onSubmit={submitReview} noValidate>
                  <label className="company-review-field">
                    <span>Your name</span>
                    <input
                      ref={reviewNameRef}
                      type="text"
                      name="reviewer-name"
                      value={reviewForm.name}
                      maxLength={60}
                      autoComplete="name"
                      placeholder="Full name"
                      onChange={(event) => updateReviewField("name", event.target.value)}
                    />
                  </label>

                  <fieldset className="company-review-rating-field">
                    <legend>Your rating</legend>
                    <div className="company-review-rating-picker" onPointerLeave={() => setHoveredRating(0)}>
                      <div role="radiogroup" aria-label="Choose a rating from 1 to 5 stars">
                        {[1, 2, 3, 4, 5].map((rating) => {
                          const filled = rating <= (hoveredRating || reviewForm.rating);

                          return (
                            <label
                              className={filled ? "is-filled" : ""}
                              key={rating}
                              onPointerEnter={() => setHoveredRating(rating)}
                            >
                              <input
                                type="radio"
                                name="review-rating"
                                value={rating}
                                checked={reviewForm.rating === rating}
                                onChange={() => updateReviewField("rating", rating)}
                              />
                              <Star size={27} strokeWidth={1.55} aria-hidden="true" />
                              <span className="company-review-sr-only">{rating} stars</span>
                            </label>
                          );
                        })}
                      </div>
                      <output>{reviewForm.rating ? `${reviewForm.rating}.0` : "Select"}</output>
                    </div>
                  </fieldset>

                  <label className="company-review-field">
                    <span>Your review</span>
                    <textarea
                      name="review-message"
                      value={reviewForm.quote}
                      minLength={10}
                      maxLength={420}
                      rows={5}
                      placeholder="Tell us about your experience"
                      onChange={(event) => updateReviewField("quote", event.target.value)}
                    />
                    <small>{reviewForm.quote.length} / 420</small>
                  </label>

                  <label className="company-review-consent">
                    <input
                      type="checkbox"
                      checked={reviewForm.consent}
                      onChange={(event) => updateReviewField("consent", event.target.checked)}
                    />
                    <span>I agree that my name and review may be displayed publicly.</span>
                  </label>

                  <p className={`company-review-error ${reviewError ? "is-visible" : ""}`} role="alert">
                    {reviewError}
                  </p>

                  <button className="company-review-submit" type="submit">
                    <span>Submit review</span>
                    <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </form>
              </>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

export default CompanyProofSection;
