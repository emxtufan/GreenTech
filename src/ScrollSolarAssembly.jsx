import React, { useRef } from "react";
import ServiceSectionOverlay from "./ServiceSectionOverlay.jsx";
import ServiceSvgIllustration from "./ServiceSvgIllustration.jsx";
import useSection from "./hooks/useSection.js";
import "./ScrollSolarAssembly.css";

// Sticky service section: the scroll-built SVG illustration sits behind the
// marquee and the service copy (see ServiceSvgIllustration).
function ScrollSolarAssembly({ active, onPrepared }) {
  const text = useSection("photovoltaic-service");
  const sectionRef = useRef(null);

  return (
    <section
      ref={sectionRef}
      id="service-photovoltaic"
      className={`solar-assembly-section ${active ? "visible" : ""}`}
      data-anchor-progress="0.85"
      aria-labelledby="service-solar-title"
    >
      <div className="solar-assembly-sticky">
        <ServiceSvgIllustration
          variant="solar"
          sectionRef={sectionRef}
          active={active}
          modelKey="solar-assembly"
          onPrepared={onPrepared}
        />
        <ServiceSectionOverlay
          active={active}
          label={text("marqueeLabel", "SERVICII")}
          index={text("eyebrow", "01 / Servicii")}
          titleId="service-solar-title"
          title={text("title", "Constructia parcurilor fotovoltaice")}
          description={text("description", "Executam montajul structurilor si modulelor, cablarea DC si AC, instalarea invertoarelor, testarile si pregatirea pentru racordare.")}
        />
      </div>
    </section>
  );
}

export default ScrollSolarAssembly;
