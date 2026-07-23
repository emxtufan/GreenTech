import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "original-index.html"), "utf8");
const outputDirectory = path.join(root, "public", "original");

function extractSvg(startIndex, marker) {
  const markerIndex = source.indexOf(marker, startIndex);
  if (markerIndex < 0) return "";
  const svgStart = source.indexOf("<svg", markerIndex);
  const svgEnd = source.indexOf("</svg>", svgStart);
  if (svgStart < 0 || svgEnd < 0) return "";
  return source.slice(svgStart, svgEnd + 6);
}

function extractContainingSvg(startIndex, marker) {
  const markerIndex = source.indexOf(marker, startIndex);
  if (markerIndex < 0) return "";
  const svgStart = source.lastIndexOf("<svg", markerIndex);
  const svgEnd = source.indexOf("</svg>", markerIndex);
  if (svgStart < 0 || svgEnd < 0) return "";
  return source.slice(svgStart, svgEnd + 6);
}

await mkdir(outputDirectory, { recursive: true });

const logoStart = source.indexOf('class="Nav_logo__au6jc"');
await writeFile(
  path.join(outputDirectory, "logo-desktop.svg"),
  extractContainingSvg(logoStart, "Nav_desktop__"),
);
await writeFile(
  path.join(outputDirectory, "logo-mobile.svg"),
  extractContainingSvg(logoStart, "Nav_mobile__"),
);

for (const index of [0, 1, 4, 5]) {
  const wrapperStart = source.indexOf(`id="graph_wrapper_${index}"`);
  await writeFile(
    path.join(outputDirectory, `graph-${index}-desktop.svg`),
    extractSvg(wrapperStart, "Cards_graphDesktop__"),
  );
  await writeFile(
    path.join(outputDirectory, `graph-${index}-mobile.svg`),
    extractSvg(wrapperStart, "Cards_graphMobile__"),
  );
}
