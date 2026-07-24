import React, { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import "./SolarContactSection.css";

const MODEL_URL = "/3d/space_sun.glb";
const MAP_URL = "https://maps.app.goo.gl/4B6ZvpVcABLVJL5DA";
const LINKEDIN_URL = "https://ro.linkedin.com/company/greentech-professionals";
const FACEBOOK_URL = "https://www.facebook.com/greentechprofessionals";
const MODEL_SOURCE_URL =
  "https://sketchfab.com/3d-models/space-sun-9dc16d37e8224fe9923f68de0149fcab";

const RADAR_RING_PERIOD = 2.45;
const RADAR_RING_SPREAD = 1.05;

const SUN_IDLE_SPIN = 0.055;
const SUN_SCROLL_SPIN_BOOST = 0.95;
const SUN_SCROLL_REFERENCE_SPEED = 900;
const SUN_SPIN_ATTACK = 9;
const SUN_SPIN_RELEASE = 1.6;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function getEmbeddedImageBlob(arrayBuffer) {
  const dataView = new DataView(arrayBuffer);
  const textDecoder = new TextDecoder();
  let json = null;
  let binaryOffset = 0;
  let offset = 12;

  while (offset < arrayBuffer.byteLength) {
    const chunkLength = dataView.getUint32(offset, true);
    const chunkType = dataView.getUint32(offset + 4, true);
    const chunkOffset = offset + 8;

    if (chunkType === 0x4e4f534a) {
      const jsonText = textDecoder.decode(
        new Uint8Array(arrayBuffer, chunkOffset, chunkLength),
      );
      json = JSON.parse(jsonText.replace(/\u0000+$/g, ""));
    } else if (chunkType === 0x004e4942) {
      binaryOffset = chunkOffset;
    }

    offset = chunkOffset + chunkLength;
  }

  const image = json?.images?.find((candidate) => candidate.bufferView !== undefined);
  const bufferView = image ? json.bufferViews?.[image.bufferView] : null;
  if (!image || !bufferView || !binaryOffset) {
    throw new Error("The solar texture is not embedded in the GLB.");
  }

  const imageStart = binaryOffset + (bufferView.byteOffset ?? 0);
  const imageEnd = imageStart + bufferView.byteLength;
  return new Blob([arrayBuffer.slice(imageStart, imageEnd)], {
    type: image.mimeType ?? "image/png",
  });
}

async function loadEmbeddedTexture(arrayBuffer) {
  const imageUrl = URL.createObjectURL(getEmbeddedImageBlob(arrayBuffer));

  try {
    return await new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(imageUrl, resolve, undefined, reject);
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function disposeObject(root) {
  const materials = new Set();
  const textures = new Set();

  root?.traverse((object) => {
    object.geometry?.dispose?.();
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value);
      });
    });
  });

  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
}

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

