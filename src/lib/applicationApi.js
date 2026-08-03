const MAX_CV_BYTES = 6 * 1024 * 1024;
const ALLOWED_CV_EXTENSIONS = [".pdf", ".doc", ".docx"];

/** Reads a File into base64 for transport; the server writes the binary. */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The CV file could not be read."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

export async function submitCareerApplication({ cvFile, ...fields }) {
  if (!cvFile) throw new Error("Please attach your CV.");

  if (cvFile.size > MAX_CV_BYTES) {
    throw new Error(
      `The CV must be smaller than ${Math.round(MAX_CV_BYTES / 1024 / 1024)} MB.`,
    );
  }

  const name = cvFile.name.toLowerCase();
  if (!ALLOWED_CV_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    throw new Error("The CV must be a PDF, DOC or DOCX file.");
  }

  const response = await fetch("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...fields,
      cvName: cvFile.name,
      cvData: await readFileAsBase64(cvFile),
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export { MAX_CV_BYTES, ALLOWED_CV_EXTENSIONS };
