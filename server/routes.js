import express from "express";
import { contentRepository } from "./contentRepository.js";
import { ValidationError } from "./contentSchema.js";
import { saveUpload, UploadError, MAX_UPLOAD_BYTES } from "./uploads.js";
import {
  requireAdmin,
  verifyPassword,
  createSessionToken,
  sessionCookie,
  clearedSessionCookie,
  isAuthenticated,
} from "./auth.js";

export function createApiRouter() {
  const router = express.Router();

  // ---- public read -------------------------------------------------------

  router.get("/content", async (request, response, next) => {
    try {
      response.json(await contentRepository.getContent());
    } catch (error) {
      next(error);
    }
  });

  // ---- session -----------------------------------------------------------

  router.post("/admin/login", express.json({ limit: "8kb" }), (request, response) => {
    if (!verifyPassword(request.body?.password)) {
      response.status(401).json({ success: false, error: "Incorrect password." });
      return;
    }

    response.setHeader("Set-Cookie", sessionCookie(createSessionToken()));
    response.json({ success: true });
  });

  router.post("/admin/logout", (request, response) => {
    response.setHeader("Set-Cookie", clearedSessionCookie());
    response.json({ success: true });
  });

  router.get("/admin/session", (request, response) => {
    response.json({ authenticated: isAuthenticated(request) });
  });

  // ---- protected writes --------------------------------------------------

  router.put(
    "/admin/content",
    requireAdmin,
    express.json({ limit: "5mb" }),
    async (request, response, next) => {
      try {
        const saved = await contentRepository.updateContent(request.body);
        response.json({ success: true, content: saved });
      } catch (error) {
        next(error);
      }
    },
  );

  // Raw binary upload rather than multipart: express can parse it with no
  // extra dependency, and the browser can post a File object directly as the
  // request body. Filename and bucket ride along as query parameters.
  router.post(
    "/admin/upload",
    requireAdmin,
    express.raw({ type: "*/*", limit: MAX_UPLOAD_BYTES }),
    async (request, response, next) => {
      try {
        const result = await saveUpload({
          buffer: request.body,
          originalName: request.query.filename,
          category: request.query.category,
        });

        response.json({ success: true, ...result });
      } catch (error) {
        next(error);
      }
    },
  );

  router.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error instanceof ValidationError) {
      response.status(400).json({
        success: false,
        error: "The submitted content is not valid.",
        issues: error.issues,
      });
      return;
    }

    if (error instanceof UploadError) {
      response.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }

    if (error?.type === "entity.too.large") {
      response.status(413).json({ success: false, error: "Payload too large." });
      return;
    }

    console.error("API error:", error);
    response.status(500).json({ success: false, error: "Internal server error." });
  });

  return router;
}
