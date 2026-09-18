import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  SCENE_COUNT,
  SCROLL_HEIGHT,
  SCROLL_SEGMENT,
} from "./experienceConfig.js";
import useExperienceScrollController from "./useExperienceScrollController.js";
import {
  selectBlogPosts,
  selectGalleryItems,
  selectHeroCards,
  selectPhotoGalleryItems,
} from "./lib/siteContent.js";
import useSiteContent from "./hooks/useSiteContent.js";
import useSection from "./hooks/useSection.js";
import { uiText, useLocale } from "./lib/i18n.js";
import { resolveAnchorScrollTop } from "./scrollMotion.js";
import { trackVisit } from "./lib/visitTracker.js";
import "./styles.css";
import SiteNavigation from "./SiteNavigation.jsx";
import SideTabs from "./SideTabs.jsx";

const BlurText = lazy(() => import("./BlurText.jsx"));
const PostExperienceSections = lazy(() => import("./PostExperienceSections.jsx"));
const BlogPostPage = lazy(() => import("./BlogPostPage.jsx"));
const ProjectDetailPage = lazy(() => import("./ProjectDetailPage.jsx"));
const AllProjectsPage = lazy(() => import("./AllProjectsPage.jsx"));
const AllPhotosPage = lazy(() => import("./AllPhotosPage.jsx"));

// Which hero cards render the graph treatment — a UI behaviour, not content.
const graphSections = new Set([0, 1, 4, 5]);

// Time between the preloader starting to fade and the hero's cloud reveal.
const AUTO_ENTER_DELAY = 600;

const heroSurfaces = [
  "#fff8e8",
  "#edf8f7",
  "#f2f5f2",
  "#f3f8eb",
  "#eff7f1",
  "#f2f7f2",
];

function useEnpower3d({
  dark,
  highQuality,
  setHeroProgress,
  setHeroReady,
  setActive,
  setEntered,
}) {
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
            onProgress: (progress) => {
              setHeroProgress((current) => Math.max(current, progress));
            },
            onReady: () => {
              if (cancelled) return;
              setHeroReady(true);
            },
            onActiveChange: setActive,
            onEnter: () => setEntered(true),
            onExit: () => setEntered(false),
          });
          experienceRef.current = experience;
        })
        .catch((error) => {
          console.error("Unable to load the Enpower 3D experience", error);
          setHeroProgress(100);
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

function Navigation({ backToIntro, entered, onEnterAndNavigate }) {
  const visible = useScrollAwareNavigation(entered);
  return (
    <SiteNavigation
      visible={visible}
      backToIntro={backToIntro}
      entered={entered}
      onEnterAndNavigate={onEnterAndNavigate}
    />
  );
}

function HeroScrollCue({ active, entered }) {
  const locale = useLocale();
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
      {uiText("scrollDown", locale)}
    </div>
  );
}

function Card({ active, entered }) {
  const locale = useLocale();
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
      </div>
      <button
        className="card-toggle"
        type="button"
        aria-label={uiText(expanded ? "hideInfo" : "showInfo", locale)}
        aria-expanded={expanded}
        onClick={toggleExpanded}
      >
        <span aria-hidden="true" />
      </button>
    </aside>
  );
}

function Preloader({ loaded, ready }) {
  const locale = useLocale();
  const progress = Math.min(100, Math.max(0, Math.round(loaded)));

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
        <div
          className="loader-progress"
          role="progressbar"
          aria-label={uiText("loadingExperience", locale)}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={progress}
        >
          <strong className="loader-progress-value">{progress}%</strong>
          <span className="loader-progress-track" aria-hidden="true">
            <span
              className="loader-progress-fill"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}

