import React, { useRef } from "react";
import ServiceSectionOverlay from "./ServiceSectionOverlay.jsx";
import ServiceSvgIllustration from "./ServiceSvgIllustration.jsx";
import useSection from "./hooks/useSection.js";
import "./ScrollElectricalInspection.css";

// Sticky service section: the scroll-built SVG illustration sits behind the
// marquee and the service copy (see ServiceSvgIllustration).
function ScrollElectricalInspection({ active, onPrepared }) {
  const text = useSection("electrical-service");
  const sectionRef = useRef(null);

  return (
    <section
      ref={sectionRef}
      id="service-electrical"
      className={`electrical-inspection-section ${active ? "visible" : ""}`}
      data-anchor-progress="0.85"
      aria-labelledby="service-electrical-title"
    >
      <div className="electrical-inspection-sticky">
        <ServiceSvgIllustration
          variant="electrical"
          sectionRef={sectionRef}
          active={active}
          modelKey="electrical-inspection"
          onPrepared={onPrepared}
        />
        <ServiceSectionOverlay
          active={active}
          label={text("marqueeLabel", "SERVICII")}
          index={text("eyebrow", "02 / Servicii")}
          titleId="service-electrical-title"
          title={text("title", "Inspectii si verificari electrice")}
          description={text("description", "Realizam masuratori, termografie, verificari PRAM si documentatie pentru tablouri, echipamente si retele de distributie.")}
        />
      </div>
    </section>
  );
}

export default ScrollElectricalInspection;
