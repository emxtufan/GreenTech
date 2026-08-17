import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import ServiceSectionOverlay from "./ServiceSectionOverlay.jsx";
import useSection from "./hooks/useSection.js";
import useNearViewport from "./hooks/useNearViewport.js";
import {
  cloneCachedGLTF,
  disposeGLTFInstance,
} from "./lib/threeAssetCache.js";
import "./ScrollDataCenterBuild.css";

const MODEL_URL = "/3d/data_center_workspace_2.glb";
const MODEL_REST_LIFT = 0.13;
const MODEL_REST_LIFT_MOBILE = 0.06;
const AUTO_ROTATION_SPEED = THREE.MathUtils.degToRad(12);
// A server room read close to eye level: leaning further would show the
// ceiling and hide the aisles the racks sit in.
const FRONTAL_TILT = THREE.MathUtils.degToRad(8);

// Mostly dark casings and floor with glossy highlights, plus three emissive
// materials for the rack LEDs and ceiling lamps. It carries far more light
// than the flat white scenes, and the low roughness wants the environment.
const LIGHT_SCALE = 0.75;
const TONE_EXPOSURE = 1;
const ENV_MAP_INTENSITY = 0.7;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (progress) => {
  const value = clamp(progress, 0, 1);
  return value * value * (3 - 2 * value);
};

function ScrollDataCenterBuild({ active, prepare = false, onPrepared }) {
  const text = useSection("data-center-service");
  const sectionRef = useRef(null);
  const mountRef = useRef(null);
  const nearViewport = useNearViewport(sectionRef, active);
  const webglActive = prepare || nearViewport;

  useEffect(() => {
    const section = sectionRef.current;
    const mount = mountRef.current;
    if (!webglActive || !section || !mount) return undefined;

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
    renderer.domElement.className = "data-center-canvas";
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

    const pivot = new THREE.Group();
    pivot.rotation.x = FRONTAL_TILT;
    scene.add(pivot);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const state = {
      opacity: 0,
      restOffsetY: 0,
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
    let preparationReported = false;
    const layout = {
      sectionTop: 0,
      sectionHeight: 1,
      viewportHeight: Math.max(1, window.innerHeight),
    };

    const reportPreparation = (success) => {
      if (preparationReported) return;
      preparationReported = true;
      onPrepared?.("data-center", success);
    };

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
      const availableWidth = horizontalView * (mobile ? 0.95 : 0.62);
      const availableHeight = verticalView * (mobile ? 0.42 : 0.4);
      const modelScale = Math.min(
        availableWidth / Math.max(0.001, state.normalizedWidth),
        availableHeight / Math.max(0.001, state.normalizedHeight),
      );

      modelRoot.scale.setScalar(modelScale);
      // Sit above centre so the service copy owns the lower third.
      state.restOffsetY =
        verticalView * (mobile ? MODEL_REST_LIFT_MOBILE : MODEL_REST_LIFT);
      pivot.position.x = 0;
      pivot.position.y = state.restOffsetY;
      pivot.position.z = 0;
    };

    const measure = () => {
      measureFrame = 0;
      if (disposed) return;

      const width = Math.max(1, mount.clientWidth || window.innerWidth);
      const height = Math.max(1, mount.clientHeight || window.innerHeight);
      const sectionBounds = section.getBoundingClientRect();
      const mobile = window.innerWidth <= 700;
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        mobile ? 1.35 : 1.65,
      );

      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      layout.sectionTop = window.scrollY + sectionBounds.top;
      layout.sectionHeight = Math.max(1, sectionBounds.height);
      layout.viewportHeight = height;
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

      const viewportHeight = layout.viewportHeight;
      const boundsTop = layout.sectionTop - window.scrollY;
      const boundsBottom = boundsTop + layout.sectionHeight;
      const entryVisibility = smoothstep(
        (viewportHeight - boundsTop) / Math.max(1, viewportHeight * 0.65),
      );
      const exitVisibility = smoothstep(
        boundsBottom / Math.max(1, viewportHeight * 0.5),
      );
      const targetOpacity = modelRoot ? entryVisibility * exitVisibility : 0;
      const ease = reducedMotion.matches
        ? 1
        : window.innerWidth <= 700
          ? 0.14
          : 0.09;

      state.opacity += (targetOpacity - state.opacity) * ease;

      if (Math.abs(targetOpacity - state.opacity) < 0.001) {
        state.opacity = targetOpacity;
      }

      mount.style.opacity = state.opacity.toFixed(3);
      pivot.position.y = state.restOffsetY;

      if (!reducedMotion.matches) {
        idleRotation = THREE.MathUtils.euclideanModulo(
          idleRotation + delta * AUTO_ROTATION_SPEED,
          Math.PI * 2,
        );
      }
      if (modelRoot) {
        modelRoot.rotation.y = idleRotation;
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

    const loadModel = async () => {
      if (loadStarted || disposed) return;
      loadStarted = true;

      try {
        const gltf = await cloneCachedGLTF(MODEL_URL);
          if (disposed) {
            disposeGLTFInstance(gltf.scene);
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

          // The footprint is square, so the turntable sweeps a diagonal 41%
          // wider than the resting width — reserve that or the corners clip.
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
            reportPreparation(true);
          });
      } catch (error) {
        console.error("Unable to prepare the data center model", error);
        mount.classList.add("load-error");
        reportPreparation(false);
      }
    };

    const renderObserver = new IntersectionObserver(
      (entries) => {
        sectionInRange = entries.some((entry) => entry.isIntersecting);
        if (sectionInRange) {
          measure();
          if (!frame) frame = window.requestAnimationFrame(render);
        } else {
          window.cancelAnimationFrame(frame);
          frame = 0;
          lastFrameTime = 0;
          state.opacity = 0;
          mount.style.opacity = "0";
        }
      },
      { rootMargin: "20% 0px" },
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
      disposeGLTFInstance(sourceModel);
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
  }, [onPrepared, webglActive]);

  return (
    <section
      ref={sectionRef}
      id="service-data-center"
      className={`data-center-section ${active ? "visible" : ""}`}
      aria-labelledby="service-data-center-title"
    >
      <div className="data-center-sticky">
        <div
          ref={mountRef}
          className="data-center-canvas-mount"
          aria-hidden="true"
        />
        <ServiceSectionOverlay
          active={active}
          index={text("eyebrow", "04 / Service")}
          titleId="service-data-center-title"
          title={text("title", "Data Center Construction")}
          description={text("description", "Turnkey data center builds — white space fit-out, power distribution and redundancy, cooling and containment, commissioned and documented to spec.")}
        />
      </div>
    </section>
  );
}

export default ScrollDataCenterBuild;
