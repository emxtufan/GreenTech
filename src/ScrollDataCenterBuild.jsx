import React, { useRef } from "react";
import ServiceSectionOverlay from "./ServiceSectionOverlay.jsx";
import ServiceSvgIllustration from "./ServiceSvgIllustration.jsx";
import useSection from "./hooks/useSection.js";
import "./ScrollDataCenterBuild.css";

// Sticky service section: the scroll-built SVG illustration sits behind the
// marquee and the service copy (see ServiceSvgIllustration).
function ScrollDataCenterBuild({ active, onPrepared }) {
  const text = useSection("data-center-service");
  const sectionRef = useRef(null);

  return (
    <section
      ref={sectionRef}
      id="service-data-center"
      className={`data-center-section ${active ? "visible" : ""}`}
      data-anchor-progress="0.85"
      aria-labelledby="service-data-center-title"
    >
      <div className="data-center-sticky">
        <ServiceSvgIllustration
          variant="data-center"
          sectionRef={sectionRef}
          active={active}
          modelKey="data-center"
          onPrepared={onPrepared}
        />
        <ServiceSectionOverlay
          active={active}
          label={text("marqueeLabel", "SERVICII")}
          index={text("eyebrow", "04 / Servicii")}
          titleId="service-data-center-title"
          title={text("title", "Constructia centrelor de date")}
          description={text("description", "Executam amenajarea spatiilor, distributia electrica, sistemele de redundanta si racire, precum si lucrarile de punere in functiune.")}
        />
      </div>
    </section>
  );
}

export default ScrollDataCenterBuild;
