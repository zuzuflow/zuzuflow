import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AzureKeyVaultConfig } from "@workflow/shared";

export interface AzureKeyVaultActivityInput {
  config: AzureKeyVaultConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    vaultUrl?: string;
  };
}

export interface AzureKeyVaultActivityOutput {
  result: unknown;
  ok: boolean;
}

/**
 * Azure Key Vault secrets — getSecret / setSecret / listSecrets /
 * deleteSecret. Uses a Service Principal (tenantId + clientId +
 * clientSecret). @azure/identity + @azure/keyvault-secrets lazy-loaded.
 */
export async function azureKeyVaultActivity(
  input: AzureKeyVaultActivityInput,
): Promise<AzureKeyVaultActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const { tenantId, clientId, clientSecret, vaultUrl } =
    resolvedCredentials ?? {};
  if (!tenantId || !clientId || !clientSecret || !vaultUrl) {
    throw ApplicationFailure.create({
      message:
        "Azure Key Vault requires a Service Principal (tenantId + clientId + clientSecret) and a vaultUrl in the credential.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const { ClientSecretCredential } = await import("@azure/identity");
  const { SecretClient } = await import("@azure/keyvault-secrets");
  const client = new SecretClient(
    vaultUrl,
    new ClientSecretCredential(tenantId, clientId, clientSecret),
  );

  try {
    switch (cfg.operation) {
      case "getSecret": {
        if (!cfg.secretName) {
          throw ApplicationFailure.create({
            message: "getSecret: `secretName` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const name = interpolateTemplate(cfg.secretName, context);
        const secret = await client.getSecret(name, {
          version: cfg.secretVersion,
        });
        return {
          ok: true,
          result: {
            name: secret.name,
            value: secret.value,
            version: secret.properties.version,
            enabled: secret.properties.enabled,
            createdOn: secret.properties.createdOn?.toISOString(),
            updatedOn: secret.properties.updatedOn?.toISOString(),
          },
        };
      }

      case "setSecret": {
        if (!cfg.secretName || cfg.secretValue === undefined) {
          throw ApplicationFailure.create({
            message: "setSecret: `secretName` and `secretValue` are required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const name = interpolateTemplate(cfg.secretName, context);
        const value = interpolateTemplate(cfg.secretValue, context);
        const secret = await client.setSecret(name, value);
        return {
          ok: true,
          result: { name: secret.name, version: secret.properties.version },
        };
      }

      case "listSecrets": {
        const items: Array<{
          name: string;
          enabled?: boolean;
          updatedOn?: string;
        }> = [];
        for await (const p of client.listPropertiesOfSecrets()) {
          items.push({
            name: p.name,
            enabled: p.enabled,
            updatedOn: p.updatedOn?.toISOString(),
          });
        }
        return { ok: true, result: { items, count: items.length } };
      }

      case "deleteSecret": {
        if (!cfg.secretName) {
          throw ApplicationFailure.create({
            message: "deleteSecret: `secretName` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const name = interpolateTemplate(cfg.secretName, context);
        const poller = await client.beginDeleteSecret(name);
        await poller.pollUntilDone();
        return { ok: true, result: { deleted: true, name } };
      }

      default:
        throw ApplicationFailure.create({
          message: `Unsupported Azure Key Vault operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const status = (err as { statusCode?: number }).statusCode;
    throw ApplicationFailure.create({
      message: `Azure Key Vault ${cfg.operation} failed: ${(err as Error).message}`,
      type:
        status === 401 || status === 403
          ? "AUTH_ERROR"
          : status === 404
            ? "VALIDATION_ERROR"
            : "UPSTREAM_ERROR",
      nonRetryable: status === 401 || status === 403 || status === 404,
    });
  }
}
