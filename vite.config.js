import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "node:path";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

const deferHomepageStyles = {
  name: "defer-homepage-styles",
  apply: "build",
  enforce: "post",
  transformIndexHtml(html, context) {
    if (!context.filename.endsWith("index.html")) return html;

    return html.replace(
      /<link rel="stylesheet" crossorigin href="(\/assets\/home-[^"]+\.css)">/,
      (_, href) => [
        `<link rel="stylesheet" crossorigin href="${href}" media="print" onload="this.onload=null;this.media='all'">`,
        `<noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`,
      ].join(""),
    );
  },
};

export default defineConfig({
  plugins: [tailwindcss(), deferHomepageStyles],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        home: path.resolve(rootDir, "index.html"),
        admin: path.resolve(rootDir, "admin.html"),
      },
    },
  },
});
