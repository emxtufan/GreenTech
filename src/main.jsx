import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BadgeCheck, BadgeDollarSign, SolarPanel, Zap } from "lucide-react";
import { motion } from "motion/react";
import {
  EnpowerExperience,
  SCENE_COUNT,
  SCROLL_HEIGHT,
  SCROLL_SEGMENT,
} from "./enpower3d.js";
import LogoLoop from "./LogoLoop.jsx";
import ScrollStack, { ScrollStackItem } from "./ScrollStack.jsx";
import HorizontalParallaxGallery from "./HorizontalParallaxGallery.jsx";
import ScrollWindTurbine from "./ScrollWindTurbine.jsx";
import ScrollSolarAssembly from "./ScrollSolarAssembly.jsx";
import ScrollElectricalInspection from "./ScrollElectricalInspection.jsx";
import ScrollConstructionServices from "./ScrollConstructionServices.jsx";
import ScrollDataCenterBuild from "./ScrollDataCenterBuild.jsx";
import FaqSection from "./FaqSection.jsx";
import SolarContactSection from "./SolarContactSection.jsx";
import CompanyProofSection from "./CompanyProofSection.jsx";
import BlogSection from "./BlogSection.jsx";
import BlogPostPage from "./BlogPostPage.jsx";
import ProjectDetailPage from "./ProjectDetailPage.jsx";
import AllProjectsPage from "./AllProjectsPage.jsx";
import SectionActionModal, { useSectionAction } from "./SectionAction.jsx";
import useExperienceScrollController from "./useExperienceScrollController.js";
import { TOUCH_VISUAL_EASE, usesNativeTouchScroll } from "./scrollMotion.js";
import {
  selectClientLogos,
  selectBlogPosts,
  selectGalleryItems,
  selectHeroCards,
  selectImpactStats,
  selectProcessCards,
} from "./lib/siteContent.js";
import useSiteContent from "./hooks/useSiteContent.js";
import useSection from "./hooks/useSection.js";
import "./styles.css?=122222";
import BlurText from "./BlurText";
import CountUp from "./CountUp.jsx";
import SiteNavigation from "./SiteNavigation.jsx";

// Icons cannot live in JSON, so content stores a name and this map resolves it.
const impactStatIcons = { Zap, SolarPanel, BadgeCheck, BadgeDollarSign };

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

// Which hero cards render the graph treatment — a UI behaviour, not content.
const graphSections = new Set([0, 1, 4, 5]);

const processCardThemeClasses = {
  design: "project-stack-card-design",
  build: "project-stack-card-build",
  care: "project-stack-card-care",
};

// Baselines for first paint; live values come from useSiteContent below.
const processCards = selectProcessCards();

const heroSurfaces = [
  "#fff8e8",
  "#edf8f7",
  "#f2f5f2",
  "#f3f8eb",
  "#eff7f1",
  "#f2f7f2",
];

function useEnpower3d({ dark, highQuality, setLoaded, setReady, setActive, setEntered }) {
  const mountRef = useRef(null);
  const experienceRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return undefined;
    const experience = new EnpowerExperience(mountRef.current, {
      dark,
      highQuality,
      onProgress: setLoaded,
      onReady: () => {
        setReady(true);
        const requestedScene = Number.parseInt(new URLSearchParams(window.location.search).get("scene"), 10);
        if (Number.isInteger(requestedScene) && requestedScene >= 0 && requestedScene < SCENE_COUNT) {
          experience.enter();
          window.setTimeout(() => {
            window.scrollTo(0, requestedScene * SCROLL_SEGMENT + 1);
          }, 50);
        }
      },
      onActiveChange: setActive,
      onEnter: () => setEntered(true),
      onExit: () => setEntered(false),
    });
    experienceRef.current = experience;
    return () => {
      experience.dispose();
      experienceRef.current = null;
    };
  }, []);

  useEffect(() => {
    experienceRef.current?.setDark(dark);
  }, [dark]);

  useEffect(() => {
    experienceRef.current?.setQuality(highQuality);
  }, [highQuality]);

  return { mountRef, experienceRef };
}

