import {
  preloadPageGLTFs,
  subscribePageModelProgress,
} from "./threeAssetCache.js";
import { collectProjectImages } from "./projectImages.js";
import {
  selectBlogPosts,
  selectClientLogos,
  selectGalleryItems,
  selectPhotoGalleryItems,
  selectTestimonials,
} from "./siteContent.js";

const IMAGE_URL_PATTERN = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

// Everything the homepage paints, so the site arrives fully loaded and fast
// scrolling never meets an empty frame. Mirrors what each section renders:
const HOMEPAGE_BLOG_POSTS = 4; // BlogSection HOMEPAGE_POST_LIMIT
const HOMEPAGE_PROJECT_CARDS = 6; // HorizontalParallaxGallery: 5 featured + archive cover
const PHOTO_STREAM_MOBILE_QUERY = 767; // PhotoGallerySection uses useIsMobile()

const STATIC_CRITICAL_IMAGES = [
  "/original/logo-preloader-480.webp",
  "/original/logo-nav-480.webp",
  "/original/LOGO-BUN-Transparent.png.webp",
  "/original/logo-alb.png.webp",
  "/original/footer-certifications.webp",
  "/gallery/solar-safety.webp",
];

function addImageUrl(output, value) {
  if (typeof value !== "string") return;
  const url = value.trim();
  if (IMAGE_URL_PATTERN.test(url)) output.add(url);
}

// The photo stream shows `cards` images per rail on two rails, the second rail
// offset by half the pool, exactly as PhotoGallerySection lays them out.
function collectPhotoStreamUrls(content, output) {
  const images = collectProjectImages(
    selectGalleryItems(content),
    selectPhotoGalleryItems(content),
  );
  if (!images.length) return;

  const mobile = window.innerWidth <= PHOTO_STREAM_MOBILE_QUERY;
  const cards = mobile
    ? Math.min(6, Math.max(4, images.length))
    : Math.min(12, Math.max(9, images.length));
  [0, Math.ceil(images.length / 2)].forEach((offset) => {
    for (let index = 0; index < cards; index += 1) {
      addImageUrl(output, images[(index + offset) % images.length]?.src);
    }
  });
}

export function collectHomepageMediaUrls(content) {
  const output = new Set(STATIC_CRITICAL_IMAGES);

  selectGalleryItems(content)
    .slice(0, HOMEPAGE_PROJECT_CARDS)
    .forEach((item) => addImageUrl(output, item.image));
  collectPhotoStreamUrls(content, output);
  selectClientLogos(content)
    .forEach((logo) => addImageUrl(output, logo.image ?? logo.src));
  selectTestimonials(content)
    .forEach((testimonial) => addImageUrl(output, testimonial.image));
  selectBlogPosts(content)
    .slice(0, HOMEPAGE_BLOG_POSTS)
    .forEach((post) => addImageUrl(output, post.image));

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

export async function preloadPageAssets(content, onProgress = () => {}) {
  const media = [...collectHomepageMediaUrls(content)];
  let modelProgress = 0;
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

  const unsubscribe = subscribePageModelProgress((progress) => {
    modelProgress = progress;
    emit();
  });

  const mediaPromise = Promise.all(
    media.map(async (url) => {
      const result = await preloadImage(url);
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
      preloadPageGLTFs(),
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
