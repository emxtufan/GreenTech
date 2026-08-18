import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Loader2, Mail, MapPin, Phone, Send } from "lucide-react";
import * as THREE from "three";
import BlurText from "./BlurText.jsx";
import SectionActionModal, { useSectionAction } from "./SectionAction.jsx";
import useSection from "./hooks/useSection.js";
import useSiteContent from "./hooks/useSiteContent.js";
import {
  cloneCachedGLTF,
  disposeGLTFInstance,
} from "./lib/threeAssetCache.js";
import { selectFooter, selectFooterGroups } from "./lib/siteContent.js";
import SolarContactForms from "./SolarContactForms.jsx";
import "./SolarContactSection.css";

const MODEL_URL = "/3d/space_sun.glb";
const OFFICE_EMAIL = "office@greentechpro.ro";
const MAP_URL = "https://maps.app.goo.gl/4B6ZvpVcABLVJL5DA";

const RADAR_RING_PERIOD = 2.45;
const RADAR_RING_RADIUS = 0.505;
const RADAR_RING_SPREAD = 0.4;

const SUN_IDLE_SPIN = 0.055;
const SUN_SCROLL_SPIN_BOOST = 0.95;
const SUN_SCROLL_REFERENCE_SPEED = 900;
const SUN_SPIN_ATTACK = 9;
const SUN_SPIN_RELEASE = 1.6;
const SUN_DESKTOP_SCALE = 0.7;

// Anything not starting with "#" or "/" leaves the site and opens in a new tab.
// "modal:privacy" style links open in-page instead of navigating away.
const getModalKey = (href) => String(href ?? "").match(/^modal:(\w+)$/)?.[1] ?? null;

