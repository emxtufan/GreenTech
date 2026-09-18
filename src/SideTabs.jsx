import React from "react";
import { FaFacebookF, FaInstagram, FaLinkedinIn } from "react-icons/fa6";
import useSiteContent from "./hooks/useSiteContent.js";
import { selectSection, sectionText } from "./lib/siteContent.js";
import "./SideTabs.css";

// Fixed social icons on the right edge. Everything is driven by the
// "social-bar" section in the admin: its "Visible on homepage" switch hides
// the bar, and an empty URL hides that one icon.
const SOCIAL_TABS = [
  { key: "facebook", label: "Facebook", field: "facebookUrl", Icon: FaFacebookF },
  { key: "instagram", label: "Instagram", field: "instagramUrl", Icon: FaInstagram },
  { key: "linkedin", label: "LinkedIn", field: "linkedinUrl", Icon: FaLinkedinIn },
];

function SideTabs() {
  const section = selectSection("social-bar", useSiteContent());
  if (!section || section.visible === false) return null;

  const tabs = SOCIAL_TABS
    .map((tab) => ({ ...tab, href: sectionText(section, tab.field).trim() }))
    .filter((tab) => tab.href);
  if (tabs.length === 0) return null;

  return (
    <nav className="side-tabs" aria-label="Social">
      {tabs.map((tab) => (
        <a
          key={tab.key}
          className={`side-tab side-tab-${tab.key}`}
          href={tab.href}
          target="_blank"
          rel="noreferrer"
          aria-label={tab.label}
          title={tab.label}
        >
          <tab.Icon size={18} aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}

export default SideTabs;
