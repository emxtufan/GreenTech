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
  fetch("/api/content", { headers: { Accept: "application/json" } }).then(json);

export const saveContent = (content) =>
  fetch("/api/admin/content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  }).then(json);

/**
 * Posts the File as a raw body. Returns `{ url }` — the only thing that is ever
 * written into the content document.
 */
export const uploadImage = (file, category = "misc") => {
  const query = new URLSearchParams({ filename: file.name, category });

  return fetch(`/api/admin/upload?${query}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  }).then(json);
};
