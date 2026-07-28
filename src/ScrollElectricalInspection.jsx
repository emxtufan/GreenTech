import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import ServiceSectionOverlay from "./ServiceSectionOverlay.jsx";
import useSection from "./hooks/useSection.js";
import "./ScrollElectricalInspection.css";

const MODEL_URL = "/3d/factory__electrical__box_12_mb.glb";
const MODEL_REST_LIFT = 0.13;
const MODEL_REST_LIFT_MOBILE = 0.06;
const ENTRANCE_COMPLETE_AT = 0.14;
const SPIN_COMPLETE_AT = 0.82;
const SPIN_TURNS = 1.15;
// Scroll owns the rotation, matching the assembly section: the model holds
// still when the page does. Raise this to add autonomous drift back.
const IDLE_SPIN = 0;
const FRONTAL_TILT = THREE.MathUtils.degToRad(6);

// Metalness and roughness here come from a texture, so they must not be
// overridden — the rig itself is what runs hot on this model.
const LIGHT_SCALE = 0.6;
const TONE_EXPOSURE = 1;
const ENV_MAP_INTENSITY = 0.6;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (start, end, progress) => start + (end - start) * progress;
const smoothstep = (progress) => {
  const value = clamp(progress, 0, 1);
  return value * value * (3 - 2 * value);
};

