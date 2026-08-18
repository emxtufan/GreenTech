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
import "./ScrollSolarAssembly.css";

const MODEL_URL = "/3d/futuristic_solar_power_module%20(1).glb";
const MODEL_REST_LIFT = 0.11;
const MODEL_REST_LIFT_MOBILE = 0.08;
const ASSEMBLY_CLIP_START = 4.32;
const ASSEMBLY_CLIP_END = 9.2;
const ASSEMBLY_COMPLETE_AT = 0.82;
const FRONTAL_TILT = THREE.MathUtils.degToRad(0);
const ANIMATED_BOUNDS_SAMPLES = 5;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (start, end, progress) => start + (end - start) * progress;
const smoothstep = (progress) => {
  const value = clamp(progress, 0, 1);
  return value * value * (3 - 2 * value);
};

function expandByAnimatedModel(targetBox, root) {
  const vertex = new THREE.Vector3();

  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.isMesh) return;

    const positionAttribute = object.geometry?.attributes?.position;
    if (!positionAttribute) return;

    for (let index = 0; index < positionAttribute.count; index += 1) {
      if (object.isSkinnedMesh) object.getVertexPosition(index, vertex);
      else vertex.fromBufferAttribute(positionAttribute, index);

      vertex.applyMatrix4(object.matrixWorld);
      targetBox.expandByPoint(vertex);
    }
  });
}

