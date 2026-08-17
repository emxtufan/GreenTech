import React, { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, BadgeDollarSign, SolarPanel, Zap } from "lucide-react";
import { motion } from "motion/react";
import BlogSection from "./BlogSection.jsx";
import BlurText from "./BlurText.jsx";
import CompanyProofSection from "./CompanyProofSection.jsx";
import CountUp from "./CountUp.jsx";
import FaqSection from "./FaqSection.jsx";
import HorizontalParallaxGallery from "./HorizontalParallaxGallery.jsx";
import LogoLoop from "./LogoLoop.jsx";
import ScrollConstructionServices from "./ScrollConstructionServices.jsx";
import ScrollDataCenterBuild from "./ScrollDataCenterBuild.jsx";
import ScrollElectricalInspection from "./ScrollElectricalInspection.jsx";
import ScrollSolarAssembly from "./ScrollSolarAssembly.jsx";
import ScrollStack, { ScrollStackItem } from "./ScrollStack.jsx";
import ScrollWindTurbine from "./ScrollWindTurbine.jsx";
import SolarContactSection from "./SolarContactSection.jsx";
import useSiteContent from "./hooks/useSiteContent.js";
import useSection from "./hooks/useSection.js";
import {
  selectClientLogos,
  selectGalleryItems,
  selectImpactStats,
  selectProcessCards,
} from "./lib/siteContent.js";
import { TOUCH_VISUAL_EASE, usesNativeTouchScroll } from "./scrollMotion.js";

const impactStatIcons = { Zap, SolarPanel, BadgeCheck, BadgeDollarSign };

const processCardThemeClasses = {
  design: "project-stack-card-design",
  build: "project-stack-card-build",
  care: "project-stack-card-care",
};

function AnimatedImpactValue({ value }) {
  const displayValue = String(value ?? "");
  const numberMatch = displayValue.match(/-?\d[\d,]*(?:\.\d+)?/);

  if (!numberMatch) return displayValue;

  const numberText = numberMatch[0];
  const target = Number(numberText.replace(/,/g, ""));
  if (!Number.isFinite(target)) return displayValue;

  const numberStart = numberMatch.index ?? 0;
  const prefix = displayValue.slice(0, numberStart);
  const suffix = displayValue.slice(numberStart + numberText.length);

  return (
    <span className="impact-stat-value-animated" aria-hidden="true">
      {prefix}
      <span
        className="impact-stat-count"
        style={{ minWidth: `${Math.max(numberText.length, 1) * 0.62}em` }}
      >
        <CountUp
          from={0}
          to={target}
          separator="," 
          direction="up"
          duration={1}
          className="count-up-text"
          delay={0}
        />
      </span>
      {suffix}
    </span>
  );
}

function useViewportReveal(enabled, revealAt = 0.88) {
  const targetRef = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setRevealed(false);
      return undefined;
    }

    if (revealed) return undefined;

    const target = targetRef.current;
    if (!target) return undefined;

    let animationFrame = 0;
    const visualViewport = window.visualViewport;

    const updateReveal = () => {
      animationFrame = 0;
      const bounds = target.getBoundingClientRect();
      const viewportHeight = visualViewport?.height || window.innerHeight;

      if (bounds.top <= viewportHeight * revealAt && bounds.bottom >= 0) {
        setRevealed(true);
      }
    };

    const scheduleReveal = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateReveal);
    };

    scheduleReveal();
    window.addEventListener("scroll", scheduleReveal, { passive: true });
    window.addEventListener("resize", scheduleReveal);
    visualViewport?.addEventListener("scroll", scheduleReveal, { passive: true });
    visualViewport?.addEventListener("resize", scheduleReveal);

    return () => {
      window.removeEventListener("scroll", scheduleReveal);
      window.removeEventListener("resize", scheduleReveal);
      visualViewport?.removeEventListener("scroll", scheduleReveal);
      visualViewport?.removeEventListener("resize", scheduleReveal);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [enabled, revealAt, revealed]);

  return [targetRef, revealed];
}