const isExternalLink = (href) => /^https?:\/\//i.test(String(href ?? ""));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function createCoronaMaterial({ color = 0xff8a24, rimPower = 4.8 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      glowStrength: { value: 0 },
      rimPower: { value: rimPower },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float glowStrength;
      uniform float rimPower;
      varying vec3 vNormal;
      varying vec3 vViewDirection;

      void main() {
        float edge = 1.0 - max(dot(vNormal, vViewDirection), 0.0);
        float glow = pow(edge, rimPower) * glowStrength;
        gl_FragColor = vec4(glowColor, glow);
      }
    `,
  });
}

function SolarContactSection({
  active,
  prepare = false,
  onPrepared,
  onShowAllProjects,
}) {
  const text = useSection("contact");
  const siteContent = useSiteContent();
  const footer = selectFooter(siteContent);
  const footerGroups = selectFooterGroups(siteContent);
  const socialLinks = footerGroups.find((group) => group.title === "Social")?.links ?? [];
  const contactAction = useSectionAction("contact", {
    label: "Trimite solicitarea",
    mode: "builtin",
  });
  const sectionRef = useRef(null);
  const mountRef = useRef(null);
  const runtimeRef = useRef(null);
  const [legalModal, setLegalModal] = useState(null);
  const legalTriggerRef = useRef(null);

  useEffect(() => {
    runtimeRef.current?.setActive(active);
  }, [active]);

  const openLegal = (key, event) => {
    legalTriggerRef.current = event.currentTarget;
    setLegalModal({
      title: footer[`${key}Title`] || "",
      description: footer[`${key}Body`] || "",
    });
  };


  useEffect(() => {
    const section = sectionRef.current;
    const mount = mountRef.current;
    if ((!active && !prepare) || !section || !mount) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer = null;
    let scene = null;
    let camera = null;
    let sunGroup = null;
    let modelRoot = null;
    let radarGeometry = null;
    let coronaShell = null;
    const radarShells = [];
    let resizeObserver = null;
    let frame = 0;
    let measureFrame = 0;
    let lastFrameTime = 0;
    let rotation = -0.55;
    let spinBoost = 0;
    let previousScrollY = window.scrollY;
    let initialized = false;
    let sectionVisible = false;
    let disposed = false;
    let componentActive = active;
    let preparationReported = false;
    const layout = {
      sectionTop: 0,
      sectionHeight: 1,
      viewportHeight: Math.max(1, window.innerHeight),
    };

    const reportPreparation = (success) => {
      if (preparationReported) return;
      preparationReported = true;
      onPrepared?.("solar-contact", success);
    };

    const measure = () => {
      measureFrame = 0;
      if (!renderer || !camera || !sunGroup || disposed) return;

      const width = Math.max(1, mount.clientWidth || window.innerWidth);
      const height = Math.max(1, mount.clientHeight || window.innerHeight);
      const sectionBounds = section.getBoundingClientRect();
      const mobile = width <= 700;
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        mobile ? 1.45 : 1.75,
      );

      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      layout.sectionTop = window.scrollY + sectionBounds.top;
      layout.sectionHeight = Math.max(1, sectionBounds.height);
      layout.viewportHeight = Math.max(1, window.innerHeight);

      const distance = camera.position.z;
      const verticalView =
        2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
      const horizontalView = verticalView * camera.aspect;
      const diameter = mobile
        ? Math.min(horizontalView * 0.68, verticalView * 0.34)
        : Math.min(horizontalView * 0.58, verticalView * 0.78) * SUN_DESKTOP_SCALE;

      sunGroup.scale.setScalar(diameter);
      sunGroup.position.set(
        mobile ? 0 : horizontalView * 0.23,
        mobile ? -verticalView * 0.015 : 0,
        0,
      );
    };

    const scheduleMeasure = () => {
      if (measureFrame) return;
      measureFrame = window.requestAnimationFrame(measure);
    };

    const render = (time) => {
      if (
        !renderer
        || !scene
        || !camera
        || !sunGroup
        || !sectionVisible
        || !componentActive
        || disposed
      ) {
        frame = 0;
        lastFrameTime = 0;
        return;
      }

      const delta = lastFrameTime
        ? Math.min(0.05, (time - lastFrameTime) / 1000)
        : 0;
      lastFrameTime = time;

      const scrollY = window.scrollY;
      const scrollDelta = scrollY - previousScrollY;
      previousScrollY = scrollY;

      if (!reducedMotion.matches) {
        // Scroll speed nudges the spin up, then it eases back to the idle rate.
        const scrollSpeed = delta > 0 ? Math.abs(scrollDelta) / delta : 0;
        const boostTarget =
          clamp(scrollSpeed / SUN_SCROLL_REFERENCE_SPEED, 0, 1) ** 0.75
          * SUN_SCROLL_SPIN_BOOST;
        const smoothing =
          boostTarget > spinBoost ? SUN_SPIN_ATTACK : SUN_SPIN_RELEASE;

        spinBoost += (boostTarget - spinBoost) * (1 - Math.exp(-smoothing * delta));
        rotation += delta * (SUN_IDLE_SPIN + spinBoost);
      }

      sunGroup.rotation.y = rotation;
      sunGroup.rotation.x = THREE.MathUtils.degToRad(3.5)
        + Math.sin(time * 0.00018) * 0.018;

      const seconds = time * 0.001;

      if (coronaShell) {
        const breath = reducedMotion.matches ? 0 : Math.sin(seconds * 1.5);
        coronaShell.scale.setScalar(1.02 + breath * 0.014);
        coronaShell.material.uniforms.glowStrength.value = 0.34 + breath * 0.07;
      }

      radarShells.forEach((shell, index) => {
        shell.visible = !reducedMotion.matches;
        if (reducedMotion.matches) return;

        const phase =
          (seconds / RADAR_RING_PERIOD + index / radarShells.length) % 1;
        const ringTravel = 1 - (1 - phase) ** 2.2;
        const fadeIn = clamp(phase / 0.07, 0, 1);
        const fadeOut = (1 - phase) ** 1.9;
        shell.scale.setScalar(1 + ringTravel * RADAR_RING_SPREAD);
        shell.material.uniforms.glowStrength.value = fadeIn * fadeOut * 0.95;
        shell.material.uniforms.rimPower.value = 5.2 + phase * 13;
      });

      const viewportHeight = layout.viewportHeight;
      const boundsTop = layout.sectionTop - window.scrollY;
      const travel = clamp(
        (viewportHeight - boundsTop) / Math.max(1, viewportHeight + layout.sectionHeight),
        0,
        1,
      );
      sunGroup.rotation.z = THREE.MathUtils.degToRad(-4) + travel * 0.08;

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };

    const startRendering = () => {
      if (!initialized || frame || !sectionVisible || !componentActive) return;
      frame = window.requestAnimationFrame(render);
    };

    runtimeRef.current = {
      setActive(nextActive) {
        componentActive = nextActive;
        if (componentActive) {
          startRendering();
          return;
        }

        window.cancelAnimationFrame(frame);
        frame = 0;
        lastFrameTime = 0;
      },
    };

    const initialize = () => {
      if (initialized || disposed) return;
      initialized = true;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0, 8);

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.domElement.className = "solar-contact-canvas";
      renderer.domElement.setAttribute("aria-hidden", "true");
      mount.appendChild(renderer.domElement);

      sunGroup = new THREE.Group();
      sunGroup.visible = false;
      scene.add(sunGroup);

      radarGeometry = new THREE.SphereGeometry(RADAR_RING_RADIUS, 48, 30);

      coronaShell = new THREE.Mesh(radarGeometry, createCoronaMaterial());
      coronaShell.renderOrder = -12;
      sunGroup.add(coronaShell);

      const ringCount = (mount.clientWidth || window.innerWidth) <= 700 ? 7 : 10;
      for (let index = 0; index < ringCount; index += 1) {
        const shell = new THREE.Mesh(
          radarGeometry,
          createCoronaMaterial({ color: 0xffb057, rimPower: 6 }),
        );
        shell.renderOrder = -10 + index;
        radarShells.push(shell);
        sunGroup.add(shell);
      }

      const loadModel = async () => {
        try {
          const gltf = await cloneCachedGLTF(MODEL_URL);

          if (disposed) {
            disposeGLTFInstance(gltf.scene);
            return;
          }

          // The model uses the legacy specular-glossiness extension. Current
          // GLTFLoader versions keep its embedded texture in the parser cache,
          // even though they do not attach it to the converted material.
          const solarTexture = await gltf.parser.getDependency("texture", 0);
          if (!solarTexture) throw new Error("The solar texture is missing from the GLB.");

          solarTexture.colorSpace = THREE.SRGBColorSpace;
          solarTexture.flipY = false;
          solarTexture.anisotropy = Math.min(
            8,
            renderer.capabilities.getMaxAnisotropy(),
          );
          solarTexture.needsUpdate = true;

          const sourceMaterials = new Set();
          gltf.scene.traverse((object) => {
            if (!object.isMesh) return;

            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            const luminousMaterials = materials.filter(Boolean).map((material) => {
              sourceMaterials.add(material);
              return new THREE.MeshBasicMaterial({
                map: solarTexture,
                color: 0xffffff,
                side: THREE.DoubleSide,
                toneMapped: false,
              });
            });

            object.material = Array.isArray(object.material)
              ? luminousMaterials
              : luminousMaterials[0];
            object.frustumCulled = false;
          });
          sourceMaterials.forEach((material) => material.dispose());

          const bounds = new THREE.Box3().setFromObject(gltf.scene);
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          const sourceDiameter = Math.max(0.001, size.x, size.y, size.z);

          modelRoot = new THREE.Group();
          gltf.scene.position.sub(center);
          modelRoot.scale.setScalar(1 / sourceDiameter);
          modelRoot.add(gltf.scene);
          sunGroup.add(modelRoot);
          sunGroup.visible = true;
          mount.classList.add("model-ready");
          measure();
          renderer.compile(scene, camera);
          renderer.render(scene, camera);
          reportPreparation(true);
          startRendering();
        } catch (error) {
          if (disposed) return;
          console.error("Unable to prepare the solar contact model", error);
          mount.classList.add("load-error");
          reportPreparation(false);
        }
      };
      loadModel();

      resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(mount);
      window.addEventListener("resize", scheduleMeasure);
      measure();
      startRendering();
    };

    const loadObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        initialize();
        loadObserver.disconnect();
      },
      { rootMargin: "75% 0px" },
    );

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        sectionVisible = entries.some((entry) => entry.isIntersecting);
        if (sectionVisible) {
          initialize();
          measure();
          startRendering();
        } else {
          window.cancelAnimationFrame(frame);
          frame = 0;
          lastFrameTime = 0;
        }
      },
      { rootMargin: "8% 0px" },
    );

    loadObserver.observe(section);
    visibilityObserver.observe(mount);
    if (prepare) initialize();

    return () => {
      disposed = true;
      loadObserver.disconnect();
      visibilityObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(measureFrame);
      disposeGLTFInstance(modelRoot);
      radarShells.forEach((shell) => shell.material.dispose());
      coronaShell?.material.dispose();
      radarGeometry?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
      mount.classList.remove("model-ready", "load-error");
      if (runtimeRef.current) runtimeRef.current = null;
    };
  }, [onPrepared, prepare]);

  return (
    <section
      className={`solar-contact-section ${active ? "visible" : ""}`}
      id="contact"
      ref={sectionRef}
      aria-labelledby="solar-contact-title"
    >
      <div
        className="solar-contact-canvas-mount"
        ref={mountRef}
        aria-hidden="true"
      />

      <div className="solar-contact-inner">
        <header className="solar-contact-intro">
          <span>{text("eyebrow", "Solicitare proiect")}</span>
          <BlurText
            as="h2"
            id="solar-contact-title"
            text={text("title", "Discutam despre proiectul dumneavoastra.")}
            play={active}
            animateBy="letters"
            direction="top"
            delay={55}
            stepDuration={0.45}
          />
          <p>
            {text(
              "description",
              "Trimiteti-ne amplasamentul, capacitatea estimata si lucrarile necesare. Revenim cu intrebarile tehnice si pasii urmatori.",
            )}
          </p>
        </header>

        <div className="solar-contact-visual-space" aria-hidden="true" />

        <SolarContactForms openLegal={openLegal} contactAction={contactAction} />

        <div className="solar-contact-links">
          <a className="solar-contact-link" href={`mailto:${footer.email || OFFICE_EMAIL}`}>
            <span>{text("emailLabel", "E-mail")}</span>
            <strong>{footer.email || OFFICE_EMAIL}</strong>
            <i aria-hidden="true">
              <ArrowUpRight size={22} strokeWidth={1.7} />
            </i>
          </a>
          <a
            className="solar-contact-link"
            href={footer.mapUrl || MAP_URL}
            target="_blank"
            rel="noreferrer"
          >
            <span>{text("officeLabel", "Sediu")}</span>
            <strong>
              {text("officeAddress", footer.address || "Calea Floreasca nr. 194, Sector 1, Bucuresti")}
              <small>{text("officeBuilding", "Floreasca Lake Offices")}</small>
            </strong>
            <i aria-hidden="true">
              <ArrowUpRight size={22} strokeWidth={1.7} />
            </i>
          </a>
        </div>

        <footer className="solar-contact-footer">
          <div className="solar-contact-footer-main">
            <div className="solar-contact-footer-brand">
              <img
                src="/original/logo-alb.png.webp"
                alt="Greentech Professionals"
              />
              <p>{footer.tagline}</p>
              <div className="solar-contact-footer-certifications">
                <img
                  src="/original/footer-certifications.webp"
                  alt="Atestat ANRE si certificari ISO 9001, ISO 14001 si IQNet"
                  width="300"
                  height="69"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>

            <div className="solar-contact-footer-groups">
              {footerGroups
                .filter((group) => group.title !== "Social")
                .map((group) => (
                  <section key={group.title}>
                    <h3>{group.title}</h3>
                    <nav aria-label={group.title}>
                      {group.links.map((link) => (
                        getModalKey(link.href) ? (
                          <button
                            key={link.id}
                            type="button"
                            onClick={(event) => openLegal(getModalKey(link.href), event)}
                          >
                            {link.label}
                          </button>
                        ) : (
                          <a
                            key={link.id}
                            href={link.href}
                            {...(isExternalLink(link.href)
                              ? { target: "_blank", rel: "noreferrer" }
                              : null)}
                          >
                            {link.label}
                            {isExternalLink(link.href) && (
                              <ArrowUpRight size={13} strokeWidth={1.8} aria-hidden="true" />
                            )}
                          </a>
                        )
                      ))}
                    </nav>
                  </section>
                ))}
            </div>
          </div>

          <div className="solar-contact-footer-bottom">
            <span>
              &copy; {new Date().getFullYear()} {footer.copyright}
            </span>

            {socialLinks.length > 0 && (
              <nav
                aria-label={text("socialLinksLabel", "Retele sociale")}
                className="solar-contact-footer-social"
              >
                {socialLinks.map((link) => (
                  <a key={link.id} href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
              </nav>
            )}

          </div>
        </footer>
      </div>
      <SectionActionModal {...contactAction.modalProps} />
      <SectionActionModal
        open={legalModal !== null}
        onClose={() => setLegalModal(null)}
        content={legalModal ?? {}}
        triggerRef={legalTriggerRef}
      />
    </section>
  );
}

export default SolarContactSection;
