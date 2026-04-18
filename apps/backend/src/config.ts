import "dotenv/config";
import { z } from "zod";

// =============================================================================
// Environment configuration — parsed and validated with Zod at startup.
// All missing required vars cause an immediate crash with a clear message.
// =============================================================================

const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((s) => s.split(",").map((o) => o.trim())),

  // Database
  DATABASE_URL: z.string().url(),

  // Temporal
  TEMPORAL_ADDRESS: z.string().default("localhost:7233"),
  TEMPORAL_NAMESPACE: z.string().default("default"),
  TEMPORAL_TASK_QUEUE: z.string().default("workflow-interpreter"),
  TEMPORAL_TLS_CERT_PATH: z.string().optional(),
  TEMPORAL_TLS_KEY_PATH: z.string().optional(),

  // Webhook
  WEBHOOK_SECRET: z.string().min(16),

  // Email / SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // SendGrid
  SENDGRID_API_KEY: z.string().optional(),

  // Redis
  REDIS_URL: z.string().optional(),

  // Auth
  // Master bearer token — machine-to-machine access (optional; omit if not needed).
  API_TOKEN: z.string().min(16).default("dev-api-token-change-in-production"),
  // Secret used to sign/verify JWTs issued by POST /api/auth/login.
  JWT_SECRET: z.string().min(16).default("dev-jwt-secret-change-in-production"),
  // Initial admin credentials — used to seed the first user if the DB is empty.
  INITIAL_ADMIN_USERNAME: z.string().min(1).default("admin"),
  INITIAL_ADMIN_PASSWORD: z.string().min(8).default("changeme1"),

  // Signup
  SIGNUP_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false")
    .default("true"),

  // MFA
  // 32-byte (64 hex char) key for AES-256 encryption of TOTP secrets.
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  MFA_ENCRYPTION_KEY: z
    .string()
    .length(64)
    .default(
      "0000000000000000000000000000000000000000000000000000000000000000",
    ),
  MFA_ISSUER: z.string().default("ZuzuFlow"),

  // Logging
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "❌  Invalid environment variables:\n",
      result.error.flatten().fieldErrors,
    );
    process.exit(1);
  }
  return result.data;
}

export const config = parseEnv();

export type Config = typeof config;
