function normaliseProjectImage(project, entry, imageIndex) {
  const image = typeof entry === "string" ? { src: entry } : entry;
  const src = typeof image?.src === "string" ? image.src.trim() : "";
  if (!src) return null;

  return {
    id: `${project?.id || "project"}-${imageIndex}`,
    src,
    alt: typeof image?.alt === "string" && image.alt.trim()
      ? image.alt.trim()
      : `Fotografie din proiectul ${project?.title || "Greentech Professionals"}`,
    projectId: project?.id || "",
    projectTitle: project?.title || "Greentech Professionals",
    location: project?.location || "",
    category: project?.category || "",
    caption: typeof image?.caption === "string" ? image.caption : "",
  };
}

function normaliseUploadedImage(photo, imageIndex, project) {
  const src = typeof photo?.src === "string" ? photo.src.trim() : "";
  if (!src) return null;

  const readableName = String(photo?.originalName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

  return {
    id: `upload-${photo?.id || imageIndex}`,
    src,
    alt: photo?.alt || photo?.title || project?.alt || readableName,
    projectId: project?.id || photo?.projectId || "",
    projectTitle: project?.title || photo?.title || readableName || "Greentech Professionals",
    location: photo?.location || project?.location || "",
    category: photo?.category || project?.category || "",
    caption: photo?.caption || "",
    originalName: photo?.originalName || "",
  };
}

/**
 * Keep the archive in the same order as the project collection. Uploaded
 * photographs linked from admin are appended to their project; unlinked
 * photographs live in one final Greentech group.
 */
export function collectProjectImageGroups(projects = [], uploadedPhotos = []) {
  const seen = new Set();
  const groups = projects.map((project) => ({
    id: project?.id || `project-${project?.order ?? 0}`,
    projectId: project?.id || "",
    title: project?.title || "Greentech Professionals",
    location: project?.location || "",
    category: project?.category || "",
    images: [],
  }));
  const projectsById = new Map(
    projects
      .filter((project) => project?.id)
      .map((project) => [project.id, project]),
  );
  const groupsByProjectId = new Map(
    groups
      .filter((group) => group.projectId)
      .map((group) => [group.projectId, group]),
  );
  const unassignedImages = [];

  projects.forEach((project) => {
    const group = groupsByProjectId.get(project?.id);
    if (!group) return;

    const projectImages = Array.isArray(project?.gallery) && project.gallery.length > 0
      ? project.gallery
      : [{ src: project?.image, alt: project?.alt }];

    projectImages.forEach((entry, imageIndex) => {
      const image = normaliseProjectImage(project, entry, imageIndex);
      if (!image || seen.has(image.src)) return;

      seen.add(image.src);
      group.images.push(image);
    });
  });

  uploadedPhotos.forEach((photo, imageIndex) => {
    const project = projectsById.get(photo?.projectId);
    const image = normaliseUploadedImage(photo, imageIndex, project);
    if (!image || seen.has(image.src)) return;

    seen.add(image.src);
    const projectGroup = groupsByProjectId.get(project?.id);
    if (projectGroup) projectGroup.images.push(image);
    else unassignedImages.push(image);
  });

  const populatedGroups = groups.filter((group) => group.images.length > 0);
  if (unassignedImages.length > 0) {
    populatedGroups.push({
      id: "greentech-general",
      projectId: "",
      title: "Greentech Professionals",
      location: "",
      category: "",
      images: unassignedImages,
    });
  }

  return populatedGroups;
}

/** The animated homepage corridor stays varied by alternating project rows. */
export function collectProjectImages(projects = [], uploadedPhotos = []) {
  const imageGroups = collectProjectImageGroups(projects, uploadedPhotos)
    .map((group) => group.images);

  const images = [];
  const longestGroup = imageGroups.reduce(
    (longest, group) => Math.max(longest, group.length),
    0,
  );

  for (let imageIndex = 0; imageIndex < longestGroup; imageIndex += 1) {
    imageGroups.forEach((group) => {
      if (group[imageIndex]) images.push(group[imageIndex]);
    });
  }

  return images;
}
