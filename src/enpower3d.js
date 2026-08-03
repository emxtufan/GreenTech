import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import gsap from "gsap";
import { SCENE_COUNT, SCROLL_SEGMENT } from "./experienceConfig.js";

export { SCENE_COUNT, SCROLL_HEIGHT, SCROLL_SEGMENT } from "./experienceConfig.js";

const LIGHT_BACKGROUND = 16776954;
const DARK_BACKGROUND = 1315860;
const LIGHT_STROKE = 9868950;
const DARK_STROKE = 12829635;
const DARK_FILL = 0x2b332f;
const DARK_GROUND = 0x1b201d;
const BASE_CAMERA_FOV = 25;
const PHONE_REFERENCE_ASPECT = 0.28;
const PHONE_MODEL_SCALE = 1;
const DESKTOP_MIN_PIXEL_RATIO = 1.5;
const PHONE_MIN_PIXEL_RATIO = 2;
const MAX_DESKTOP_PIXEL_RATIO = 2;
const MAX_PHONE_PIXEL_RATIO = 3;
const LINE_MSAA_SAMPLES = 2;
const MSAA_RENDER_PIXEL_LIMIT = 2500000;
const MOBILE_SOLAR_CLOUD_OPACITY = 0.12;
const MOBILE_SOLAR_INTRO_CLOUD_OPACITY = 0.235;

function getSolarCloudOpacity(dark, width, height, intro = false) {
  if (dark) return intro ? 0.03 : 0.02;
  if (Math.min(width, height) <= 600) {
    return intro ? MOBILE_SOLAR_INTRO_CLOUD_OPACITY : MOBILE_SOLAR_CLOUD_OPACITY;
  }
  return 0.26;
}

function getExperiencePixelRatio(highQuality, width, height) {
  const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
  if (!highQuality) return devicePixelRatio > 1 ? 1 : 0.5;
  const phoneScreen = Math.min(width, height) <= 600;
  const minimum = phoneScreen ? PHONE_MIN_PIXEL_RATIO : DESKTOP_MIN_PIXEL_RATIO;
  const maximum = phoneScreen ? MAX_PHONE_PIXEL_RATIO : MAX_DESKTOP_PIXEL_RATIO;
  return Math.min(Math.max(devicePixelRatio, minimum), maximum);
}

function getResponsiveCameraFov(width, height) {
  const aspect = width / Math.max(1, height);
  const phoneLayout = Math.min(width, height) <= 600;
  if (!phoneLayout || aspect >= PHONE_REFERENCE_ASPECT) return BASE_CAMERA_FOV;

  const referenceHalfWidth =
    Math.tan(THREE.MathUtils.degToRad(BASE_CAMERA_FOV * 0.5)) *
    PHONE_REFERENCE_ASPECT;
  const fov = THREE.MathUtils.radToDeg(
    2 * Math.atan(referenceHalfWidth / aspect),
  );
  return Math.min(10, fov);
}

const stagePalettes = {
  solar: {
    background: 0xfff8e8,
    ground: 0xf3ecdf,
    fill: 0xf1c75b,
    stroke: 0x59605b,
    accent: 0xf0a51a,
    fills: [
      ["White", 0x8bbc3f],
    ],
  },
  wind: {
    background: 0xedf8f7,
    ground: 0xe4efed,
    fill: 0x78c8d4,
    stroke: 0x4f5d5f,
    accent: 0x1697b1,
    fills: [
      ["Rotating_", 0x55b8c8],
      ["Pole_", 0x8fd2d8],
    ],
  },
  towers: {
    background: 0xf2f5f2,
    ground: 0xe5ebe7,
    fill: 0xaebdb6,
    stroke: 0x4d5752,
    accent: 0x698f80,
  },
  central: {
    background: 0xf3f8eb,
    ground: 0xe6eee0,
    fill: 0xa3cf72,
    stroke: 0x49564a,
    accent: 0x72ae43,
    fills: [
      ["Building_", 0x9fce6c],
      ["Tower_", 0xaabbb3],
      ["Small_Towers_", 0x91aaa0],
    ],
  },
  factory: {
    background: 0xeff7f1,
    ground: 0xe1ece4,
    fill: 0x63b47d,
    stroke: 0x43534a,
    accent: 0x299b59,
    fills: [
      ["Building_", 0x66b981],
      ["Tower_", 0xa9bbb2],
    ],
  },
  overview: {
    background: 0xf2f7f2,
    ground: 0xe5ede6,
    fill: 0xc7d6ca,
    stroke: 0x4b5650,
    accent: 0x63b34d,
    window: 0x86aaa0,
    fills: [
      ["Solar_", 0xf1c75b],
      ["Rotating_", 0x55b8c8],
      ["Pole_", 0x8fd2d8],
      ["Central_", 0x9fce6c],
      ["Factory_", 0x63b47d],
      ["Household_", 0xd3e1d5],
      ["Tower_", 0xaebdb6],
      ["Poles_", 0xaebdb6],
    ],
  },
};

const textureFiles = {
  displacement: "/_next/static/media/displacement-1.656d49d1.jpg",
  cloud: "/_next/static/media/cloud.3a5ed178.png",
  light: "/_next/static/media/light.4374ad92.png",
  alpha: "/_next/static/media/alphamap.e7266df0.png",
  alpha2: "/_next/static/media/alphamap-2.9e2de17d.png",
  particle: "/_next/static/media/spark-1.f6cfdea5.png",
};

const modelFiles = {
  solar: "/3d/solar.glb",
  wind: "/3d/turbines.glb",
  towers: "/3d/towers.glb",
  central: "/3d/central.glb",
  factory: "/3d/factory.glb",
  overview: "/3d/overview.glb",
};

const stageSettings = {
  solar: {
    sourceIndex: 0,
    fog: [110, 200],
    camera: [-5, 140, 110],
    cameraRotation: [-0.1, 0, 0],
    near: 1.2,
    far: 950,
    group: [0, -5, -100],
    groupRotation: [0, -0.2, 0],
    blackSide: THREE.FrontSide,
  },
  wind: {
    sourceIndex: 1,
    fog: [9, 160],
    camera: [0, 14, 85],
    cameraRotation: [-0.1, 0, 0],
    near: 1,
    far: 950,
    group: [4, 0, -10],
    groupRotation: [0, -0.2, 0],
  },
  towers: {
    sourceIndex: 3,
    fog: [80, 200],
    camera: [0, 16, 120],
    cameraRotation: [-0.1, 0, 0],
    near: 1,
    far: 950,
    group: [4, 0, -10],
    groupRotation: [0, -0.2, 0],
  },
  central: {
    sourceIndex: 4,
    fog: [50, 200],
    camera: [0, 30, 75],
    cameraRotation: [-0.22, 0, 0],
    near: 1.5,
    far: 950,
    group: [0, 0, -20],
    groupRotation: [0, -0.2, 0],
  },
  factory: {
    sourceIndex: 5,
    fog: [80, 250],
    camera: [0, 45, 75],
    cameraRotation: [-0.25, 0, 0],
    near: 1,
    far: 950,
    group: [-2, 0, -45],
    groupRotation: [0, -0.2, 0],
  },
  overview: {
    sourceIndex: 6,
    fog: [50, 200],
    camera: [0, 35, 75],
    cameraRotation: [-0.22, 0, 0],
    near: 10,
    far: 2000,
    group: [20, 0, 10],
    groupRotation: [0, -0.55, 0],
  },
};

function clamp(min, max, value) {
  return Math.min(max, Math.max(min, value));
}

function createNoise2D(random = Math.random) {
  const skew = 0.5 * (Math.sqrt(3) - 1);
  const unskew = (3 - Math.sqrt(3)) / 6;
  const gradients = new Float64Array([
    1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0,
    1, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0, -1,
  ]);
  const permutation = new Uint8Array(512);
  for (let index = 0; index < 256; index += 1) permutation[index] = index;
  for (let index = 0; index < 255; index += 1) {
    const swapIndex = index + ~~(random() * (256 - index));
    const value = permutation[index];
    permutation[index] = permutation[swapIndex];
    permutation[swapIndex] = value;
  }
  for (let index = 256; index < 512; index += 1) permutation[index] = permutation[index - 256];
  const gradX = new Float64Array(permutation).map((value) => gradients[(value % 12) * 2]);
  const gradY = new Float64Array(permutation).map((value) => gradients[(value % 12) * 2 + 1]);

  return (xValue, yValue) => {
    const skewValue = (xValue + yValue) * skew;
    const cellX = Math.floor(xValue + skewValue);
    const cellY = Math.floor(yValue + skewValue);
    const unskewValue = (cellX + cellY) * unskew;
    const x0 = xValue - (cellX - unskewValue);
    const y0 = yValue - (cellY - unskewValue);
    const xStep = x0 > y0 ? 1 : 0;
    const yStep = x0 > y0 ? 0 : 1;
    const x1 = x0 - xStep + unskew;
    const y1 = y0 - yStep + unskew;
    const x2 = x0 - 1 + 2 * unskew;
    const y2 = y0 - 1 + 2 * unskew;
    const permutationX = cellX & 255;
    const permutationY = cellY & 255;
    let contribution0 = 0;
    let contribution1 = 0;
    let contribution2 = 0;

    let weight = 0.5 - x0 * x0 - y0 * y0;
    if (weight >= 0) {
      const gradientIndex = permutationX + permutation[permutationY];
      weight *= weight;
      contribution0 = weight * weight * (gradX[gradientIndex] * x0 + gradY[gradientIndex] * y0);
    }
    weight = 0.5 - x1 * x1 - y1 * y1;
    if (weight >= 0) {
      const gradientIndex = permutationX + xStep + permutation[permutationY + yStep];
      weight *= weight;
      contribution1 = weight * weight * (gradX[gradientIndex] * x1 + gradY[gradientIndex] * y1);
    }
    weight = 0.5 - x2 * x2 - y2 * y2;
    if (weight >= 0) {
      const gradientIndex = permutationX + 1 + permutation[permutationY + 1];
      weight *= weight;
      contribution2 = weight * weight * (gradX[gradientIndex] * x2 + gradY[gradientIndex] * y2);
    }
    return 70 * (contribution0 + contribution1 + contribution2);
  };
}

