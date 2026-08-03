import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  SCENE_COUNT,
  SCROLL_HEIGHT,
  SCROLL_SEGMENT,
} from "./experienceConfig.js";
import SectionActionModal, { useSectionAction } from "./SectionAction.jsx";
import useExperienceScrollController from "./useExperienceScrollController.js";
import {
  selectBlogPosts,
  selectGalleryItems,
  selectHeroCards,
} from "./lib/siteContent.js";
import useSiteContent from "./hooks/useSiteContent.js";
import useSection from "./hooks/useSection.js";
import "./styles.css?=122222";
import SiteNavigation from "./SiteNavigation.jsx";

const BlurText = lazy(() => import("./BlurText.jsx"));
const PostExperienceSections = lazy(() => import("./PostExperienceSections.jsx"));
const BlogPostPage = lazy(() => import("./BlogPostPage.jsx"));
const ProjectDetailPage = lazy(() => import("./ProjectDetailPage.jsx"));
const AllProjectsPage = lazy(() => import("./AllProjectsPage.jsx"));

// Which hero cards render the graph treatment — a UI behaviour, not content.
const graphSections = new Set([0, 1, 4, 5]);

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
    let cancelled = false;

    // Let the branded HTML interface paint before WebGL parsing and setup.
    // This keeps the first frame responsive even on throttled mobile CPUs.
    const loadTimer = window.setTimeout(() => {
      import("./enpower3d.js")
        .then(({ EnpowerExperience }) => {
          if (cancelled || !mountRef.current) return;

          const experience = new EnpowerExperience(mountRef.current, {
            dark,
            highQuality,
            onProgress: setLoaded,
            onReady: () => {
              if (cancelled) return;
              setReady(true);
              const requestedScene = Number.parseInt(
                new URLSearchParams(window.location.search).get("scene"),
                10,
              );
              if (
                Number.isInteger(requestedScene)
                && requestedScene >= 0
                && requestedScene < SCENE_COUNT
              ) {
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
        })
        .catch((error) => {
          console.error("Unable to load the Enpower 3D experience", error);
          setLoaded(100);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimer);
      experienceRef.current?.dispose();
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
      <img
        src="/original/logo-preloader-480.webp"
        width="480"
        height="66"
        alt=""
        decoding="async"
      />
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

function HeroScrollCue({ active, entered }) {
  const cueRef = useRef(null);
  const [atStart, setAtStart] = useState(true);

  useEffect(() => {
    if (!entered) {
      setAtStart(true);
      return undefined;
    }

    const update = () => setAtStart(window.scrollY <= 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [entered]);

  useEffect(() => {
    const cue = cueRef.current;
    const card = document.getElementById(`card_content_${active}`);
    if (!cue || !card) return undefined;

    const updateOffset = () => {
      cue.style.setProperty("--hero-card-offset", `${card.getBoundingClientRect().height}px`);
    };
    updateOffset();

    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(updateOffset);
    observer.observe(card);
    return () => observer.disconnect();
  }, [active, entered]);

  const visible = entered && active === 0 && atStart;
  return (
    <div
      ref={cueRef}
      className={`hero-scroll-cue ${visible ? "visible" : ""}`}
      aria-hidden="true"
    >
      Scroll down
    </div>
  );
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
        {entered ? (
          <Suspense fallback={<h2>{section.title}</h2>}>
            <BlurText
              key={`${section.id}-visible`}
              as="h2"
              text={section.title}
              play
              delay={200}
              animateBy="words"
              direction="top"
            />
          </Suspense>
        ) : (
          <h2>{section.title}</h2>
        )}
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

function Preloader({ loaded, ready }) {
  useEffect(() => {
    if (!ready) return undefined;

    const bootShell = document.getElementById("boot-shell");
    if (!bootShell) return undefined;

    bootShell.classList.add("done");
    const removeTimer = window.setTimeout(() => bootShell.remove(), 1300);
    return () => window.clearTimeout(removeTimer);
  }, [ready]);

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
          <HeroScrollCue active={active} entered={entered} />
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
        {entered && (
          <Suspense fallback={<div className="post-experience-loading" aria-hidden="true" />}>
            <PostExperienceSections
              entered={entered}
              onOpenProject={onOpenProject}
              onShowAllProjects={onShowAllProjects}
              onOpenPost={onOpenPost}
            />
          </Suspense>
        )}
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
      <Suspense
        fallback={routeState.projectId || routeState.postId || routeState.projectsIndexOpen
          ? <div className="route-loading" role="status">Loading</div>
          : null}
      >
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
      </Suspense>
    </>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