function LogoMark() {
  return (
    <span className="loader-logo-mark">
      <img src="/original/LOGO-BUN-Transparent.png.webp" alt="" />
    </span>
  );
}


function useScrollAwareNavigation(enabled) {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const animationFrame = useRef(0);

  useEffect(() => {
    lastScrollY.current = Math.max(0, window.scrollY);

    if (!enabled) {
      setVisible(true);
      return undefined;
    }

    const updateVisibility = () => {
      animationFrame.current = 0;
      const currentScrollY = Math.max(0, window.scrollY);
      const distance = currentScrollY - lastScrollY.current;

      if (currentScrollY <= 24) {
        setVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      if (Math.abs(distance) >= 6) {
        setVisible(distance < 0);
        lastScrollY.current = currentScrollY;
      }
    };

    const handleScroll = () => {
      if (animationFrame.current) return;
      animationFrame.current = window.requestAnimationFrame(updateVisibility);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.cancelAnimationFrame(animationFrame.current);
    };
  }, [enabled]);

  return visible;
}

function Navigation({ backToIntro, entered }) {
  const visible = useScrollAwareNavigation(entered);
  return <SiteNavigation visible={visible} backToIntro={backToIntro} entered={entered} />;
}

function Card({ active, entered }) {
  const sections = selectHeroCards(useSiteContent());
  const section = sections[active] ?? sections[0];
  const [expandedSectionKey, setExpandedSectionKey] = useState(null);

  useEffect(() => {
    if (!entered) setExpandedSectionKey(null);
  }, [entered]);

  if (!section) return null;

  const hasGraph = graphSections.has(section.sourceIndex);
  const expanded = expandedSectionKey === section.id;
  // Body copy is one field in the admin; blank lines separate paragraphs.
  const paragraphs = String(section.body ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const toggleExpanded = (event) => {
    event.stopPropagation();
    setExpandedSectionKey((currentKey) => (
      currentKey === section.id ? null : section.id
    ));
  };

  return (
    <aside
      className={`cards ${entered ? "visible" : ""} ${expanded ? "expanded" : ""}`}
      id={`card_content_${active}`}
      data-lenis-prevent
    >
      <header className="card-header">
        <BlurText
          key={`${section.id}-${entered ? "visible" : "hidden"}`}
          as="h2"
          text={section.title}
          play={entered}
          delay={200}
          animateBy="words"
          direction="top"
        />
        <span className="card-range">[{active + 1}]</span>
      </header>
      <div className="card-info">
        {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {section.footnote && <p className="card-footnote">{section.footnote}</p>}
        
        {active === sections.length - 1 && (
          <a className="future-link" href="/products">Invest in the sustainability of your future</a>
        )}
      </div>
      <button
        className="card-toggle"
        type="button"
        aria-label={expanded ? "Hide info" : "Show info"}
        aria-expanded={expanded}
        onClick={toggleExpanded}
      >
        <span aria-hidden="true" />
      </button>
    </aside>
  );
}

function Intro({ entered, ready, enter }) {
  const text = useSection("intro-hero");
  const introAction = useSectionAction("intro-hero", {
    label: "Click to explore",
    mode: "builtin",
  });

  return (
    <section className={`intro ${entered ? "hidden" : ""}`} id="introUi">
      <div className="intro-content">
        <h1 className="intro-title">
          {text("title", "Welcome to GreenTech Professionals")}
        </h1>
        <p className="intro-copy">
          {text(
            "description",
            "Electrical, mechanical and photovoltaic solutions built for a cleaner, more efficient future.",
          )}
        </p>
        {introAction.visible && (
          <button
            className="intro-cta"
            type="button"
            onClick={(event) => introAction.activate(event, enter)}
            disabled={introAction.mode === "builtin" && !ready}
          >
            <span>{introAction.label}</span>
            <span className="intro-cta-arrow" aria-hidden="true">{"\u2192"}</span>
          </button>
        )}
      </div>
      <SectionActionModal {...introAction.modalProps} />
    </section>
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
  // LogoLoop expects `src`; the content file stores images under `image`.
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
      const playPromise = video.play();
      playPromise?.catch(() => {});
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
            animate={introRevealed
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 14 }}
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
            animate={clientsRevealed
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 14 }}
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
            animate={clientsRevealed
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 20 }}
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
      const ease = smoothVisuals && !reducedMotion.matches
        ? TOUCH_VISUAL_EASE
        : 1;
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
          <h2 id="process-section-title">
            {processText("title", "Our Work Process")}
          </h2>
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
            const themeClass =
              processCardThemeClasses[card.theme] ?? processCardThemeClasses.design;

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

function Preloader({ loaded, ready }) {
  return (
    <div className={`preloader ${ready ? "done" : ""}`} id="preloaderWrapper">
      <div className="loader-logo" id="logoWrapper">
        <LogoMark />
        <p>Greentech Professionals is an electrical and construction company with experience in electrical and mechanical works in the photovoltaic field.</p>
      </div>
    </div>
  );
}

function App({ onOpenProject, onShowAllProjects, onOpenPost, routeOpen }) {
  const galleryItems = selectGalleryItems(useSiteContent());
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [active, setActive] = useState(0);
  const [dark, setDark] = useState(false);
  const [highQuality, setHighQuality] = useState(true);
  const sceneRef = useRef(null);
  const postExperienceRef = useRef(null);
  const { mountRef, experienceRef } = useEnpower3d({
    dark,
    highQuality,
    setLoaded,
    setReady,
    setActive,
    setEntered,
  });

  useEffect(() => {
    document.documentElement.dataset.mode = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    const root = document.documentElement;
    const heroSurface = dark ? "#141414" : heroSurfaces[active] ?? heroSurfaces[0];
    root.style.setProperty("--hero-surface", heroSurface);
  }, [active, dark]);

  const prepareForHeroNavigation = useExperienceScrollController({
    entered,
    projectOpen: routeOpen,
    sceneRef,
    postExperienceRef,
    experienceRef,
  });

  const enter = useCallback(() => {
    experienceRef.current?.enter();
  }, [experienceRef]);

  const backToIntro = useCallback(() => {
    prepareForHeroNavigation();
    experienceRef.current?.returnToIntro();
  }, [experienceRef, prepareForHeroNavigation]);

  return (
    <main
      className={`page ${entered ? "entered" : ""}`}
      id="home"
      inert={routeOpen}
      aria-hidden={routeOpen ? "true" : undefined}
    >
      <div className="experience-scroll">
        <div
          ref={sceneRef}
          className={`scene ${ready ? "ready" : ""}`}
          id="scene3d"
        >
          <div className="canvas-wrapper" ref={mountRef} />
          <Card active={active} entered={entered} />
        </div>
        <div
          className="scroll-space"
          style={{ height: entered ? `${SCROLL_HEIGHT}px` : 0 }}
        />
      </div>
      <Navigation backToIntro={backToIntro} entered={entered} />
      <Intro entered={entered} ready={ready} enter={enter} />
      <Preloader loaded={loaded} ready={ready} />
      <div ref={postExperienceRef} className="post-experience-sections">
        <ScrollWindTurbine active={entered} />
        <FinalSection entered={entered} />
        <StackSection entered={entered} />
        <HorizontalParallaxGallery
          entered={entered}
          items={galleryItems}
          onProjectOpen={onOpenProject}
          onShowAllProjects={onShowAllProjects}
        />
        <CompanyProofSection active={entered} />
        <ScrollSolarAssembly active={entered} />
        <ScrollElectricalInspection active={entered} />
        <ScrollConstructionServices active={entered} />
        <ScrollDataCenterBuild active={entered} />
        <BlogSection
          active={entered}
          onPostOpen={onOpenPost}
        />
        <FaqSection active={entered} />
        <SolarContactSection
          active={entered}
          onShowAllProjects={onShowAllProjects}
        />
      </div>
    </main>
  );
}

function getSiteRouteFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  const postId = searchParams.get("post");
  const projectId = postId ? null : searchParams.get("project");

  return {
    projectId,
    postId,
    projectsIndexOpen:
      !projectId && !postId && searchParams.get("projects") === "all",
  };
}

function getProjectUrl(projectId) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("project", projectId);
  return `${url.pathname}${url.search}${url.hash}`;
}

function getProjectsIndexUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("projects", "all");
  return `${url.pathname}${url.search}${url.hash}`;
}

function getBlogPostUrl(postId) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("post", postId);
  return `${url.pathname}${url.search}${url.hash}`;
}

function Root() {
  const routeContent = useSiteContent();
  const routedProjects = selectGalleryItems(routeContent);
  const routedBlogPosts = selectBlogPosts(routeContent);
  const [routeState, setRouteState] = useState(getSiteRouteFromUrl);
  const { projectId, postId, projectsIndexOpen } = routeState;

  useEffect(() => {
    const handlePopState = () => setRouteState(getSiteRouteFromUrl());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const openProject = useCallback((nextProjectId) => {
    window.history.pushState(
      { projectOverlay: true },
      "",
      getProjectUrl(nextProjectId),
    );
    setRouteState({
      projectId: nextProjectId,
      postId: null,
      projectsIndexOpen: false,
    });
  }, []);

  const changeProject = useCallback((nextProjectId) => {
    window.history.replaceState(
      { ...window.history.state, projectOverlay: true },
      "",
      getProjectUrl(nextProjectId),
    );
    setRouteState({
      projectId: nextProjectId,
      postId: null,
      projectsIndexOpen: false,
    });
  }, []);

  const openProjectsIndex = useCallback(() => {
    window.history.pushState(
      { projectsIndex: true },
      "",
      getProjectsIndexUrl(),
    );
    setRouteState({ projectId: null, postId: null, projectsIndexOpen: true });
  }, []);

  const openBlogPost = useCallback((nextPostId) => {
    window.history.pushState(
      { blogPostOverlay: true },
      "",
      getBlogPostUrl(nextPostId),
    );
    setRouteState({
      projectId: null,
      postId: nextPostId,
      projectsIndexOpen: false,
    });
  }, []);

  const closeProject = useCallback(() => {
    if (window.history.state?.projectOverlay) {
      window.history.back();
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("project");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setRouteState({ projectId: null, postId: null, projectsIndexOpen: false });
  }, []);

  const closeProjectsIndex = useCallback(() => {
    if (window.history.state?.projectsIndex) {
      window.history.back();
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("projects");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setRouteState({ projectId: null, postId: null, projectsIndexOpen: false });
  }, []);

  const closeBlogPost = useCallback(() => {
    if (window.history.state?.blogPostOverlay) {
      window.history.back();
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("post");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setRouteState({ projectId: null, postId: null, projectsIndexOpen: false });
  }, []);

  const projectIndex = routedProjects.findIndex((item) => item.id === projectId);
  const project = projectIndex >= 0 ? routedProjects[projectIndex] : null;
  const nextProject = project
    ? routedProjects[(projectIndex + 1) % routedProjects.length]
    : null;
  const blogPost = routedBlogPosts.find((post) => post.id === postId) ?? null;

  return (
    <>
      <App
        onOpenProject={openProject}
        onShowAllProjects={openProjectsIndex}
        onOpenPost={openBlogPost}
        routeOpen={Boolean(project) || Boolean(blogPost) || projectsIndexOpen}
      />
      {projectsIndexOpen && (
        <AllProjectsPage
          projects={routedProjects}
          onClose={closeProjectsIndex}
          onProjectOpen={openProject}
        />
      )}
      {project && (
        <ProjectDetailPage
          project={project}
          nextProject={nextProject}
          onClose={closeProject}
          onProjectOpen={changeProject}
        />
      )}
      {blogPost && (
        <BlogPostPage
          post={blogPost}
          onClose={closeBlogPost}
          onProjectOpen={changeProject}
        />
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
