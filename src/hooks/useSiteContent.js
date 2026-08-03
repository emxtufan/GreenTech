import { useEffect, useState } from "react";
import { getSiteContent, fetchSiteContent } from "../lib/siteContent.js";
import { useLocale } from "../lib/i18n.js";

/**
 * Renders immediately from the bundled baseline, then swaps in the live
 * document once the API answers. A failed request is not surfaced: the site
 * keeps showing the content it shipped with rather than an error state.
 */
export default function useSiteContent() {
  const locale = useLocale();
  const [content, setContent] = useState(() => getSiteContent(locale));

  useEffect(() => {
    const controller = new AbortController();
    setContent(getSiteContent(locale));

    fetchSiteContent({ signal: controller.signal, locale })
      .then(setContent)
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.warn("Falling back to bundled site content:", error.message);
        }
      });

    return () => controller.abort();
  }, [locale]);

  return content;
}