function App({
  siteContent,
  onOpenProject,
  onShowAllProjects,
  onShowAllPhotos,
  onOpenPost,
  routeOpen,
}) {
  const [loaded, setLoaded] = useState(0);
  const [heroProgress, setHeroProgress] = useState(0);
  const [heroReady, setHeroReady] = useState(false);
  const [pageAssetProgress, setPageAssetProgress] = useState(0);
  const [pageAssetsReady, setPageAssetsReady] = useState(false);
  const [postPreparationProgress, setPostPreparationProgress] = useState(0);
  const [entered, setEntered] = useState(false);
  const [active, setActive] = useState(0);
  const [dark, setDark] = useState(false);
  const [highQuality, setHighQuality] = useState(true);
  const sceneRef = useRef(null);
  const postExperienceRef = useRef(null);
  const requestedSceneHandledRef = useRef(false);
  const ready =
    heroReady
    && pageAssetsReady
    && postPreparationProgress >= 100;
  const { mountRef, experienceRef } = useEnpower3d({
    dark,
    highQuality,
    setHeroProgress,
    setHeroReady,
    setActive,
    setEntered,
  });

  useEffect(() => {
    document.documentElement.dataset.mode = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    let cancelled = false;
    setPageAssetsReady(false);

    import("./lib/pageAssetPreloader.js")
      .then(({ preloadPageAssets }) => preloadPageAssets(
        siteContent,
        (progress) => {
          if (cancelled) return;
          setPageAssetProgress((current) => Math.max(current, progress));
        },
      ))
      .then(() => {
        if (cancelled) return;
        setPageAssetProgress(100);
        setPageAssetsReady(true);
      })
      .catch((error) => {
        console.error("Unable to preload every page asset", error);
        if (cancelled) return;
        // Whatever failed will fall back in its own section; do not hold
        // the whole site behind it.
        setPageAssetProgress(100);
        setPageAssetsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [siteContent]);

  useEffect(() => {
    const aggregate = Math.min(
      99,
      Math.round(
        heroProgress * 0.24
        + pageAssetProgress * 0.56
        + postPreparationProgress * 0.2,
      ),
    );
    setLoaded((current) => (ready ? 100 : Math.max(current, aggregate)));
  }, [heroProgress, pageAssetProgress, postPreparationProgress, ready]);

  useEffect(() => {
    if (!ready || requestedSceneHandledRef.current) return undefined;

    const requestedScene = Number.parseInt(
      new URLSearchParams(window.location.search).get("scene"),
      10,
    );
    if (
      !Number.isInteger(requestedScene)
      || requestedScene < 0
      || requestedScene >= SCENE_COUNT
    ) {
      return undefined;
    }

    requestedSceneHandledRef.current = true;
    experienceRef.current?.enter();
    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        window.scrollTo(0, requestedScene * SCROLL_SEGMENT + 1);
      });
      requestedSceneHandledRef.current = secondFrame;
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (typeof requestedSceneHandledRef.current === "number") {
        window.cancelAnimationFrame(requestedSceneHandledRef.current);
      }
    };
  }, [experienceRef, ready]);

  useEffect(() => {
    const root = document.documentElement;
    const heroSurface = dark ? "#141414" : heroSurfaces[active] ?? heroSurfaces[0];
    root.style.setProperty("--hero-surface", heroSurface);
  }, [active, dark]);

  useExperienceScrollController({
    entered,
    routeOpen,
    sceneRef,
    experienceRef,
  });

  // No "start exploring" step: once everything is loaded the clouds part on
  // their own. The delay lets the preloader fade first so the animation is
  // actually seen.
  const autoEnteredRef = useRef(false);
  useEffect(() => {
    if (!ready || autoEnteredRef.current) return undefined;
    autoEnteredRef.current = true;
    const timer = window.setTimeout(
      () => experienceRef.current?.enter(),
      AUTO_ENTER_DELAY,
    );
    return () => window.clearTimeout(timer);
  }, [experienceRef, ready]);

  // A menu link used from the intro: enter the experience, then scroll to the
  // requested section once it has a place in the layout.
  const pendingSectionRef = useRef(null);
  const enterAndNavigate = useCallback((href) => {
    pendingSectionRef.current = href;
    if (ready) experienceRef.current?.enter();
  }, [experienceRef, ready]);

  useEffect(() => {
    if (ready && !entered && pendingSectionRef.current) experienceRef.current?.enter();
  }, [entered, experienceRef, ready]);

  useEffect(() => {
    if (!entered || !pendingSectionRef.current) return undefined;

    const href = pendingSectionRef.current;
    pendingSectionRef.current = null;
    let secondFrame = 0;
    // Two frames: the sections leave their fixed "preparing" state in this
    // commit and the scroll controller mounts alongside; let both settle.
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const target = document.querySelector(href);
        if (!target) return;
        if (typeof window.__scrollToSection === "function") {
          window.__scrollToSection(target);
          return;
        }
        const anchorTop = resolveAnchorScrollTop(target);
        if (anchorTop !== null) {
          window.scrollTo({ top: anchorTop, behavior: "smooth" });
          return;
        }
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [entered]);

  // The brand button returns to the first scene rather than to an intro
  // screen, since there is no longer one to return to.
  const backToStart = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (typeof window.__scrollToSection === "function") {
      window.__scrollToSection(scene);
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handlePostPreparationProgress = useCallback((progress) => {
    setPostPreparationProgress((current) => Math.max(current, progress));
  }, []);

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
      {/* Before the navigation on purpose: at the same z-index the mobile
          menu sheet (later in the DOM) must cover the tabs. */}
      <SideTabs />
      <Navigation
        backToIntro={backToStart}
        entered={entered}
        onEnterAndNavigate={enterAndNavigate}
      />
      <Preloader loaded={loaded} ready={ready} />
      <div
        ref={postExperienceRef}
        className={`post-experience-sections ${entered ? "" : "preparing"}`}
      >
        <Suspense fallback={<div className="post-experience-loading" aria-hidden="true" />}>
          <PostExperienceSections
            entered={entered}
            prepare3d
            onPreparationProgress={handlePostPreparationProgress}
            onOpenProject={onOpenProject}
            onShowAllProjects={onShowAllProjects}
            onShowAllPhotos={onShowAllPhotos}
            onOpenPost={onOpenPost}
          />
        </Suspense>
      </div>
    </main>
  );
}

function getSiteRouteFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  const postId = searchParams.get("post");
  const projectId = postId ? null : searchParams.get("project");
  const projectsIndexOpen =
    !projectId && !postId && searchParams.get("projects") === "all";

  return {
    projectId,
    postId,
    projectsIndexOpen,
    photosIndexOpen:
      !projectId
      && !postId
      && !projectsIndexOpen
      && searchParams.get("gallery") === "all",
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

function getPhotosIndexUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("gallery", "all");
  return `${url.pathname}${url.search}${url.hash}`;
}

function getBlogPostUrl(postId) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("post", postId);
  return `${url.pathname}${url.search}${url.hash}`;
}

