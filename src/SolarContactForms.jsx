import React, { useEffect, useRef, useState } from "react";
import { Briefcase, Loader2, Paperclip, Send, X } from "lucide-react";
import { submitProjectInquiry } from "./lib/inquiryApi.js";
import { submitCareerApplication, MAX_CV_BYTES } from "./lib/applicationApi.js";
import { APPLY_HASH } from "./SiteNavigation.jsx";
import useSection from "./hooks/useSection.js";
import "./SolarContactForms.css";

const IDLE = { state: "idle", message: "" };

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

function SubmitButton({ label, busyLabel, busy, disabled, icon: Icon = Send }) {
  return (
    <button className="contact-forms-submit" type="submit" disabled={busy || disabled}>
      <span>{busy ? busyLabel : label}</span>
      {busy
        ? <Loader2 className="contact-forms-spin" size={18} strokeWidth={1.8} aria-hidden="true" />
        : <Icon size={18} strokeWidth={1.8} aria-hidden="true" />}
    </button>
  );
}

function ProjectForm({ openLegal, contactAction, text }) {
  const [status, setStatus] = useState(IDLE);
  const busy = status.state === "submitting";

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    setStatus({
      state: "submitting",
      message: text("sendingRequestMessage", "Solicitarea se trimite..."),
    });

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
        message: text("requestSuccessMessage", "Va multumim. Solicitarea a ajuns la echipa noastra."),
      });
    } catch {
      setStatus({
        state: "error",
        message: text("requestErrorMessage", "Solicitarea nu a putut fi trimisa. Incercati din nou."),
      });
    }
  };

  return (
    <form className="contact-forms-form" onSubmit={submit} noValidate>
      <div className="contact-forms-grid">
        <div className="contact-forms-field">
          <label htmlFor="project-first-name">{text("firstNameLabel", "Prenume")}</label>
          <input id="project-first-name" name="firstName" type="text"
            autoComplete="given-name" required />
        </div>

        <div className="contact-forms-field">
          <label htmlFor="project-last-name">{text("lastNameLabel", "Nume")}</label>
          <input id="project-last-name" name="lastName" type="text"
            autoComplete="family-name" required />
        </div>

        <div className="contact-forms-field">
          <label htmlFor="project-phone">{text("phoneLabel", "Numar de telefon")}</label>
          <input id="project-phone" name="phone" type="tel" autoComplete="tel" required />
        </div>

        <div className="contact-forms-field contact-forms-field-wide">
          <label htmlFor="project-message">{text("messageLabel", "Descrieti proiectul")}</label>
          <textarea id="project-message" name="message" rows={5} required />
        </div>
      </div>

      <label className="contact-forms-honeypot" aria-hidden="true">
        {text("websiteLabel", "Website")}
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      <ConsentField name="gdprConsent">
        {text("consentPrefix", "Sunt de acord cu prelucrarea datelor personale pentru ca Greentech Professionals sa poata raspunde solicitarii, conform")} {" "}
        <button type="button" className="contact-forms-inline-link"
          onClick={(event) => openLegal("privacy", event)}>
          {text("privacyPolicyLabel", "politicii de confidentialitate")}
        </button>
        {text("consentSuffix", ".")}
      </ConsentField>

      <div className="contact-forms-actions">
        <SubmitButton
          label={contactAction?.label || "Trimite solicitarea"}
          busyLabel={text("sendingLabel", "Se trimite...")}
          busy={busy}
        />
        <StatusLine status={status} />
      </div>
    </form>
  );
}

