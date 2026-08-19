export function collectProjectImages(projects = [], uploadedPhotos = []) {
  const seen = new Set();
  const imageGroups = [];
  const projectsById = new Map(
    projects
      .filter((project) => project?.id)
      .map((project) => [project.id, project]),
  );

  const uploadedImages = [];

  uploadedPhotos.forEach((photo, imageIndex) => {
    const src = typeof photo?.src === "string" ? photo.src.trim() : "";
    if (!src || seen.has(src)) return;

    const project = projectsById.get(photo?.projectId);
    const readableName = String(photo?.originalName || "")
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim();

    seen.add(src);
    uploadedImages.push({
      id: `upload-${photo?.id || imageIndex}`,
      src,
      alt: photo?.alt || photo?.title || project?.alt || readableName,
      projectId: project?.id || photo?.projectId || "",
      projectTitle: photo?.title || project?.title || readableName || "Greentech Professionals",
      location: photo?.location || project?.location || "",
      category: photo?.category || project?.category || "",
      caption: photo?.caption || "",
      originalName: photo?.originalName || "",
    });
  });

  if (uploadedImages.length > 0) imageGroups.push(uploadedImages);

  projects.forEach((project) => {
    const projectGroup = [];
    const projectImages = Array.isArray(project?.gallery) && project.gallery.length > 0
      ? project.gallery
      : [{ src: project?.image, alt: project?.alt }];

    projectImages.forEach((entry, imageIndex) => {
      const image = typeof entry === "string" ? { src: entry } : entry;
      const src = typeof image?.src === "string" ? image.src.trim() : "";
      if (!src || seen.has(src)) return;

      seen.add(src);
      projectGroup.push({
        id: `${project?.id || "project"}-${imageIndex}`,
        src,
        alt: typeof image?.alt === "string" && image.alt.trim()
          ? image.alt.trim()
          : `Fotografie din proiectul ${project?.title || "Greentech Professionals"}`,
        projectId: project?.id || "",
        projectTitle: project?.title || "Greentech Professionals",
        location: project?.location || "",
        category: project?.category || "",
      });
    });

    if (projectGroup.length > 0) imageGroups.push(projectGroup);
  });

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
