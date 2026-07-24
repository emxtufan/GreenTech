import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import "./ScrollWindTurbine.css";

const MODEL_URL = "/3d/animated_wind_turbine.glb";
const INWARD_Z_ROTATION = 0.9;
const STAGE_Y_MOBILE = [-0.8, 0.65, 0.4];
const STAGE_Y_DESKTOP = [-0.45, 0.45, 0.45];

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

function ScrollWindTurbine({ active }) {
  const layerRef = useRef(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!active || !layer) return undefined;

    const sectionGroup = layer.parentElement;
    const stageElements = Array.from(
      sectionGroup.querySelectorAll("[data-wind-stage]"),
    );
    if (!stageElements.length) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.className = "scroll-wind-turbine-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    layer.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x152119, 2.25));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(4, 7, 8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x8bbc3f, 1.7);
    rimLight.position.set(-6, 2, -2);
    scene.add(rimLight);

    const pivot = new THREE.Group();
    scene.add(pivot);

    const zAxisAlignment = new THREE.Group();
    zAxisAlignment.rotation.x = -Math.PI * 0.5;
    pivot.add(zAxisAlignment);

    const zRotationRig = new THREE.Group();
    zAxisAlignment.add(zRotationRig);

    const modelAlignment = new THREE.Group();
    modelAlignment.rotation.x = Math.PI * 0.5;
    zRotationRig.add(modelAlignment);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const state = {
      opacity: 0,
      x: 0,
      y: STAGE_Y_MOBILE[0],
      zRotation: -INWARD_Z_ROTATION,
      targetHeight: 3.8,
      sideTravel: 0,
      modelAspect: 0.72,
    };

    let stageMetrics = [];
    let modelRoot = null;
    let mixer = null;
    let clipDuration = 1;
    let frame = 0;
    let measureFrame = 0;
    let disposed = false;

    const updateModelLayout = () => {
      const distance = camera.position.z;
      const verticalView = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
      const horizontalView = verticalView * camera.aspect;
      const mobile = window.innerWidth <= 700;
      const widthShare = mobile ? 15 : 0.56;
      const heightFromWidth = (horizontalView * widthShare) / state.modelAspect;

      state.targetHeight = Math.min(mobile ? 10 : 6.5, heightFromWidth);
      const modelWidth = state.targetHeight * state.modelAspect;
      state.sideTravel = Math.max(
        0,
        mobile
          ? horizontalView * 0.5
          : horizontalView * 0.5 - modelWidth * 0.12,
      );

      modelRoot?.scale.setScalar(state.targetHeight);
    };

    const measure = () => {
      measureFrame = 0;
      if (disposed) return;

      const width = Math.max(1, renderer.domElement.clientWidth || window.innerWidth);
      const height = Math.max(1, renderer.domElement.clientHeight || window.innerHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, width <= 700 ? 1.4 : 1.75);

      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();

      stageMetrics = stageElements
        .filter((element) => getComputedStyle(element).display !== "none")
        .map((element) => {
          const bounds = element.getBoundingClientRect();
          const top = bounds.top + window.scrollY;
          return {
            top,
            bottom: top + bounds.height,
            center: top + bounds.height * 0.5,
          };
        });

      updateModelLayout();
    };

    const scheduleMeasure = () => {
      if (measureFrame) return;
      measureFrame = window.requestAnimationFrame(measure);
    };

    const getScrollTargets = () => {
      if (!stageMetrics.length) {
        return {
          opacity: 0,
          x: 0,
          y: STAGE_Y_MOBILE[0],
          zRotation: -INWARD_Z_ROTATION,
          animationTime: 0,
        };
      }

      const viewportHeight = Math.max(1, renderer.domElement.clientHeight || window.innerHeight);
      const viewportCenter = window.scrollY + viewportHeight * 0.5;
      const firstStage = stageMetrics[0];
      const lastStage = stageMetrics[stageMetrics.length - 1];
      const fadeIn = smoothstep(
        (window.scrollY + viewportHeight - firstStage.top) / (viewportHeight * 0.55),
      );
      const fadeOut = smoothstep(
        (lastStage.bottom - window.scrollY) / (viewportHeight * 0.5),
      );

      let firstIndex = 0;
      let secondIndex = 0;
      let progress = 0;

      if (viewportCenter >= stageMetrics[stageMetrics.length - 1].center) {
        firstIndex = stageMetrics.length - 1;
        secondIndex = firstIndex;
      } else {
        for (let index = 0; index < stageMetrics.length - 1; index += 1) {
          const current = stageMetrics[index];
          const next = stageMetrics[index + 1];
          if (viewportCenter < current.center || viewportCenter > next.center) continue;

          firstIndex = index;
          secondIndex = index + 1;
          progress = smoothstep(
            (viewportCenter - current.center) / Math.max(1, next.center - current.center),
          );
          break;
        }
      }

      const firstSide = firstIndex % 2 === 0 ? 1 : -1;
      const secondSide = secondIndex % 2 === 0 ? 1 : -1;
      const mobile = window.innerWidth <= 700;
      const sideTransitionProgress = mobile && firstIndex !== secondIndex
        ? smoothstep((progress - 0.4) / 0.2)
        : progress;
      const sidePosition = lerp(
        firstSide,
        secondSide,
        sideTransitionProgress,
      );
      const crossingVisibility = firstIndex === secondIndex
        ? 1
        : lerp(0.24, 1, Math.abs(sidePosition));
      const stageYPositions = window.innerWidth <= 700
        ? STAGE_Y_MOBILE
        : STAGE_Y_DESKTOP;
      const yStart = stageYPositions[firstIndex] ?? stageYPositions.at(-1);
      const yEnd = stageYPositions[secondIndex] ?? stageYPositions.at(-1);
      const stageStart = stageMetrics[0].top;
      const horizontalTravel = mobile && sidePosition < 0
        ? state.sideTravel * 0.3
        : state.sideTravel;
      return {
        opacity:
          fadeIn *
          fadeOut *
          crossingVisibility *
          (mobile ? 0.46 : 0.68),
        x: sidePosition * horizontalTravel,
        y: lerp(yStart, yEnd, progress),
        zRotation: -sidePosition * INWARD_Z_ROTATION,
        animationTime: Math.max(0, window.scrollY - stageStart) * 0.0045,
      };
    };

    const render = () => {
      const targets = getScrollTargets();
      const ease = reducedMotion.matches
        ? 1
        : window.innerWidth <= 700
          ? 0.14
          : 0.075;

      state.opacity += (targets.opacity - state.opacity) * ease;
      state.x += (targets.x - state.x) * ease;
      state.y += (targets.y - state.y) * ease;
      state.zRotation += (targets.zRotation - state.zRotation) * ease;

      if (Math.abs(targets.opacity - state.opacity) < 0.001) state.opacity = targets.opacity;
      if (Math.abs(targets.x - state.x) < 0.001) state.x = targets.x;

      layer.style.opacity = state.opacity.toFixed(3);
      pivot.position.x = state.x;
      pivot.position.y = state.y;
      zRotationRig.rotation.z = state.zRotation;

      if (mixer) {
        const animationTime = reducedMotion.matches ? 0 : targets.animationTime;
        mixer.setTime(animationTime % clipDuration);
      }

      if (state.opacity > 0.002) renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };

    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) {
          disposeModel(gltf.scene);
          return;
        }

        gltf.scene.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const sourceHeight = Math.max(0.001, size.y);

        const normalizationScale = 1 / sourceHeight;
        gltf.scene.scale.setScalar(normalizationScale);
        gltf.scene.position.copy(center).multiplyScalar(-normalizationScale);
        gltf.scene.traverse((object) => {
          if (!object.isMesh) return;
          object.frustumCulled = false;
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.filter(Boolean).forEach((material) => {
            if ("envMapIntensity" in material) material.envMapIntensity = 1.25;
            material.needsUpdate = true;
          });
        });

        modelRoot = new THREE.Group();
        modelRoot.add(gltf.scene);
        modelAlignment.add(modelRoot);

        state.modelAspect = Math.max(0.2, size.x / sourceHeight);
        updateModelLayout();

        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(gltf.scene);
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
          clipDuration = Math.max(0.001, gltf.animations[0].duration);
        }
      },
      undefined,
      () => {
        layer.classList.add("load-error");
      },
    );

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(sectionGroup);
    stageElements.forEach((element) => resizeObserver.observe(element));
    window.addEventListener("resize", scheduleMeasure);
    measure();
    frame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(measureFrame);
      mixer?.stopAllAction();
      disposeModel(modelRoot);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      layer.style.opacity = "";
      layer.classList.remove("load-error");
    };
  }, [active]);

  return <div ref={layerRef} className="scroll-wind-turbine-layer" aria-hidden="true" />;
}

export default ScrollWindTurbine;