function repeatingTexture(source, repeatX = 1, repeatY = 1) {
  const texture = source.clone();
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.needsUpdate = true;
  return texture;
}

function wireMaterial(color, alphaMap) {
  return new THREE.MeshBasicMaterial({
    color,
    alphaMap,
    transparent: true,
    side: THREE.DoubleSide,
  });
}

function applyModelMaterials(stage, model) {
  model.traverse((object) => {
    if (!object.isMesh && !object.isPoints) return;
    if (object.name.includes("White")) object.material = stage.fillMaterialFor(object.name);
    if (object.name.includes("Stroke")) object.material = stage.blackMaterial;
    if (object.name.includes("Rotating")) stage.rotationObjects.push(object);
  });
}

function makeCloudMesh(texture, count, width, height, positionFactory, opacity) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const matrix = new THREE.Matrix4();
  const positions = [];
  for (let index = 0; index < count; index += 1) {
    positions.push(positionFactory());
  }
  const map = texture.clone();
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0),
    map,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    depthWrite: false,
    opacity,
    fog: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  positions.forEach(([x, y, z], index) => {
    matrix.makeTranslation(x, y, z);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return { mesh, material };
}

class RenderStage {
  constructor(owner, key, model, textures, displayIndex) {
    this.owner = owner;
    this.key = key;
    this.settings = stageSettings[key];
    this.palette = stagePalettes[key];
    this.timelineOffset = (this.settings.sourceIndex - displayIndex) * SCROLL_SEGMENT;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.palette.background);
    this.scene.fog = new THREE.Fog(this.palette.background, ...this.settings.fog);
    this.camera = new THREE.PerspectiveCamera(
      BASE_CAMERA_FOV,
      owner.vw / owner.vh,
      this.settings.near,
      this.settings.far,
    );
    this.camera.position.set(...this.settings.camera);
    this.camera.rotation.set(...this.settings.cameraRotation);
    this.scene.add(this.camera);
    this.fbo = new THREE.WebGLRenderTarget(owner.vw, owner.vh);
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouse = { x: 0, y: 0 };
    this.resizeRatio = { x: 0, z: 0, rotationY: 0 };
    this.rotationObjects = [];
    this.simplex = createNoise2D();
    this.paletteMaterials = [];
    this.fillMaterialCache = new Map();
    this.whiteMaterial = this.registerPaletteMaterial(this.palette.fill, DARK_FILL);
    this.groundMaterial = this.registerPaletteMaterial(this.palette.ground, DARK_GROUND);
    this.blackMaterial = this.registerPaletteMaterial(
      this.palette.stroke,
      DARK_STROKE,
      this.settings.blackSide ?? THREE.DoubleSide,
    );
    this.pivot = new THREE.Object3D();
    this.globalGroup = new THREE.Group();
    this.resizeGroup = new THREE.Group();
    this.resizeGroup.add(this.globalGroup);
    this.pivot.add(this.resizeGroup);
    this.scene.add(this.pivot);
    this.globalGroup.position.set(...this.settings.group);
    this.globalGroup.rotation.set(...this.settings.groupRotation);
    this.model = model;
    applyModelMaterials(this, model);
    this.setupSpecificModel(textures);
    this.globalGroup.add(model);
    this.setDark(false);
    this.resize(owner.vw, owner.vh, owner.pixelRatio);
  }

  registerPaletteMaterial(lightColor, darkColor, side = THREE.DoubleSide) {
    const material = new THREE.MeshBasicMaterial({ color: lightColor, side });
    this.paletteMaterials.push({ material, lightColor, darkColor });
    return material;
  }

  fillMaterialFor(name) {
    if (/^(Ground|Floor)_White/.test(name)) return this.groundMaterial;
    const override = this.palette.fills?.find(([prefix]) => name.startsWith(prefix));
    if (!override) return this.whiteMaterial;
    const color = override[1];
    if (!this.fillMaterialCache.has(color)) {
      this.fillMaterialCache.set(color, this.registerPaletteMaterial(color, DARK_FILL));
    }
    return this.fillMaterialCache.get(color);
  }

  object(name) {
    const object = this.model.getObjectByName(name);
    if (!object) throw new Error(`${this.key}.glb is missing ${name}`);
    return object;
  }

  setupSpecificModel(textures) {
    if (this.key === "solar") this.setupSolar(textures);
    if (this.key === "wind") this.setupWind(textures);
    if (this.key === "towers") this.setupTowers(textures);
    if (this.key === "central") this.setupCentral(textures);
    if (this.key === "factory") this.setupFactory(textures);
    if (this.key === "overview") this.setupOverview(textures);
  }

  setupSolar(textures) {
    const alphaMap = repeatingTexture(textures.alpha2);
    this.wireMaterial = wireMaterial(16763729, alphaMap);
    this.object("Wire_1_Stroke_Copy").material = this.wireMaterial;
    this.object("Wire_1_Stroke_Copy").visible = false;
    const lightMap = repeatingTexture(textures.light);
    const lightAlpha = repeatingTexture(textures.alpha);
    this.lightMaterial1 = new THREE.MeshBasicMaterial({
      depthWrite: false,
      map: lightMap,
      alphaMap: lightAlpha,
      color: 16763729,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.lightMaterial2 = new THREE.MeshBasicMaterial({
      depthWrite: false,
      map: lightMap,
      alphaMap: lightAlpha,
      color: 16763729,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const lightGeometry = new THREE.PlaneGeometry(40, 50);
    const light1 = new THREE.Mesh(lightGeometry, this.lightMaterial1);
    light1.position.set(0, 20, 30);
    light1.rotation.set(0, -0.02, -0.6);
    const light2 = new THREE.Mesh(lightGeometry, this.lightMaterial2);
    light2.position.set(0, 20, 15);
    light2.rotation.set(0, -0.02, -0.6);
    this.globalGroup.add(light1, light2);

    const cloudSet1 = makeCloudMesh(
      textures.cloud,
      200,
      60,
      60,
      () => [
        (2 * Math.random() - 1) * 250,
        (2 * Math.random() - 1) * 90 + 142,
        (2 * Math.random() - 1) * 100 - 100,
      ],
      0,
    );
    const cloudSet2 = makeCloudMesh(
      textures.cloud,
      200,
      60,
      60,
      () => [
        (2 * Math.random() - 1) * 200,
        (2 * Math.random() - 1) * 90 + 142,
        (2 * Math.random() - 1) * 100 - 100,
      ],
      0,
    );
    this.cloudMaterial = cloudSet1.material;
    cloudSet2.mesh.material = this.cloudMaterial;
    this.clouds1 = cloudSet1.mesh;
    this.clouds2 = cloudSet2.mesh;
    this.clouds2.position.x = 300;
    this.clouds3 = cloudSet1.mesh.clone();
    this.clouds4 = cloudSet2.mesh.clone();
    this.clouds3.material = this.cloudMaterial;
    this.clouds4.material = this.cloudMaterial;
    this.clouds3.position.x = -450;
    this.globalGroup.add(this.clouds1, this.clouds2, this.clouds3, this.clouds4);

    const particleGeometry = new THREE.BufferGeometry();
    const particleMap = textures.particle.clone();
    particleMap.needsUpdate = true;
    this.particleShaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        pointTexture: { value: particleMap },
        color: { value: new THREE.Vector4(100 / 255, 100 / 255, 100 / 255, 1) },
        resolution: { value: new THREE.Vector4(1, 1, 1, 1) },
      },
      vertexShader: "attribute float size; varying vec4 vColor; uniform vec4 color; void main() { vColor = color; vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 ); gl_PointSize = size * ( 300.0 / -mvPosition.z ); gl_Position = projectionMatrix * mvPosition; }",
      fragmentShader: "uniform sampler2D pointTexture; varying vec4 vColor; uniform vec4 resolution; void main() { gl_FragColor = vec4( vColor.x, vColor.y, vColor.z, 0.8 ); gl_FragColor = gl_FragColor * texture2D( pointTexture, gl_PointCoord ); }",
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      transparent: true,
      depthWrite: false,
    });
    this.particleSystem = new THREE.Points(particleGeometry, this.particleShaderMaterial);
    this.particleSystem.position.set(0, 20, 20);
    this.particleSystem.rotation.set(0, -0.1, -0.6);
    this.globalGroup.add(this.particleSystem);
    const particleCount = (this.owner.vw + this.owner.vh) / 7;
    const positions = [];
    const sizes = [];
    this.animationYParticle = [];
    for (let index = 0; index < particleCount; index += 1) {
      positions.push(
        (2 * Math.random() - 1) * 15,
        (2 * Math.random() - 1) * 20,
        (2 * Math.random() - 1) * 3,
      );
      sizes.push(1);
      this.animationYParticle.push(0);
    }
    particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    particleGeometry.setAttribute(
      "size",
      new THREE.Float32BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage),
    );
    this.positions = particleGeometry.attributes.position.array;
    this.savedParticles = Float32Array.from(this.positions);
    this.sizes = particleGeometry.attributes.size.array;
    this.positionsLength = this.positions.length;
    this.particleIndex = 0;
    this.introTransition = { ratioContent: 0, ratioRotate: 0, ratioCamera: 1 };
    this.wheelY = { val: 0 };
    this.wheel = { y: 0 };
    this.mobileDragY = 0;
    this.mobileDrag = { y: 0 };
    this.cloudOpacity = {
      base: getSolarCloudOpacity(false, this.owner.vw, this.owner.vhSaved),
      intro: getSolarCloudOpacity(false, this.owner.vw, this.owner.vhSaved, true),
    };
  }

  setupWind(textures) {
    this.staticWireMaterial = new THREE.MeshBasicMaterial({ color: 14079702, side: THREE.DoubleSide });
    this.wireMaterial = wireMaterial(6602448, repeatingTexture(textures.alpha2));
    this.object("Wire_1_Stroke").material = this.staticWireMaterial;
    this.object("Wire_1_Stroke_Copy").material = this.wireMaterial;
    const cloud = makeCloudMesh(
      textures.cloud,
      30,
      60,
      30,
      () => [
        (2 * Math.random() - 1) * 100,
        (2 * Math.random() - 1) * 15 + 40,
        (2 * Math.random() - 1) * 20 - 100,
      ],
      0.2,
    );
    this.clouds = cloud.mesh;
    this.cloudMaterial = cloud.material;
    this.globalGroup.add(this.clouds);

    const lightGeometries = [];
    const darkGeometries = [];
    for (let index = 0; index < 65; index += 1) {
      const geometry = new THREE.CapsuleGeometry(0.1, 1, 4, 16);
      geometry.rotateX(Math.PI / 2);
      geometry.translate(
        (2 * Math.random() - 1) * 40,
        (2 * Math.random() - 1) * 7 + 15,
        (2 * Math.random() - 1) * 150 - 30,
      );
      lightGeometries.push(geometry);
    }
    for (let index = 0; index < 65; index += 1) {
      const geometry = new THREE.CapsuleGeometry(0.1, 1, 4, 16);
      geometry.rotateX(Math.PI / 2);
      geometry.translate(
        (2 * Math.random() - 1) * 40,
        (2 * Math.random() - 1) * 7 + 15,
        (2 * Math.random() - 1) * 150 - 30,
      );
      darkGeometries.push(geometry);
    }
    const lightGeometry = mergeGeometries(lightGeometries);
    const darkGeometry = mergeGeometries(darkGeometries);
    lightGeometries.forEach((item) => item.dispose());
    darkGeometries.forEach((item) => item.dispose());
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 14540253, side: THREE.DoubleSide });
    const darkMaterial = new THREE.MeshBasicMaterial({ color: 6602448, side: THREE.DoubleSide });
    this.particles1 = new THREE.Mesh(lightGeometry, lightMaterial);
    this.particles2 = new THREE.Mesh(darkGeometry, darkMaterial);
    this.particles3 = new THREE.Mesh(lightGeometry, lightMaterial);
    this.particles4 = new THREE.Mesh(darkGeometry, darkMaterial);
    this.particles3.position.z = -300;
    this.particles4.position.z = -300;
    this.globalGroup.add(this.particles1, this.particles2, this.particles3, this.particles4);
  }

  setupTowers(textures) {
    this.staticWireMaterial = new THREE.MeshBasicMaterial({ color: 12369084, side: THREE.DoubleSide });
    this.wireMaterial1 = wireMaterial(6602448, repeatingTexture(textures.alpha2));
    this.wireMaterial2 = wireMaterial(16763729, repeatingTexture(textures.alpha2));
    this.wireMaterial3 = wireMaterial(5734606, repeatingTexture(textures.alpha2));
    for (const name of ["Left_Wire_1_Stroke", "Mid_Wire_1_Stroke", "Right_Wire_1_Stroke"]) {
      this.object(name).material = this.staticWireMaterial;
    }
    this.object("Left_Wire_1_Stroke_Copy").material = this.wireMaterial1;
    this.object("Mid_Wire_1_Stroke_Copy").material = this.wireMaterial2;
    this.object("Right_Wire_1_Stroke_Copy").material = this.wireMaterial3;
    const cloud = makeCloudMesh(
      textures.cloud,
      30,
      60,
      30,
      () => [
        (2 * Math.random() - 1) * 100 - 50,
        (2 * Math.random() - 1) * 20 + 50,
        (2 * Math.random() - 1) * 20 - 100,
      ],
      0.2,
    );
    this.clouds = cloud.mesh;
    this.cloudMaterial = cloud.material;
    this.globalGroup.add(this.clouds);
  }

  setupCentral(textures) {
    this.staticWireMaterial = new THREE.MeshBasicMaterial({ color: LIGHT_STROKE, side: THREE.DoubleSide });
    const sharedAlpha = repeatingTexture(textures.alpha2);
    const greenAlpha = repeatingTexture(textures.alpha2, 4, 4);
    this.wireMaterial1 = wireMaterial(6602448, sharedAlpha);
    this.wireMaterial2 = wireMaterial(16763729, sharedAlpha);
    this.wireMaterial3 = wireMaterial(5734606, sharedAlpha);
    this.wireMaterial4 = wireMaterial(5886558, greenAlpha);
    for (const name of [
      "Wire_Mid_1_Stroke_1",
      "Wire_Mid_1_Stroke_2",
      "Wire_Mid_1_Stroke_3",
      "Green_Wire_1_Stroke",
    ]) {
      this.object(name).material = this.staticWireMaterial;
    }
    this.object("Wire_Mid_1_Stroke_1_Copy").material = this.wireMaterial1;
    this.object("Wire_Mid_1_Stroke_2_Copy").material = this.wireMaterial2;
    this.object("Wire_Mid_1_Stroke_3_Copy").material = this.wireMaterial3;
    this.object("Green_Wire_1_Stroke_Copy").material = this.wireMaterial4;
    const cloud = makeCloudMesh(
      textures.cloud,
      40,
      60,
      20,
      () => [
        (2 * Math.random() - 1) * 100 - 100,
        (2 * Math.random() - 1) * 15 + 30,
        (2 * Math.random() - 1) * 20 - 100,
      ],
      0.2,
    );
    this.clouds = cloud.mesh;
    this.cloudMaterial = cloud.material;
    this.globalGroup.add(this.clouds);
  }

  setupFactory(textures) {
    this.staticWireMaterial = new THREE.MeshBasicMaterial({ color: LIGHT_STROKE, side: THREE.DoubleSide });
    this.wireMaterial = wireMaterial(5886558, repeatingTexture(textures.alpha2, 4, 4));
    this.object("Wire_1_Stroke").material = this.staticWireMaterial;
    this.object("Wire_1_Stroke_Copy").material = this.wireMaterial;
    const cloud = makeCloudMesh(
      textures.cloud,
      40,
      60,
      30,
      () => [
        (2 * Math.random() - 1) * 200 - 100,
        (2 * Math.random() - 1) * 10 + 45,
        (2 * Math.random() - 1) * 20 - 100,
      ],
      0.2,
    );
    this.clouds = cloud.mesh;
    this.clouds.rotation.set(0, Math.PI / 2, 0);
    this.cloudMaterial = cloud.material;
    this.globalGroup.add(this.clouds);

    const geometry = new THREE.BufferGeometry();
    const particleMap = textures.cloud.clone();
    particleMap.needsUpdate = true;
    this.particleMaterial = new THREE.PointsMaterial({
      map: particleMap,
      color: new THREE.Color(0),
      size: 10,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthWrite: false,
      opacity: 0.2,
      fog: false,
    });
    this.particleSystem = new THREE.Points(geometry, this.particleMaterial);
    this.particleSystem.position.set(-16, 30, -24);
    this.particleSystem.rotation.set(0, 1.55, 0);
    this.particleSystemClone = this.particleSystem.clone();
    this.particleSystem.position.set(-16, 30, -14.5);
    this.particleSystemClone.rotation.set(0, -1.55, 0);
    this.globalGroup.add(this.particleSystem, this.particleSystemClone);
    const positions = [];
    const sizes = [];
    this.animationYParticle = [];
    for (let index = 0; index < 500; index += 1) {
      positions.push(
        2 * Math.random() - 1,
        (2 * Math.random() - 1) * 20,
        (2 * Math.random() - 1) * 1.5,
      );
      sizes.push(20);
      this.animationYParticle.push(0);
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute(
      "size",
      new THREE.Float32BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage),
    );
    this.positions = geometry.attributes.position.array;
    this.savedParticles = Float32Array.from(this.positions);
    this.sizes = geometry.attributes.size.array;
    this.positionsLength = this.positions.length;
    this.particleIndex = 0;
  }

  setupOverview(textures) {
    this.windowMaterial = this.registerPaletteMaterial(this.palette.window, 0x9bb8aa);
    this.staticWireMaterial = new THREE.MeshBasicMaterial({ color: 12369084, side: THREE.DoubleSide });
    const sharedAlpha = repeatingTexture(textures.alpha2);
    const poleAlpha = repeatingTexture(textures.alpha2, 2, 2);
    this.wireMaterial1 = wireMaterial(6602448, sharedAlpha);
    this.wireMaterial2 = wireMaterial(16763729, sharedAlpha);
    this.wireMaterial4 = wireMaterial(5886558, poleAlpha);
    this.object("Household_Windows").material = this.windowMaterial;
    for (const name of [
      "Hydro_Stroke",
      "Hydro_White",
      "Hydro_wire_1_Stroke",
      "Hydro_wire_1_Stroke_Copy",
    ]) {
      this.object(name).removeFromParent();
    }
    for (const name of [
      "Pole_Wire_1_Stroke",
      "Solar_wire_1_Stroke",
      "Wind_wire_1_Stroke",
    ]) {
      this.object(name).material = this.staticWireMaterial;
    }
    this.object("Solar_wire_1_Stroke_Copy").material = this.wireMaterial2;
    this.object("Wind_wire_1_Stroke_Copy").material = this.wireMaterial1;
    this.object("Pole_Wire_1_Stroke_Copy").material = this.wireMaterial4;
    this.scroll = { x: -0.21808, y: 24.8, y2: 0.21808, z: 66.25 };
  }

  finishIntro() {
    if (this.key !== "solar") return;
    gsap.to(this.camera.position, { duration: 2.4, z: 75, ease: "power3.inOut" });
    gsap.to(this.globalGroup.position, { duration: 2.4, z: -10, delay: 0.3, ease: "power3.inOut" });
    gsap.to(this.cloudMaterial, {
      duration: 2.4,
      opacity: this.cloudOpacity.intro,
      delay: 0.2,
      ease: "power3.inOut",
    });
  }

  enterExperience() {
    if (this.key !== "solar") return;
    gsap.to(this.cloudMaterial, {
      duration: 1.6,
      opacity: this.cloudOpacity.base,
      ease: "power2.inOut",
    });
    gsap.to(this.wheelY, { duration: 2, val: -10000, ease: "sine.inOut" });
    gsap.to(this.introTransition, {
      duration: 2,
      ratioRotate: 1,
      ratioCamera: 0,
      delay: 0.2,
      ease: "power2.inOut",
    });
    gsap.to(this.introTransition, {
      duration: 0.6,
      ratioContent: 1,
      delay: 1.4,
      ease: "sine.inOut",
    });
    gsap.to(this.lightMaterial2, {
      duration: 1,
      opacity: 1,
      delay: 1.4,
      ease: "power2.inOut",
    });
  }

  backToIntro() {
    if (this.key !== "solar") return;
    gsap.to(this.cloudMaterial, {
      duration: 1.2,
      opacity: this.cloudOpacity.intro,
      ease: "power2.inOut",
    });
    gsap.to(this.wheelY, { duration: 1.4, val: 0, ease: "power2.inOut" });
    gsap.to(this.introTransition, {
      duration: 0.6,
      ratioContent: 0,
      ease: "power2.inOut",
    });
    gsap.to(this.introTransition, {
      duration: 1,
      ratioRotate: 0,
      ratioCamera: 1,
      delay: 0.2,
      ease: "power2.inOut",
    });
    gsap.to(this.lightMaterial2, { duration: 1, opacity: 0, ease: "power2.inOut" });
  }

  updateMouse(clientX, clientY) {
    this.mouseX = -((clientX - this.owner.vw / 2) / (this.owner.vw / 2)) / 15;
    this.mouseY = -((clientY - this.owner.vh / 2) / (this.owner.vh / 2)) / 30;
  }

  smoothMouse() {
    const easing = this.owner.easingBase / 2;
    this.mouse.x = easing * (this.mouseX - this.mouse.x) + this.mouse.x;
    this.mouse.y = easing * (this.mouseY - this.mouse.y) + this.mouse.y;
  }

  update() {
    this.smoothMouse();
    const index = this.settings.sourceIndex;
    if (this.key === "solar") this.updateSolar(index);
    if (this.key === "wind") this.updateWind(index);
    if (this.key === "towers") this.updateTowers(index);
    if (this.key === "central") this.updateCentral(index);
    if (this.key === "factory") this.updateFactory(index);
    if (this.key === "overview") this.updateOverview(index);
  }

  updateSolar(index) {
    const setup = this.owner;
    const scrollY = setup.scrollY + this.timelineOffset;
    const easing = 1.5 * setup.easingBase;
    this.wheel.y = easing * (this.wheelY.val - this.wheel.y) + this.wheel.y;
    this.mobileDrag.y = easing * (this.mobileDragY - this.mobileDrag.y) + this.mobileDrag.y;
    this.globalGroup.position.x = 6 - 10 * index + scrollY / 500;
    this.globalGroup.rotation.x = this.mouse.y * this.introTransition.ratioRotate;
    this.globalGroup.rotation.y =
      -0.4 + 0.25 * index - scrollY / 20000 + this.mouse.x * this.introTransition.ratioRotate;
    this.camera.position.y = 140 + this.wheel.y / 80.8 - this.mobileDrag.y / 450;
    this.camera.rotation.x =
      -0.1 * this.introTransition.ratioRotate +
      (this.mouse.y * this.introTransition.ratioCamera) / 4.5;
    this.camera.rotation.y = (this.mouse.x * this.introTransition.ratioCamera) / 4.5;
    this.resizeGroup.position.z = -(20 * this.resizeRatio.z) * this.introTransition.ratioRotate;
    this.wireMaterial.alphaMap.offset.y = -(setup.elapsed / 1.5);
    if (!setup.highQuality) return;
    this.lightMaterial1.alphaMap.offset.x = setup.elapsed / 10;
    this.lightMaterial2.alphaMap.offset.x = setup.elapsed / 10 - 1;
    this.clouds1.position.x -= 2 * setup.delta;
    this.clouds2.position.x -= 2 * setup.delta;
    this.clouds3.position.x += 3 * setup.delta;
    this.clouds4.position.x += 3 * setup.delta;
    if (this.clouds1.position.x <= -400) this.clouds1.position.x = 300;
    if (this.clouds2.position.x <= -400) this.clouds2.position.x = 300;
    if (this.clouds3.position.x >= 350) this.clouds3.position.x = -500;
    if (this.clouds4.position.x >= 350) this.clouds4.position.x = -500;
    for (let offset = 0; offset < this.positionsLength; offset += 3) {
      this.animationYParticle[this.particleIndex] -= setup.delta;
      this.positions[offset] = this.savedParticles[offset] + 1.5 * this.simplex(offset + setup.elapsed / 8, offset);
      this.positions[offset + 1] =
        this.savedParticles[offset + 1] +
        2 * this.simplex(offset + setup.elapsed / 8, this.savedParticles[offset + 1]) +
        this.animationYParticle[this.particleIndex];
      this.positions[offset + 2] =
        this.savedParticles[offset + 2] + this.simplex(offset + setup.elapsed / 8, this.savedParticles[offset + 2]);
      if (this.positions[offset + 1] < -5) this.animationYParticle[this.particleIndex] = 20;
      this.sizes[this.particleIndex] = Math.max(0.15, 5 * this.simplex(offset + setup.elapsed / 4, setup.elapsed / 2));
      this.particleIndex += 1;
    }
    this.particleIndex = 0;
    this.particleSystem.geometry.attributes.position.needsUpdate = true;
    this.particleSystem.geometry.attributes.size.needsUpdate = true;
  }

  updateWind(index) {
    const setup = this.owner;
    const scrollY = setup.scrollY + this.timelineOffset;
    for (let offset = 0; offset < this.rotationObjects.length; offset += 2) {
      this.rotationObjects[offset].rotation.y = 2 * setup.elapsed + (Math.PI / 4) * offset;
      if (this.rotationObjects[offset + 1]) {
        this.rotationObjects[offset + 1].rotation.y = 2 * setup.elapsed + (Math.PI / 4) * offset;
      }
    }
    this.globalGroup.rotation.x = this.mouse.y;
    this.globalGroup.rotation.y = this.mouse.x;
    this.camera.position.z = 45 + 80 * index - scrollY / 60;
    this.scene.fog.far = 250 - 60 * index - scrollY / 80;
    this.scene.fog.near = 200 - 60 * index - scrollY / 80;
    this.wireMaterial.alphaMap.offset.y = -(setup.elapsed / 1.25);
    if (!setup.highQuality) return;
    const movement = 45 * setup.delta;
    for (const particle of [this.particles1, this.particles2, this.particles3, this.particles4]) {
      particle.position.z -= movement;
      if (particle.position.z < -300) particle.position.z = 300;
    }
    this.particles1.position.x = this.simplex(10, 3 * setup.elapsed) / 8;
    this.particles2.position.x = this.simplex(2, 3 * setup.elapsed) / 8;
    this.particles3.position.x = this.simplex(10, 3 * setup.elapsed) / 8;
    this.particles4.position.x = this.simplex(2, 3 * setup.elapsed) / 8;
  }

  updateTowers(index) {
    const setup = this.owner;
    const scrollY = setup.scrollY + this.timelineOffset;
    this.globalGroup.rotation.x = this.mouse.y / 2;
    this.globalGroup.rotation.y = -0.4 + this.mouse.x / 2;
    this.camera.position.y = -30 + 10 * index + scrollY / 500;
    this.resizeGroup.position.z = -(10 * this.resizeRatio.z);
    this.wireMaterial1.alphaMap.offset.y = -0.14 - setup.elapsed / 2;
    this.wireMaterial2.alphaMap.offset.y = -setup.elapsed / 2;
    this.wireMaterial3.alphaMap.offset.y = 0.08 - setup.elapsed / 2;
  }

  updateCentral(index) {
    const setup = this.owner;
    const scrollY = setup.scrollY + this.timelineOffset;
    this.globalGroup.rotation.x = 0.3 + 0.2 * index - scrollY / 18750 + this.mouse.y;
    this.globalGroup.rotation.y = -0.5 + this.resizeRatio.rotationY + this.mouse.x;
    this.globalGroup.position.z = -140 + 19.375 * index + scrollY / 440;
    this.resizeGroup.position.set(this.resizeRatio.x, 0, -(30 * this.resizeRatio.z));
    this.wireMaterial1.alphaMap.offset.y = setup.elapsed / 2;
    this.wireMaterial4.alphaMap.offset.y = -1.25 * setup.elapsed;
  }

  updateFactory(index) {
    const setup = this.owner;
    const scrollY = setup.scrollY + this.timelineOffset;
    this.globalGroup.rotation.x = -this.mouse.y / 1.5 - 0.11;
    this.globalGroup.rotation.y = 2.6 + 1.2 * index + scrollY / 10000 + this.mouse.x / 1.5;
    this.resizeGroup.position.x = 40 * this.resizeRatio.z;
    this.resizeGroup.position.z = -(40 * this.resizeRatio.z);
    this.wireMaterial.alphaMap.offset.y = 1.25 * setup.elapsed;
    if (!setup.highQuality) return;
    for (let offset = 0; offset < this.positionsLength; offset += 3) {
      this.animationYParticle[this.particleIndex] += 2 * setup.delta;
      this.positions[offset] = this.savedParticles[offset] + 1.25 * this.simplex(offset + setup.elapsed / 8, offset);
      this.positions[offset + 1] =
        this.savedParticles[offset + 1] +
        2 * this.simplex(offset + setup.elapsed / 8, this.savedParticles[offset + 1]) +
        this.animationYParticle[this.particleIndex];
      this.positions[offset + 2] =
        this.savedParticles[offset + 2] + this.simplex(offset + setup.elapsed / 8, this.savedParticles[offset + 2]);
      if (this.positions[offset + 1] > 30) this.animationYParticle[this.particleIndex] = -20;
      this.sizes[this.particleIndex] = Math.max(0.15, 5 * this.simplex(offset + setup.elapsed / 4, setup.elapsed / 2));
      this.particleIndex += 1;
    }
    this.particleIndex = 0;
    this.particleSystem.geometry.attributes.position.needsUpdate = true;
    this.particleSystem.geometry.attributes.size.needsUpdate = true;
    this.wireMaterial.alphaMap.offset.y = -(setup.elapsed / 1.5);
  }

  updateOverview(index) {
    const setup = this.owner;
    const scrollY = setup.scrollY + this.timelineOffset;
    const targetY = Math.max(24.8, 32 - 65.2 * index + scrollY / 62.5);
    const targetY2 = Math.min(0.21808, -0.22 + 0.160575 * index - scrollY / 24960);
    const targetZ = Math.max(66.25, 55 - 78.125 * index + scrollY / 50);
    const targetX = Math.min(-0.21808, -0.22 + 0.160575 * index - scrollY / 24960);
    const easing = setup.easingBase / 2;
    this.scroll.y = easing * (targetY - this.scroll.y) + this.scroll.y;
    this.scroll.y2 = easing * (targetY2 - this.scroll.y2) + this.scroll.y2;
    this.scroll.z = easing * (targetZ - this.scroll.z) + this.scroll.z;
    this.scroll.x = easing * (targetX - this.scroll.x) + this.scroll.x;
    for (let offset = 0; offset < this.rotationObjects.length; offset += 2) {
      this.rotationObjects[offset].rotation.y = 2 * setup.elapsed + (Math.PI / 4) * offset;
      if (this.rotationObjects[offset + 1]) {
        this.rotationObjects[offset + 1].rotation.y = 2 * setup.elapsed + (Math.PI / 4) * offset;
      }
    }
    this.globalGroup.rotation.y = -0.25 + this.scroll.y2;
    this.camera.position.y = this.scroll.y;
    this.camera.position.z = this.scroll.z;
    this.camera.rotation.x = this.scroll.x;
    this.resizeGroup.position.z = -(20 * this.resizeRatio.z);
    this.scene.fog.near = 70 - 200.4 * index + scrollY / 20;
    this.scene.fog.far = 200 - 200.4 * index + scrollY / 20;
    this.wireMaterial1.alphaMap.offset.y = -(setup.elapsed / 2);
    this.wireMaterial4.alphaMap.offset.y = -1.25 * setup.elapsed;
  }

  render() {
    const renderer = this.owner.renderer;
    renderer.setClearColor(0xffffff);
    renderer.setRenderTarget(this.fbo);
    renderer.clear();
    renderer.render(this.scene, this.camera);
  }

  setDark(dark) {
    const background = dark ? DARK_BACKGROUND : this.palette.background;
    for (const { material, lightColor, darkColor } of this.paletteMaterials) {
      material.color.set(dark ? darkColor : lightColor);
    }
    if (this.staticWireMaterial) {
      this.staticWireMaterial.color.set(dark ? DARK_STROKE : this.palette.stroke);
    }
    this.scene.background = new THREE.Color(background);
    this.scene.fog = new THREE.Fog(background, ...this.settings.fog);
    if (this.key === "solar") {
      this.cloudOpacity.base = getSolarCloudOpacity(
        dark,
        this.owner.vw,
        this.owner.vhSaved,
      );
      this.cloudOpacity.intro = getSolarCloudOpacity(
        dark,
        this.owner.vw,
        this.owner.vhSaved,
        true,
      );
      this.cloudMaterial.opacity = this.owner.entered
        ? this.cloudOpacity.base
        : this.cloudOpacity.intro;
    }
    if (["wind", "towers", "central", "factory"].includes(this.key)) {
      this.cloudMaterial.opacity = dark ? 0.03 : 0.2;
    }
    if (this.key === "factory") this.particleMaterial.opacity = dark ? 0.03 : 0.2;
  }

  setQuality(highQuality) {
    if (this.key === "solar") {
      for (const item of [this.clouds1, this.clouds2, this.clouds3, this.clouds4, this.particleSystem]) {
        item.visible = highQuality;
      }
    }
    if (this.key === "wind") {
      for (const item of [this.particles1, this.particles2, this.particles3, this.particles4, this.clouds]) {
        item.visible = highQuality;
      }
    }
    if (this.key === "towers" || this.key === "central") this.clouds.visible = highQuality;
    if (this.key === "factory") {
      this.clouds.visible = highQuality;
      this.particleSystem.visible = highQuality;
      this.particleSystemClone.visible = highQuality;
    }
  }

  resize(width, height, pixelRatio, fullResolution = true) {
    const renderWidth = fullResolution ? Math.ceil(width * pixelRatio) : 1;
    const renderHeight = fullResolution ? Math.ceil(height * pixelRatio) : 1;
    const aspect = width / height;
    const phonePortrait = Math.min(width, height) <= 600 && aspect < 1;
    const maxSamples = this.owner.renderer.capabilities.maxSamples ?? 0;
    const lowDensitySurface =
      pixelRatio <= DESKTOP_MIN_PIXEL_RATIO
      && renderWidth * renderHeight <= MSAA_RENDER_PIXEL_LIMIT;
    const targetSamples =
      fullResolution
      && this.owner.renderer.capabilities.isWebGL2
      && (phonePortrait || lowDensitySurface)
        ? Math.min(LINE_MSAA_SAMPLES, maxSamples)
        : 0;
    if (this.fbo.samples !== targetSamples) {
      this.fbo.samples = targetSamples;
      this.fbo.dispose();
    }
    this.fbo.setSize(renderWidth, renderHeight);
    this.resizeGroup.scale.setScalar(phonePortrait ? PHONE_MODEL_SCALE : 1);
    if (this.key === "factory") {
      this.resizeRatio.z = aspect < 1 ? 1 - aspect : 0;
    } else if (this.key === "central") {
      if (aspect < 1) {
        this.resizeRatio.z = 1 + (1 - aspect);
        this.resizeRatio.rotationY = -0.6;
        this.resizeRatio.x = 20;
      } else {
        this.resizeRatio.z = 1;
        this.resizeRatio.rotationY = 0;
        this.resizeRatio.x = 0;
      }
    } else {
      this.resizeRatio.z = aspect < 1 ? 1 + (1 - aspect) : 1;
    }
    if (this.particleShaderMaterial) {
      this.particleShaderMaterial.uniforms.resolution.value.set(width, height, 1, 1);
    }
    this.camera.fov = getResponsiveCameraFov(width, height);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.fbo.dispose();
    this.scene.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    });
  }
}

