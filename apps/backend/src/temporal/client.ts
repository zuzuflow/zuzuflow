import { Client, Connection, TLSConfig } from "@temporalio/client";
import * as fs from "fs";
import { config } from "../config";
import { logger } from "../logger";

// =============================================================================
// Temporal Client singleton
// =============================================================================

let _client: Client | null = null;

async function buildClient(): Promise<Client> {
  let tls: TLSConfig | undefined;

  if (config.TEMPORAL_TLS_CERT_PATH && config.TEMPORAL_TLS_KEY_PATH) {
    tls = {
      clientCertPair: {
        crt: fs.readFileSync(config.TEMPORAL_TLS_CERT_PATH),
        key: fs.readFileSync(config.TEMPORAL_TLS_KEY_PATH),
      },
    };
    logger.info("Temporal TLS configured");
  }

  const connection = await Connection.connect({
    address: config.TEMPORAL_ADDRESS,
    tls,
  });

  const client = new Client({
    connection,
    namespace: config.TEMPORAL_NAMESPACE,
  });

  logger.info("Temporal client connected", {
    address: config.TEMPORAL_ADDRESS,
    namespace: config.TEMPORAL_NAMESPACE,
  });

  return client;
}

/**
 * Returns the Temporal Client singleton, creating it on first call.
 * Subsequent calls return the cached instance.
 */
export async function getTemporalClient(): Promise<Client> {
  if (!_client) {
    _client = await buildClient();
  }
  return _client;
}
