import {
  preloadPageGLTFs,
  subscribePageModelProgress,
} from "./threeAssetCache.js";

const IMAGE_URL_PATTERN = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const VIDEO_URL_PATTERN = /\.(?:mp4|webm)(?:[?#].*)?$/i;
const DEFERRED_MEDIA_KEYS = new Set(["gallery"]);

const STATIC_CRITICAL_IMAGES = [
  "/original/logo-preloader-480.webp",
  "/original/logo-nav-480.webp",
  "/original/LOGO-BUN-Transparent.png.webp",
  "/original/footer-certifications.webp",
];

function collectMediaUrls(value, output = new Set()) {
  if (typeof value === "string") {
    const url = value.trim();
    if (IMAGE_URL_PATTERN.test(url) || VIDEO_URL_PATTERN.test(url)) output.add(url);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectMediaUrls(item, output));
    return output;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      if (!DEFERRED_MEDIA_KEYS.has(key)) collectMediaUrls(item, output);
    });
  }

  return output;
}

function preloadImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    const finish = () => resolve({ url, loaded: true });
    const fail = () => resolve({ url, loaded: false });

    image.decoding = "async";
    image.onload = () => {
      if (typeof image.decode !== "function") {
        finish();
        return;
      }
      image.decode().then(finish, finish);
    };
    image.onerror = fail;
    image.src = url;
  });
}

function preloadVideo(url) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;

    const finish = (loaded) => {
      if (settled) return;
      settled = true;
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("error", handleError);
      video.removeAttribute("src");
      video.load();
      resolve({ url, loaded });
    };
    const handleLoaded = () => finish(true);
    const handleError = () => finish(false);

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("loadeddata", handleLoaded, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.src = url;
    video.load();
  });
}

export async function preloadPageAssets(
  content,
  onProgress = () => {},
  { deferHeavyAssets = false } = {},
) {
  const mediaUrls = deferHeavyAssets ? new Set() : collectMediaUrls(content);
  STATIC_CRITICAL_IMAGES.forEach((url) => mediaUrls.add(url));

  const media = [...mediaUrls];
  let modelProgress = deferHeavyAssets ? 100 : 0;
  let completedMedia = 0;
  let fontsReady = false;

  const emit = () => {
    const mediaProgress = media.length ? completedMedia / media.length : 1;
    const progress =
      modelProgress * 0.86
      + mediaProgress * 100 * 0.1
      + (fontsReady ? 4 : 0);
    onProgress(Math.min(100, Math.round(progress)));
  };

  const unsubscribe = deferHeavyAssets
    ? () => {}
    : subscribePageModelProgress((progress) => {
      modelProgress = progress;
      emit();
    });

  const mediaPromise = Promise.all(
    media.map(async (url) => {
      const result = VIDEO_URL_PATTERN.test(url)
        ? await preloadVideo(url)
        : await preloadImage(url);
      completedMedia += 1;
      emit();
      return result;
    }),
  );

  const fontsPromise = (document.fonts?.ready ?? Promise.resolve()).then(() => {
    fontsReady = true;
    emit();
  });

  try {
    const [models, mediaResults] = await Promise.all([
      deferHeavyAssets ? Promise.resolve([]) : preloadPageGLTFs(),
      mediaPromise,
      fontsPromise,
    ]);
    modelProgress = 100;
    completedMedia = media.length;
    fontsReady = true;
    emit();
    return { models, media: mediaResults };
  } finally {
    unsubscribe();
  }
}
