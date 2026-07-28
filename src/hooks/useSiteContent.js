import { useEffect, useState } from "react";
import { getSiteContent, fetchSiteContent } from "../lib/siteContent.js";

/**
 * Renders immediately from the bundled baseline, then swaps in the live
 * document once the API answers. A failed request is not surfaced: the site
 * keeps showing the content it shipped with rather than an error state.
 */
export default function useSiteContent() {
  const [content, setContent] = useState(getSiteContent);

  useEffect(() => {
    const controller = new AbortController();

    fetchSiteContent({ signal: controller.signal })
      .then(setContent)
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.warn("Falling back to bundled site content:", error.message);
        }
      });

    return () => controller.abort();
  }, []);

  return content;
}
