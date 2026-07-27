import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Award,
  CheckCircle2,
  Globe2,
  Quote,
  ShieldCheck,
  Users,
} from "lucide-react";
import "./CompanyProofSection.css";

const CompanyFootprintMap = lazy(() => import("./CompanyFootprintMap.jsx"));

const credentials = [
  {
    value: "ISO",
    label: "Quality certifications",
    detail: "Quality credentials supporting structured project delivery.",
    Icon: Award,
  },
  {
    value: "ANRE",
    label: "Energy certification",
    detail: "Certified capability for work in the energy field.",
    Icon: ShieldCheck,
  },
  {
    value: "30+",
    label: "Satisfied clients",
    detail: "Published company experience across completed work.",
    Icon: Users,
  },
  {
    value: "RO / IT / ES",
    label: "European delivery",
    detail: "A field presence spanning three active markets.",
    Icon: Globe2,
  },
];

const qualityPoints = [
  "Specialist-qualified field teams",
  "Electrical inspections and PRAM testing capability",
  "Planned execution, handover and maintenance",
];

function CompanyProofSection({ active }) {
  const sectionRef = useRef(null);
  const [inView, setInView] = useState(false);

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

  return (
    <section
      ref={sectionRef}
      className={`company-proof-section ${active ? "is-active" : ""} ${inView ? "is-in-view" : ""}`}
      aria-labelledby="company-proof-title"
    >
      <div className="company-proof-inner">
        <header className="company-proof-header proof-reveal">
          <span>Trust &amp; certifications</span>
          <div>
            <h2 id="company-proof-title">Built for accountable field delivery.</h2>
            <p>
              Technical capability, qualified teams and a growing European
              footprint behind every stage of execution.
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
          {credentials.map(({ value, label, detail, Icon }) => (
            <article className="company-proof-credential" key={label}>
              <Icon size={23} strokeWidth={1.6} aria-hidden="true" />
              <strong>{value}</strong>
              <h3>{label}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>

        <section className="company-footprint proof-reveal" aria-labelledby="footprint-title">
          <header>
            <span>European footprint</span>
            <h2 id="footprint-title">Teams close to the work.</h2>
            <p>
              Published projects and field updates connect GreenTech Professionals
              across Romania, Italy and Spain.
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
            <span>Safety &amp; quality</span>
            <h2 id="quality-title">Control from planning to handover.</h2>
            <p>
              Reliable delivery depends on disciplined field execution, qualified
              personnel and checks that continue beyond installation.
            </p>
            <ul>
              {qualityPoints.map((point) => (
                <li key={point}>
                  <CheckCircle2 size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span>{point}</span>
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

        <figure className="company-testimonial proof-reveal">
          <Quote size={34} strokeWidth={1.35} aria-hidden="true" />
          <blockquote>
            &ldquo;We are very satisfied with the professionalism of the GreenTech
            Professionals team.&rdquo;
          </blockquote>
          <figcaption>
            <strong>M. A.</strong>
            <span>Customer testimonial</span>
            <a
              href="https://greentechpro.ro/about-us/"
              target="_blank"
              rel="noreferrer"
              aria-label="Read the customer testimonial source"
            >
              Source
              <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export default CompanyProofSection;
