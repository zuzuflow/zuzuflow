import type { AwsBaseConfig } from "@workflow/shared";

/**
 * Shared AWS utility — builds client config from AwsBaseConfig + resolved credentials.
 * Used by all AWS activity modules to avoid duplicating credential wiring.
 */

export interface AwsClientConfig {
  region: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export function buildAwsClientConfig(
  cfg: AwsBaseConfig,
  resolvedCredentials?: { accessKeyId?: string; secretAccessKey?: string }
): AwsClientConfig {
  const result: AwsClientConfig = {
    region: cfg.region ?? "us-east-1",
  };

  if (cfg.endpoint) {
    result.endpoint = cfg.endpoint;
  }

  if (resolvedCredentials?.accessKeyId && resolvedCredentials?.secretAccessKey) {
    result.credentials = {
      accessKeyId: resolvedCredentials.accessKeyId,
      secretAccessKey: resolvedCredentials.secretAccessKey,
    };
  }

  return result;
}
