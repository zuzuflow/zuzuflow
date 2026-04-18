import "dotenv/config";
import * as http from "http";
import express from "express";
import cors from "cors";

import { config } from "./config";
import { logger } from "./logger";
import { workflowRouter } from "./routes/workflows";
import { executionRouter } from "./routes/executions";
import { webhookRouter } from "./routes/webhooks";
import { internalRouter } from "./routes/internal";
import { credentialRouter } from "./routes/credentials";
import { variableRouter } from "./routes/variables";
import { folderRouter } from "./routes/folders";
import { tagRouter } from "./routes/tags";
import { settingsRouter } from "./routes/settings";
import { gitRouter } from "./routes/git";
import { authRouter } from "./routes/auth";
import { environmentRouter } from "./routes/environments";
import { requireAuth } from "./middleware/auth";
import { requireMfaEnrollmentComplete } from "./middleware/requireMfaEnrollmentComplete";
import { resolveEnvironment } from "./middleware/resolveEnvironment";
import { attachWebSocketServer } from "./ws/executionBroadcaster";
import { userService } from "./services/UserService";
import { gitService } from "./services/GitService";

// =============================================================================
// Express application
// =============================================================================

const app: import("express").Express = express();

// Trust proxy headers (Nginx → k8s → pod) so req.ip returns the real client IP
app.set("trust proxy", true);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(
  cors({
    origin: config.CORS_ORIGINS,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Webhook-Signature",
      "X-Hub-Signature-256",
    ],
    credentials: true,
  }),
);

// Parse JSON bodies — but preserve the raw body for webhook signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Public routes — no auth required
// ---------------------------------------------------------------------------

// Auth (login / refresh) — must come before requireAuth
app.use("/api/auth", authRouter);

// Inbound webhooks are verified by HMAC, not bearer token
app.use("/api/webhooks/inbound", webhookRouter);

// Internal worker callbacks (not exposed to the internet in production)
app.use("/internal", internalRouter);

// ---------------------------------------------------------------------------
// Protected API routes — require Bearer token
// ---------------------------------------------------------------------------

app.use("/api", requireAuth);
app.use("/api", requireMfaEnrollmentComplete);

// Global routes (not environment-scoped)
app.use("/api/environments", environmentRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/git", gitRouter);

// Environment-scoped routes — require :envSlug in the URL
app.use("/api/env/:envSlug", resolveEnvironment);
app.use("/api/env/:envSlug/workflows", workflowRouter);
app.use("/api/env/:envSlug/executions", executionRouter);
app.use("/api/env/:envSlug/webhooks", webhookRouter);
app.use("/api/env/:envSlug/credentials", credentialRouter);
app.use("/api/env/:envSlug/variables", variableRouter);
app.use("/api/env/:envSlug/folders", folderRouter);
app.use("/api/env/:envSlug/tags", tagRouter);

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error("Unhandled error", { err });
    res.status(500).json({ error: "Internal server error" });
  },
);

// =============================================================================
// HTTP + WebSocket server
// =============================================================================

const server = http.createServer(app);

// Attach WebSocket server for real-time execution events
attachWebSocketServer(server);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(config.PORT, async () => {
  logger.info(`Backend listening on port ${config.PORT}`, {
    env: config.NODE_ENV,
    cors: config.CORS_ORIGINS,
  });
  // Seed initial admin user if the users table is empty
  await userService
    .ensureAdminExists()
    .catch((err) => logger.error("Failed to seed admin user", { err }));

  // Kick off the auto-pull interval. The interval no-ops whenever the git
  // config has autoPull disabled or credentials missing, so it's safe to
  // always start — no separate toggle needed at process level.
  gitService.startAutoPullInterval();
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force-kill after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app, server };
