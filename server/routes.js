import express from "express";
import { contentRepository } from "./contentRepository.js";
import { ValidationError } from "./contentSchema.js";
import {
  mergeApprovedReviews,
  reviewRepository,
  ReviewError,
} from "./reviewRepository.js";
import { inquiryRepository, InquiryError } from "./inquiryRepository.js";
import { saveUpload, UploadError, MAX_UPLOAD_BYTES } from "./uploads.js";
import { geocodePlace, GeocodingError } from "./geocoding.js";
import {
  requireAdmin,
  verifyPassword,
  createSessionToken,
  sessionCookie,
  clearedSessionCookie,
  isAuthenticated,
} from "./auth.js";

const REVIEW_RATE_WINDOW_MS = 60 * 60 * 1000;
const REVIEW_RATE_LIMIT = 4;
const reviewRateBuckets = new Map();
const INQUIRY_RATE_WINDOW_MS = 60 * 60 * 1000;
const INQUIRY_RATE_LIMIT = 6;
const inquiryRateBuckets = new Map();

function consumeReviewRateLimit(request) {
  const email = String(request.body?.email ?? "").trim().toLowerCase();
  const key = `${request.ip || request.socket.remoteAddress || "unknown"}:${email}`;
  const now = Date.now();
  const recent = (reviewRateBuckets.get(key) || [])
    .filter((timestamp) => now - timestamp < REVIEW_RATE_WINDOW_MS);

  if (recent.length >= REVIEW_RATE_LIMIT) return false;
  recent.push(now);
  reviewRateBuckets.set(key, recent);

  if (reviewRateBuckets.size > 1000) {
    for (const [bucketKey, timestamps] of reviewRateBuckets) {
      if (!timestamps.some((timestamp) => now - timestamp < REVIEW_RATE_WINDOW_MS)) {
        reviewRateBuckets.delete(bucketKey);
      }
    }
  }

  return true;
}

function consumeInquiryRateLimit(request) {
  const phone = String(request.body?.phone ?? "").trim();
  const key = `${request.ip || request.socket.remoteAddress || "unknown"}:${phone}`;
  const now = Date.now();
  const recent = (inquiryRateBuckets.get(key) || [])
    .filter((timestamp) => now - timestamp < INQUIRY_RATE_WINDOW_MS);

  if (recent.length >= INQUIRY_RATE_LIMIT) return false;
  recent.push(now);
  inquiryRateBuckets.set(key, recent);

  if (inquiryRateBuckets.size > 1000) {
    for (const [bucketKey, timestamps] of inquiryRateBuckets) {
      if (!timestamps.some((timestamp) => now - timestamp < INQUIRY_RATE_WINDOW_MS)) {
        inquiryRateBuckets.delete(bucketKey);
      }
    }
  }

  return true;
}

export function createApiRouter() {
  const router = express.Router();

  // ---- public read -------------------------------------------------------

  router.get("/content", async (request, response, next) => {
    try {
      const [content, reviews] = await Promise.all([
        contentRepository.getContent(),
        reviewRepository.getApproved(),
      ]);
      response.json(mergeApprovedReviews(content, reviews));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/reviews",
    express.json({ limit: "16kb" }),
    async (request, response, next) => {
      try {
        // A hidden honeypot catches basic form bots without revealing the trap.
        if (String(request.body?.website ?? "").trim()) {
          response.status(202).json({ success: true, status: "pending" });
          return;
        }

        if (!consumeReviewRateLimit(request)) {
          throw new ReviewError(
            "Too many review submissions. Please try again later.",
            429,
          );
        }

        const submitted = await reviewRepository.submit(request.body);
        response.status(201).json({ success: true, ...submitted });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/inquiries",
    express.json({ limit: "16kb" }),
    async (request, response, next) => {
      try {
        if (String(request.body?.website ?? "").trim()) {
          response.status(202).json({ success: true, status: "new" });
          return;
        }

        if (!consumeInquiryRateLimit(request)) {
          throw new InquiryError(
            "Too many project inquiries. Please try again later.",
            429,
          );
        }

        const submitted = await inquiryRepository.submit(request.body);
        response.status(201).json({ success: true, ...submitted });
      } catch (error) {
        next(error);
      }
    },
  );

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

  router.get("/admin/content", requireAdmin, async (request, response, next) => {
    try {
      response.json(await contentRepository.getContent());
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/reviews", requireAdmin, async (request, response, next) => {
    try {
      response.json({ success: true, reviews: await reviewRepository.getAll() });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/admin/reviews/:id",
    requireAdmin,
    express.json({ limit: "4kb" }),
    async (request, response, next) => {
      try {
        const review = await reviewRepository.setStatus(
          request.params.id,
          request.body?.status,
        );
        response.json({ success: true, review });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/admin/reviews/:id",
    requireAdmin,
    async (request, response, next) => {
      try {
        await reviewRepository.remove(request.params.id);
        response.json({ success: true });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/admin/inquiries", requireAdmin, async (request, response, next) => {
    try {
      response.json({ success: true, inquiries: await inquiryRepository.getAll() });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/admin/inquiries/:id",
    requireAdmin,
    express.json({ limit: "4kb" }),
    async (request, response, next) => {
      try {
        const inquiry = await inquiryRepository.setStatus(
          request.params.id,
          request.body?.status,
        );
        response.json({ success: true, inquiry });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/admin/inquiries/:id",
    requireAdmin,
    async (request, response, next) => {
      try {
        await inquiryRepository.remove(request.params.id);
        response.json({ success: true });
      } catch (error) {
        next(error);
      }
    },
  );

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

  router.post(
    "/admin/geocode",
    requireAdmin,
    express.json({ limit: "8kb" }),
    async (request, response, next) => {
      try {
        const lookup = await geocodePlace({
          query: request.body?.query,
          countryCode: request.body?.countryCode,
        });

        response.json({
          success: true,
          ...lookup,
          attribution: {
            label: "OpenStreetMap contributors",
            url: "https://www.openstreetmap.org/copyright",
          },
        });
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

    if (error instanceof GeocodingError) {
      response.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }

    if (error instanceof ReviewError) {
      response.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }

    if (error instanceof InquiryError) {
      response.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }

    if (error?.type === "entity.too.large") {
      response.status(413).json({ success: false, error: "Payload too large." });
      return;
    }

    if (error instanceof SyntaxError && error?.status === 400 && "body" in error) {
      response.status(400).json({ success: false, error: "Invalid JSON payload." });
      return;
    }

    console.error("API error:", error);
    response.status(500).json({ success: false, error: "Internal server error." });
  });

  return router;
}
