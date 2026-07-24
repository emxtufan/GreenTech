import React from "react";
import ScrollVelocity from "./ScrollVelocity.jsx";
import "./ServiceSectionOverlay.css";

// Shared chrome for the scroll-driven 3D service sections: a decorative
// marquee ribbon on top and the readable service copy underneath the model.
function ServiceSectionOverlay({
  index,
  title,
  description,
  label = "SERVICES",
  titleId,
}) {
  return (
    <>
      <div className="service-overlay-marquee" aria-hidden="true">
        <ScrollVelocity
          texts={[label]}
          velocity={90}
          className="service-overlay-marquee-text"
          numCopies={8}
          damping={50}
          stiffness={400}
          parallaxClassName="service-overlay-parallax"
          scrollerClassName="service-overlay-scroller"
        />
      </div>

      <div className="service-overlay-copy">
        <div className="service-overlay-copy-inner">
          <span className="service-overlay-index" aria-hidden="true">
            {index}
          </span>
          <h2 className="service-overlay-title" id={titleId}>
            {title}
          </h2>
          <p className="service-overlay-description">{description}</p>
        </div>
      </div>
    </>
  );
}

export default ServiceSectionOverlay;