const transitionVertexShader = `
varying vec2 vUv;
void main() {
  vUv = vec2(uv.x, uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const transitionFragmentShader = `
uniform float time;
uniform float progress;
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform sampler2D displacement;
uniform vec4 resolution;
uniform vec3 accentFrom;
uniform vec3 accentTo;
uniform float transitionIndex;
varying vec2 vUv;

vec2 mirrored(vec2 value) {
  vec2 mirroredValue = mod(value, 2.0);
  return mix(mirroredValue, 2.0 - mirroredValue, step(1.0, mirroredValue));
}

float hash21(vec2 value) {
  value = fract(value * vec2(123.34, 456.21));
  value += dot(value, value + 45.32);
  return fract(value.x * value.y);
}

void main() {
  vec2 newUV = (vUv - vec2(0.5)) * resolution.zw + vec2(0.5);
  float transitionProgress = smoothstep(0.0, 1.0, clamp(progress / 0.245, 0.0, 1.0));
  float envelope = sin(transitionProgress * 3.14159265);
  float aspect = resolution.x / max(resolution.y, 1.0);
  vec2 noiseUV = mirrored(newUV * 1.15 + vec2(time * 0.025, -time * 0.018));
  vec4 noise = texture2D(displacement, noiseUV);
  float interpolation = 0.0;
  vec2 firstUV = newUV;
  vec2 secondUV = newUV;
  float fromStrength = 0.0;
  float toStrength = 0.0;
  float highlightStrength = 0.0;

  if (transitionIndex < 0.5) {
    // Solar to wind: expanding energy portal.
    vec2 center = vec2(0.46, 0.5);
    vec2 radial = newUV - center;
    radial.x *= aspect;
    float distanceToCenter = length(radial);
    float angle = atan(radial.y, radial.x);
    vec2 farCorner = vec2(
      max(center.x, 1.0 - center.x) * aspect,
      max(center.y, 1.0 - center.y)
    );
    float maxRadius = length(farCorner) + 0.12;
    float radius = mix(-0.12, maxRadius + 0.12, transitionProgress);
    float organicEdge = (noise.r - 0.5) * 0.04;
    organicEdge += sin(angle * 3.0 + time * 0.8 + noise.g * 4.0) * 0.008;
    float warpedDistance = distanceToCenter + organicEdge * envelope;
    float edgeSoftness = mix(0.012, 0.022, envelope);
    interpolation = 1.0 - smoothstep(
      radius - edgeSoftness,
      radius + edgeSoftness,
      warpedDistance
    );
    float distanceToRing = abs(warpedDistance - radius);
    float halo = (1.0 - smoothstep(0.012, 0.065, distanceToRing)) * envelope;
    float core = (1.0 - smoothstep(0.0, 0.012, distanceToRing)) * envelope;
    vec2 radialDirection = radial / max(distanceToCenter, 0.001);
    radialDirection.x /= aspect;
    vec2 refraction = radialDirection * (noise.gb - 0.5) * 0.012 * halo;
    firstUV += refraction;
    secondUV -= refraction;
    float sparks = pow(
      0.5 + 0.5 * sin(angle * 28.0 + time * 4.0 + noise.b * 8.0),
      12.0
    );
    float wakeDistance = radius - warpedDistance;
    float wake = smoothstep(0.0, 0.02, wakeDistance)
      * (1.0 - smoothstep(0.04, 0.24, wakeDistance));
    float ripple = 0.5 + 0.5 * sin(wakeDistance * 90.0 - time * 3.5);
    toStrength = halo * (0.14 + sparks * 0.08) + wake * ripple * 0.06 * envelope;
    fromStrength = core * (0.5 + sparks * 0.18);
    highlightStrength = core * sparks * 0.24;
  } else if (transitionIndex < 1.5) {
    // Wind to towers: layered wind ribbons sweep horizontally.
    float wave = sin(newUV.y * 17.0 + time * 1.7) * 0.028;
    wave += sin(newUV.y * 41.0 - time * 2.3) * 0.01;
    float flowCoordinate = newUV.x + wave * envelope;
    flowCoordinate += (noise.g - 0.5) * 0.055 * envelope;
    float front = mix(-0.12, 1.12, transitionProgress);
    interpolation = 1.0 - smoothstep(front - 0.024, front + 0.024, flowCoordinate);
    float distanceToFront = abs(flowCoordinate - front);
    float halo = (1.0 - smoothstep(0.01, 0.075, distanceToFront)) * envelope;
    float core = (1.0 - smoothstep(0.0, 0.01, distanceToFront)) * envelope;
    vec2 flowOffset = vec2(noise.g - 0.5, sin(newUV.y * 30.0 + time * 2.0));
    flowOffset *= 0.012 * halo;
    firstUV += flowOffset;
    secondUV -= flowOffset;
    float wakeDistance = front - flowCoordinate;
    float trail = smoothstep(0.0, 0.025, wakeDistance)
      * (1.0 - smoothstep(0.08, 0.3, wakeDistance));
    float streaks = pow(
      0.5 + 0.5 * sin(newUV.y * 82.0 - time * 7.0 + noise.r * 10.0),
      14.0
    );
    toStrength = halo * 0.2 + trail * streaks * 0.08 * envelope;
    fromStrength = core * 0.42;
    highlightStrength = core * streaks * 0.28;
  } else if (transitionIndex < 2.5) {
    // Towers to central: an electric grid charges from bottom to top.
    float scanCoordinate = newUV.y + (noise.r - 0.5) * 0.06 * envelope;
    scanCoordinate += sin(newUV.x * 30.0 + time * 2.0) * 0.008 * envelope;
    float front = mix(-0.12, 1.12, transitionProgress);
    interpolation = 1.0 - smoothstep(front - 0.018, front + 0.018, scanCoordinate);
    float distanceToFront = abs(scanCoordinate - front);
    float halo = (1.0 - smoothstep(0.008, 0.07, distanceToFront)) * envelope;
    float core = (1.0 - smoothstep(0.0, 0.008, distanceToFront)) * envelope;
    vec2 gridPosition = newUV * vec2(18.0 * aspect, 12.0);
    vec2 cellDistance = abs(fract(gridPosition) - 0.5);
    float gridLine = smoothstep(0.43, 0.49, max(cellDistance.x, cellDistance.y));
    float pulse = pow(
      0.5 + 0.5 * sin(newUV.x * 110.0 - time * 8.0 + noise.b * 6.0),
      12.0
    );
    vec2 scanOffset = vec2(0.0, (noise.g - 0.5) * 0.014 * halo);
    firstUV += scanOffset;
    secondUV -= scanOffset;
    toStrength = halo * (0.15 + gridLine * 0.1);
    fromStrength = core * 0.48;
    highlightStrength = core * 0.2 + halo * gridLine * pulse * 0.2;
  } else if (transitionIndex < 3.5) {
    // Central to factory: staggered digital mosaic dissolve.
    vec2 gridSize = vec2(18.0 * aspect, 12.0);
    vec2 gridPosition = newUV * gridSize;
    vec2 cell = floor(gridPosition);
    float order = hash21(cell);
    float threshold = mix(-0.12, 1.12, transitionProgress);
    interpolation = smoothstep(order - 0.075, order + 0.075, threshold);
    float switchBand = (1.0 - smoothstep(0.025, 0.16, abs(order - threshold))) * envelope;
    vec2 pixelUV = (cell + 0.5) / gridSize;
    firstUV = mix(newUV, pixelUV, switchBand * 0.78);
    secondUV = mix(newUV, pixelUV, switchBand * 0.78);
    vec2 cellUV = fract(gridPosition);
    float borderDistance = min(
      min(cellUV.x, 1.0 - cellUV.x),
      min(cellUV.y, 1.0 - cellUV.y)
    );
    float cellBorder = 1.0 - smoothstep(0.0, 0.08, borderDistance);
    float flicker = 0.5 + 0.5 * sin(time * 7.0 + order * 31.0);
    fromStrength = switchBand * (1.0 - interpolation) * 0.14;
    toStrength = switchBand * interpolation * 0.16;
    highlightStrength = switchBand * cellBorder * (0.12 + flicker * 0.18);
  } else if (transitionIndex < 4.5) {
    // Factory to overview: alternating energy shutters.
    float bands = 10.0;
    float bandIndex = floor(newUV.y * bands);
    float parity = mod(bandIndex, 2.0);
    float directedX = mix(newUV.x, 1.0 - newUV.x, parity);
    float delay = hash21(vec2(bandIndex, 7.31)) * 0.16;
    float bandProgress = clamp(
      (transitionProgress - delay) / max(1.0 - delay, 0.001),
      0.0,
      1.0
    );
    bandProgress = smoothstep(0.0, 1.0, bandProgress);
    float front = mix(-0.08, 1.08, bandProgress);
    interpolation = 1.0 - smoothstep(front - 0.022, front + 0.022, directedX);
    float distanceToFront = abs(directedX - front);
    float halo = (1.0 - smoothstep(0.008, 0.06, distanceToFront)) * envelope;
    float core = (1.0 - smoothstep(0.0, 0.008, distanceToFront)) * envelope;
    float directionSign = mix(1.0, -1.0, parity);
    vec2 shutterOffset = vec2(directionSign * (noise.r - 0.5) * 0.014 * halo, 0.0);
    firstUV += shutterOffset;
    secondUV -= shutterOffset;
    float sliceUV = fract(newUV.y * bands);
    float sliceBorder = 1.0 - smoothstep(
      0.0,
      0.07,
      min(sliceUV, 1.0 - sliceUV)
    );
    float pulse = 0.5 + 0.5 * sin(time * 6.0 + bandIndex * 1.7);
    toStrength = halo * 0.2;
    fromStrength = core * 0.4;
    highlightStrength = core * (0.14 + pulse * 0.14) + halo * sliceBorder * 0.08;
  }

  vec4 firstTexture = texture2D(texture1, clamp(firstUV, vec2(0.0), vec2(1.0)));
  vec4 secondTexture = texture2D(texture2, clamp(secondUV, vec2(0.0), vec2(1.0)));
  vec4 color = mix(firstTexture, secondTexture, interpolation);
  color.rgb = mix(color.rgb, accentTo, clamp(toStrength, 0.0, 0.32));
  color.rgb = mix(color.rgb, accentFrom, clamp(fromStrength, 0.0, 0.72));
  color.rgb = mix(
    color.rgb,
    vec3(1.0, 0.98, 0.76),
    clamp(highlightStrength, 0.0, 0.36)
  );
  gl_FragColor = color;
}
`;

export class EnpowerExperience {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.onProgress = callbacks.onProgress ?? (() => {});
    this.onReady = callbacks.onReady ?? (() => {});
    this.onActiveChange = callbacks.onActiveChange ?? (() => {});
    this.onEnter = callbacks.onEnter ?? (() => {});
    this.onExit = callbacks.onExit ?? (() => {});
    this.highQuality = callbacks.highQuality ?? true;
    this.dark = callbacks.dark ?? false;
    this.entered = false;
    this.destroyed = false;
    this.ready = false;
    this.renderingPaused = false;
    this.vw = Math.max(1, this.container.clientWidth || window.innerWidth || 0);
    this.vhSaved = Math.max(1, this.container.clientHeight || window.innerHeight || 0);
    this.vh = this.vw / this.vhSaved > 2 ? this.vw / 2 : this.vhSaved;
    this.pixelRatio = getExperiencePixelRatio(this.highQuality, this.vw, this.vhSaved);
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.shadowMap.enabled = false;
    this.renderer.sortObjects = true;
    this.renderer.premultipliedAlpha = false;
    this.renderer.stencil = false;
    this.renderer.depth = false;
    this.renderer.autoClearStencil = false;
    this.renderer.preserveDrawingBuffer = false;
    this.renderer.powerPreference = "high-performance";
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.vw, this.vh);
    this.container.insertBefore(this.renderer.domElement, this.container.firstChild);
    this.clock = new THREE.Clock();
    this.delta = this.clock.getDelta();
    this.elapsed = 0;
    this.scrollY = 0;
    this.currentIndex = 0;
    this.easingBase = 0.1;
    this.frames = 0;
    this.fpsStart = performance.now();
    this.fpsChecks = 0;
    this.mouseClient = { x: this.vw / 2, y: this.vh / 2 };
    this.resizeFrame = 0;
    this.boundResize = this.scheduleResize.bind(this);
    this.boundPointerMove = this.pointerMove.bind(this);
    this.boundLoop = this.loop.bind(this);
    window.addEventListener("resize", this.boundResize);
    window.addEventListener("pointermove", this.boundPointerMove);
    this.resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(this.boundResize);
    this.resizeObserver?.observe(this.container);
    this.initialize();
  }

  async initialize() {
    try {
      const loadingManager = new THREE.LoadingManager();
      loadingManager.onProgress = (_url, loaded, total) => {
        this.onProgress(Math.floor((loaded / total) * 100));
      };
      const textureLoader = new THREE.TextureLoader(loadingManager);
      textureLoader.crossOrigin = "";
      const dracoLoader = new DRACOLoader(loadingManager);
      dracoLoader.setDecoderPath("/draco/");
      const modelLoader = new GLTFLoader(loadingManager);
      modelLoader.setDRACOLoader(dracoLoader);
      this.dracoLoader = dracoLoader;
      this.modelLoader = modelLoader;

      const textureEntries = Object.entries(textureFiles);
      const modelEntries = Object.entries(modelFiles);
      this.modelEntries = modelEntries;
      const texturePromise = Promise.all(
        textureEntries.map(async ([key, url]) => [key, await textureLoader.loadAsync(url)]),
      );
      const [firstModelEntry] = modelEntries;
      const firstModelPromise = modelLoader
        .loadAsync(firstModelEntry[1])
        .then((model) => [firstModelEntry[0], model]);
      const [loadedTextures, loadedFirstModel] = await Promise.all([
        texturePromise,
        firstModelPromise,
      ]);
      if (this.destroyed) return;
      const maxAnisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      for (const [key, texture] of loadedTextures) {
        if (key !== "alpha" && key !== "alpha2") continue;
        texture.anisotropy = maxAnisotropy;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.needsUpdate = true;
      }
      this.textures = Object.fromEntries(loadedTextures);
      this.models = { [loadedFirstModel[0]]: loadedFirstModel[1] };
      this.stages = [
        new RenderStage(
          this,
          firstModelEntry[0],
          loadedFirstModel[1].scene,
          this.textures,
          0,
        ),
      ];
      this.stages.forEach((stage) => {
        stage.setDark(this.dark);
        stage.setQuality(this.highQuality);
      });
      this.createTransitionScene();
      this.resize(true);
      this.stages[0].finishIntro();
      this.ready = true;
      this.onProgress(100);
      this.onReady();
      if (!this.renderingPaused) {
        this.raf = requestAnimationFrame(this.boundLoop);
      }
    } catch (error) {
      console.error("Unable to initialize the Enpower 3D experience", error);
      this.onProgress(100);
    }
  }

  loadRemainingModels() {
    if (this.remainingModelsPromise || this.destroyed || !this.modelLoader) {
      return this.remainingModelsPromise;
    }

    const remainingEntries = this.modelEntries.slice(1);
    this.remainingModelsPromise = Promise.all(
      remainingEntries.map(async ([key, url]) => [key, await this.modelLoader.loadAsync(url)]),
    )
      .then((loadedModels) => {
        if (this.destroyed) return;

        for (const [key, model] of loadedModels) this.models[key] = model;
        const addedStages = remainingEntries.map(
          ([key], offset) => new RenderStage(
            this,
            key,
            this.models[key].scene,
            this.textures,
            offset + 1,
          ),
        );
        addedStages.forEach((stage) => {
          stage.setDark(this.dark);
          stage.setQuality(this.highQuality);
          stage.updateMouse(this.mouseClient.x, this.mouseClient.y);
        });
        this.stages.push(...addedStages);
        this.resize(true);
        this.onProgress(100);
      })
      .catch((error) => {
        console.error("Unable to load the remaining Enpower scenes", error);
      });

    return this.remainingModelsPromise;
  }

  createTransitionScene() {
    const nextStage = this.stages[1] ?? this.stages[0];
    this.transitionScene = new THREE.Scene();
    this.transitionScene.background = new THREE.Color(16316405);
    this.transitionCamera = new THREE.OrthographicCamera(
      -(this.vw / 2),
      this.vw / 2,
      this.vh / 2,
      -(this.vh / 2),
      -10,
      10,
    );
    this.transitionScene.add(this.transitionCamera);
    this.transitionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        progress: { value: -0.01 },
        texture1: { value: this.stages[0].fbo.texture },
        texture2: { value: nextStage.fbo.texture },
        displacement: { value: this.textures.displacement },
        resolution: { value: new THREE.Vector4(this.vw, this.vh, 1, 1) },
        accentFrom: { value: new THREE.Color(this.stages[0].palette.accent) },
        accentTo: { value: new THREE.Color(nextStage.palette.accent) },
        transitionIndex: { value: 0 },
      },
      vertexShader: transitionVertexShader,
      fragmentShader: transitionFragmentShader,
    });
    this.transitionPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(this.vw, this.vh, 1, 1),
      this.transitionMaterial,
    );
    this.transitionScene.add(this.transitionPlane);
    this.renderPass = new RenderPass(this.transitionScene, this.transitionCamera);
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.enabled = this.pixelRatio < 2;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.fxaaPass);
  }

  loop() {
    if (this.destroyed || !this.ready || this.renderingPaused) return;
    this.delta = this.clock.getDelta();
    this.elapsed += this.delta;
    this.scrollY = this.easingBase * (window.scrollY - this.scrollY) + this.scrollY;
    const availableSceneCount = Math.max(1, this.stages.length);
    const nextIndex = clamp(
      0,
      availableSceneCount - 1,
      Math.floor(this.scrollY / 16500 / 0.245),
    );
    if (nextIndex !== this.currentIndex) {
      this.currentIndex = nextIndex;
      this.resizeStages();
      this.onActiveChange(nextIndex);
    }
    const firstStage = this.stages[this.currentIndex];
    const secondStage = this.stages[this.currentIndex + 1] ?? firstStage;
    this.transitionMaterial.uniforms.texture1.value = firstStage.fbo.texture;
    this.transitionMaterial.uniforms.texture2.value = secondStage.fbo.texture;
    this.transitionMaterial.uniforms.time.value = this.elapsed;
    this.transitionMaterial.uniforms.transitionIndex.value = this.currentIndex;
    this.transitionMaterial.uniforms.accentFrom.value.set(firstStage.palette.accent);
    this.transitionMaterial.uniforms.accentTo.value.set(secondStage.palette.accent);
    this.transitionMaterial.uniforms.progress.value =
      this.currentIndex < availableSceneCount - 1 ? (this.scrollY / 16500) % 0.245 : 0;
    for (
      let index = this.currentIndex;
      index <= Math.min(this.currentIndex + 1, availableSceneCount - 1);
      index += 1
    ) {
      this.stages[index].render();
      this.stages[index].update();
    }
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.composer.render();
    this.calculateEasing();
    this.raf = requestAnimationFrame(this.boundLoop);
  }

  setRenderingPaused(paused) {
    const nextPaused = Boolean(paused);
    if (nextPaused === this.renderingPaused || this.destroyed) return;

    this.renderingPaused = nextPaused;
    if (nextPaused) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }

    if (!this.ready) return;
    this.clock.start();
    this.raf = requestAnimationFrame(this.boundLoop);
  }

  calculateEasing() {
    if (this.fpsChecks > 6) return;
    this.frames += 1;
    const now = performance.now();
    const duration = now - this.fpsStart;
    if (duration <= 150) return;
    const fps = Math.round((1000 * this.frames) / duration);
    this.easingBase = clamp(0.05, 0.1, 60 / fps / 10);
    this.frames = 0;
    this.fpsStart = now;
    this.fpsChecks += 1;
  }

  pointerMove(event) {
    if (this.renderingPaused) return;
    this.mouseClient.x = event.clientX;
    this.mouseClient.y = event.clientY;
    if (!this.stages) return;
    this.stages.forEach((stage) => stage.updateMouse(event.clientX, event.clientY));
  }

  enter() {
    if (this.entered || !this.ready) return;
    this.loadRemainingModels();
    this.entered = true;
    this.stages[0].enterExperience();
    this.onEnter();
  }

  goTo(index) {
    const section = clamp(0, SCENE_COUNT - 1, index);
    if (!this.entered) this.enter();
    const scroll = { value: window.scrollY };
    const target = section * 4000;
    gsap.to(scroll, {
      duration: Math.max(0.3, Math.abs(window.scrollY - target) / 15000),
      value: target,
      ease: "power1.inOut",
      onUpdate: () => window.scrollTo(0, scroll.value),
    });
  }

  returnToIntro() {
    if (!this.entered || !this.ready) return;
    const scroll = { value: window.scrollY };
    gsap.to(scroll, {
      duration: Math.abs(window.scrollY) / 15000,
      value: -4000,
      ease: "power1.inOut",
      onUpdate: () => window.scrollTo(0, scroll.value),
      onComplete: () => {
        this.entered = false;
        this.stages[0].backToIntro();
        this.onExit();
      },
    });
  }

  setDark(dark) {
    this.dark = dark;
    this.stages?.forEach((stage) => stage.setDark(dark));
  }

  setQuality(highQuality) {
    this.highQuality = highQuality;
    if (this.transitionMaterial) {
      this.transitionMaterial.uniforms.displacement.value = highQuality ? this.textures.displacement : null;
    }
    this.stages?.forEach((stage) => stage.setQuality(highQuality));
    this.resize();
  }

  resizeStages() {
    this.stages?.forEach((stage, index) => {
      const fullResolution = index === this.currentIndex || index === this.currentIndex + 1;
      stage.resize(this.vw, this.vh, this.pixelRatio, fullResolution);
    });
  }

  scheduleResize() {
    if (this.destroyed || this.resizeFrame) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      this.resize();
    });
  }

  resize(force = false) {
    const nextWidth = Math.max(1, this.container.clientWidth || window.innerWidth || 0);
    const nextSavedHeight = Math.max(1, this.container.clientHeight || window.innerHeight || 0);
    const nextHeight = nextWidth / nextSavedHeight > 2 ? nextWidth / 2 : nextSavedHeight;
    const nextPixelRatio = getExperiencePixelRatio(
      this.highQuality,
      nextWidth,
      nextSavedHeight,
    );

    if (
      !force
      && nextPixelRatio === this.pixelRatio
      && nextWidth === this.vw
      && nextSavedHeight === this.vhSaved
      && nextHeight === this.vh
    ) {
      return;
    }

    const previousPixelRatio = this.pixelRatio;
    this.pixelRatio = nextPixelRatio;
    this.vw = nextWidth;
    this.vhSaved = nextSavedHeight;
    this.vh = nextHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.vw, this.vh);
    this.renderer.domElement.style.top = this.vw / this.vhSaved > 2 ? "50%" : "0";
    this.renderer.domElement.style.transform = this.vw / this.vhSaved > 2 ? "translateY(-50%)" : "none";
    if (!this.transitionCamera) return;
    this.transitionCamera.left = -(this.vw / 2);
    this.transitionCamera.right = this.vw / 2;
    this.transitionCamera.top = this.vh / 2;
    this.transitionCamera.bottom = -(this.vh / 2);
    this.transitionCamera.updateProjectionMatrix();
    this.transitionPlane.geometry.dispose();
    this.transitionPlane.geometry = new THREE.PlaneGeometry(this.vw, this.vh, 1, 1);
    this.transitionMaterial.uniforms.resolution.value.set(this.vw, this.vh, 1, 1);
    if (previousPixelRatio !== this.pixelRatio) {
      this.composer.setPixelRatio(this.pixelRatio);
    }
    this.fxaaPass.material.uniforms.resolution.value.set(
      1 / (this.vw * this.pixelRatio),
      1 / (this.vh * this.pixelRatio),
    );
    this.fxaaPass.enabled = this.pixelRatio < 2;
    this.composer.setSize(this.vw, this.vh);
    this.resizeStages();
  }

  dispose() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.resizeFrame);
    window.removeEventListener("resize", this.boundResize);
    window.removeEventListener("pointermove", this.boundPointerMove);
    this.resizeObserver?.disconnect();
    gsap.killTweensOf(this.stages?.[0]?.camera.position);
    gsap.killTweensOf(this.stages?.[0]?.globalGroup.position);
    this.stages?.forEach((stage) => stage.dispose());
    this.transitionPlane?.geometry.dispose();
    this.transitionMaterial?.dispose();
    this.composer?.dispose();
    this.dracoLoader?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
