import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export const PAGE_GLTF_ASSETS = [
  {
    key: "wind-turbine",
    url: "/3d/animated_wind_turbine.glb",
    bytes: 1_272_620,
  },
  {
    key: "solar-assembly",
    url: "/3d/futuristic_solar_power_module%20(1).glb",
    bytes: 29_636_996,
  },
  {
    key: "electrical-inspection",
    url: "/3d/factory__electrical__box_12_mb.glb",
    bytes: 15_009_052,
  },
  {
    key: "construction-services",
    url: "/3d/construction.glb",
    bytes: 6_763_712,
  },
  {
    key: "data-center",
    url: "/3d/data_center_workspace_2.glb",
    bytes: 124_688,
  },
  {
    key: "solar-contact",
    url: "/3d/space_sun.glb",
    bytes: 1_534_068,
  },
];

const assetByUrl = new Map(PAGE_GLTF_ASSETS.map((asset) => [asset.url, asset]));
const sourceCache = new Map();
const promiseCache = new Map();
const progressListeners = new Set();
const progressByUrl = new Map(
  PAGE_GLTF_ASSETS.map((asset) => [
    asset.url,
    {
      loaded: 0,
      total: asset.bytes,
      parsed: false,
      failed: false,
    },
  ]),
);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

function getAggregateProgress() {
  let loadedBytes = 0;
  let totalBytes = 0;
  let preparedAssets = 0;

  PAGE_GLTF_ASSETS.forEach((asset) => {
    const progress = progressByUrl.get(asset.url);
    const total = Math.max(1, progress?.total || asset.bytes);
    totalBytes += total;
    loadedBytes += Math.min(total, progress?.loaded || 0);
    if (progress?.parsed || progress?.failed) preparedAssets += 1;
  });

  const downloadProgress = loadedBytes / Math.max(1, totalBytes);
  const parseProgress = preparedAssets / PAGE_GLTF_ASSETS.length;

  return Math.round((downloadProgress * 0.88 + parseProgress * 0.12) * 100);
}

function emitProgress() {
  const progress = getAggregateProgress();
  progressListeners.forEach((listener) => listener(progress));
}

export function subscribePageModelProgress(listener) {
  progressListeners.add(listener);
  listener(getAggregateProgress());
  return () => progressListeners.delete(listener);
}

export function loadCachedGLTF(url) {
  if (sourceCache.has(url)) return Promise.resolve(sourceCache.get(url));
  if (promiseCache.has(url)) return promiseCache.get(url);

  const asset = assetByUrl.get(url);
  if (!asset) {
    throw new Error(`Unregistered page GLTF asset: ${url}`);
  }

  const promise = gltfLoader
    .loadAsync(url, (event) => {
      const progress = progressByUrl.get(url);
      if (!progress) return;

      progress.loaded = Math.max(progress.loaded, event.loaded || 0);
      if (event.total > 0) progress.total = event.total;
      emitProgress();
    })
    .then((gltf) => {
      sourceCache.set(url, gltf);
      const progress = progressByUrl.get(url);
      progress.loaded = progress.total;
      progress.parsed = true;
      emitProgress();
      return gltf;
    })
    .catch((error) => {
      const progress = progressByUrl.get(url);
      progress.failed = true;
      emitProgress();
      throw error;
    });

  promiseCache.set(url, promise);
  return promise;
}

export async function preloadPageGLTFs() {
  const results = await Promise.allSettled(
    PAGE_GLTF_ASSETS.map((asset) => loadCachedGLTF(asset.url)),
  );
  const rejected = results.filter((result) => result.status === "rejected");

  if (rejected.length) {
    throw new AggregateError(
      rejected.map((result) => result.reason),
      "One or more page GLTF assets could not be prepared.",
    );
  }

  return results.map((result) => result.value);
}

export async function cloneCachedGLTF(url) {
  const source = await loadCachedGLTF(url);
  const scene = cloneSkeleton(source.scene);
  const materialClones = new Map();

  scene.traverse((object) => {
    if (!object.isMesh || !object.material) return;

    const cloneMaterial = (material) => {
      if (!materialClones.has(material)) {
        materialClones.set(material, material.clone());
      }
      return materialClones.get(material);
    };

    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
  });

  return {
    ...source,
    scene,
    animations: source.animations,
  };
}

// Geometry and textures belong to the shared source cache. Instances only own
// their cloned or replacement materials.
export function disposeGLTFInstance(root) {
  const materials = new Set();

  root?.traverse((object) => {
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => materials.add(material));
  });

  materials.forEach((material) => material.dispose());
}