function Root() {
  const locale = useLocale();
  const routeContent = useSiteContent();
  const routedProjects = selectGalleryItems(routeContent);
  const routedPhotos = selectPhotoGalleryItems(routeContent);
  const routedBlogPosts = selectBlogPosts(routeContent);
  const [routeState, setRouteState] = useState(getSiteRouteFromUrl);

  useEffect(() => {
    trackVisit();
  }, []);
  const {
    projectId,
    postId,
    projectsIndexOpen,
    photosIndexOpen,
  } = routeState;

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
      photosIndexOpen: false,
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
      photosIndexOpen: false,
    });
  }, []);

  const openProjectsIndex = useCallback(() => {
    window.history.pushState(
      { projectsIndex: true },
      "",
      getProjectsIndexUrl(),
    );
    setRouteState({
      projectId: null,
      postId: null,
      projectsIndexOpen: true,
      photosIndexOpen: false,
    });
  }, []);

  const openPhotosIndex = useCallback(() => {
    window.history.pushState(
      { photosIndex: true },
      "",
      getPhotosIndexUrl(),
    );
    setRouteState({
      projectId: null,
      postId: null,
      projectsIndexOpen: false,
      photosIndexOpen: true,
    });
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
      photosIndexOpen: false,
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
    setRouteState({
      projectId: null,
      postId: null,
      projectsIndexOpen: false,
      photosIndexOpen: false,
    });
  }, []);

  const closeProjectsIndex = useCallback(() => {
    if (window.history.state?.projectsIndex) {
      window.history.back();
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("projects");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setRouteState({
      projectId: null,
      postId: null,
      projectsIndexOpen: false,
      photosIndexOpen: false,
    });
  }, []);

  const closePhotosIndex = useCallback(() => {
    if (window.history.state?.photosIndex) {
      window.history.back();
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("gallery");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setRouteState({
      projectId: null,
      postId: null,
      projectsIndexOpen: false,
      photosIndexOpen: false,
    });
  }, []);

  const closeBlogPost = useCallback(() => {
    if (window.history.state?.blogPostOverlay) {
      window.history.back();
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("post");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setRouteState({
      projectId: null,
      postId: null,
      projectsIndexOpen: false,
      photosIndexOpen: false,
    });
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
        siteContent={routeContent}
        onOpenProject={openProject}
        onShowAllProjects={openProjectsIndex}
        onShowAllPhotos={openPhotosIndex}
        onOpenPost={openBlogPost}
        routeOpen={
          Boolean(project)
          || Boolean(blogPost)
          || projectsIndexOpen
          || photosIndexOpen
        }
      />
      <Suspense
        fallback={
          routeState.projectId
          || routeState.postId
          || routeState.projectsIndexOpen
          || routeState.photosIndexOpen
          ? <div className="route-loading" role="status">{uiText("loading", locale)}</div>
          : null
        }
      >
        {photosIndexOpen && (
          <AllPhotosPage
            projects={routedProjects}
            photos={routedPhotos}
            onClose={closePhotosIndex}
          />
        )}
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
