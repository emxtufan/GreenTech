import express from "express";
import compression from "compression";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT_DIR = fileURLToPath(new URL(".", import.meta.url));

// Keep direct `node server.js` starts consistent with the npm scripts.
// Existing OS-level variables still take precedence over values from .env.
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(path.join(ROOT_DIR, ".env"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const {
  closePersistence,
  initialisePersistence,
  persistenceDriver,
} = await import("./server/persistence.js");
await initialisePersistence();
const { SEED_UPLOADS_DIR, UPLOADS_DIR } = await import("./server/storagePaths.js");
const { createApiRouter } = await import("./server/routes.js");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
// A direct `node server.js` start is common in aaPanel. Default to the built
// production app; Vite is enabled only by the explicit development command.
const development = process.argv.includes("--development")
  || process.env.NODE_ENV === "development";
const production = !development;

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

const app = express();
let vite = null;

app.disable("x-powered-by");
app.use(compression({ threshold: 1024 }));

app.use("/api", createApiRouter());

// Customer review storage contains private moderation data. Keep only these
// files away from Vite while allowing the frontend's site-content JSON import.
app.use([
  "/data/customer-reviews.json",
  "/data/customer-reviews.backup.json",
  "/data/project-inquiries.json",
  "/data/project-inquiries.backup.json",
  "/data/career-applications.json",
  "/data/career-applications.backup.json",
  "/data/newsletter-subscribers.json",
  "/data/newsletter-subscribers.backup.json",
], (request, response) => {
  response.status(404).type("text").send("Not found");
});

// Runtime uploads are kept outside Git. Versioned seed uploads remain a
// fallback for URLs already present in the initial site content.
const uploadStaticOptions = {
  index: false,
  maxAge: production ? "30d" : 0,
  setHeaders: (response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
  },
};
app.use("/uploads", express.static(UPLOADS_DIR, uploadStaticOptions));
if (path.resolve(UPLOADS_DIR) !== path.resolve(SEED_UPLOADS_DIR)) {
  app.use("/uploads", express.static(SEED_UPLOADS_DIR, uploadStaticOptions));
}

if (production) {
  await access(path.join(DIST_DIR, "index.html")).catch(() => {
    throw new Error("Production build not found. Run `npm run build` before `npm start`.");
  });

  app.use(express.static(DIST_DIR, { index: false }));

  const sendPage = (filename) => (request, response, next) => {
    response.sendFile(path.join(DIST_DIR, filename), (error) => {
      if (error) next(error);
    });
  };

  app.get("/", sendPage("index.html"));
  app.get("/admin", sendPage("admin.html"));
  app.get("/admin/", sendPage("admin.html"));
} else {
  const { createServer: createViteServer } = await import("vite");
  vite = await createViteServer({
    root: ROOT_DIR,
    appType: "mpa",
    server: { middlewareMode: true },
  });

  const renderPage = (filename) => async (request, response, next) => {
    try {
      const source = await readFile(path.join(ROOT_DIR, filename), "utf8");
      const html = await vite.transformIndexHtml(request.originalUrl, source);
      response.status(200).type("html").send(html);
    } catch (error) {
      vite.ssrFixStacktrace(error);
      next(error);
    }
  };

  app.get("/", renderPage("index.html"));
  app.get("/admin", renderPage("admin.html"));
  app.get("/admin/", renderPage("admin.html"));
  app.use(vite.middlewares);
}

app.use((request, response) => {
  response.status(404).type("text").send("Not found");
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  console.error(error);
  response.status(500).type("text").send("Internal server error");
});

const server = createServer(app);

server.on("error", async (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the existing server or set another PORT.`);
  } else {
    console.error("Unable to start GreenTech server:", error);
  }

  await vite?.close();
  await closePersistence();
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const mode = production ? "production" : "development";
  console.log(`GreenTech server (${mode}) running at http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
  console.log(`Persistence: ${persistenceDriver()}`);
});

async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);
  server.close(async () => {
    await vite?.close();
    await closePersistence();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