function FinalSection({ entered }) {
  const content = useSiteContent();
  const companyText = useSection("company-overview");
  const companyVideoText = useSection("company-video");
  const clientsText = useSection("clients");
  const configuredCompanyVideoUrl = companyVideoText("videoUrl", "/video.mp4");
  const companyVideoUrl = configuredCompanyVideoUrl.trim() || "/video.mp4";
  const companyVideoEyebrow = companyVideoText("eyebrow", "Company film");
  const companyVideoTitle = companyVideoText("title", "Work delivered in the field");
  const companyVideoDescription = companyVideoText(
    "description",
    "Looping company video that starts when the section reaches the top of the viewport.",
  );
  const hasCompanyVideoHeading = Boolean(companyVideoEyebrow || companyVideoTitle);
  const hasCompanyVideoCopy = Boolean(hasCompanyVideoHeading || companyVideoDescription);
  const impactStats = selectImpactStats(content);
  const clientLogos = selectClientLogos(content).map((logo) => ({
    ...logo,
    src: logo.image ?? logo.src,
  }));
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const [introRef, introRevealed] = useViewportReveal(entered);
  const [clientsRef, clientsRevealed] = useViewportReveal(entered, 0.9);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return undefined;

    let sectionReachedTop = false;
    let animationFrame = 0;

    const resetVideo = () => {
      video.pause();
      if (video.readyState > 0) video.currentTime = 0;
    };

    const playFromStart = () => {
      if (video.readyState > 0) video.currentTime = 0;
      video.play()?.catch(() => {});
    };

    const updatePlayback = () => {
      animationFrame = 0;
      const bounds = section.getBoundingClientRect();
      const shouldPlay = entered && bounds.top <= 1 && bounds.bottom > 0;
      if (shouldPlay === sectionReachedTop) return;

      sectionReachedTop = shouldPlay;
      if (shouldPlay) playFromStart();
      else resetVideo();
    };

    const scheduleUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updatePlayback);
    };

    const handleLoadedMetadata = () => {
      if (sectionReachedTop) playFromStart();
    };

    resetVideo();
    updatePlayback();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      window.cancelAnimationFrame(animationFrame);
      resetVideo();
    };
  }, [companyVideoUrl, entered]);

  return (
    <section
      ref={sectionRef}
      id="company"
      className={`final-section ${entered ? "visible" : ""}`}
      aria-labelledby="final-section-title"
      data-wind-stage="company"
    >
      <div className="final-section-inner">
        <header ref={introRef} className="final-section-intro">
          <BlurText
            as="h1"
            id="final-section-title"
            text={companyText("title", "GreenTech Professionals SRL")}
            play={introRevealed}
            animateBy="letters"
            direction="top"
            delay={55}
            stepDuration={0.45}
          />
          <motion.p
            initial={false}
            animate={introRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
            transition={{ duration: 0.7, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            {companyText(
              "description",
              "GreenTech Professionals is an electrical and construction company with experience in electrical and mechanical works in the photovoltaic field.",
            )}
          </motion.p>
        </header>

        <div className="impact-network">
          <div className="impact-stats">
            {impactStats.map(({ id, value, label, icon }) => {
              const Icon = impactStatIcons[icon] ?? Zap;

              return (
                <article className="impact-stat" key={id ?? label}>
                  <span className="impact-stat-icon" aria-hidden="true">
                    <Icon size={30} strokeWidth={1.45} />
                  </span>
                  <strong aria-label={String(value)}>
                    <AnimatedImpactValue value={value} />
                  </strong>
                  <span className="impact-stat-label">{label}</span>
                </article>
              );
            })}
          </div>
        </div>

        <section
          className="company-video"
          aria-labelledby={companyVideoTitle ? "company-video-title" : undefined}
          aria-label={companyVideoTitle ? undefined : "Company video"}
        >
          <div className="company-video-frame">
            <video
              key={companyVideoUrl}
              ref={videoRef}
              src={companyVideoUrl}
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={companyVideoTitle || "GreenTech Professionals company film"}
            />
          </div>
          {hasCompanyVideoCopy && (
            <div className="company-video-copy">
              {hasCompanyVideoHeading && (
                <div className="company-video-heading">
                  {companyVideoEyebrow && <span>{companyVideoEyebrow}</span>}
                  {companyVideoTitle && (
                    <BlurText
                      as="h2"
                      id="company-video-title"
                      text={companyVideoTitle}
                      play={entered}
                      animateBy="letters"
                      direction="top"
                      delay={55}
                      stepDuration={0.45}
                    />
                  )}
                </div>
              )}
              {companyVideoDescription && <p>{companyVideoDescription}</p>}
            </div>
          )}
        </section>

        <section ref={clientsRef} className="clients-showcase" aria-labelledby="clients-title">
          <BlurText
            as="h2"
            id="clients-title"
            text={clientsText("title", "Our Clients")}
            play={clientsRevealed}
            animateBy="letters"
            direction="top"
            delay={55}
            stepDuration={0.45}
          />
          <motion.p
            initial={false}
            animate={clientsRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
            transition={{ duration: 0.9, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {clientsText(
              "description",
              "Selected client relationships across energy, mobility and infrastructure.",
            )}
          </motion.p>
          <motion.div
            className="clients-loop"
            initial={false}
            animate={clientsRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 1, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <LogoLoop
              logos={clientLogos}
              speed={54}
              direction="left"
              logoHeight={58}
              gap={28}
              hoverSpeed={12}
              scaleOnHover
              fadeOut
              fadeOutColor="#000000"
              ariaLabel="Our clients"
            />
          </motion.div>
        </section>
      </div>
    </section>
  );
}

function StackSection({ entered }) {
  const cards = selectProcessCards(useSiteContent());
  const processText = useSection("work-process");
  const introRef = useRef(null);
  const releaseStartRef = useRef(null);
  const releaseFrameRef = useRef(0);
  const releaseVisualRef = useRef(0);

  const handleStackComplete = useCallback(({ scrollStart }) => {
    releaseStartRef.current = scrollStart;
  }, []);

  useEffect(() => {
    const intro = introRef.current;
    if (!intro) return undefined;

    if (!entered) {
      releaseStartRef.current = null;
      releaseVisualRef.current = 0;
      intro.style.transform = "";
      return undefined;
    }

    const smoothVisuals = usesNativeTouchScroll();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateIntroRelease = () => {
      releaseFrameRef.current = 0;
      const releaseStart = releaseStartRef.current;
      if (releaseStart === null) {
        releaseVisualRef.current = 0;
        intro.style.transform = "";
        return;
      }

      const releaseDistance = Math.max(0, window.scrollY - releaseStart);
      const maxReleaseDistance = intro.offsetHeight + 100;
      const targetTranslateY = Math.min(releaseDistance, maxReleaseDistance);
      const ease = smoothVisuals && !reducedMotion.matches ? TOUCH_VISUAL_EASE : 1;
      const nextTranslateY = releaseVisualRef.current
        + (targetTranslateY - releaseVisualRef.current) * ease;
      const translateY = Math.abs(targetTranslateY - nextTranslateY) < 0.1
        ? targetTranslateY
        : nextTranslateY;

      releaseVisualRef.current = translateY;
      intro.style.transform = translateY > 0 ? `translate3d(0, ${-translateY}px, 0)` : "";

      if (translateY !== targetTranslateY) {
        releaseFrameRef.current = window.requestAnimationFrame(updateIntroRelease);
      }
    };

    const scheduleIntroRelease = () => {
      if (releaseFrameRef.current) return;
      releaseFrameRef.current = window.requestAnimationFrame(updateIntroRelease);
    };

    window.addEventListener("scroll", scheduleIntroRelease, { passive: true });
    window.addEventListener("resize", scheduleIntroRelease);

    return () => {
      window.removeEventListener("scroll", scheduleIntroRelease);
      window.removeEventListener("resize", scheduleIntroRelease);
      window.cancelAnimationFrame(releaseFrameRef.current);
      releaseVisualRef.current = 0;
      intro.style.transform = "";
    };
  }, [entered]);

  return (
    <section
      id="process"
      className={`process-section ${entered ? "visible" : ""}`}
      aria-labelledby="process-section-title"
      data-wind-stage="process"
    >
      <div className="process-section-inner">
        <header className="process-section-intro" ref={introRef}>
          <span>{processText("eyebrow", "Process")}</span>
          <h2 id="process-section-title">{processText("title", "Our Work Process")}</h2>
          <p>
            {processText(
              "description",
              "A compact view of how GreenTech Professionals moves a photovoltaic project from technical decisions to reliable field execution.",
            )}
          </p>
        </header>

        <ScrollStack
          className="project-scroll-stack"
          stackPosition="36%"
          scaleEndPosition="23%"
          rotationAmount={0}
          onStackComplete={handleStackComplete}
        >
          {cards.map((card) => {
            const themeClass = processCardThemeClasses[card.theme]
              ?? processCardThemeClasses.design;

            return (
              <ScrollStackItem
                key={card.id}
                itemClassName={`project-stack-card ${themeClass}`}
              >
                <span className="project-stack-number">{card.number}</span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </ScrollStackItem>
            );
          })}
        </ScrollStack>
        <div className="process-section-release-space" aria-hidden="true" />
      </div>
    </section>
  );
}

function PostExperienceSections({
  entered,
  prepare3d = false,
  onPreparationProgress,
  onOpenPost,
  onOpenProject,
  onShowAllProjects,
}) {
  const galleryItems = selectGalleryItems(useSiteContent());
  const preparedModelsRef = useRef(new Set());

  const handleModelPrepared = useCallback((key, success) => {
    if (!success) return;
    if (preparedModelsRef.current.has(key)) return;
    preparedModelsRef.current.add(key);
    onPreparationProgress?.(
      Math.round((preparedModelsRef.current.size / 6) * 100),
    );
  }, [onPreparationProgress]);

  useEffect(() => {
    onPreparationProgress?.(
      Math.round((preparedModelsRef.current.size / 6) * 100),
    );
  }, [onPreparationProgress]);

  return (
    <>
      <ScrollWindTurbine
        active={entered}
        prepare={prepare3d}
        onPrepared={handleModelPrepared}
      />
      <FinalSection entered={entered} />
      <StackSection entered={entered} />
      <HorizontalParallaxGallery
        entered={entered}
        items={galleryItems}
        onProjectOpen={onOpenProject}
        onShowAllProjects={onShowAllProjects}
      />
      <CompanyProofSection active={entered} />
      <ScrollSolarAssembly
        active={entered}
        prepare={prepare3d}
        onPrepared={handleModelPrepared}
      />
      <ScrollElectricalInspection
        active={entered}
        prepare={prepare3d}
        onPrepared={handleModelPrepared}
      />
      <ScrollConstructionServices
        active={entered}
        prepare={prepare3d}
        onPrepared={handleModelPrepared}
      />
      <ScrollDataCenterBuild
        active={entered}
        prepare={prepare3d}
        onPrepared={handleModelPrepared}
      />
      <BlogSection active={entered} onPostOpen={onOpenPost} />
      <FaqSection active={entered} />
      <SolarContactSection
        active={entered}
        prepare={prepare3d}
        onPrepared={handleModelPrepared}
        onShowAllProjects={onShowAllProjects}
      />
    </>
  );
}

export default PostExperienceSections;
