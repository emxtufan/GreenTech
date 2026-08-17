import React, { useEffect, useRef, useState } from "react";
import { Briefcase, Loader2, Paperclip, Send, X } from "lucide-react";
import { submitProjectInquiry } from "./lib/inquiryApi.js";
import { submitCareerApplication, MAX_CV_BYTES } from "./lib/applicationApi.js";
import { APPLY_HASH } from "./SiteNavigation.jsx";
import "./SolarContactForms.css";

const IDLE = { state: "idle", message: "" };

const PANELS = [
  {
    key: "project",
    eyebrow: "Project inquiry",
    title: "Discuss a project",
    hint: "Site, capacity and the scope you need.",
  },
  {
    key: "career",
    eyebrow: "Careers",
    title: "Join the team",
    hint: "Send your CV and tell us what you have built.",
  },
];

function StatusLine({ status }) {
  return (
    <p
      className={`contact-forms-status is-${status.state} ${status.message ? "visible" : ""}`}
      role={status.state === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {status.message}
    </p>
  );
}

function ConsentField({ name, children }) {
  return (
    <label className="contact-forms-consent">
      <input name={name} type="checkbox" required />
      <span className="contact-forms-consent-box" aria-hidden="true" />
      <span>{children}</span>
    </label>
  );
}

function SubmitButton({ label, busy, disabled, icon: Icon = Send }) {
  return (
    <button className="contact-forms-submit" type="submit" disabled={busy || disabled}>
      <span>{busy ? "Sending..." : label}</span>
      {busy
        ? <Loader2 className="contact-forms-spin" size={18} strokeWidth={1.8} aria-hidden="true" />
        : <Icon size={18} strokeWidth={1.8} aria-hidden="true" />}
    </button>
  );
}

function ProjectForm({ openLegal, contactAction }) {
  const [status, setStatus] = useState(IDLE);
  const busy = status.state === "submitting";

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    setStatus({ state: "submitting", message: "Sending your request..." });

    try {
      await submitProjectInquiry({
        firstName: String(data.get("firstName") ?? "").trim(),
        lastName: String(data.get("lastName") ?? "").trim(),
        phone: String(data.get("phone") ?? "").trim(),
        message: String(data.get("message") ?? "").trim(),
        consent: data.get("gdprConsent") === "on",
        website: String(data.get("website") ?? ""),
      });
      form.reset();
      setStatus({
        state: "success",
        message: "Thank you. Your project inquiry has been sent to our team.",
      });
    } catch (error) {
      setStatus({
        state: "error",
        message: error.message || "Your request could not be sent. Please try again.",
      });
    }
  };

  return (
    <form className="contact-forms-form" onSubmit={submit} noValidate>
      <div className="contact-forms-grid">
        <div className="contact-forms-field">
          <label htmlFor="project-first-name">First name</label>
          <input id="project-first-name" name="firstName" type="text"
            autoComplete="given-name" required />
        </div>

        <div className="contact-forms-field">
          <label htmlFor="project-last-name">Last name</label>
          <input id="project-last-name" name="lastName" type="text"
            autoComplete="family-name" required />
        </div>

        <div className="contact-forms-field">
          <label htmlFor="project-phone">Phone number</label>
          <input id="project-phone" name="phone" type="tel" autoComplete="tel" required />
        </div>

        <div className="contact-forms-field contact-forms-field-wide">
          <label htmlFor="project-message">Describe your project</label>
          <textarea id="project-message" name="message" rows={5} required />
        </div>
      </div>

      <label className="contact-forms-honeypot" aria-hidden="true">
        Website
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      <ConsentField name="gdprConsent">
        I agree to the processing of my personal data so GreenTech Professionals
        can respond to this inquiry, as described in the{" "}
        <button type="button" className="contact-forms-inline-link"
          onClick={(event) => openLegal("privacy", event)}>
          privacy policy
        </button>
        .
      </ConsentField>

      <div className="contact-forms-actions">
        <SubmitButton label={contactAction?.label || "Send request"} busy={busy} />
        <StatusLine status={status} />
      </div>
    </form>
  );
}