function disposeModel(root) {
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

function ScrollElectricalInspection({ active }) {
  const text = useSection("electrical-service");
  const sectionRef = useRef(null);
  const mountRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    const mount = mountRef.current;
    if (!active || !section || !mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 8.5);
    const mobileQuality = window.innerWidth <= 700;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = TONE_EXPOSURE;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = !mobileQuality;
    renderer.domElement.className = "electrical-inspection-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const environment = new RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const environmentMap = pmremGenerator.fromScene(environment, 0.04).texture;
    scene.environment = environmentMap;

    scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x101a13, 2.4 * LIGHT_SCALE));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.1 * LIGHT_SCALE);
    keyLight.position.set(5, 7, 8);
    keyLight.castShadow = true;
    const shadowMapSize = mobileQuality ? 512 : 1024;
    keyLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.025;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x8bbc3f, 2.1 * LIGHT_SCALE);
    rimLight.position.set(-5, 3, -3);
    scene.add(rimLight);

    const frontLight = new THREE.DirectionalLight(0xb9ddff, 1.05 * LIGHT_SCALE);
    frontLight.position.set(0, 1.5, 10);
    scene.add(frontLight);

    // Tilting the pivot leans the turntable axis, so the spin reads as a
    // three-quarter product turn instead of a flat carousel.
    const pivot = new THREE.Group();
    pivot.rotation.x = FRONTAL_TILT;
    scene.add(pivot);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const state = {
      opacity: 0,
      entranceProgress: 0,
      entranceOffsetY: 0,
      restOffsetY: 0,
      spinProgress: 0,
      normalizedWidth: 1,
      normalizedHeight: 1,
    };

    let modelRoot = null;
    let sourceModel = null;
    let idleRotation = 0;
    let lastFrameTime = 0;
    let frame = 0;
    let measureFrame = 0;
    let disposed = false;
    let loadStarted = false;
    let preparationTask = 0;
    let sectionInRange = false;
    let shadowFrame = 0;

    const scheduleIdleTask = (callback) => {
      if (typeof window.requestIdleCallback === "function") {
        return window.requestIdleCallback(callback, { timeout: 750 });
      }
      return window.setTimeout(callback, 16);
    };

    const cancelIdleTask = (task) => {
      if (!task) return;
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(task);
      } else {
        window.clearTimeout(task);
      }
    };

    const updateModelLayout = () => {
      if (!modelRoot) return;

      const distance = camera.position.z;
      const verticalView =
        2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
      const horizontalView = verticalView * camera.aspect;
      const mobile = window.innerWidth <= 700;
      const availableWidth = horizontalView * (mobile ? 0.88 : 0.58);
      const availableHeight = verticalView * (mobile ? 0.42 : 0.39);
      const modelScale = Math.min(
        availableWidth / Math.max(0.001, state.normalizedWidth),
        availableHeight / Math.max(0.001, state.normalizedHeight),
      );

      modelRoot.scale.setScalar(modelScale);
      state.entranceOffsetY = verticalView * (mobile ? 0.32 : 0.3);
      // Sit above centre so the service copy owns the lower third.
      state.restOffsetY =
        verticalView * (mobile ? MODEL_REST_LIFT_MOBILE : MODEL_REST_LIFT);
      pivot.position.x = 0;
      pivot.position.z = 0;
    };

    const measure = () => {
      measureFrame = 0;
      if (disposed) return;

      const width = Math.max(1, mount.clientWidth || window.innerWidth);
      const height = Math.max(1, mount.clientHeight || window.innerHeight);
      const mobile = window.innerWidth <= 700;
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        mobile ? 1.35 : 1.65,
      );

      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      updateModelLayout();
    };

    const scheduleMeasure = () => {
      if (measureFrame) return;
      measureFrame = window.requestAnimationFrame(measure);
    };

    const render = (time) => {
      if (!sectionInRange || disposed) {
        frame = 0;
        lastFrameTime = 0;
        return;
      }

      const delta = lastFrameTime
        ? Math.min(0.05, (time - lastFrameTime) / 1000)
        : 0;
      lastFrameTime = time;

      const bounds = section.getBoundingClientRect();
      const viewportHeight = Math.max(1, mount.clientHeight || window.innerHeight);
      const scrollTravel = Math.max(1, bounds.height - viewportHeight);
      const rawProgress = -bounds.top / scrollTravel;
      const targetEntrance = reducedMotion.matches
        ? 1
        : smoothstep(rawProgress / ENTRANCE_COMPLETE_AT);
      const targetProgress = smoothstep(
        (rawProgress - ENTRANCE_COMPLETE_AT) /
          (SPIN_COMPLETE_AT - ENTRANCE_COMPLETE_AT),
      );
      const entryVisibility = smoothstep(
        (viewportHeight - bounds.top) / Math.max(1, viewportHeight * 0.65),
      );
      const exitVisibility = smoothstep(
        bounds.bottom / Math.max(1, viewportHeight * 0.5),
      );
      const targetOpacity = modelRoot
        ? entryVisibility * exitVisibility * targetEntrance
        : 0;
      const ease = reducedMotion.matches
        ? 1
        : window.innerWidth <= 700
          ? 0.14
          : 0.09;

      state.opacity += (targetOpacity - state.opacity) * ease;
      state.entranceProgress +=
        (targetEntrance - state.entranceProgress) * ease;
      state.spinProgress += (targetProgress - state.spinProgress) * ease;

      if (Math.abs(targetOpacity - state.opacity) < 0.001) {
        state.opacity = targetOpacity;
      }
      if (Math.abs(targetEntrance - state.entranceProgress) < 0.0005) {
        state.entranceProgress = targetEntrance;
      }
      if (Math.abs(targetProgress - state.spinProgress) < 0.0005) {
        state.spinProgress = targetProgress;
      }

      mount.style.opacity = state.opacity.toFixed(3);
      pivot.position.y = lerp(
        state.entranceOffsetY,
        state.restOffsetY,
        state.entranceProgress,
      );

      if (!reducedMotion.matches) idleRotation += delta * IDLE_SPIN;
      if (modelRoot) {
        modelRoot.rotation.y =
          idleRotation + state.spinProgress * SPIN_TURNS * Math.PI * 2;
      }

      if (state.opacity > 0.002) {
        if (mobileQuality) {
          shadowFrame = (shadowFrame + 1) % 2;
          if (shadowFrame === 0) renderer.shadowMap.needsUpdate = true;
        }
        renderer.render(scene, camera);
      }
      frame = window.requestAnimationFrame(render);
    };

    const loadModel = () => {
      if (loadStarted || disposed) return;
      loadStarted = true;

      const loader = new GLTFLoader();
      loader.load(
        MODEL_URL,
        (gltf) => {
          if (disposed) {
            disposeModel(gltf.scene);
            return;
          }

          sourceModel = gltf.scene;
          sourceModel.traverse((object) => {
            if (!object.isMesh) return;
            object.frustumCulled = false;
            object.castShadow = true;
            object.receiveShadow = true;

            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            materials.filter(Boolean).forEach((material) => {
              if ("envMapIntensity" in material) {
                material.envMapIntensity = ENV_MAP_INTENSITY;
              }
              material.needsUpdate = true;
            });
          });

          const bounds = new THREE.Box3().setFromObject(sourceModel);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const sourceScale = 1 / Math.max(0.001, size.x, size.y, size.z);
          sourceModel.scale.setScalar(sourceScale);
          sourceModel.position.copy(center).multiplyScalar(-sourceScale);

          modelRoot = new THREE.Group();
          modelRoot.add(sourceModel);
          pivot.add(modelRoot);

          // The turntable sweeps the footprint diagonal, so reserve that width
          // instead of the resting one or the box clips its own corners at 90°.
          state.normalizedWidth = Math.max(
            0.001,
            Math.hypot(size.x, size.z) * sourceScale,
          );
          // Leaning the pivot projects depth into screen height, and rotation
          // swings the longer footprint axis toward the camera, so budget for
          // the worst case rather than the model's own height.
          const sweptDepth = Math.max(size.x, size.z);
          state.normalizedHeight = Math.max(
            0.001,
            (size.y * Math.cos(FRONTAL_TILT)
              + sweptDepth * Math.sin(FRONTAL_TILT)) * sourceScale,
          );
          updateModelLayout();

          preparationTask = scheduleIdleTask(() => {
            preparationTask = 0;
            if (disposed || !modelRoot) return;
            renderer.shadowMap.needsUpdate = true;
            renderer.compile(scene, camera);
            renderer.render(scene, camera);
          });
        },
        undefined,
        () => {
          mount.classList.add("load-error");
        },
      );
    };

    const renderObserver = new IntersectionObserver(
      (entries) => {
        sectionInRange = entries.some((entry) => entry.isIntersecting);
        if (sectionInRange && !frame) {
          frame = window.requestAnimationFrame(render);
        } else if (!sectionInRange) {
          window.cancelAnimationFrame(frame);
          frame = 0;
          lastFrameTime = 0;
          state.opacity = 0;
          mount.style.opacity = "0";
        }
      },
      { rootMargin: "100% 0px" },
    );
    renderObserver.observe(section);
    loadModel();

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(section);
    resizeObserver.observe(mount);
    window.addEventListener("resize", scheduleMeasure);
    measure();

    return () => {
      disposed = true;
      renderObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(measureFrame);
      cancelIdleTask(preparationTask);
      disposeModel(sourceModel);
      scene.environment = null;
      environmentMap.dispose();
      environment.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      mount.style.opacity = "";
      mount.classList.remove("load-error");
    };
  }, [active]);

  return (
    <section
      ref={sectionRef}
      className={`electrical-inspection-section ${active ? "visible" : ""}`}
      aria-labelledby="service-electrical-title"
    >
      <div className="electrical-inspection-sticky">
        <div
          ref={mountRef}
          className="electrical-inspection-canvas-mount"
          aria-hidden="true"
        />
        <ServiceSectionOverlay
          index={text("eyebrow", "02 / Service")}
          titleId="service-electrical-title"
          title={text("title", "Electrical Inspections & Testing")}
          description={text("description", "Acceptance and periodic testing for panels, switchgear and distribution networks — insulation and earthing measurements, thermography, and full documentation.")}
        />
      </div>
    </section>
  );
}

export default ScrollElectricalInspection;
