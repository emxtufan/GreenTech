import React, { useRef } from "react";
import ServiceSectionOverlay from "./ServiceSectionOverlay.jsx";
import ServiceSvgIllustration from "./ServiceSvgIllustration.jsx";
import useSection from "./hooks/useSection.js";
import "./ScrollConstructionServices.css";

// Sticky service section: the scroll-built SVG illustration sits behind the
// marquee and the service copy (see ServiceSvgIllustration).
function ScrollConstructionServices({ active, onPrepared }) {
  const text = useSection("construction-service");
  const sectionRef = useRef(null);

  return (
    <section
      ref={sectionRef}
      id="service-construction"
      className={`construction-services-section ${active ? "visible" : ""}`}
      data-anchor-progress="0.85"
      aria-labelledby="service-construction-title"
    >
      <div className="construction-services-sticky">
        <ServiceSvgIllustration
          variant="construction"
          sectionRef={sectionRef}
          active={active}
          modelKey="construction-services"
          onPrepared={onPrepared}
        />
        <ServiceSectionOverlay
          active={active}
          label={text("marqueeLabel", "SERVICII")}
          index={text("eyebrow", "03 / Servicii")}
          titleId="service-construction-title"
          title={text("title", "Servicii de constructii")}
          description={text("description", "Executam lucrari civile si structurale pentru obiective energetice, de la organizarea santierului pana la predarea lucrarilor.")}
        />
      </div>
    </section>
  );
}

export default ScrollConstructionServices;
