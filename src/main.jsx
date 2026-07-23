import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BadgeCheck, BadgeDollarSign, SolarPanel, Zap } from "lucide-react";
import { SiNextdotjs, SiReact, SiTailwindcss, SiTypescript } from "react-icons/si";
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
import ProjectDetailPage from "./ProjectDetailPage.jsx";
import horizontalGalleryData from "./data/horizontal-gallery.json";
import processCardsData from "./data/process-cards.json";
import "./styles.css";

const sections = [
  {
    key: "solar",
    sourceIndex: 0,
    title: "Construction of Photovoltaic Parks",
    paragraphs: [
      "Solar is an abundant and cheap source of energy in South Africa. For customers with existing on-site solar panels, the addition of wheeled solar can boost renewable energy penetration by up to 50%, without the need for capital expenditure.",
    ],
  },
  {
    key: "wind",
    sourceIndex: 1,
    title: "Construction of Wind Parks",
    paragraphs: [
      "Wind power, an intermittent resource with high potential in South Africa, generates power primarily during the mornings and evenings, perfectly complementing solar. A blend of off-site solar and wind energy can potentially elevate renewable energy penetration by an additional 15-20%.",
    ],
  },
  {
    key: "transmission",
    sourceIndex: 3,
    title: "Solar PV Systems",
    paragraphs: [
      "Enpower Trading leverages the Eskom and Municipal networks to provide customers with a choice of energy source.",
      "As the market evolves, Enpower Trading will collaborate with municipalities, regulators and other bodies to ensure municipalities remain revenue surplus neutral, and that we collectively work toward the goals of South Africa's Just Energy Transition: decarbonisation, affordability and security of supply.",
    ],
  },
  {
    key: "aggregation",
    sourceIndex: 4,
    title: "Data Center Construction",
    paragraphs: [
      "South African customers have limited access to Renewable Energy (RE) and can only supply a small percentage of their total energy needs through on-site generation. On-site generation requires high capital expenditure, and can only power one location.",
      "Enpower Trading offers customers access to a wide range of energy sources that collectively provide up to 100% renewable energy penetration rate, across multiple sites, reducing reliance on non-renewable energy ('brown power').",
      "Customers now have the ability to choose the source of their energy.",
    ],
  },
  {
    key: "customer",
    sourceIndex: 5,
    title: "Maintenance",
    paragraphs: [
      "Maximize your savings with our competitive tariffs and journey towards a net-zero future with the guidance of our Team. Enjoy the freedom of no longer being reliant on a single utility and benefit from fixed escalations, flexible contract periods (5, 10, or 20 years) as well as Renewable Energy Certificates (RECs) which assist you on your journey to net-zero.",
    ],
    footnote: "Between 2007 and 2022 the Eskom Tariff increased by 653%.",
  },
  {
    key: "future",
    sourceIndex: 6,
    title: "Construction Services, Inspections & Testing",
    paragraphs: [
      "The evolved future trading market will transform the way in which we purchase and consume energy. The future liberalized market will see the unbundling of the previous vertically integrated national utility, allowing for a more competitive energy market and greener future.",
    ],
  },
];

const graphSections = new Set([0, 1, 4, 5]);

const impactStats = [
  { value: "700 MW+", label: "Total Installed Power", Icon: Zap },
  { value: "1.3M+", label: "Solar Panels Installed", Icon: SolarPanel },
  { value: "550+", label: "Specialized Professionals", Icon: BadgeCheck },
  { value: "\u20AC 12.5M", label: "Total Invoiced", Icon: BadgeDollarSign },
];

const clientLogos = [
  { node: <SiReact />, title: "React", href: "https://react.dev" },
  { node: <SiNextdotjs />, title: "Next.js", href: "https://nextjs.org" },
  {
    node: <SiTypescript />,
    title: "TypeScript",
    href: "https://www.typescriptlang.org",
  },
  {
    node: <SiTailwindcss />,
    title: "Tailwind CSS",
    href: "https://tailwindcss.com",
  },
];

const processCardThemeClasses = {
  design: "project-stack-card-design",
  build: "project-stack-card-build",
  care: "project-stack-card-care",
};

const processCards = processCardsData
  .filter((card) => card.enabled !== false)
  .sort((firstCard, secondCard) => firstCard.order - secondCard.order);

const horizontalGalleryItems = horizontalGalleryData
  .filter((item) => item.enabled !== false)
  .sort((firstItem, secondItem) => firstItem.order - secondItem.order);

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