function CareerForm({ openLegal, text }) {
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
      setStatus({ state: "error", message: text("missingCvMessage", "Atasati CV-ul.") });
      return;
    }

    const data = new FormData(form);
    setStatus({
      state: "submitting",
      message: text("sendingApplicationMessage", "Candidatura se trimite..."),
    });

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
        message: text("applicationSuccessMessage", "Va multumim. Candidatura si CV-ul au ajuns la echipa noastra."),
      });
    } catch {
      setStatus({
        state: "error",
        message: text("applicationErrorMessage", "Candidatura nu a putut fi trimisa. Incercati din nou."),
      });
    }
  };

  return (
    <form className="contact-forms-form" onSubmit={submit} noValidate>
      <div className="contact-forms-grid">
        <div className="contact-forms-field">
          <label htmlFor="career-name">{text("nameLabel", "Nume")}</label>
          <input id="career-name" name="name" type="text" autoComplete="name" required />
        </div>

        <div className="contact-forms-field">
          <label htmlFor="career-position">{text("positionLabel", "Pozitia dorita")}</label>
          <input id="career-position" name="position" type="text"
            placeholder={text("positionPlaceholder", "Electrician, inginer, coordonator...")} required />
        </div>

        <div className="contact-forms-field">
          <label htmlFor="career-email">{text("emailLabel", "E-mail")}</label>
          <input id="career-email" name="email" type="email" autoComplete="email" required />
        </div>

        <div className="contact-forms-field">
          <label htmlFor="career-phone">{text("phoneLabel", "Numar de telefon")}</label>
          <input id="career-phone" name="phone" type="tel" autoComplete="tel" required />
        </div>

        <div className="contact-forms-field contact-forms-field-wide">
          <label htmlFor="career-experience">{text("experienceLabel", "Descrieti experienta")}</label>
          <textarea id="career-experience" name="experience" rows={5} required />
        </div>

        <div className="contact-forms-field contact-forms-field-wide">
          <label htmlFor="career-cv">{text("cvLabel", "Incarcati CV-ul sau referintele")}</label>
          <div className="contact-forms-file">
            <button type="button" onClick={() => fileRef.current?.click()}>
              <Paperclip size={16} strokeWidth={1.8} aria-hidden="true" />
              {cvFile
                ? text("changeFileLabel", "Schimba fisierul")
                : text("chooseFileLabel", "Alege fisierul")}
            </button>

            <span className="contact-forms-file-name">
              {cvFile
                ? `${cvFile.name} - ${Math.ceil(cvFile.size / 1024)} KB`
                : text("fileTypesLabel", "PDF, DOC sau DOCX")}
            </span>

            {cvFile && (
              <button
                type="button"
                className="contact-forms-file-clear"
                aria-label={text("clearFileLabel", "Elimina fisierul")}
                onClick={() => setCvFile(null)}
              >
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
            {text("fileHintPrefix", "Maximum")} {Math.round(MAX_CV_BYTES / 1024 / 1024)} {text("fileHintSuffix", "MB. Fisierul ajunge doar la echipa de recrutare.")}
          </small>
        </div>
      </div>

      <label className="contact-forms-honeypot" aria-hidden="true">
        {text("websiteLabel", "Website")}
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      <ConsentField name="gdprConsent">
        {text("consentPrefix", "Sunt de acord cu prelucrarea datelor personale si a CV-ului in scopul recrutarii, conform")} {" "}
        <button type="button" className="contact-forms-inline-link"
          onClick={(event) => openLegal("privacy", event)}>
          {text("privacyPolicyLabel", "politicii de confidentialitate")}
        </button>
        {text("consentSuffix", ".")}
      </ConsentField>

      <div className="contact-forms-actions">
        <SubmitButton
          label={text("action", "Trimite candidatura")}
          busyLabel={text("sendingLabel", "Se trimite...")}
          busy={busy}
          icon={Briefcase}
        />
        <StatusLine status={status} />
      </div>
    </form>
  );
}

function SolarContactForms({ openLegal, contactAction }) {
  const contactText = useSection("contact");
  const careerText = useSection("careers");
  const [openPanel, setOpenPanel] = useState("project");
  const rootRef = useRef(null);
  const panels = [
    {
      key: "project",
      eyebrow: contactText("projectPanelEyebrow", "Solicitare proiect"),
      title: contactText("projectPanelTitle", "Discutati un proiect"),
      hint: contactText("projectPanelHint", "Amplasament, capacitate si lucrari necesare."),
    },
    {
      key: "career",
      eyebrow: careerText("careerPanelEyebrow", "Cariere"),
      title: careerText("careerPanelTitle", "Alaturati-va echipei"),
      hint: careerText("careerPanelHint", "CV, experienta si rolul urmarit."),
    },
  ];

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
        {panels.map((panel) => {
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

      {panels.map((panel) => {
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
              ? (
                <ProjectForm
                  openLegal={openLegal}
                  contactAction={contactAction}
                  text={contactText}
                />
              ) : (
                <CareerForm openLegal={openLegal} text={careerText} />
              )}
          </div>
        );
      })}
    </div>
  );
}

export default SolarContactForms;
