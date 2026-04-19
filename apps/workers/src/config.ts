import "dotenv/config";
import { z } from "zod";

// =============================================================================
// Worker environment configuration
// =============================================================================

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Temporal
  TEMPORAL_ADDRESS: z.string().default("localhost:7233"),
  TEMPORAL_NAMESPACE: z.string().default("default"),
  TEMPORAL_TASK_QUEUE: z.string().default("workflow-interpreter"),
  // Optional comma-separated list. When set, overrides TEMPORAL_TASK_QUEUE and
  // the worker process polls all listed queues in parallel.
  // Example: "shared-free,premium-pool,org-abc123"
  TEMPORAL_TASK_QUEUES: z.string().optional(),
  TEMPORAL_TLS_CERT_PATH: z.string().optional(),
  TEMPORAL_TLS_KEY_PATH: z.string().optional(),

  // Backend internal URL (for persistence activities)
  BACKEND_INTERNAL_URL: z.string().url().default("http://localhost:3001"),

  // Database (used by postgres activity directly when no credential)
  DATABASE_URL: z.string().url().optional(),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  SENDGRID_API_KEY: z.string().optional(),

  // Logging
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "Invalid worker environment variables:\n",
      result.error.flatten().fieldErrors
    );
    process.exit(1);
  }
  return result.data;
}

export const config = parseEnv();
export type Config = typeof config;
