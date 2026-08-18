import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Loader2,
  MessageSquarePlus,
  Quote,
  ShieldCheck,
  Star,
  Users,
  X,
} from "lucide-react";
import {
  selectCredentials,
  selectFootprintCountries,
  selectQualityPoints,
  selectTestimonials,
} from "./lib/siteContent.js";
import BlurText from "./BlurText.jsx";
import SectionActionModal, { useSectionAction } from "./SectionAction.jsx";
import useSiteContent from "./hooks/useSiteContent.js";
import useSection from "./hooks/useSection.js";
import { submitCustomerReview } from "./lib/reviewApi.js";
import "./CompanyProofSection.css";

const CompanyFootprintMap = lazy(() => import("./CompanyFootprintMap.jsx"));

// Icons cannot live in JSON, so content stores a name and this map resolves it.
const credentialIcons = { Award, ShieldCheck, Users, Globe2 };

const TESTIMONIAL_ROTATION_MS = 7000;
const EMPTY_REVIEW = {
  name: "",
  email: "",
  quote: "",
  rating: 0,
  consent: false,
  website: "",
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

function CompanyProofSection({ active, beforeFootprint = null }) {
  const content = useSiteContent();
  const credentials = selectCredentials(content);
  const footprintCountries = selectFootprintCountries(content);
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
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewForm, setReviewForm] = useState(EMPTY_REVIEW);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewError, setReviewError] = useState("");
  const carouselTestimonials = testimonials;
  const carouselPaused = testimonialPaused || reviewOpen;
  const credentialsAction = useSectionAction("credentials", {
    label: "Vezi acreditarile",
    mode: "link",
  });
  const qualityAction = useSectionAction("quality", {
    label: "Vezi serviciile",
    mode: "link",
    url: "#service-photovoltaic",
  });
  const reviewsAction = useSectionAction("reviews", {
    label: "Scrie o recenzie",
    mode: "builtin",
  });

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
    if (
      !active
      || !inView
      || !testimonialInView
      || carouselPaused
      || carouselTestimonials.length < 2
    ) {
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
    setTestimonialIndex((current) => (
      carouselTestimonials.length === 0
        ? 0
        : Math.min(current, carouselTestimonials.length - 1)
    ));
  }, [carouselTestimonials.length]);

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
    if (carouselTestimonials.length < 2) return;
    setTestimonialIndex((current) => (
      (current - 1 + carouselTestimonials.length) % carouselTestimonials.length
    ));
  };

  const showNextTestimonial = () => {
    if (carouselTestimonials.length < 2) return;
    setTestimonialIndex((current) => (current + 1) % carouselTestimonials.length);
  };

  const openReviewDialog = () => {
    setReviewForm({ ...EMPTY_REVIEW });
    setHoveredRating(0);
    setReviewError("");
    setReviewSubmitted(false);
    setReviewSubmitting(false);
    setReviewOpen(true);
  };

  const closeReviewDialog = () => {
    setReviewOpen(false);
  };

  const updateReviewField = (field, value) => {
    setReviewForm((current) => ({ ...current, [field]: value }));
    if (reviewError) setReviewError("");
  };

  const submitReview = async (event) => {
    event.preventDefault();

    const author = reviewForm.name.trim();
    const email = reviewForm.email.trim();
    const quote = reviewForm.quote.trim();

    if (author.length < 2) {
      setReviewError(reviewsText("validationName", "Introduceti numele."));
      reviewNameRef.current?.focus();
      return;
    }

    if (reviewForm.rating < 1) {
      setReviewError(reviewsText("validationRating", "Alegeti numarul de stele."));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setReviewError(reviewsText("validationEmail", "Introduceti o adresa de e-mail valida. Adresa nu va fi publicata."));
      return;
    }

    if (quote.length < 10) {
      setReviewError(reviewsText("validationReview", "Scrieti cel putin 10 caractere despre experienta dumneavoastra."));
      return;
    }

    if (!reviewForm.consent) {
      setReviewError(reviewsText("validationConsent", "Confirmati ca recenzia poate fi afisata public."));
      return;
    }

    setReviewSubmitting(true);
    setReviewError("");
    try {
      await submitCustomerReview({
        name: author,
        email,
        quote,
        rating: reviewForm.rating,
        consent: reviewForm.consent,
        website: reviewForm.website,
      });
      setReviewSubmitted(true);
    } catch {
      setReviewError(reviewsText("submitError", "Recenzia nu a putut fi trimisa. Incercati din nou."));
    } finally {
      setReviewSubmitting(false);
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
      id="credentials"
      className={`company-proof-section ${active ? "is-active" : ""} ${inView ? "is-in-view" : ""}`}
      aria-labelledby="company-proof-title"
    >
      <div className="company-proof-inner">
        <header className="company-proof-header proof-reveal">
          <span>{credentialsText("eyebrow", "Certificari si experienta")}</span>
          <div>
            <BlurText
              as="h2"
              id="company-proof-title"
              text={credentialsText("title", "Competente verificate pentru lucrari bine executate.")}
              play={active}
              animateBy="letters"
              direction="top"
              delay={55}
              stepDuration={0.45}
            />
            <p>
              {credentialsText(
                "description",
                "Certificarile, experienta echipelor si prezenta in trei piete europene sustin modul nostru de lucru.",
              )}
            </p>
          </div>
          {credentialsAction.visible && (
            <a
              href={credentialsAction.hrefFor(credentialsAction.url || "#")}
              onClick={(event) => credentialsAction.activate(event)}
            >
              <span>{credentialsAction.label}</span>
              <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden="true" />
            </a>
          )}
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

        {beforeFootprint && (
          <div className="company-proof-gallery-slot">
            {beforeFootprint}
          </div>
        )}

        <section className="company-footprint proof-reveal" aria-labelledby="footprint-title">
          <header>
            <span>{footprintText("eyebrow", "Amprenta europeana")}</span>
            <BlurText
              as="h2"
              id="footprint-title"
              text={footprintText("title", "Echipe active in Romania, Italia si Spania.")}
              play={active}
              animateBy="letters"
              direction="top"
              delay={55}
              stepDuration={0.45}
            />
            <p>
              {footprintText(
                "description",
                "Harta arata tarile si amplasamentele in care Greentech Professionals a desfasurat lucrari.",
              )}
            </p>
          </header>

          <Suspense
            fallback={
              <div
                className="company-footprint-map company-footprint-map-loading"
                role="status"
              >
                <span>{footprintText("mapLoadingLabel", "Se incarca harta proiectelor europene")}</span>
              </div>
            }
          >
            <CompanyFootprintMap
              countries={footprintCountries}
              labels={{
                title: footprintText("mapTitle"),
                descriptionPrefix: footprintText("mapDescriptionPrefix"),
                descriptionFallback: footprintText("mapDescriptionFallback"),
                showCountry: footprintText("mapShowCountryLabel"),
                countries: footprintText("mapCountriesLabel"),
                empty: footprintText("mapEmptyLabel"),
              }}
            />
          </Suspense>
        </section>

        <section className="company-quality proof-reveal" aria-labelledby="quality-title">
          <figure className="company-quality-media">
            <img
              src="/gallery/solar-safety.webp"
              alt={qualityText("imageAlt", "Echipament de protectie asezat pe module fotovoltaice")}
              loading="lazy"
              decoding="async"
            />
            <figcaption>{qualityText("imageCaption", "Siguranta incepe inaintea lucrarilor.")}</figcaption>
          </figure>

          <div className="company-quality-copy">
            <span>{qualityText("eyebrow", "Siguranta si calitate")}</span>
            <BlurText
              as="h2"
              id="quality-title"
              text={qualityText("title", "Control tehnic, de la mobilizare la predare.")}
              play={active}
              animateBy="letters"
              direction="top"
              delay={55}
              stepDuration={0.45}
            />
            <p>
              {qualityText(
                "description",
                "Urmarim executia prin verificari planificate, masuratori si documentatie de santier.",
              )}
            </p>
            <ul>
              {qualityPoints.map((point) => (
                <li key={point.id}>
                  <CheckCircle2 size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span>{point.text}</span>
                </li>
              ))}
            </ul>
            {qualityAction.visible && (
              <a
                href={qualityAction.hrefFor(qualityAction.url || "#")}
                onClick={(event) => qualityAction.activate(event)}
              >
                <span>{qualityAction.label}</span>
                <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden="true" />
              </a>
            )}
          </div>
        </section>

        <section
          ref={testimonialRef}
          id="reviews"
          className={`company-testimonial-carousel proof-reveal ${testimonialInView ? "is-running" : ""} ${carouselPaused ? "is-paused" : ""}`}
          aria-label={reviewsText("carouselLabel", "Recenzii ale clientilor")}
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
            <span>{reviewsText("eyebrow", "Recenzii")}</span>
            {reviewsAction.visible && (
              <button
                ref={reviewTriggerRef}
                className="company-review-trigger"
                type="button"
                onClick={(event) => reviewsAction.activate(event, openReviewDialog)}
              >
                <MessageSquarePlus size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{reviewsAction.label}</span>
              </button>
            )}
          </div>

          <div
            className="company-testimonial-stage"
            aria-live={carouselPaused ? "polite" : "off"}
          >
            {carouselTestimonials.length === 0 && (
              <div className="company-testimonial-empty">
                <MessageSquarePlus size={22} strokeWidth={1.6} aria-hidden="true" />
                <strong>{reviewsText("noReviewsTitle", "Nu exista recenzii publicate.")}</strong>
                <span>{reviewsText("noReviewsDescription", "Recenziile trimise apar aici dupa aprobare.")}</span>
              </div>
            )}

            {carouselTestimonials.map((testimonial, index) => {
              const selected = index === testimonialIndex;

              return (
                <figure
                  className={`company-testimonial ${selected ? "is-active" : ""}`}
                  key={testimonial.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${carouselTestimonials.length}`}
                  aria-hidden={!selected}
                >
                  <header className="company-testimonial-author">
                    <span
                      className="company-testimonial-avatar"
                      style={{ "--testimonial-avatar-position": testimonial.imagePosition }}
                      aria-hidden="true"
                    >
                      {testimonial.image ? (
                        <img src={testimonial.image} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span>{testimonial.avatarText || getReviewInitials(testimonial.author)}</span>
                      )}
                    </span>
                    <span className="company-testimonial-identity">
                      <strong>
                        {testimonial.author}
                        {testimonial.verified && (
                          <CheckCircle2 size={15} strokeWidth={1.8} aria-hidden="true" />
                        )}
                      </strong>
                      <span>{testimonial.role || reviewsText("reviewRole", "Recenzie client")}</span>
                    </span>
                    <span
                      className="company-testimonial-rating"
                      aria-label={`${testimonial.rating} ${reviewsText("ratingOutOfLabel", "stele din 5")}`}
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
                  </header>

                  <div className="company-testimonial-quote">
                    <Quote size={24} strokeWidth={1.45} aria-hidden="true" />
                    <blockquote>&ldquo;{testimonial.quote}&rdquo;</blockquote>
                  </div>

                  <figcaption>
                    <span className="company-testimonial-provenance">
                      {testimonial.source ? (
                        <>
                          <ShieldCheck size={15} strokeWidth={1.7} aria-hidden="true" />
                          {reviewsText("sourceBackedLabel", "Recenzie din sursa publica")}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={15} strokeWidth={1.7} aria-hidden="true" />
                          {reviewsText("approvedSubmissionLabel", "Recenzie aprobata")}
                        </>
                      )}
                    </span>
                    {testimonial.source && (
                      <a
                        href={testimonial.source}
                        target="_blank"
                        rel="noreferrer"
                        tabIndex={selected ? 0 : -1}
                        aria-label={`${reviewsText("readSourceLabel", "Citeste sursa recenziei scrise de")} ${testimonial.author}`}
                      >
                        {reviewsText("originalSourceLabel", "Sursa originala")}
                        <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
                      </a>
                    )}
                  </figcaption>
                </figure>
              );
            })}
          </div>

          {carouselTestimonials.length > 0 && (
            <div className="company-testimonial-controls">
              <span className="company-testimonial-count" aria-hidden="true">
                {String(testimonialIndex + 1).padStart(2, "0")} / {String(carouselTestimonials.length).padStart(2, "0")}
              </span>

              <div
                className="company-testimonial-dots"
                role="group"
                aria-label={reviewsText("chooseReviewLabel", "Alege recenzia")}
              >
                {carouselTestimonials.map((testimonial, index) => (
                  <button
                    className={index === testimonialIndex ? "is-active" : ""}
                    type="button"
                    key={testimonial.id}
                    aria-label={`${reviewsText("showReviewLabel", "Afiseaza recenzia")} ${index + 1}`}
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
                  aria-label={reviewsText("previousReviewLabel", "Recenzia anterioara")}
                  title={reviewsText("previousReviewLabel", "Recenzia anterioara")}
                  disabled={carouselTestimonials.length < 2}
                  onClick={showPreviousTestimonial}
                >
                  <ChevronLeft size={20} strokeWidth={1.8} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={reviewsText("nextReviewLabel", "Recenzia urmatoare")}
                  title={reviewsText("nextReviewLabel", "Recenzia urmatoare")}
                  disabled={carouselTestimonials.length < 2}
                  onClick={showNextTestimonial}
                >
                  <ChevronRight size={20} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      </section>

      <SectionActionModal {...credentialsAction.modalProps} />
      <SectionActionModal {...qualityAction.modalProps} />
      <SectionActionModal {...reviewsAction.modalProps} />

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
              aria-label={reviewsText("closeFormLabel", "Inchide formularul de recenzie")}
              title={reviewsText("closeLabel", "Inchide")}
              onClick={closeReviewDialog}
            >
              <X size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>

            {reviewSubmitted ? (
              <div className="company-review-success" role="status">
                <div className="company-review-success-icon" aria-hidden="true">
                  <CheckCircle2 size={27} strokeWidth={1.6} aria-hidden="true" />
                </div>

                <div className="company-review-success-copy">
                  <p className="company-review-success-eyebrow">
                    {reviewsText("successEyebrow", "Recenzie primita")}
                  </p>
                  <h2 id="company-review-title">
                    {reviewsText("successTitle", "Va multumim pentru recenzie.")}
                  </h2>
                  <p className="company-review-success-note">
                    {reviewsText(
                      "successDescription",
                      "Recenzia a fost trimisa si va deveni publica dupa aprobarea echipei Greentech.",
                    )}
                  </p>
                </div>

                <div
                  className="company-review-success-status"
                  aria-label={`${reviewsText("moderationStatusLabel", "Starea moderarii")}: ${reviewsText("awaitingApprovalLabel", "In asteptarea aprobarii")}`}
                >
                  <ShieldCheck size={22} strokeWidth={1.6} aria-hidden="true" />
                  <div>
                    <span>{reviewsText("moderationStatusLabel", "Starea moderarii")}</span>
                    <strong>{reviewsText("awaitingApprovalLabel", "In asteptarea aprobarii")}</strong>
                  </div>
                </div>

                <button type="button" onClick={closeReviewDialog}>
                  <span>{reviewsText("doneLabel", "Gata")}</span>
                  <CheckCircle2 size={17} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <header className="company-review-header">
                  <span>{reviewsText("formEyebrow", "Opinia clientilor")}</span>
                  <h2 id="company-review-title">{reviewsAction.label}</h2>
                </header>

                <form className="company-review-form" onSubmit={submitReview} noValidate>
                  <label className="company-review-field">
                    <span>{reviewsText("nameLabel", "Nume")}</span>
                    <input
                      ref={reviewNameRef}
                      type="text"
                      name="reviewer-name"
                      value={reviewForm.name}
                      maxLength={60}
                      autoComplete="name"
                      placeholder={reviewsText("namePlaceholder", "Nume complet")}
                      onChange={(event) => updateReviewField("name", event.target.value)}
                    />
                  </label>

                  <label className="company-review-field">
                    <span>
                      {reviewsText("emailLabel", "E-mail")} {" "}
                      <small>{reviewsText("emailHint", "Ramane privat si este folosit doar pentru verificare")}</small>
                    </span>
                    <input
                      type="email"
                      name="reviewer-email"
                      value={reviewForm.email}
                      maxLength={160}
                      autoComplete="email"
                      inputMode="email"
                      placeholder="name@company.com"
                      onChange={(event) => updateReviewField("email", event.target.value)}
                    />
                  </label>

                  <fieldset className="company-review-rating-field">
                    <legend>{reviewsText("ratingLabel", "Evaluare")}</legend>
                    <div className="company-review-rating-picker" onPointerLeave={() => setHoveredRating(0)}>
                      <div
                        role="radiogroup"
                        aria-label={reviewsText("ratingPickerLabel", "Alegeti intre 1 si 5 stele")}
                      >
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
                              <span className="company-review-sr-only">
                                {rating} {reviewsText("starsLabel", "stele")}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <output>
                        {reviewForm.rating
                          ? `${reviewForm.rating}.0`
                          : reviewsText("selectLabel", "Alegeti")}
                      </output>
                    </div>
                  </fieldset>

                  <label className="company-review-field">
                    <span>{reviewsText("reviewLabel", "Recenzie")}</span>
                    <textarea
                      name="review-message"
                      value={reviewForm.quote}
                      minLength={10}
                      maxLength={420}
                      rows={5}
                      placeholder={reviewsText("reviewPlaceholder", "Descrieti experienta colaborarii")}
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
                    <span>{reviewsText("consentLabel", "Sunt de acord ca numele si recenzia mea sa fie afisate public.")}</span>
                  </label>

                  <label className="company-review-honeypot" aria-hidden="true">
                    <span>{reviewsText("websiteLabel", "Website")}</span>
                    <input
                      type="text"
                      name="website"
                      value={reviewForm.website}
                      tabIndex={-1}
                      autoComplete="off"
                      onChange={(event) => updateReviewField("website", event.target.value)}
                    />
                  </label>

                  <p className={`company-review-error ${reviewError ? "is-visible" : ""}`} role="alert">
                    {reviewError}
                  </p>

                  <button className="company-review-submit" type="submit" disabled={reviewSubmitting}>
                    <span>
                      {reviewSubmitting
                        ? reviewsText("submittingLabel", "Se trimite...")
                        : reviewsText("submitLabel", "Trimite pentru aprobare")}
                    </span>
                    {reviewSubmitting ? (
                      <Loader2 className="company-review-spin" size={18} strokeWidth={1.8} aria-hidden="true" />
                    ) : (
                      <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden="true" />
                    )}
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
