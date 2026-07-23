import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  EnpowerExperience,
  SCENE_COUNT,
  SCROLL_HEIGHT,
  SCROLL_SEGMENT,
} from "./enpower3d.js";
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
      <img src="/original/logo-alb.png.webp" alt="" />
    </span>
  );
}

function NavigationLogo({ backToIntro }) {
  return (
    <button className="brand-logo" type="button" aria-label="Enpower Trading" onClick={backToIntro}>
      <span className="brand-logo-desktop"><img src="" alt="" /></span>
      <span className="brand-logo-mobile"><img src="/original/logo-alb.png.webp" alt="" /></span>
    </button>
  );
}

function Navigation({ highQuality, setHighQuality, dark, setDark, backToIntro }) {
  return (
    <header className="nav" id="menuWrapper">
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

function App() {
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
    <main className={`page ${entered ? "entered" : ""}`} id="home">
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
      />
      <Card active={active} entered={entered} />
      <Intro entered={entered} ready={ready} enter={enter} />
      <Preloader loaded={loaded} ready={ready} />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
