import { useCallback } from "react";
import { selectSection, sectionText } from "../lib/siteContent.js";
import useSiteContent from "./useSiteContent.js";

/**
 * Copy for one homepage section, with the component's own markup as fallback.
 *
 *   const text = useSection("intro-hero");
 *   <h1>{text("title", "Welcome to GreenTech Professionals")}</h1>
 *
 * Fallback copy is used only when a field is absent. A field cleared in admin
 * remains empty on the public site.
 */
export default function useSection(id) {
  const section = selectSection(id, useSiteContent());
  return useCallback(
    (field, fallback = "") => sectionText(section, field, fallback),
    [section],
  );
}