function CareerForm({ openLegal }) {
  const [status, setStatus] = useState(IDLE);
  const [cvFile, setCvFile] = useState(null);
  const fileRef = useRef(null);
  const busy = status.state === "submitting";

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    if (!cvFile) {
      setStatus({ state: "error", message: "Please attach your CV." });
      return;
    }

    const data = new FormData(form);
    setStatus({ state: "submitting", message: "Sending your application..." });

    try {
      await submitCareerApplication({
        name: String(data.get("name") ?? "").trim(),
        position: String(data.get("position") ?? "").trim(),
        email: String(data.get("email") ?? "").trim(),
        phone: String(data.get("phone") ?? "").trim(),
        experience: String(data.get("experience") ?? "").trim(),
        consent: data.get("gdprConsent") === "on",
        website: String(data.get("website") ?? ""),
        cvFile,
      });
      form.reset();
      setCvFile(null);
      setStatus({
        state: "success",
        message: "Thank you. Your application and CV have reached our team.",
      });
    } catch (error) {
      setStatus({
        state: "error",
        message: error.message || "Your application could not be sent. Please try again.",
      });
    }
  };

  return (
    <form className="contact-forms-form" onSubmit={submit} noValidate>
      <div className="contact-forms-grid">
        <div className="contact-forms-field">
          <label htmlFor="career-name">Name</label>
          <input id="career-name" name="name" type="text" autoComplete="name" required />
        </div>

        <div className="contact-forms-field">
          <label htmlFor="career-position">Position</label>
          <input id="career-position" name="position" type="text"
            placeholder="Electrician, inginer, coordonator..." required />
        </div>

        <div className="contact-forms-field">
          <label htmlFor="career-email">Email</label>
          <input id="career-email" name="email" type="email" autoComplete="email" required />
        </div>

        <div className="contact-forms-field">
          <label htmlFor="career-phone">Phone Number</label>
          <input id="career-phone" name="phone" type="tel" autoComplete="tel" required />
        </div>

        <div className="contact-forms-field contact-forms-field-wide">
          <label htmlFor="career-experience">Describe your experience</label>
          <textarea id="career-experience" name="experience" rows={5} required />
        </div>

        <div className="contact-forms-field contact-forms-field-wide">
          <label htmlFor="career-cv">Upload your CV / References</label>
          <div className="contact-forms-file">
            <button type="button" onClick={() => fileRef.current?.click()}>
              <Paperclip size={16} strokeWidth={1.8} aria-hidden="true" />
              {cvFile ? "Change file" : "Choose file"}
            </button>

            <span className="contact-forms-file-name">
              {cvFile ? `${cvFile.name} · ${Math.ceil(cvFile.size / 1024)} KB` : "PDF, DOC or DOCX"}
            </span>

            {cvFile && (
              <button type="button" className="contact-forms-file-clear"
                aria-label="Elimină fișierul" onClick={() => setCvFile(null)}>
                <X size={15} strokeWidth={1.9} aria-hidden="true" />
              </button>
            )}

            <input
              ref={fileRef}
              id="career-cv"
              name="cv"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              // Required is enforced in submit(): the input is cleared on every
              // pick so the same file can be reselected after a failed upload.
              onChange={(event) => {
                const [file] = event.target.files ?? [];
                event.target.value = "";
                if (file) setCvFile(file);
              }}
            />
          </div>
          <small>
            Maxim {Math.round(MAX_CV_BYTES / 1024 / 1024)} MB. Fișierul ajunge doar la
            echipa noastră de recrutare.
          </small>
        </div>
      </div>

      <label className="contact-forms-honeypot" aria-hidden="true">
        Website
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      <ConsentField name="gdprConsent">
        Sunt de acord cu prelucrarea datelor mele personale și a CV-ului în scopul
        recrutării, conform{" "}
        <button type="button" className="contact-forms-inline-link"
          onClick={(event) => openLegal("privacy", event)}>
          politicii de confidențialitate
        </button>
        .
      </ConsentField>

      <div className="contact-forms-actions">
        <SubmitButton label="Trimite aplicația" busy={busy} icon={Briefcase} />
        <StatusLine status={status} />
      </div>
    </form>
  );
}

function SolarContactForms({ openLegal, contactAction }) {
  const [openPanel, setOpenPanel] = useState("project");
  const rootRef = useRef(null);

  // The nav's Apply control and any shared `#apply` link land here: open the
  // career panel and bring it into view.
  useEffect(() => {
    const openCareer = () => {
      if (window.location.hash !== APPLY_HASH) return;

      setOpenPanel("career");

      if (typeof window.__scrollToSection === "function") {
        window.__scrollToSection(rootRef.current);
        return;
      }

      rootRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
    };

    openCareer();
    window.addEventListener("hashchange", openCareer);
    return () => window.removeEventListener("hashchange", openCareer);
  }, []);

  return (
    <div className="contact-forms" ref={rootRef}>
      <div className="contact-forms-triggers">
        {PANELS.map((panel) => {
          const open = openPanel === panel.key;

          return (
            <button
              key={panel.key}
              type="button"
              className={`contact-forms-trigger ${open ? "is-open" : ""}`}
              aria-expanded={open}
              aria-controls={`contact-panel-${panel.key}`}
              onClick={() => setOpenPanel(open ? null : panel.key)}
            >
              <span className="contact-forms-trigger-eyebrow">{panel.eyebrow}</span>
              <strong>{panel.title}</strong>
              <span className="contact-forms-trigger-hint">{panel.hint}</span>
              <i className="contact-forms-trigger-mark" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {PANELS.map((panel) => {
        const open = openPanel === panel.key;

        return (
          <div
            key={panel.key}
            id={`contact-panel-${panel.key}`}
            className={`contact-forms-panel ${open ? "is-open" : ""}`}
            // A collapsed panel keeps its required inputs out of the tab order
            // and out of constraint validation.
            inert={open ? undefined : true}
          >
            {panel.key === "project"
              ? <ProjectForm openLegal={openLegal} contactAction={contactAction} />
              : <CareerForm openLegal={openLegal} />}
          </div>
        );
      })}
    </div>
  );
}

export default SolarContactForms;
