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
export const uploadAsset = (file, category = "misc") => {
  const query = new URLSearchParams({ filename: file.name, category });

  return fetch(`/api/admin/upload?${query}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  }).then(json);
};

export const uploadImage = uploadAsset;
