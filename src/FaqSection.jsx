import React, { useEffect, useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { selectFaqs } from "./lib/siteContent.js";
import BlurText from "./BlurText.jsx";
import useSiteContent from "./hooks/useSiteContent.js";
import useSection from "./hooks/useSection.js";
import "./FaqSection.css?=dwqdwq";

function FaqItem({ faq, open, onToggle, index }) {
  const answerId = useId();
  const bodyRef = useRef(null);
  const [height, setHeight] = useState(0);

  // Measure the answer so the panel can animate to an explicit height rather
  // than snapping open, and re-measure when the viewport reflows the text.
  //
  // Measuring again on every open matters: the first measurement can run while
  // the section is still `display: none`, which reports 0 and would otherwise
  // leave the panel collapsed until a resize happened to correct it.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;

    const measure = () => setHeight(body.scrollHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [faq.answer, open]);

  const paragraphs = String(faq.answer ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <li className={`faq-item ${open ? "is-open" : ""}`}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={answerId}
          onClick={onToggle}
        >
          <span className="faq-index" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="faq-question">{faq.question}</span>
          <span className="faq-marker" aria-hidden="true">
            <Plus size={20} strokeWidth={1.6} />
          </span>
        </button>
      </h3>

      <div
        id={answerId}
        className="faq-answer"
        style={{ height: open ? `${height}px` : 0 }}
        // Collapsed answers stay out of the tab order and the a11y tree.
        inert={open ? undefined : true}
      >
        <div className="faq-answer-body" ref={bodyRef}>
          {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </div>
    </li>
  );
}

function FaqSection({ active }) {
  const text = useSection("faqs");
  const faqs = selectFaqs(useSiteContent());
  const sectionRef = useRef(null);
  const [openId, setOpenId] = useState(null);
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

  if (faqs.length === 0) return null;

  return (
    <section
      id="faqs"
      ref={sectionRef}
      className={`faq-section ${active ? "is-active" : ""} ${inView ? "is-in-view" : ""}`}
      aria-labelledby="faq-section-title"
    >
      <div className="faq-inner">
        <header className="faq-header">
          <span>{text("eyebrow", "FAQs")}</span>
          <BlurText
            as="h2"
            id="faq-section-title"
            text={text("title", "Questions we hear before a project starts.")}
            play={active}
            animateBy="letters"
            direction="top"
            delay={55}
            stepDuration={0.45}
          />
          <p>
            {text(
              "description",
              "Scope, coverage and certification — the details clients ask about most often.",
            )}
          </p>
        </header>

        <ul className="faq-list">
          {faqs.map((faq, index) => (
            <FaqItem
              key={faq.id}
              faq={faq}
              index={index}
              open={openId === faq.id}
              onToggle={() => setOpenId((current) => (current === faq.id ? null : faq.id))}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

export default FaqSection;
