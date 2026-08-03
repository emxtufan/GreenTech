import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Globe2, Send } from "lucide-react";
import {
  LOCALE_OPTIONS,
  setLocale,
  uiText,
  useLocale,
} from "./lib/i18n.js";
import "./SiteNavigation.css";

// Hash the Apply control navigates to. SolarContactForms listens for it and
// opens the career panel, so the button, the footer and a shared link all
// behave identically.
export const APPLY_HASH = "#apply";

// Page anchors, not content: these mirror the section ids in the markup.
const NAV_ITEMS = [
  { labelKey: "company", href: "#company" },
  {
    labelKey: "services",
    href: "#service-photovoltaic",
    children: [
      { labelKey: "photovoltaicParks", href: "#service-photovoltaic" },
      { labelKey: "electricalInspections", href: "#service-electrical" },
      { labelKey: "constructionServices", href: "#service-construction" },
      { labelKey: "dataCenterConstruction", href: "#service-data-center" },
    ],
  },
  { labelKey: "process", href: "#process" },
  { labelKey: "projects", href: "#projects" },
  { labelKey: "credentials", href: "#credentials" },
  { labelKey: "reviews", href: "#reviews" },
  { labelKey: "journal", href: "#journal" },
  { labelKey: "faqs", href: "#faqs" },
  { labelKey: "contact", href: "#contact" },
];

const flatten = (items) =>
  items.flatMap((item) => (item.children ? [item, ...item.children] : [item]));

function LanguageSelector({ mobile = false }) {
  const locale = useLocale();
  const label = uiText("language", locale);

  return (
    <label
      className={`site-nav-language ${mobile ? "site-nav-language-mobile" : "site-nav-language-desktop"}`}
      title={label}
    >
      <Globe2 size={16} strokeWidth={1.8} aria-hidden="true" />
      <span className="site-nav-language-label">{label}</span>
      <select
        value={locale}
        aria-label={label}
        onChange={(event) => setLocale(event.target.value)}
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {mobile ? option.label : option.shortLabel}
          </option>
        ))}
      </select>
      <ChevronDown className="site-nav-language-chevron" size={13} aria-hidden="true" />
    </label>
  );
}

function ServicesMenu({ item, onNavigate }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const closeTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Pointer-driven menus need a grace period, or moving the cursor from the
  // trigger to the panel closes it mid-travel.
  const scheduleClose = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  const cancelClose = () => window.clearTimeout(closeTimer.current);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      className={`site-nav-group ${open ? "is-open" : ""}`}
      ref={wrapperRef}
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className="site-nav-link site-nav-group-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {item.label}
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
      </button>

      <div className="site-nav-dropdown" inert={open ? undefined : true}>
        {item.children.map((child) => (
          <a
            key={child.href}
            href={child.href}
            onClick={(event) => { setOpen(false); onNavigate(event, child.href); }}
          >
            {child.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function SiteNavigation({ visible, backToIntro, entered }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const burgerRef = useRef(null);
  const locale = useLocale();
  const navItems = useMemo(() => {
    const localise = (item) => ({
      ...item,
      label: uiText(item.labelKey, locale),
      children: item.children?.map(localise),
    });
    return NAV_ITEMS.map(localise);
  }, [locale]);

  // The mobile sheet covers the page, so the page behind it must not scroll.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      burgerRef.current?.focus({ preventScroll: true });
    };
  }, [menuOpen]);

  // Close the sheet if the viewport grows into the desktop layout.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1001px)");
    const close = () => { if (query.matches) setMenuOpen(false); };
    query.addEventListener("change", close);
    return () => query.removeEventListener("change", close);
  }, []);

  const goToSection = (event, href) => {
    const target = document.querySelector(href);
    if (!target) return;

    event.preventDefault();
    setMenuOpen(false);

    // Lenis owns the scroller once the experience is running; fall back to the
    // native behaviour on pages where it is not mounted.
    if (typeof window.__scrollToSection === "function") {
      window.__scrollToSection(target);
      return;
    }

    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };

  const apply = (event) => {
    event.preventDefault();
    setMenuOpen(false);
    // Re-assigning the same hash fires no event, so clear it first.
    if (window.location.hash === APPLY_HASH) window.location.hash = "";
    window.location.hash = APPLY_HASH;
  };

  return (
    <>
      <header
        className={`site-nav ${visible ? "" : "site-nav-hidden"} ${entered ? "is-entered" : ""}`}
        id="menuWrapper"
      >
        <button
          className="site-nav-brand"
          type="button"
          aria-label={uiText("backToStart", locale)}
          onClick={backToIntro}
        >
          <img
            src="/original/logo-nav-480.webp"
            width="480"
            height="67"
            alt="GreenTech Professionals"
            decoding="async"
          />
        </button>

        <nav className="site-nav-links" aria-label={uiText("sections", locale)}>
          {navItems.map((item) => (
            item.children
              ? <ServicesMenu key={item.label} item={item} onNavigate={goToSection} />
              : (
                <a
                  key={item.href}
                  className="site-nav-link"
                  href={item.href}
                  onClick={(event) => goToSection(event, item.href)}
                >
                  {item.label}
                </a>
              )
          ))}
        </nav>

        <div className="site-nav-actions">
          <LanguageSelector />

          <a className="site-nav-apply" href={APPLY_HASH} onClick={apply}>
            <span>{uiText("apply", locale)}</span>
          </a>

          <button
            ref={burgerRef}
            className={`site-nav-burger ${menuOpen ? "is-open" : ""}`}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-nav-sheet"
            aria-label={uiText(menuOpen ? "closeMenu" : "openMenu", locale)}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <i aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        id="site-nav-sheet"
        className={`site-nav-sheet ${menuOpen ? "is-open" : ""}`}
        inert={menuOpen ? undefined : true}
      >
        <nav aria-label={uiText("allSections", locale)}>
          {flatten(navItems).map((item, index) => (
            <a
              key={`${item.href}-${index}`}
              href={item.href}
              className={item.children ? "is-heading" : ""}
              onClick={(event) => goToSection(event, item.href)}
            >
              <span>{item.label}</span>
              <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </a>
          ))}
        </nav>

        <LanguageSelector mobile />

        <a className="site-nav-sheet-apply" href={APPLY_HASH} onClick={apply}>
          <span>{uiText("applyRole", locale)}</span>
          <Send size={17} strokeWidth={1.9} aria-hidden="true" />
        </a>
      </div>
    </>
  );
}

export default SiteNavigation;
