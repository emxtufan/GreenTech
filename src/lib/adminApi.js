// Admin-side transport. The admin UI never touches JSON files or localStorage;
// everything goes through these calls, so swapping the server's persistence
// layer for a database needs no change here.

const json = async (response) => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.issues = payload.issues;
    throw error;
  }

  return payload;
};

export const getSession = () =>
  fetch("/api/admin/session", { headers: { Accept: "application/json" } }).then(json);

export const login = (password) =>
  fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  }).then(json);

export const logout = () =>
  fetch("/api/admin/logout", { method: "POST" }).then(json);

export const getContent = () =>
  fetch("/api/admin/content", { headers: { Accept: "application/json" } }).then(json);

export const saveContent = (content) =>
  fetch("/api/admin/content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  }).then(json);

export const geocodeLocation = ({ query, countryCode }) =>
  fetch("/api/admin/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, countryCode }),
  }).then(json);

export const getCustomerReviews = () =>
  fetch("/api/admin/reviews", { headers: { Accept: "application/json" } }).then(json);

export const updateCustomerReviewStatus = (id, status) =>
  fetch(`/api/admin/reviews/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }).then(json);

export const deleteCustomerReview = (id) =>
  fetch(`/api/admin/reviews/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).then(json);

export const getProjectInquiries = () =>
  fetch("/api/admin/inquiries", { headers: { Accept: "application/json" } }).then(json);

export const updateProjectInquiryStatus = (id, status) =>
  fetch(`/api/admin/inquiries/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }).then(json);

export const deleteProjectInquiry = (id) =>
  fetch(`/api/admin/inquiries/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).then(json);

export const getCareerApplications = () =>
  fetch("/api/admin/applications", { headers: { Accept: "application/json" } }).then(json);

export const updateCareerApplicationStatus = (id, status) =>
  fetch(`/api/admin/applications/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }).then(json);

export const deleteCareerApplication = (id) =>
  fetch(`/api/admin/applications/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).then(json);

/**
 * Posts the File as a raw body. Returns `{ url }` — the only thing that is ever
 * written into the content document.
 */
export const uploadAsset = (file, category = "misc", { onProgress, signal } = {}) => {
  const query = new URLSearchParams({ filename: file.name, category });

  return new Promise((resolve, reject) => {
    // Fetch does not expose browser upload progress, so this request uses XHR.
    const request = new XMLHttpRequest();
    const totalBytes = file.size || 0;

    const abortRequest = () => request.abort();
    const cleanup = () => signal?.removeEventListener("abort", abortRequest);
    const fail = (message, status, issues) => {
      const error = new Error(message);
      error.status = status;
      error.issues = issues;
      reject(error);
    };

    request.open("POST", `/api/admin/upload?${query}`);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.setRequestHeader("Accept", "application/json");

    request.upload.addEventListener("progress", (event) => {
      const total = event.lengthComputable && event.total > 0 ? event.total : totalBytes;
      const loaded = Math.min(event.loaded, total || event.loaded);
      const percentage = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;

      onProgress?.({ loaded, total, percentage });
    });

    request.addEventListener("load", () => {
      cleanup();

      let payload = {};
      try {
        payload = request.responseText ? JSON.parse(request.responseText) : {};
      } catch {
        payload = {};
      }

      if (request.status < 200 || request.status >= 300) {
        const fallbackMessage = request.status === 413
          ? "The server rejected this file as too large. Check the Nginx client_max_body_size setting."
          : `Upload failed (${request.status || "network error"}).`;

        fail(payload.error || fallbackMessage, request.status, payload.issues);
        return;
      }

      onProgress?.({ loaded: totalBytes, total: totalBytes, percentage: 100 });
      resolve(payload);
    });

    request.addEventListener("error", () => {
      cleanup();
      fail("The upload connection was interrupted. Check the network and try again.", 0);
    });

    request.addEventListener("abort", () => {
      cleanup();
      reject(new DOMException("Upload canceled.", "AbortError"));
    });

    if (signal?.aborted) {
      reject(new DOMException("Upload canceled.", "AbortError"));
      return;
    }

    signal?.addEventListener("abort", abortRequest, { once: true });
    onProgress?.({ loaded: 0, total: totalBytes, percentage: 0 });
    request.send(file);
  });
};

const IMAGE_OPTIMISE_THRESHOLD = 7 * 1024 * 1024;
const IMAGE_TARGET_BYTES = 6 * 1024 * 1024;
const IMAGE_MAX_EDGE = 3200;

const canvasBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(
    (blob) => (blob ? resolve(blob) : reject(new Error("The browser could not optimise this image."))),
    type,
    quality,
  );
});

const decodeImage = async (file) => {
  if (typeof createImageBitmap === "function") {
    try {
      let bitmap;
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
        bitmap = await createImageBitmap(file);
      }

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Fall back to an HTML image decoder below.
    }
  }

  const url = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      image.src = url;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
};

async function optimiseLargeImage(file) {
  if (
    file.size <= IMAGE_OPTIMISE_THRESHOLD
    || file.type === "image/gif"
    || typeof document === "undefined"
  ) {
    return file;
  }

  const decoded = await decodeImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: file.type !== "image/jpeg" });

  if (!context) {
    decoded.release();
    throw new Error("This browser cannot optimise large images.");
  }

  const outputType = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
  const outputExtension = outputType === "image/jpeg" ? "jpg" : "webp";
  const stem = file.name.replace(/\.[^.]+$/, "") || "image";
  let scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(decoded.width, decoded.height));
  let quality = 0.86;
  let blob = null;

  try {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
      blob = await canvasBlob(canvas, outputType, quality);

      if (blob.size <= IMAGE_TARGET_BYTES) break;
      scale *= 0.82;
      quality = Math.max(0.66, quality - 0.05);
    }
  } finally {
    decoded.release();
    canvas.width = 1;
    canvas.height = 1;
  }

  if (!blob || blob.size >= file.size) return file;

  return new File([blob], `${stem}.${outputExtension}`, {
    type: outputType,
    lastModified: file.lastModified,
  });
}

export const uploadImage = async (file, category = "misc") => {
  const prepared = await optimiseLargeImage(file);
  const result = await uploadAsset(prepared, category);

  return {
    ...result,
    optimised: prepared !== file,
    originalBytes: file.size,
    uploadedBytes: prepared.size,
  };
};