function NavigationLogo({ backToIntro }) {
  return (
    <button className="brand-logo" type="button" aria-label="Enpower Trading" onClick={backToIntro}>
      <span className="brand-logo-desktop"><img src="" alt="" /></span>
      <span className="brand-logo-mobile"><img src="/original/LOGO-BUN-Transparent.png.webp" alt="" /></span>
    </button>
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

function Navigation({ highQuality, setHighQuality, dark, setDark, backToIntro, entered }) {
  const visible = useScrollAwareNavigation(entered);

  return (
    <header className={`nav ${visible ? "" : "nav-scroll-hidden"}`} id="menuWrapper">
      <NavigationLogo backToIntro={backToIntro} />
      <div className="nav-actions">
       
        <button className="menu-button" type="button" >
          <span>Menu</span>
          <i className="burger" aria-hidden="true" />
        </button>
      </div>
      {/* <span className="desktop-mode">{dark ? "Light mode" : "Dark mode"}</span> */}
    </header>
  );
}

function Card({ active, entered }) {
  const section = sections[active] ?? sections[0];
  const hasGraph = graphSections.has(section.sourceIndex);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [active]);

  return (
    <aside
      className={`cards ${entered ? "visible" : ""} ${expanded ? "expanded" : ""}`}
      id={`card_content_${active}`}
    >
      <header className="card-header">
        <h2>{section.title}</h2>
        <span className="card-range">[{active + 1}]</span>
      </header>
      <div className="card-info">
        {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
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
        onClick={() => setExpanded((value) => !value)}
      >
        <span aria-hidden="true" />
      </button>
    </aside>
  );
}

function Intro({ entered, ready, enter }) {
  return (
    <section className={`intro ${entered ? "hidden" : ""}`} id="introUi">
      <div className="intro-content">
        <h1 className="intro-title">Welcome to GreenTech Professionals</h1>
        <p className="intro-copy">
          Electrical, mechanical and photovoltaic solutions built for a cleaner, more efficient future.
        </p>
      </div>
      <button className="intro-cta" type="button" onClick={enter} disabled={!ready}>
        <span>Click to explore</span>
        <span className="intro-cta-arrow" aria-hidden="true">{"\u2192"}</span>
      </button>
    </section>
  );
}

function FinalSection({ entered }) {
  const sectionRef = useRef(null);
  const videoRef = useRef(null);

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
  }, [entered]);

  return (
    <section
      ref={sectionRef}
      className={`final-section ${entered ? "visible" : ""}`}
      aria-labelledby="final-section-title"
      data-wind-stage="company"
    >
      <div className="final-section-inner">
        <header className="final-section-intro">
          <h1 id="final-section-title">GreenTech Professionals SRL</h1>
          <p>
            GreenTech Professionals is an electrical and construction company with
            experience in electrical and mechanical works in the photovoltaic field.
          </p>
        </header>

        <div className="impact-network">
          <div className="impact-stats">
            {impactStats.map(({ value, label, Icon }) => (
              <article className="impact-stat" key={label}>
                <span className="impact-stat-icon" aria-hidden="true">
                  <Icon size={30} strokeWidth={1.45} />
                </span>
                <strong>{value}</strong>
                <span className="impact-stat-label">{label}</span>
              </article>
            ))}
          </div>
        </div>

        <section className="company-video" aria-labelledby="company-video-title">
          <div className="company-video-frame">
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="GreenTech Professionals video"
            >
              <source src="/video.mp4" type="video/mp4" />
            </video>
          </div>
        </section>

        <section className="clients-showcase" aria-labelledby="clients-title">
          <h2 id="clients-title">Our Clients</h2>
           <p>
            GreenTech Professionals is an electrical and construction company with
            experience in electrical and mechanical works in the photovoltaic field.
          </p>
          <div className="clients-loop">
            <LogoLoop
              logos={clientLogos}
              speed={70}
              direction="left"
              logoHeight={42}
              gap={72}
              hoverSpeed={0}
              scaleOnHover
              fadeOut
              fadeOutColor="#000000"
              ariaLabel="Our clients"
            />
          </div>
        </section>
      </div>
    </section>
  );
}

