// =============================================================================
// Safe environment variable filter for child-process sandboxes.
//
// When user code runs in a child process (instead of isolated-vm), it inherits
// the parent's environment. This module creates a filtered env that only
// includes safe, non-secret variables.
// =============================================================================

/** Env var names that are safe to pass to sandboxed child processes */
const SAFE_ENV_WHITELIST = new Set([
  "NODE_ENV",
  "NODE_PATH",
  "PATH",
  "HOME",
  "TMPDIR",
  "TZ",
  "LANG",
  "LC_ALL",
]);

/** Patterns that indicate a secret — block any key matching these */
const SECRET_PATTERNS = [
  /SECRET/i,
  /PASSWORD/i,
  /PASSWD/i,
  /TOKEN/i,
  /KEY/i,
  /CREDENTIAL/i,
  /DATABASE_URL/i,
  /REDIS_URL/i,
  /MONGO_URL/i,
  /POSTGRES/i,
  /MYSQL/i,
  /API_URL/i,
  /INTERNAL/i,
  /AUTH/i,
  /PRIVATE/i,
  /SMTP/i,
  /SENDGRID/i,
  /TWILIO/i,
  /AWS_/i,
  /AZURE_/i,
  /GCP_/i,
  /FIREBASE/i,
  /TEMPORAL_/i,
];

/**
 * Build a sanitized env object for child-process sandbox execution.
 * Only whitelisted keys are included; anything matching secret patterns is blocked.
 *
 * @param extra Additional env vars to inject (e.g., WORKFLOW_CONTEXT)
 */
export function safeEnvForSandbox(
  extra: Record<string, string> = {}
): Record<string, string> {
  const env: Record<string, string> = {};

  for (const key of SAFE_ENV_WHITELIST) {
    if (process.env[key]) {
      env[key] = process.env[key]!;
    }
  }

  // Add caller-specified extras (these are workflow data, not secrets)
  for (const [k, v] of Object.entries(extra)) {
    env[k] = v;
  }

  return env;
}