function ScrollSolarAssembly({ active, prepare = false, onPrepared }) {
  const text = useSection("photovoltaic-service");
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
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = !mobileQuality;
    renderer.domElement.className = "solar-assembly-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const environment = new RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const environmentMap = pmremGenerator.fromScene(environment, 0.04).texture;
    scene.environment = environmentMap;

    scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x101a13, 2.4));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
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

    const rimLight = new THREE.DirectionalLight(0x8bbc3f, 2.1);
    rimLight.position.set(-5, 3, -3);
    scene.add(rimLight);

    const frontLight = new THREE.DirectionalLight(0xb9ddff, 1.05);
    frontLight.position.set(0, 1.5, 10);
    scene.add(frontLight);

    const pivot = new THREE.Group();
    pivot.rotation.x = Math.PI * 0.5 + FRONTAL_TILT;
    scene.add(pivot);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const state = {
      opacity: 0,
      restOffsetY: 0,
      assemblyProgress: 0,
      normalizedWidth: 1,
      normalizedHeight: 1,
    };

    let modelRoot = null;
    let sourceModel = null;
    let mixer = null;
    let animationStart = ASSEMBLY_CLIP_START;
    let animationEnd = ASSEMBLY_CLIP_END;
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
      onPrepared?.("solar-assembly", success);
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
      const availableWidth = horizontalView * (mobile ? 0.68 : 0.52);
      const availableHeight = verticalView * (mobile ? 0.42 : 0.44);
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

    const requestRender = () => {
      if (!sectionInRange || disposed || frame) return;
      frame = window.requestAnimationFrame(render);
    };

    const render = () => {
      frame = 0;
      if (!sectionInRange || disposed) {
        return;
      }

      const viewportHeight = layout.viewportHeight;
      const boundsTop = layout.sectionTop - window.scrollY;
      const boundsBottom = boundsTop + layout.sectionHeight;
      const scrollTravel = Math.max(1, layout.sectionHeight - viewportHeight);
      const rawProgress = -boundsTop / scrollTravel;
      const targetProgress = smoothstep(rawProgress / ASSEMBLY_COMPLETE_AT);
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
      state.assemblyProgress +=
        (targetProgress - state.assemblyProgress) * ease;

      if (Math.abs(targetOpacity - state.opacity) < 0.001) {
        state.opacity = targetOpacity;
      }
      if (Math.abs(targetProgress - state.assemblyProgress) < 0.0005) {
        state.assemblyProgress = targetProgress;
      }

      mount.style.opacity = state.opacity.toFixed(3);
      pivot.position.y = state.restOffsetY;

      if (mixer) {
        const progress = reducedMotion.matches ? 1 : state.assemblyProgress;
        mixer.setTime(lerp(animationStart, animationEnd, progress));
      }

      if (state.opacity > 0.002) {
        if (mobileQuality) {
          shadowFrame = (shadowFrame + 1) % 2;
          if (shadowFrame === 0) renderer.shadowMap.needsUpdate = true;
        }
        renderer.render(scene, camera);
      }

      const animationSettled =
        Math.abs(targetOpacity - state.opacity) < 0.001
        && Math.abs(targetProgress - state.assemblyProgress) < 0.0005;
      if (!animationSettled) requestRender();
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
            const adjustedMaterials = materials.filter(Boolean).map((material) => {
              const adjustedMaterial = material;

              if (object.isSkinnedMesh && adjustedMaterial.isMeshStandardMaterial) {
                adjustedMaterial.metalness = 0.72;
                adjustedMaterial.roughness = 0.78;
                adjustedMaterial.emissive.set(0x16344b);
                adjustedMaterial.emissiveMap = adjustedMaterial.map;
                adjustedMaterial.emissiveIntensity = 0.08;
              }

              if ("envMapIntensity" in adjustedMaterial) {
                adjustedMaterial.envMapIntensity = object.isSkinnedMesh ? 1.2 : 1;
              }
              adjustedMaterial.needsUpdate = true;
              return adjustedMaterial;
            });

            object.material = Array.isArray(object.material)
              ? adjustedMaterials
              : adjustedMaterials[0];
          });

          const clip = gltf.animations[0];
          if (clip) {
            mixer = new THREE.AnimationMixer(sourceModel);
            const action = mixer.clipAction(clip);
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            action.play();

            // The source clip opens, holds, then closes. Use its assembly pass only.
            animationStart = clamp(ASSEMBLY_CLIP_START, 0, clip.duration);
            animationEnd = clamp(
              ASSEMBLY_CLIP_END,
              animationStart,
              clip.duration,
            );
          }

          const animatedBounds = new THREE.Box3();
          const sampleCount = mixer ? ANIMATED_BOUNDS_SAMPLES : 0;
          let sampleIndex = 0;

          const finishModelPreparation = () => {
            const size = animatedBounds.getSize(new THREE.Vector3());
            const center = animatedBounds.getCenter(new THREE.Vector3());
            const sourceScale = 1 / Math.max(0.001, size.x, size.y, size.z);
            sourceModel.scale.setScalar(sourceScale);
            sourceModel.position.copy(center).multiplyScalar(-sourceScale);

            modelRoot = new THREE.Group();
            modelRoot.add(sourceModel);
            pivot.add(modelRoot);

            state.normalizedWidth = Math.max(0.001, size.x * sourceScale);
            state.normalizedHeight = Math.max(0.001, size.z * sourceScale);
            mixer?.setTime(animationStart);
            updateModelLayout();

            preparationTask = scheduleIdleTask(() => {
              preparationTask = 0;
              if (disposed || !modelRoot) return;
              renderer.shadowMap.needsUpdate = true;
              renderer.compile(scene, camera);
              renderer.render(scene, camera);
              reportPreparation(true);
              requestRender();
            });
          };

          const sampleAnimatedBounds = () => {
            preparationTask = 0;
            if (disposed) return;

            const progress = sampleCount > 0 ? sampleIndex / sampleCount : 0;
            mixer?.setTime(lerp(animationStart, animationEnd, progress));
            expandByAnimatedModel(animatedBounds, sourceModel);
            sampleIndex += 1;

            if (sampleIndex <= sampleCount) {
              preparationTask = scheduleIdleTask(sampleAnimatedBounds);
              return;
            }

            finishModelPreparation();
          };

          preparationTask = scheduleIdleTask(sampleAnimatedBounds);
      } catch (error) {
        console.error("Unable to prepare the solar assembly model", error);
        mount.classList.add("load-error");
        reportPreparation(false);
      }
    };

    const renderObserver = new IntersectionObserver(
      (entries) => {
        sectionInRange = entries.some((entry) => entry.isIntersecting);
        if (sectionInRange) {
          measure();
          requestRender();
        } else if (!sectionInRange) {
          window.cancelAnimationFrame(frame);
          frame = 0;
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
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", scheduleMeasure);
    measure();

    return () => {
      disposed = true;
      renderObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", scheduleMeasure);
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(measureFrame);
      cancelIdleTask(preparationTask);
      mixer?.stopAllAction();
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
      id="service-photovoltaic"
      className={`solar-assembly-section ${active ? "visible" : ""}`}
      aria-labelledby="service-solar-title"
    >
      <div className="solar-assembly-sticky">
        <div
          ref={mountRef}
          className="solar-assembly-canvas-mount"
          aria-hidden="true"
        />
        <ServiceSectionOverlay
          active={active}
          label={text("marqueeLabel", "SERVICII")}
          index={text("eyebrow", "01 / Servicii")}
          titleId="service-solar-title"
          title={text("title", "Constructia parcurilor fotovoltaice")}
          description={text("description", "Executam montajul structurilor si modulelor, cablarea DC si AC, instalarea invertoarelor, testarile si pregatirea pentru racordare.")}
        />
      </div>
    </section>
  );
}

export default ScrollSolarAssembly;