function StackSection({ entered }) {
  const introRef = useRef(null);
  const releaseStartRef = useRef(null);
  const releaseFrameRef = useRef(0);

  const handleStackComplete = useCallback(({ scrollStart }) => {
    releaseStartRef.current = scrollStart;
  }, []);

  useEffect(() => {
    const intro = introRef.current;
    if (!intro) return undefined;

    if (!entered) {
      releaseStartRef.current = null;
      intro.style.transform = "";
      return undefined;
    }

    const updateIntroRelease = () => {
      releaseFrameRef.current = 0;
      const releaseStart = releaseStartRef.current;
      if (releaseStart === null) {
        intro.style.transform = "";
        return;
      }

      const releaseDistance = Math.max(0, window.scrollY - releaseStart);
      const maxReleaseDistance = intro.offsetHeight + 100;
      const translateY = Math.min(releaseDistance, maxReleaseDistance);
      intro.style.transform = translateY > 0 ? `translate3d(0, ${-translateY}px, 0)` : "";
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
      intro.style.transform = "";
    };
  }, [entered]);

  return (
    <section
      className={`process-section ${entered ? "visible" : ""}`}
      aria-labelledby="process-section-title"
      data-wind-stage="process"
    >
      <div className="process-section-inner">
        <header className="process-section-intro" ref={introRef}>
          <span>Process</span>
          <h2 id="process-section-title">Our Work Process</h2>
          <p>
            A compact view of how GreenTech Professionals moves a photovoltaic
            project from technical decisions to reliable field execution.
          </p>
        </header>

        <ScrollStack
          className="project-scroll-stack"
          stackPosition="36%"
          scaleEndPosition="23%"
          onStackComplete={handleStackComplete}
        >
          {processCards.map((card) => {
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

function App({ onOpenProject, projectOpen }) {
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [active, setActive] = useState(0);
  const [dark, setDark] = useState(false);
  const [highQuality, setHighQuality] = useState(true);
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

  const enter = useCallback(() => {
    experienceRef.current?.enter();
  }, [experienceRef]);

  const backToIntro = useCallback(() => {
    experienceRef.current?.returnToIntro();
  }, [experienceRef]);

  return (
    <main
      className={`page ${entered ? "entered" : ""}`}
      id="home"
      inert={projectOpen}
      aria-hidden={projectOpen ? "true" : undefined}
    >
      <div className="scroll-space" style={{ height: entered ? `calc(${SCROLL_HEIGHT}px + 100vh)` : "100vh" }} />
      <div className={`scene ${ready ? "ready" : ""}`} id="scene3d">
        <div className="canvas-wrapper" ref={mountRef} />
      </div>
      <Navigation
        highQuality={highQuality}
        setHighQuality={setHighQuality}
        dark={dark}
        setDark={setDark}
        backToIntro={backToIntro}
        entered={entered}
      />
      <Card active={active} entered={entered} />
      <Intro entered={entered} ready={ready} enter={enter} />
      <Preloader loaded={loaded} ready={ready} />
      <div className="post-experience-sections">
        <ScrollWindTurbine active={entered} />
        <FinalSection entered={entered} />
        <StackSection entered={entered} />
        <HorizontalParallaxGallery
          entered={entered}
          items={horizontalGalleryItems}
          onProjectOpen={onOpenProject}
        />
        <ScrollSolarAssembly active={entered} />
      </div>
    </main>
  );
}

function getProjectIdFromUrl() {
  return new URLSearchParams(window.location.search).get("project");
}

function getProjectUrl(projectId) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("project", projectId);
  return `${url.pathname}${url.search}${url.hash}`;
}

function Root() {
  const [projectId, setProjectId] = useState(getProjectIdFromUrl);

  useEffect(() => {
    const handlePopState = () => setProjectId(getProjectIdFromUrl());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const openProject = useCallback((nextProjectId) => {
    window.history.pushState(
      { projectOverlay: true },
      "",
      getProjectUrl(nextProjectId),
    );
    setProjectId(nextProjectId);
  }, []);

  const changeProject = useCallback((nextProjectId) => {
    window.history.replaceState(
      { ...window.history.state, projectOverlay: true },
      "",
      getProjectUrl(nextProjectId),
    );
    setProjectId(nextProjectId);
  }, []);

  const closeProject = useCallback(() => {
    if (window.history.state?.projectOverlay) {
      window.history.back();
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("project");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setProjectId(null);
  }, []);

  const projectIndex = horizontalGalleryItems.findIndex((item) => item.id === projectId);
  const project = projectIndex >= 0 ? horizontalGalleryItems[projectIndex] : null;
  const nextProject = project
    ? horizontalGalleryItems[(projectIndex + 1) % horizontalGalleryItems.length]
    : null;

  return (
    <>
      <App
        onOpenProject={openProject}
        projectOpen={Boolean(project)}
      />
      {project && (
        <ProjectDetailPage
          project={project}
          nextProject={nextProject}
          onClose={closeProject}
          onProjectOpen={changeProject}
        />
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