function SolarContactSection({ active }) {
  const sectionRef = useRef(null);
  const mountRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    const mount = mountRef.current;
    if (!active || !section || !mount) return undefined;

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
    const loadController = new AbortController();

    const measure = () => {
      measureFrame = 0;
      if (!renderer || !camera || !sunGroup || disposed) return;

      const width = Math.max(1, mount.clientWidth || window.innerWidth);
      const height = Math.max(1, mount.clientHeight || window.innerHeight);
      const mobile = width <= 700;
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        mobile ? 1.45 : 1.75,
      );

      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const distance = camera.position.z;
      const verticalView =
        2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
      const horizontalView = verticalView * camera.aspect;
      const diameter = mobile
        ? Math.min(horizontalView * 1.08, verticalView * 0.54)
        : Math.min(horizontalView * 0.58, verticalView * 0.78);

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
      if (!renderer || !scene || !camera || !sunGroup || !sectionVisible || disposed) {
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

      const bounds = section.getBoundingClientRect();
      const viewportHeight = Math.max(1, window.innerHeight);
      const travel = clamp(
        (viewportHeight - bounds.top) / Math.max(1, viewportHeight + bounds.height),
        0,
        1,
      );
      sunGroup.rotation.z = THREE.MathUtils.degToRad(-4) + travel * 0.08;

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };

    const startRendering = () => {
      if (!initialized || frame || !sectionVisible) return;
      frame = window.requestAnimationFrame(render);
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

      radarGeometry = new THREE.SphereGeometry(0.54, 56, 36);

      coronaShell = new THREE.Mesh(radarGeometry, createCoronaMaterial());
      coronaShell.renderOrder = -12;
      sunGroup.add(coronaShell);

      const ringCount = (mount.clientWidth || window.innerWidth) <= 700 ? 4 : 6;
      for (let index = 0; index < ringCount; index += 1) {
        const shell = new THREE.Mesh(
          radarGeometry,
          createCoronaMaterial({ color: 0xffb057, rimPower: 6 }),
        );
        shell.renderOrder = -10 + index;
        radarShells.push(shell);
        sunGroup.add(shell);
      }

      const loader = new GLTFLoader();
      const loadModel = async () => {
        try {
          const response = await fetch(MODEL_URL, {
            signal: loadController.signal,
          });
          if (!response.ok) {
            throw new Error(`Unable to load the solar model (${response.status}).`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const [gltf, solarTexture] = await Promise.all([
            new Promise((resolve, reject) => {
              loader.parse(arrayBuffer, "", resolve, reject);
            }),
            loadEmbeddedTexture(arrayBuffer),
          ]);

          if (disposed) {
            disposeObject(gltf.scene);
            solarTexture.dispose();
            return;
          }

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
          startRendering();
        } catch (error) {
          if (error?.name === "AbortError" || disposed) return;
          mount.classList.add("load-error");
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
    visibilityObserver.observe(section);

    return () => {
      disposed = true;
      loadObserver.disconnect();
      visibilityObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(measureFrame);
      loadController.abort();
      disposeObject(modelRoot);
      radarShells.forEach((shell) => shell.material.dispose());
      coronaShell?.material.dispose();
      radarGeometry?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
      mount.classList.remove("model-ready", "load-error");
    };
  }, [active]);

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
      <div className="solar-contact-shade" aria-hidden="true" />

      <div className="solar-contact-inner">
        <header className="solar-contact-intro">
          <span>Contact / Solar energy</span>
          <h2 id="solar-contact-title">Your next solar project starts here.</h2>
          <p>
            Tell us where you are building and what needs to be delivered. Our team
            is ready to discuss the next step.
          </p>
        </header>

        <div className="solar-contact-visual-space" aria-hidden="true" />

        <div className="solar-contact-links">
          <a className="solar-contact-link" href="mailto:office@greentechpro.ro">
            <span>Email us</span>
            <strong>office@greentechpro.ro</strong>
            <i aria-hidden="true">
              <ArrowUpRight size={22} strokeWidth={1.7} />
            </i>
          </a>
          <a
            className="solar-contact-link"
            href={MAP_URL}
            target="_blank"
            rel="noreferrer"
          >
            <span>Head office</span>
            <strong>
              194 Floreasca Way, District 1, Bucharest
              <small>Floreasca Lake Offices</small>
            </strong>
            <i aria-hidden="true">
              <ArrowUpRight size={22} strokeWidth={1.7} />
            </i>
          </a>
        </div>

        <footer className="solar-contact-footer">
          <img
            src="/original/logo-alb.png.webp"
            alt="GreenTech Professionals"
          />
          <nav aria-label="Social links">
            <a href={LINKEDIN_URL} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
            <a href={FACEBOOK_URL} target="_blank" rel="noreferrer">
              Facebook
            </a>
          </nav>
          <div className="solar-contact-legal">
            <span>© {new Date().getFullYear()} GreenTech Professionals SRL</span>
            <a href={MODEL_SOURCE_URL} target="_blank" rel="noreferrer">
              Sun model: Wr_titan, CC BY 4.0
            </a>
          </div>
        </footer>
      </div>
    </section>
  );
}

export default SolarContactSection;
