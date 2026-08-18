import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, X } from "lucide-react";
import { selectSection, sectionText } from "./lib/siteContent.js";
import { uiText, useLocale } from "./lib/i18n.js";
import useSiteContent from "./hooks/useSiteContent.js";
import "./SectionAction.css";

const ACTION_MODES = new Set(["builtin", "link", "modal"]);

const modalText = (modal, key, fallback = "") =>
  (typeof modal?.[key] === "string" ? modal[key] : fallback);

export function useSectionAction(
  sectionId,
  { label: fallbackLabel = "", mode: fallbackMode = "builtin", url: fallbackUrl = "" } = {},
) {
  const section = selectSection(sectionId, useSiteContent());
  const label = sectionText(section, "action", fallbackLabel);
  const configuredMode = sectionText(section, "actionMode", fallbackMode);
  const mode = ACTION_MODES.has(configuredMode) ? configuredMode : fallbackMode;
  const url = sectionText(section, "actionUrl", fallbackUrl);
  const configuredModal = section?.actionModal;
  const modal = {
    eyebrow: modalText(configuredModal, "eyebrow", sectionText(section, "eyebrow", "")),
    title: modalText(configuredModal, "title", sectionText(section, "title", "Mai multe informatii")),
    description: modalText(
      configuredModal,
      "description",
      sectionText(section, "description", ""),
    ),
    ctaLabel: modalText(configuredModal, "ctaLabel", ""),
    ctaUrl: modalText(configuredModal, "ctaUrl", ""),
  };
  const [modalOpen, setModalOpen] = useState(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (mode !== "modal") setModalOpen(false);
  }, [mode]);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const activate = useCallback((event, builtinHandler) => {
    if (mode === "modal") {
      event?.preventDefault();
      triggerRef.current = event?.currentTarget ?? null;
      setModalOpen(true);
      return;
    }

    if (mode === "link") {
      if (!url) {
        event?.preventDefault();
        return;
      }

      if (event?.currentTarget?.tagName !== "A") {
        event?.preventDefault();
        window.location.assign(url);
      }
      return;
    }

    builtinHandler?.(event);
  }, [mode, url]);

  const hrefFor = useCallback((builtinHref = "#") => {
    if (mode === "link") return url || "#";
    if (mode === "modal") return "#";
    return builtinHref;
  }, [mode, url]);

  return {
    label,
    mode,
    url,
    visible: Boolean(label && (mode !== "link" || url)),
    activate,
    hrefFor,
    modalProps: {
      open: modalOpen,
      onClose: closeModal,
      content: modal,
      triggerRef,
    },
  };
}

export default function SectionActionModal({ open, onClose, content, triggerRef }) {
  const locale = useLocale();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousActive = document.activeElement;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

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
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

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
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      (triggerRef?.current || previousActive)?.focus?.({ preventScroll: true });
    };
  }, [onClose, open, triggerRef]);

  if (!open || typeof document === "undefined") return null;

  const hasDescription = Boolean(content.description);

  return createPortal(
    <div
      className="section-action-modal-overlay"
      data-lenis-prevent
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className="section-action-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={content.title ? titleId : undefined}
        aria-describedby={hasDescription ? descriptionId : undefined}
        aria-label={content.title ? undefined : uiText("moreInformation", locale)}
        tabIndex={-1}
      >
        <button
          ref={closeRef}
          className="section-action-modal-close"
          type="button"
          aria-label={uiText("closeDialog", locale)}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>

        <div className="section-action-modal-copy">
          {content.eyebrow && <span>{content.eyebrow}</span>}
          {content.title && <h2 id={titleId}>{content.title}</h2>}
          {hasDescription && (
            <div id={descriptionId}>
              {/* Blank lines separate paragraphs, so legal copy stays readable. */}
              {String(content.description)
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          )}
        </div>

        {content.ctaLabel && content.ctaUrl && (
          <a className="section-action-modal-cta" href={content.ctaUrl}>
            <span>{content.ctaLabel}</span>
            <ArrowUpRight aria-hidden="true" />
          </a>
        )}
      </section>
    </div>,
    document.body,
  );
}
